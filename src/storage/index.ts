import { WorkoutDB } from './db'
import { mergeDocuments } from './merge'
import { parseProfileDocument } from './validate'
import {
  ENTRY_TABLES, SCHEMA_VERSION,
  type EntryBase, type EntryMap, type EntryTable, type ProfileDocument, type ProfileHeader, type ProfileId,
  PROFILES,
} from './types'

export * from './types'
export { SchemaError } from './migrate'

export type NewEntry<T extends EntryBase> = Omit<T, keyof EntryBase> & Partial<EntryBase>

export interface ImportResult {
  profileId: ProfileId
}

/** The single doorway to persistence (spec: Architecture). */
export function createStorage(db: WorkoutDB = new WorkoutDB()) {
  // Table access is generic over the entry type; Dexie's per-table typing can't express that.
  const table = (t: EntryTable) => db[t] as unknown as import('dexie').Table<EntryBase & { profileId: ProfileId }, string>
  const now = () => new Date().toISOString()

  async function deviceId(): Promise<string> {
    const row = await db.meta.get('deviceId')
    if (row) return row.value
    const value = crypto.randomUUID()
    await db.meta.put({ key: 'deviceId', value })
    return value
  }

  async function loadHeader(id: ProfileId): Promise<ProfileHeader | null> {
    const row = await db.headers.get(id)
    return row ? { profile: row.profile, settings: row.settings, goal: row.goal } : null
  }

  async function saveHeader(id: ProfileId, header: ProfileHeader): Promise<void> {
    await db.headers.put({ id, schemaVersion: SCHEMA_VERSION, ...header })
  }

  async function saveEntry<K extends EntryTable>(
    t: K, profileId: ProfileId, entry: NewEntry<EntryMap[K]>,
  ): Promise<EntryMap[K]> {
    const stamp = now()
    const existing = entry.id ? await table(t).get(entry.id) : undefined
    const full = {
      ...entry,
      id: entry.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? entry.createdAt ?? stamp,
      updatedAt: stamp,
      deleted: entry.deleted ?? false,
      deviceId: await deviceId(),
    } as EntryMap[K]
    await table(t).put({ ...full, profileId })
    return full
  }

  async function listEntries<K extends EntryTable>(
    t: K, profileId: ProfileId, opts: { includeDeleted?: boolean } = {},
  ): Promise<EntryMap[K][]> {
    const rows = await table(t).where('profileId').equals(profileId).toArray()
    const out = rows
      .filter((r) => opts.includeDeleted || !r.deleted)
      .map(({ profileId: _p, ...rest }) => rest)
    return out as unknown as EntryMap[K][]
  }

  /** Soft delete: keeps the row so the delete merges like an edit. */
  async function deleteEntry(t: EntryTable, profileId: ProfileId, id: string): Promise<void> {
    const row = await table(t).get(id)
    if (!row || row.profileId !== profileId) return
    await table(t).put({ ...row, deleted: true, updatedAt: now(), deviceId: await deviceId() })
  }

  async function exportProfile(profileId: ProfileId): Promise<ProfileDocument | null> {
    const header = await loadHeader(profileId)
    if (!header) return null
    const doc: Record<string, unknown> = { schemaVersion: SCHEMA_VERSION, ...header }
    for (const t of ENTRY_TABLES) doc[t] = await listEntries(t, profileId, { includeDeleted: true })
    return doc as unknown as ProfileDocument
  }

  async function writeDocument(profileId: ProfileId, doc: ProfileDocument): Promise<void> {
    await db.transaction('rw', [db.headers, ...ENTRY_TABLES.map((t) => db[t])], async () => {
      await saveHeader(profileId, { profile: doc.profile, settings: doc.settings, goal: doc.goal })
      for (const t of ENTRY_TABLES) {
        await table(t).bulkPut((doc[t] as EntryBase[]).map((e) => ({ ...e, profileId })))
      }
    })
  }

  /** Merge a file into a profile (spec sync rule 7). Rejects a file that belongs to the other profile. */
  async function importProfile(profileId: ProfileId, text: string): Promise<ImportResult> {
    const incoming = parseProfileDocument(text)
    const expected = PROFILES.find((p) => p.id === profileId)!.name
    if (incoming.profile.name !== expected) {
      throw new Error(`This file is for ${incoming.profile.name}, but ${expected} is open.`)
    }
    const local = await exportProfile(profileId)
    await writeDocument(profileId, local ? mergeDocuments(local, incoming) : incoming)
    return { profileId }
  }

  /** Wipes one profile's data. Used by the round-trip test; not exposed in the UI. */
  async function clearProfile(profileId: ProfileId): Promise<void> {
    await db.transaction('rw', [db.headers, ...ENTRY_TABLES.map((t) => db[t])], async () => {
      await db.headers.delete(profileId)
      for (const t of ENTRY_TABLES) await table(t).where('profileId').equals(profileId).delete()
    })
  }

  async function getLastProfile(): Promise<ProfileId | null> {
    const row = await db.meta.get('lastProfile')
    return row ? (row.value as ProfileId) : null
  }
  async function setLastProfile(id: ProfileId): Promise<void> {
    await db.meta.put({ key: 'lastProfile', value: id })
  }

  return {
    loadHeader, saveHeader, saveEntry, listEntries, deleteEntry,
    exportProfile, importProfile, clearProfile, getLastProfile, setLastProfile,
  }
}

export type Storage = ReturnType<typeof createStorage>
