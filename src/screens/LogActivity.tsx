import { useState } from 'react'
import { storage } from '../storage/instance'
import type { ProfileId } from '../storage'
import { ACTIVITY_LABEL, creditedKcal, estimateKcal, type ActivityType } from '../engine/exercise'
import { todayLocal } from '../util/today'
import { Card, Field, inputCls, primaryBtn } from './ui'

const TYPES = Object.keys(ACTIVITY_LABEL) as ActivityType[]

export default function LogActivity({ profileId, weightKg, creditPct, reload, onSaved }: {
  profileId: ProfileId; weightKg: number; creditPct: number; reload: () => void; onSaved: () => void
}) {
  const [type, setType] = useState<ActivityType>('easy_walk')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(todayLocal())
  const m = Number(minutes.replace(',', '.'))
  const est = m > 0 ? estimateKcal(type, weightKg, m) : 0
  const counted = creditedKcal(est, creditPct)

  async function save() {
    if (!(m > 0)) return
    await storage.saveEntry('activities', profileId, { date, type, minutes: m, estKcal: Math.round(est), creditedKcal: Math.round(counted) })
    setMinutes(''); reload(); onSaved()
  }

  return (
    <div className="space-y-3">
      <Field label="Activity">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          {TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes"><input inputMode="decimal" className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
        <Field label="Day"><input type="date" className={inputCls} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Card>
        <p className="text-sm text-slate-400">Estimate at {weightKg} kg</p>
        <p className="text-xl font-semibold">{m > 0 ? `Burned ~${Math.round(est)}, counted ${Math.round(counted)}` : 'Enter the minutes'}</p>
        <p className="text-xs text-slate-500">Only {creditPct}% of what you burn counts toward your budget, because machines and formulas tend to overestimate.</p>
      </Card>
      <button className={primaryBtn} disabled={!(m > 0)} onClick={() => void save()}>Save activity</button>
    </div>
  )
}
