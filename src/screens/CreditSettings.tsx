import { useEffect, useState } from 'react'
import { storage } from '../storage/instance'
import type { ProfileHeader, ProfileId } from '../storage'
import { CREDIT_COPY } from './BudgetRing'
import { Card, Field, inputCls, primaryBtn } from './ui'

export default function CreditSettings({ profileId, header, reload }: { profileId: ProfileId; header: ProfileHeader; reload: () => void }) {
  const [pct, setPct] = useState(String(header.settings.exerciseCreditPct))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => setPct(String(header.settings.exerciseCreditPct)), [header.settings.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const n = Number(pct.replace(',', '.'))
    if (!(n >= 0 && n <= 100)) return setMsg({ ok: false, text: 'Enter a number from 0 to 100.' })
    await storage.saveHeader(profileId, { ...header, settings: { ...header.settings, exerciseCreditPct: n, updatedAt: new Date().toISOString() } })
    reload()
    setMsg({ ok: true, text: 'Saved.' })
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Exercise calories</h2>
      <p className="text-sm text-slate-300">{CREDIT_COPY.body}</p>
      <Field label="Share of exercise calories that counts (%)">
        <input inputMode="decimal" className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} />
      </Field>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button className={primaryBtn} onClick={() => void save()}>Save</button>
    </Card>
  )
}
