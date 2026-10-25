import { useState } from 'react'
import { storage } from '../storage/instance'
import { clearSyncToken } from '../sync'
import { syncManager } from '../sync/instance'
import { formatAgo } from '../util/ago'
import { useNow, useSyncForm, useSyncStatus } from '../useSync'
import SyncForm from './SyncForm'
import { Card, secondaryBtn } from './ui'

export default function Settings({ onBack }: { onBack: () => void }) {
  const status = useSyncStatus()
  const now = useNow()
  const [version, setVersion] = useState(0)
  const form = useSyncForm(version)

  const stateText: Record<string, string> = {
    off: 'Not set up yet.',
    idle: 'Starting…',
    syncing: 'Syncing now…',
    synced: status.pending ? 'Connected. Some changes are waiting to upload.' : 'Everything is uploaded.',
    offline: 'No connection. Changes are saved here and will upload when you are back online.',
    error: 'Something went wrong.',
    auth: 'GitHub rejected the token. Paste a new one below.',
  }

  async function removeToken() {
    await clearSyncToken(storage)
    await syncManager.syncNow(true)
    setVersion((v) => v + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 underline">Back</button>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Sync with GitHub</h2>
        <p className="text-sm text-slate-300">{stateText[status.state]}</p>
        {status.message && <p className="text-sm text-red-400">{status.message}</p>}
        {status.lastSyncAt && (
          <p className="text-xs text-slate-500">Last synced {formatAgo(status.lastSyncAt, now)}</p>
        )}
        {form && (
          <SyncForm
            key={`${form.repo}|${form.expiry}|${form.hasToken}|${version}`}
            initialRepo={form.repo} initialExpiry={form.expiry} hasToken={form.hasToken}
            onSaved={() => setVersion((v) => v + 1)}
          />
        )}
        {form?.hasToken && (
          <>
            <button className={secondaryBtn} onClick={() => void syncManager.syncNow(true)}>Sync now</button>
            <button className={secondaryBtn} onClick={removeToken}>Remove token from this device</button>
          </>
        )}
        <p className="text-xs text-slate-500">
          The token is saved on this device only. It is never exported, synced or shown again.
        </p>
      </Card>
    </div>
  )
}
