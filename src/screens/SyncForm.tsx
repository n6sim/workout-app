import { useState } from 'react'
import { storage } from '../storage/instance'
import { saveSyncConfig, DEFAULT_REPO } from '../sync'
import { syncManager } from '../sync/instance'
import { Field, inputCls, primaryBtn } from './ui'

/** Repo, token and expiry. Used by Settings, the token-expired screen and onboarding restore. */
export default function SyncForm({
  initialRepo = DEFAULT_REPO, initialExpiry = '', hasToken = false, tokenRequired = false,
  submitLabel = 'Save and sync', onSaved,
}: {
  initialRepo?: string
  initialExpiry?: string
  hasToken?: boolean
  tokenRequired?: boolean
  submitLabel?: string
  onSaved?: () => void
}) {
  const [repo, setRepo] = useState(initialRepo)
  const [token, setToken] = useState('')
  const [expiry, setExpiry] = useState(initialExpiry)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (tokenRequired && !token.trim()) {
      setError('Paste your token first.')
      return
    }
    setBusy(true)
    try {
      await saveSyncConfig(storage, { token, repo, expiry })
      await syncManager.syncNow(true)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Data repo (owner/name)">
        <input className={inputCls} autoCapitalize="none" autoCorrect="off" value={repo} onChange={(e) => setRepo(e.target.value)} />
      </Field>
      <Field label={hasToken ? 'New token (leave empty to keep the saved one)' : 'GitHub token'}>
        <input
          type="password" className={inputCls} autoComplete="off" autoCapitalize="none" autoCorrect="off"
          placeholder={hasToken ? 'Saved on this device' : 'github_pat_…'} value={token} onChange={(e) => setToken(e.target.value)}
        />
      </Field>
      <Field label="Token expiry date (so I can warn you 7 days ahead)">
        <input type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className={primaryBtn} disabled={busy} onClick={save}>{busy ? 'Syncing…' : submitLabel}</button>
    </div>
  )
}
