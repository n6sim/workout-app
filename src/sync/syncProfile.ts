import { mergeDocuments, PROFILES, type EntryBase, type ProfileDocument, type ProfileId, type Storage } from '../storage'
import { ENTRY_TABLES } from '../storage'
import { ConflictError, RemoteError, type RemoteStore } from './types'

const MAX_TRIES = 3

/** Key order and list order do not matter to the merge, so compare in a canonical form. */
function canonical(doc: ProfileDocument): string {
  const sorted: Record<string, unknown> = { schemaVersion: doc.schemaVersion, profile: doc.profile, settings: doc.settings, goal: doc.goal }
  for (const t of ENTRY_TABLES) sorted[t] = [...(doc[t] as EntryBase[])].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify(sorted, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

export const sameDocument = (a: ProfileDocument, b: ProfileDocument) => canonical(a) === canonical(b)

/** One full sync of a profile (spec: Sync rules 1 to 3).
 *  Pull, merge with the local copy, store the merge locally, push if the remote is behind.
 *  On a version conflict, start again, up to 3 tries. */
export async function syncProfile(storage: Storage, remote: RemoteStore, profileId: ProfileId): Promise<void> {
  const expectedName = PROFILES.find((p) => p.id === profileId)!.name

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const dirtyAtStart = await storage.getDirty(profileId)
    const { doc: theirs, version } = await remote.fetch(profileId)
    if (theirs && theirs.profile.name !== expectedName) {
      throw new RemoteError(`${profileId}.json in the repo belongs to ${theirs.profile.name}, not ${expectedName}.`)
    }
    const mine = await storage.exportProfile(profileId)

    const merged = theirs && mine ? mergeDocuments(mine, theirs) : (theirs ?? mine)
    if (!merged) return // nothing here and nothing there

    if (!mine || !sameDocument(merged, mine)) await storage.applyRemote(profileId, merged)

    if (!theirs || !sameDocument(merged, theirs)) {
      try {
        await remote.put(profileId, merged, version)
      } catch (e) {
        if (e instanceof ConflictError && attempt < MAX_TRIES) continue
        throw e
      }
    }
    await storage.clearDirty(profileId, dirtyAtStart)
    return
  }
}
