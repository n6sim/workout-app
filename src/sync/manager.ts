import type { ProfileId, Storage } from '../storage'
import { loadSyncConfig, type SyncConfig } from './config'
import { GitHubSync } from './github'
import { syncProfile } from './syncProfile'
import { AuthError, ConflictError, NetworkError, RemoteError, type RemoteStore, type SyncStatus } from './types'

export interface ManagerOptions {
  /** Wait this long after a local change before pushing (spec: 5 seconds). */
  debounceMs?: number
  /** Pull this often while the app is open (spec: 5 minutes). */
  pollMs?: number
  makeRemote?: (cfg: SyncConfig) => RemoteStore
  isOnline?: () => boolean
  now?: () => number
}

/** Runs sync for the open profile: on open, every 5 minutes, 5 seconds after a change, and on reconnect.
 *  Logging never waits for this; it only reads and writes through storage. */
export class SyncManager {
  private profileId: ProfileId | null = null
  private status: SyncStatus = { state: 'off', lastSyncAt: null, pending: false, message: null }
  private listeners = new Set<() => void>()
  private cleanup: (() => void)[] = []
  private current: Promise<void> | null = null
  private rerun = false
  private rerunForce = false
  private debounce: ReturnType<typeof setTimeout> | undefined
  private authFailedToken: string | null = null

  private debounceMs: number
  private pollMs: number
  private makeRemote: (cfg: SyncConfig) => RemoteStore
  private isOnline: () => boolean
  private now: () => number

  constructor(private storage: Storage, opts: ManagerOptions = {}) {
    this.debounceMs = opts.debounceMs ?? 5000
    this.pollMs = opts.pollMs ?? 5 * 60_000
    this.makeRemote = opts.makeRemote ?? ((c) => new GitHubSync({ owner: c.owner, repo: c.repo, token: c.token }))
    this.isOnline = opts.isOnline ?? (() => (typeof navigator === 'undefined' || navigator.onLine !== false))
    this.now = opts.now ?? (() => Date.now())
  }

  // React hooks (useSyncExternalStore)
  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getStatus = () => this.status

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((cb) => cb())
  }

  async start(profileId: ProfileId): Promise<void> {
    this.stop()
    this.profileId = profileId
    const lastSyncAt = await this.storage.getMeta(`lastSync:${profileId}`)
    this.set({ state: 'idle', lastSyncAt, pending: !!(await this.storage.getDirty(profileId)), message: null })

    this.cleanup.push(
      this.storage.onChange((e) => {
        if (e.profileId !== profileId || e.source !== 'local') return
        this.set({ pending: true })
        clearTimeout(this.debounce)
        this.debounce = setTimeout(() => void this.syncNow(), this.debounceMs)
      }),
    )
    const poll = setInterval(() => void this.syncNow(), this.pollMs)
    this.cleanup.push(() => clearInterval(poll))
    if (typeof window !== 'undefined') {
      const wake = () => void this.syncNow()
      window.addEventListener('online', wake)
      this.cleanup.push(() => window.removeEventListener('online', wake))
      const visible = () => document.visibilityState === 'visible' && wake()
      document.addEventListener('visibilitychange', visible)
      this.cleanup.push(() => document.removeEventListener('visibilitychange', visible))
    }
    await this.syncNow()
  }

  stop(): void {
    this.cleanup.forEach((fn) => fn())
    this.cleanup = []
    clearTimeout(this.debounce)
    this.profileId = null
  }

  /** `force` retries even after an auth failure (the user pasted a new token).
   *  If a sync is already running, a fresh one is queued behind it and the returned promise covers both. */
  syncNow(force = false): Promise<void> {
    const profileId = this.profileId
    if (!profileId) return Promise.resolve()
    if (this.current) {
      this.rerun = true
      this.rerunForce ||= force
      return this.current
    }
    const run = (async () => {
      let f = force
      do {
        this.rerun = false
        await this.runOnce(profileId, f)
        f = this.rerunForce
        this.rerunForce = false
      } while (this.rerun && this.profileId === profileId)
    })().finally(() => {
      this.current = null
    })
    this.current = run
    return run
  }

  private async runOnce(profileId: ProfileId, force: boolean): Promise<void> {
    const cfg = await loadSyncConfig(this.storage)
    const pending = !!(await this.storage.getDirty(profileId))
    if (!cfg) {
      this.set({ state: 'off', pending, message: null })
      return
    }
    // After a 401, do not hammer GitHub with the same bad token.
    if (!force && this.authFailedToken === cfg.token) return
    if (!this.isOnline()) {
      this.set({ state: 'offline', pending, message: null })
      return
    }

    this.set({ state: 'syncing', pending })
    try {
      await syncProfile(this.storage, this.makeRemote(cfg), profileId)
      const lastSyncAt = new Date(this.now()).toISOString()
      await this.storage.setMeta(`lastSync:${profileId}`, lastSyncAt)
      this.authFailedToken = null
      this.set({ state: 'synced', lastSyncAt, pending: !!(await this.storage.getDirty(profileId)), message: null })
    } catch (e) {
      const pendingNow = !!(await this.storage.getDirty(profileId))
      if (e instanceof AuthError) {
        this.authFailedToken = cfg.token
        this.set({ state: 'auth', pending: pendingNow, message: null })
      } else if (e instanceof NetworkError) {
        this.set({ state: 'offline', pending: pendingNow, message: null })
      } else if (e instanceof ConflictError || e instanceof RemoteError) {
        this.set({ state: 'error', pending: pendingNow, message: scrub(e.message, cfg.token) })
      } else {
        this.set({ state: 'error', pending: pendingNow, message: 'Sync failed. It will try again.' })
      }
    }
  }
}

/** Belt and braces: an error message must never carry the token. */
function scrub(message: string, token: string): string {
  return token ? message.split(token).join('***') : message
}
