import { expiryInfo, isStale } from '../sync'
import { formatAgo } from '../util/ago'
import { todayLocal } from '../util/today'
import { useNow, useSyncForm, useSyncStatus } from '../useSync'

/** Slim bar on every screen: profile name, sync status, and any token or staleness warning. */
export default function SyncHeader({ name, onOpenSettings }: { name: string; onOpenSettings: () => void }) {
  const status = useSyncStatus()
  const form = useSyncForm()
  const now = useNow()

  let label = ''
  let tone = 'text-slate-400'
  switch (status.state) {
    case 'off': label = 'Not backed up. Tap to set up'; tone = 'text-amber-300'; break
    case 'idle':
    case 'syncing': label = 'Syncing…'; break
    case 'synced':
      label = status.pending ? 'Changes waiting to sync' : `Synced ${formatAgo(status.lastSyncAt ?? new Date(now).toISOString(), now)}`
      tone = status.pending ? 'text-amber-300' : 'text-emerald-400'
      break
    case 'offline': label = 'Offline, will sync'; tone = 'text-amber-300'; break
    case 'error': label = 'Sync error'; tone = 'text-red-400'; break
    case 'auth': label = 'Token needs replacing'; tone = 'text-red-400'; break
  }

  const expiry = form?.hasToken ? expiryInfo(form.expiry || null, todayLocal()) : { kind: 'none' as const }
  const stale = form?.hasToken && isStale(status.lastSyncAt, now)
  const warnings: string[] = []
  if (expiry.kind === 'soon') {
    warnings.push(`Your GitHub token expires in ${expiry.daysLeft} day${expiry.daysLeft === 1 ? '' : 's'}. Make a new one and paste it in Settings.`)
  }
  if (expiry.kind === 'expired') warnings.push('The expiry date you entered for your GitHub token has passed. Paste a new token in Settings.')
  if (stale) warnings.push("This device hasn't synced in over 3 days. Open Settings to check why.")

  return (
    <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2 text-xs">
        <span className="font-medium text-slate-300">{name}</span>
        <button onClick={onOpenSettings} className={tone} aria-label="Sync status">{label}</button>
      </div>
      {warnings.map((w) => (
        <button key={w} onClick={onOpenSettings} className="block w-full bg-amber-900/50 px-4 py-2 text-left text-xs text-amber-100">
          {w}
        </button>
      ))}
    </div>
  )
}
