import { useSyncForm } from '../useSync'
import SyncForm from './SyncForm'
import { Card, secondaryBtn } from './ui'

/** Shown when GitHub answers 401 (spec sync rule 6). Logging still works; this only fixes sync. */
export default function TokenScreen({ onDismiss }: { onDismiss: () => void }) {
  const form = useSyncForm()
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Token expired, paste a new one</h1>
        <p className="text-sm text-slate-300">
          GitHub did not accept the saved token, so your changes are not syncing. Nothing is lost: everything is still
          on this device and will upload once the token works.
        </p>
        <Card className="space-y-2 text-sm text-slate-300">
          <p className="font-medium">To make a new one</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>On github.com: Settings, Developer settings, Fine-grained tokens, Generate new token.</li>
            <li>Repository access: only your data repo. Permission: Contents, read and write.</li>
            <li>Copy the token and paste it below, with its expiry date.</li>
          </ol>
        </Card>
        {form && (
          <SyncForm
            key={form.repo} initialRepo={form.repo} initialExpiry={form.expiry} hasToken={form.hasToken}
            tokenRequired submitLabel="Save token and sync"
          />
        )}
        <button className={secondaryBtn} onClick={onDismiss}>Not now, keep using the app</button>
      </div>
    </div>
  )
}
