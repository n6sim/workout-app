import type { ProfileDocument, ProfileId } from '../storage'

export interface RemoteFile {
  /** Null when the remote has no file for this profile yet. */
  doc: ProfileDocument | null
  /** Opaque version token for optimistic concurrency (GitHub: the file sha). */
  version: string | null
}

/** What the sync engine needs from a backend. GitHubSync is the only implementation in v1;
 *  a Supabase backend would be one more class implementing this. */
export interface RemoteStore {
  fetch(profileId: ProfileId): Promise<RemoteFile>
  /** Writes the document. Throws ConflictError if `version` is stale. Returns the new version. */
  put(profileId: ProfileId, doc: ProfileDocument, version: string | null): Promise<string>
}

/** 401: the token is wrong or expired. */
export class AuthError extends Error {}
/** 409 or a sha mismatch: someone else wrote first. Pull, merge and retry. */
export class ConflictError extends Error {}
/** The request never reached GitHub (offline, DNS, blocked). */
export class NetworkError extends Error {}
/** Anything else GitHub refused (missing repo, no permission, rate limit, bad file). */
export class RemoteError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'auth'

export interface SyncStatus {
  state: SyncState
  /** ISO time of the last successful sync on this device, or null. */
  lastSyncAt: string | null
  /** True when local changes have not been pushed yet. */
  pending: boolean
  /** Plain-language reason when state is 'error'. Never contains the token. */
  message: string | null
}
