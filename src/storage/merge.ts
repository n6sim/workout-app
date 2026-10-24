import { ENTRY_TABLES, type EntryBase, type ProfileDocument, type Stamped } from './types'

/** Union by id; when an id is in both, the later updatedAt wins. A tie keeps the local copy.
 *  Shared by Import now and by sync in M2. */
export function mergeEntries<T extends EntryBase>(local: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>()
  for (const e of local) byId.set(e.id, e)
  for (const e of incoming) {
    const existing = byId.get(e.id)
    if (!existing || e.updatedAt > existing.updatedAt) byId.set(e.id, e)
  }
  return [...byId.values()]
}

export function mergeStamped<T>(local: Stamped<T>, incoming: Stamped<T>): Stamped<T> {
  return incoming.updatedAt > local.updatedAt ? incoming : local
}

export function mergeDocuments(local: ProfileDocument, incoming: ProfileDocument): ProfileDocument {
  const merged = {
    schemaVersion: local.schemaVersion,
    profile: mergeStamped(local.profile, incoming.profile),
    settings: mergeStamped(local.settings, incoming.settings),
    goal: mergeStamped(local.goal, incoming.goal),
  } as ProfileDocument
  for (const t of ENTRY_TABLES) {
    ;(merged as unknown as Record<string, unknown>)[t] = mergeEntries(
      local[t] as EntryBase[],
      incoming[t] as EntryBase[],
    )
  }
  return merged
}
