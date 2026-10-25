import { useEffect, useState } from 'react'
import { storage } from '../storage/instance'
import type { ProfileHeader, ProfileId } from '../storage'
import { ALL_EQUIPMENT } from '../engine/training/types'
import { Card, Field, inputCls, primaryBtn } from './ui'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LENGTHS = [30, 45, 60, 75]
const EQUIPMENT_LABEL: Record<string, string> = {
  dumbbell: 'Dumbbells', 'body only': 'Body weight', treadmill: 'Treadmill', 'standing bike': 'Standing bike', 'step platform': 'Step platform',
}

export default function TrainingSettings({ profileId, header, reload }: { profileId: ProfileId; header: ProfileHeader; reload: () => void }) {
  const s = header.settings
  const [days, setDays] = useState<number[]>(s.trainingDays)
  const [length, setLength] = useState(s.sessionLengthMin)
  const [equipment, setEquipment] = useState<string[]>(s.equipment)
  const [dumbbells, setDumbbells] = useState(s.dumbbellsKg.join(', '))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Pick up changes that arrive from another device (sync) without wiping the "Saved" message.
  useEffect(() => {
    setDays(s.trainingDays)
    setLength(s.sessionLengthMin)
    setEquipment(s.equipment)
    setDumbbells(s.dumbbellsKg.join(', '))
  }, [s.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function save() {
    if (days.length < 3 || days.length > 5) return setMessage({ ok: false, text: 'Pick 3, 4 or 5 training days.' })
    if (equipment.length === 0) return setMessage({ ok: false, text: 'Pick at least one kind of equipment.' })
    const dumbbellsKg = [...new Set(dumbbells.split(/[,\s]+/).map(parseFloat).filter((n) => n > 0))].sort((a, b) => a - b)
    await storage.saveHeader(profileId, {
      ...header,
      settings: { ...s, trainingDays: [...days].sort(), sessionLengthMin: length, equipment, dumbbellsKg, updatedAt: new Date().toISOString() },
    })
    reload()
    setMessage({ ok: true, text: 'Saved. Today and Week use the new plan.' })
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Training</h2>
      <Field group id="s-days" label="Training days (pick 3, 4 or 5)">
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => setDays((c) => toggle(c, i))}
              className={`rounded-lg py-3 text-xs ${days.includes(i) ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{d}</button>
          ))}
        </div>
      </Field>
      <Field group label="Session length">
        <div className="grid grid-cols-4 gap-1">
          {LENGTHS.map((m) => (
            <button key={m} type="button" aria-pressed={length === m} onClick={() => setLength(m)}
              className={`rounded-lg py-3 text-sm ${length === m ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{m} min</button>
          ))}
        </div>
      </Field>
      <Field group label="Equipment you have">
        <div className="flex flex-wrap gap-2">
          {ALL_EQUIPMENT.map((e) => (
            <button key={e} type="button" aria-pressed={equipment.includes(e)} onClick={() => setEquipment((c) => toggle(c, e))}
              className={`rounded-full px-3 py-2 text-sm ${equipment.includes(e) ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{EQUIPMENT_LABEL[e]}</button>
          ))}
        </div>
      </Field>
      <Field label="Dumbbell weights you own, kg (commas)">
        <input className={inputCls} placeholder="e.g. 4, 6, 8" value={dumbbells} onChange={(e) => setDumbbells(e.target.value)} />
      </Field>
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
      <button className={primaryBtn} onClick={() => void save()}>Save training settings</button>
    </Card>
  )
}
