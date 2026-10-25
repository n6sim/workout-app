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
export { mergeDocuments } from './merge'
export { parseProfileDocument } from './validate'

/** `local` = the user changed something here (needs syncing). `remote` = we applied a pulled copy. */
export interface ChangeEvent {
  profileId: ProfileId
  source: 'local' | 'remote'
}

export type NewEntry<T extends EntryBase> = Omit<T, keyof EntryBase> & Partial<EntryBase>

export interface ImportResult {
  profileId: ProfileId
}

/** The single doorway to persistence (spec: Architecture). */
export function createStorage(db: WorkoutDB = new WorkoutDB()) {
  // Table access is generic over the entry type; Dexie's per-table typing can't express that.
  const table = (t: EntryTable) => db[t] as unknown as import('dexie').Table<EntryBase & { profileId: ProfileId }, string>
  const now = () => new Date().toISOString()

  const listeners = new Set<(e: ChangeEvent) => void>()
  const emit = (profileId: ProfileId, source: ChangeEvent['source']) => listeners.forEach((cb) => cb({ profileId, source }))
  function onChange(cb: (e: ChangeEvent) => void): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  // Device-local key/value store (sync token, expiry, last-sync time, dirty flag).
  // Never part of a profile document, so it can never reach an export or the synced file.
  async function getMeta(key: string): Promise<string | null> {
    return (await db.meta.get(key))?.value ?? null
  }
  async function setMeta(key: string, value: string): Promise<void> {
    await db.meta.put({ key, value })
  }
  async function deleteMeta(key: string): Promise<void> {
    await db.meta.delete(key)
  }

  /** Records that this device has changes the remote copy has not seen. */
  async function markDirty(profileId: ProfileId): Promise<string> {
    const value = now()
    await setMeta(`dirty:${profileId}`, value)
    return value
  }
  const getDirty = (profileId: ProfileId) => getMeta(`dirty:${profileId}`)
  /** Clears the flag only if nothing changed since `seen`, so a change made during a push is not lost. */
  async function clearDirty(profileId: ProfileId, seen: string | null): Promise<void> {
    if ((await getDirty(profileId)) === seen) await deleteMeta(`dirty:${profileId}`)
  }

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

  const putHeader = (id: ProfileId, header: ProfileHeader) =>
    db.headers.put({ id, schemaVersion: SCHEMA_VERSION, ...header })

  async function saveHeader(id: ProfileId, header: ProfileHeader): Promise<void> {
    await putHeader(id, header)
    await markDirty(id)
    emit(id, 'local')
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
    await markDirty(profileId)
    emit(profileId, 'local')
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
    await markDirty(profileId)
    emit(profileId, 'local')
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
      await putHeader(profileId, { profile: doc.profile, settings: doc.settings, goal: doc.goal })
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
    await markDirty(profileId)
    emit(profileId, 'local')
    return { profileId }
  }

  /** Stores a copy merged from the remote. Not a user change, so it does not mark the profile dirty. */
  async function applyRemote(profileId: ProfileId, doc: ProfileDocument): Promise<void> {
    await writeDocument(profileId, doc)
    emit(profileId, 'remote')
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
    exportProfile, importProfile, applyRemote, clearProfile, getLastProfile, setLastProfile,
    onChange, getMeta, setMeta, deleteMeta, getDirty, clearDirty,
  }
}

export type Storage = ReturnType<typeof createStorage>
