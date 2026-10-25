import { useMemo, useState } from 'react'
import { storage } from '../storage/instance'
import type { Food, Meal, PhaseType, ProfileHeader, ProfileId } from '../storage'
import { daysBetween } from '../engine/dates'
import { ACTIVITY_LABEL, type ActivityType } from '../engine/exercise'
import { ideasWithTotals } from '../engine/mealIdeas'
import { itemAmount, sumItems } from '../engine/nutrition'
import { suggestMeals } from '../engine/suggestions'
import { MEAL_IDEAS } from '../data/mealIdeas'
import { isLoggingDone, setLoggingDone } from '../domain/day'
import { toInfo } from '../domain/pantry'
import { todayInfo } from '../domain/todayInfo'
import type { ProfileData } from '../useProfileData'
import { formatDate, todayLocal } from '../util/today'
import BudgetRing from './BudgetRing'
import PlanCard from './PlanCard'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const PHASE_LABEL: Record<PhaseType, string> = {
  fat_loss: 'Fat loss', recomposition: 'Recomposition', maintenance: 'Maintenance', diet_break: 'Diet break', aggressive: 'Aggressive',
}

export type LogView = 'meal' | 'activity' | 'weight'

interface Props {
  profileId: ProfileId
  header: ProfileHeader
  data: ProfileData
  reload: () => void
  onOpenSettings: () => void
  onQuickLog: (view: LogView) => void
}

export default function Today({ profileId, header, data, reload, onOpenSettings, onQuickLog }: Props) {
  const today = todayLocal()
  const { weighIns, phases, sessions, pilatesLinks, meals, activities, foods, events } = data
  const info = useMemo(
    () => todayInfo({ profileId, header, weighIns, phases, meals, activities, events, today }),
    [profileId, header, weighIns, phases, meals, activities, events, today],
  )
  const { latest, targets, budget } = info
  const dayNumber = Math.max(1, daysBetween(header.goal.startDate, today) + 1)
  const phase = phases.find((p) => p.endDate === null)
  const done = isLoggingDone(events, profileId, today)
  const todaysMeals = meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time))
  const todaysActivities = activities.filter((a) => a.date === today)
  const creditPct = header.settings.exerciseCreditPct

  async function moveDate(date: string) {
    await storage.saveHeader(profileId, { ...header, goal: { ...header.goal, targetDate: date, updatedAt: new Date().toISOString() } })
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{dayNumber === 1 ? 'Day 1 of your plan' : `Day ${dayNumber}`}</span>
          {phase && <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm text-sky-300">{PHASE_LABEL[phase.type]}</span>}
        </div>
      </div>

      {targets && budget && (
        <>
          <BudgetRing b={budget} target={targets.calorieTargetKcal} creditPct={creditPct} />

          <Card className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-slate-400">Protein</p>
              <p className="text-sm"><span className="text-xl font-semibold tabular-nums">{Math.round(info.proteinEaten)}</span> of {targets.proteinTargetG} g</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={Math.round(info.proteinEaten)} aria-valuemax={targets.proteinTargetG} aria-label="Protein">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (info.proteinEaten / targets.proteinTargetG) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500">Hitting protein matters more than hitting calories exactly.</p>
          </Card>

          <p className="text-xs text-slate-500">
            Daily target {targets.calorieTargetKcal} kcal and {targets.proteinTargetG} g protein, based on {latest!.kg} kg (weigh-in {formatDate(latest!.date)}).
          </p>

          {targets.goalTooFast && targets.moderateDate && (
            <Card className="space-y-3 bg-amber-900/40 text-sm text-amber-100">
              <p>This goal needs a faster pace than moderate mode allows. At a moderate pace you'll reach it around {formatDate(targets.moderateDate)}.</p>
              <button className={secondaryBtn} onClick={() => void moveDate(targets.moderateDate!)}>Move my date to {formatDate(targets.moderateDate)}</button>
            </Card>
          )}
          {targets.floorApplied && <p className="text-xs text-slate-500">Raised to the minimum calorie floor for safety.</p>}
        </>
      )}

      <div className="grid grid-cols-3 gap-2">
        {([['meal', 'Log meal'], ['activity', 'Log activity'], ['weight', 'Log weight']] as const).map(([v, label]) => (
          <button key={v} className="rounded-xl bg-slate-800 py-3 text-sm font-medium active:bg-slate-700" onClick={() => onQuickLog(v)}>{label}</button>
        ))}
      </div>

      <PlanCard
        profileId={profileId} header={header} phases={phases} sessions={sessions} pilatesLinks={pilatesLinks}
        activities={activities} weightKg={latest?.kg ?? null}
        today={today} reload={reload} onOpenSettings={onOpenSettings}
      />

      <Card className="space-y-2">
        <h2 className="font-semibold">Eaten today</h2>
        {todaysMeals.length === 0 && <p className="text-sm text-slate-400">Nothing logged yet.</p>}
        <ul className="divide-y divide-slate-700">
          {todaysMeals.map((m) => <MealRow key={m.id} meal={m} onDelete={async () => { await storage.deleteEntry('meals', profileId, m.id); reload() }} />)}
        </ul>
        {todaysActivities.length > 0 && (
          <div className="border-t border-slate-700 pt-2">
            <p className="mb-1 text-sm text-slate-400">Activity</p>
            <ul className="space-y-1 text-sm">
              {todaysActivities.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>{ACTIVITY_LABEL[a.type as ActivityType] ?? a.type}, {a.minutes} min</span>
                  <span className="shrink-0 text-slate-400">Burned ~{a.estKcal}, counted {a.creditedKcal}</span>
                  <button aria-label="Delete activity" className="px-1 text-slate-500" onClick={async () => { await storage.deleteEntry('activities', profileId, a.id); reload() }}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {targets && budget && !done && (
        <Suggestions foods={foods} remainingKcal={budget.remaining} remainingProtein={targets.proteinTargetG - info.proteinEaten} proteinTarget={targets.proteinTargetG}
          profileId={profileId} reload={reload} today={today} />
      )}

      <button className={done ? secondaryBtn : primaryBtn} onClick={async () => { await setLoggingDone(profileId, today, !done); reload() }}>
        {done ? 'Logging is done for today (tap to undo)' : 'Done logging today'}
      </button>
      {done && <p className="text-center text-xs text-emerald-400">Thanks. Today counts as fully logged.</p>}

      <WeighInCard profileId={profileId} weighIns={weighIns} reload={reload} />
    </div>
  )
}

function MealRow({ meal, onDelete }: { meal: Meal; onDelete: () => void }) {
  const names = meal.items.map((i) => i.name ?? i.foodId).join(', ')
  return (
    <li className="flex items-start justify-between gap-2 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate">{names || meal.rawText}</p>
        <p className="text-xs text-slate-400">{meal.time} · {meal.totals.kcal} kcal · {meal.totals.proteinG} g protein</p>
      </div>
      <button aria-label="Delete meal" className="px-1 text-slate-500" onClick={onDelete}>✕</button>
    </li>
  )
}

function Suggestions({ foods, remainingKcal, remainingProtein, proteinTarget, profileId, reload, today }: {
  foods: Food[]; remainingKcal: number; remainingProtein: number; proteinTarget: number; profileId: ProfileId; reload: () => void; today: string
}) {
  const ideas = useMemo(() => ideasWithTotals(MEAL_IDEAS, foods.map(toInfo)), [foods])
  const picks = useMemo(
    () => suggestMeals(ideas, { kcal: remainingKcal, proteinG: Math.max(0, remainingProtein) }, proteinTarget),
    [ideas, remainingKcal, remainingProtein, proteinTarget],
  )
  if (picks.length === 0) return null

  async function log(idea: (typeof ideas)[number]) {
    const items = idea.items.flatMap((it) => {
      const food = foods.find((f) => f.name === it.food)
      const a = food ? itemAmount(toInfo(food), it.qty, it.unit) : null
      return food && a && a.ok ? [{ name: food.name, foodId: food.id, qty: it.qty, unit: it.unit, kcal: a.kcal, proteinG: a.proteinG }] : []
    })
    const t = sumItems(items)
    await storage.saveEntry('meals', profileId, { date: today, time: new Date().toTimeString().slice(0, 5), rawText: idea.name, items, totals: { kcal: t.kcal, proteinG: t.proteinG } })
    reload()
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Ideas that fit what is left</h2>
      {picks.map((p) => (
        <div key={p.id} className="space-y-1 rounded-xl bg-slate-900 p-3">
          <p className="font-medium">{p.name}</p>
          <p className="text-sm text-slate-400">{p.kcal} kcal · {p.proteinG} g protein</p>
          <p className="text-xs text-slate-500">{p.items.map((i) => i.food).join(', ')}</p>
          <button className={`${secondaryBtn} mt-1`} onClick={() => void log(p)}>Log this</button>
        </div>
      ))}
    </Card>
  )
}

export function WeighInCard({ profileId, weighIns, reload }: { profileId: ProfileId; weighIns: ProfileData['weighIns']; reload: () => void }) {
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [error, setError] = useState('')

  async function add() {
    const value = parseFloat(kg.replace(',', '.'))
    if (!(value >= 30 && value <= 300)) return setError('Enter a weight between 30 and 300 kg.')
    setError('')
    await storage.saveEntry('weighIns', profileId, { date, kg: value })
    setKg('')
    reload()
  }
  async function remove(id: string) {
    await storage.deleteEntry('weighIns', profileId, id)
    reload()
  }

  const recent = [...weighIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7)
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Log weight</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight (kg)"><input inputMode="decimal" className={inputCls} value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className={primaryBtn} onClick={() => void add()}>Save weigh-in</button>
      {recent.length > 0 && (
        <ul className="divide-y divide-slate-700 text-sm">
          {recent.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2">
              <span className="text-slate-400">{formatDate(w.date)}</span>
              <span className="font-medium">{w.kg} kg</span>
              <button className="px-2 text-slate-500" aria-label="Delete weigh-in" onClick={() => void remove(w.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
