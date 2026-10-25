import { useEffect, useState, useSyncExternalStore } from 'react'
import { syncManager } from './sync/instance'
import { loadSyncForm } from './sync'
import { storage } from './storage/instance'

export function useSyncStatus() {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getStatus)
}

/** Saved repo, expiry and whether a token exists. Reloads when `version` changes or sync state changes. */
export function useSyncForm(version = 0) {
  const status = useSyncStatus()
  const [form, setForm] = useState<{ repo: string; expiry: string; hasToken: boolean } | null>(null)
  useEffect(() => {
    void loadSyncForm(storage).then(setForm)
  }, [version, status.state])
  return form
}

/** Re-renders every `ms` so "2 min ago" stays fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
