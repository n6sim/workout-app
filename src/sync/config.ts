import { daysBetween } from '../engine/dates'
import type { Storage } from '../storage'

export const DEFAULT_REPO = 'n6sim/workout-data'

/** Saved per device in local meta. Never part of a profile document, so never exported or synced. */
export interface SyncConfig {
  token: string
  owner: string
  repo: string
  /** Token expiry date the user typed in, 'YYYY-MM-DD', or null. */
  expiry: string | null
}

const KEYS = { token: 'sync.token', repo: 'sync.repo', expiry: 'sync.expiry' }

export function parseRepo(text: string): { owner: string; repo: string } | null {
  const m = /^\s*([\w.-]+)\/([\w.-]+)\s*$/.exec(text)
  return m ? { owner: m[1], repo: m[2] } : null
}

export async function loadSyncConfig(storage: Storage): Promise<SyncConfig | null> {
  const token = await storage.getMeta(KEYS.token)
  if (!token) return null
  const { owner, repo } = parseRepo((await storage.getMeta(KEYS.repo)) ?? DEFAULT_REPO) ?? parseRepo(DEFAULT_REPO)!
  return { token, owner, repo, expiry: (await storage.getMeta(KEYS.expiry)) || null }
}

/** Repo text and expiry are kept even with no token, so Settings can show them. */
export async function loadSyncForm(storage: Storage) {
  return {
    repo: (await storage.getMeta(KEYS.repo)) ?? DEFAULT_REPO,
    expiry: (await storage.getMeta(KEYS.expiry)) ?? '',
    hasToken: !!(await storage.getMeta(KEYS.token)),
  }
}

export async function saveSyncConfig(
  storage: Storage, input: { token?: string; repo: string; expiry: string },
): Promise<void> {
  if (!parseRepo(input.repo)) throw new Error('Repo should look like owner/name, for example n6sim/workout-data.')
  await storage.setMeta(KEYS.repo, input.repo.trim())
  if (input.expiry) await storage.setMeta(KEYS.expiry, input.expiry)
  else await storage.deleteMeta(KEYS.expiry)
  if (input.token?.trim()) await storage.setMeta(KEYS.token, input.token.trim())
}

export async function clearSyncToken(storage: Storage): Promise<void> {
  await storage.deleteMeta(KEYS.token)
}

export type ExpiryInfo =
  | { kind: 'none' }
  | { kind: 'ok'; daysLeft: number }
  | { kind: 'soon'; daysLeft: number }
  | { kind: 'expired' }

/** Warn 7 days ahead (spec sync rule 6). `today` is 'YYYY-MM-DD'. */
export function expiryInfo(expiry: string | null, today: string): ExpiryInfo {
  if (!expiry) return { kind: 'none' }
  const daysLeft = daysBetween(today, expiry)
  if (daysLeft < 0) return { kind: 'expired' }
  return daysLeft <= 7 ? { kind: 'soon', daysLeft } : { kind: 'ok', daysLeft }
}

export const STALE_AFTER_MS = 3 * 86_400_000

/** True when this device has not synced in 3 days (spec sync rule 5). */
export function isStale(lastSyncAt: string | null, nowMs: number): boolean {
  return lastSyncAt !== null && nowMs - Date.parse(lastSyncAt) > STALE_AFTER_MS
}
