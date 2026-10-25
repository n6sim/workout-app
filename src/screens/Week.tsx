import { useMemo } from 'react'
import { planWeek, DAY_TITLE, SUPPORTED_TRAINING_DAYS, weekStart } from '../engine/training/week'
import type { ProfileHeader, ProfileId } from '../storage'
import { setFlexDay } from '../domain/day'
import { todayInfo } from '../domain/todayInfo'
import type { ProfileData } from '../useProfileData'
import { formatDate, todayLocal } from '../util/today'
import { Card, primaryBtn, secondaryBtn } from './ui'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Week({ profileId, header, data, reload, onOpenSettings }: {
  profileId: ProfileId; header: ProfileHeader; data: ProfileData; reload: () => void; onOpenSettings: () => void
}) {
  const today = todayLocal()
  const { sessions } = data
  const days = header.settings.trainingDays
  const supported = (SUPPORTED_TRAINING_DAYS as readonly number[]).includes(new Set(days).size)
  const info = useMemo(
    () => todayInfo({ profileId, header, weighIns: data.weighIns, phases: data.phases, meals: data.meals, activities: data.activities, events: data.events, today }),
    [profileId, header, data, today],
  )

  if (!supported) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Week</h1>
        <Card className="space-y-3">
          <p className="text-sm text-slate-300">The weekly plan needs 3, 4 or 5 training days.</p>
          <button className={primaryBtn} onClick={onOpenSettings}>Open settings</button>
        </Card>
      </div>
    )
  }

  const startDate = header.goal.startDate
  const week = planWeek(days, weekStart(today))
  // Days before you started the plan are not "missed"; they simply were not part of it.
  const planned = week.filter((d) => d.kind !== 'rest' && d.date >= startDate)
  const statusOf = (date: string) => {
    const list = sessions.filter((s) => s.date === date)
    if (list.some((s) => s.status === 'done')) return 'done'
    if (list.some((s) => s.status === 'partial')) return 'partial'
    return null
  }
  const doneCount = planned.filter((d) => statusOf(d.date) === 'done').length
  const b = info.budget
  const counted = b ? b.countedBefore + b.eatenToday : 0

  async function toggleFlex(date: string) {
    await setFlexDay(profileId, date, info.flexDate === date ? null : date)
    reload()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Week</h1>
        <p className="text-sm text-slate-400">{doneCount} of {planned.length} planned sessions done</p>
      </div>

      {b && (
        <Card className="space-y-1">
          <p className="text-sm text-slate-400">Calories this week</p>
          <p className="text-2xl font-semibold tabular-nums">{b.weeklyBudget - counted} <span className="text-base font-normal text-slate-400">kcal left</span></p>
          <p className="text-xs text-slate-500">
            Budget {b.weeklyBudget} (7 days of your target + {b.weekCredited} from exercise). Counted so far {counted}. Days you did not log count as on target.
          </p>
        </Card>
      )}

      <ul className="space-y-2">
        {week.map((d) => {
          const st = statusOf(d.date)
          const isToday = d.date === today
          const before = d.date < startDate
          const isStart = d.date === startDate
          const isFlex = info.flexDate === d.date
          return (
            <li key={d.date} className={`rounded-2xl p-4 ${isToday ? 'bg-sky-900/40 ring-1 ring-sky-500' : 'bg-slate-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{WEEKDAYS[d.weekday]} <span className="text-sm text-slate-400">{formatDate(d.date)}</span>
                    {isStart && <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">Day 1</span>}
                    {isFlex && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">Flex +400</span>}
                  </p>
                  <p className={`text-sm ${d.kind === 'rest' || before ? 'text-slate-500' : 'text-slate-200'}`}>{d.kind === 'rest' ? 'Rest' : DAY_TITLE[d.kind]}</p>
                </div>
                <span className="text-sm">
                  {st === 'done' && <span className="text-emerald-400">Done</span>}
                  {st === 'partial' && <span className="text-amber-300">Partly done</span>}
                  {before && d.kind !== 'rest' && !st && <span className="text-slate-600">Before you started</span>}
                  {!before && !st && d.kind !== 'rest' && (d.date < today ? <span className="text-slate-500">Not done</span> : <span className="text-slate-400">{isToday ? 'Today' : 'Planned'}</span>)}
                </span>
              </div>
              {d.date >= today && (
                <button onClick={() => void toggleFlex(d.date)} aria-pressed={isFlex}
                  className="mt-2 text-xs text-sky-400 underline">{isFlex ? 'Remove flex day' : 'Make this my flex day'}</button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500">One flex day a week gets +400 kcal, taken evenly from the other days left.</p>
      <button className={secondaryBtn} onClick={onOpenSettings}>Change training days</button>
    </div>
  )
}
