import { useState } from 'react'
import type { TodayBudget } from '../engine/budget'

/** The copy from the spec, word for word. */
export const CREDIT_COPY = {
  title: 'Why only half your exercise counts',
  body: "Treadmills, bikes, and calorie formulas often overestimate what you burn by 20 to 50%. If we added every exercise calorie back to your budget, your deficit would quietly disappear. So we credit 50% of exercise calories to today's budget. You can change this in Settings, but 50% is the honest default.",
}

export default function BudgetRing({ b, target, creditPct }: { b: TodayBudget; target: number; creditPct: number }) {
  const [open, setOpen] = useState(false)
  const R = 52
  const C = 2 * Math.PI * R
  const frac = b.budget > 0 ? Math.min(1, b.eatenToday / b.budget) : 0
  const over = b.remaining < 0
  return (
    <div className="rounded-2xl bg-slate-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-400">Today's budget{b.isFlexToday ? ' (flex day, +400)' : ''}</p>
        <button aria-label="How the budget works" onClick={() => setOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-sm">ⓘ</button>
      </div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label={`${Math.abs(b.remaining)} kcal ${over ? 'over' : 'left'}`}>
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-slate-700" />
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            className={over ? 'stroke-red-400' : 'stroke-sky-400'} />
        </svg>
        <div>
          <p className="text-4xl font-semibold tabular-nums">{Math.abs(b.remaining)}</p>
          <p className="text-sm text-slate-400">kcal {over ? 'over' : 'left'}</p>
          <p className="mt-2 text-xs text-slate-500">{b.eatenToday} eaten of {b.budget}</p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[80%] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">{CREDIT_COPY.title}</h2>
            <p className="text-sm text-slate-300">{CREDIT_COPY.body}</p>
            {creditPct !== 50 && <p className="text-sm text-amber-200">Your setting is currently {creditPct}%.</p>}
            <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
              <p className="mb-1 font-medium text-slate-100">How today's number is worked out</p>
              <p>Daily target {target} x 7 + {b.weekCredited} counted exercise = {b.weeklyBudget} for the week.</p>
              <p>Counted so far before today: {b.countedBefore} (days you did not log count as on target).</p>
              <p>{b.weeklyBudget} - {b.countedBefore} = {b.weeklyBudget - b.countedBefore}, over {b.daysLeft} day{b.daysLeft === 1 ? '' : 's'} left, kept within 20% of your target.</p>
            </div>
            <button className="w-full rounded-xl bg-slate-800 py-3" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
