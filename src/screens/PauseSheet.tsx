import { useState } from 'react'
import type { ProfileId } from '../storage'
import type { PauseReason } from '../engine/pause'
import { startPause } from '../domain/coachActions'
import { todayLocal } from '../util/today'
import { Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const REASONS: [PauseReason, string][] = [['holiday', 'Holiday'], ['sick', 'Sick'], ['busy', 'Busy']]

/** Start a pause: a reason, an optional end date and an optional note (spec: Pause mode). */
export default function PauseSheet({ profileId, onClose, onStarted }: { profileId: ProfileId; onClose: () => void; onStarted: () => void }) {
  const today = todayLocal()
  const [reason, setReason] = useState<PauseReason>('holiday')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function go() {
    if (endDate && endDate < today) return setError('The end date cannot be in the past.')
    await startPause(profileId, { today, reason, endDate: endDate || null, note })
    onStarted()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      <div className="mx-auto max-h-[90%] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Pause</h2>
        <p className="text-sm text-slate-300">
          While paused there is no workout plan and no calorie target, and nothing you eat is judged. Paused days are left out of your trend,
          your maintenance estimate and the 12-week count, and you can still log whatever you like.
        </p>
        <Field group label="Why">
          <div className="grid grid-cols-3 gap-1">
            {REASONS.map(([r, label]) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
                className={`rounded-lg py-3 text-sm ${reason === r ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{label}</button>
            ))}
          </div>
        </Field>
        <Field label="Last paused day (optional)">
          <input type="date" className={inputCls} value={endDate} min={today} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className={primaryBtn} onClick={() => void go()}>Start pause</button>
        <button className={secondaryBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
