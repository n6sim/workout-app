import { addDays, daysBetween } from '../dates'
import type { PhaseType } from '../../storage/types'
import { buildSessionPlan } from './session'
import { pickPilatesType } from './pilates'
import { isStrengthDay, planWeek, SUPPORTED_TRAINING_DAYS, weekdayOf, weekStart } from './week'
import type { DayKind, Exercise, FocusArea, SessionPlan } from './types'

/** A past or current session, as far as planning needs it. */
export interface SessionSummary {
  date: string
  status: 'done' | 'partial' | 'skipped'
  plan: Pick<SessionPlan, 'focus' | 'kind'>
}

export interface DayPlanInput {
  date: string
  trainingDays: number[]
  phase: PhaseType
  sessionLengthMin: number
  /** Library already filtered to owned equipment. */
  library: Exercise[]
  sessions: SessionSummary[]
  focusOverride?: FocusArea[]
}

export interface DayPlan {
  date: string
  weekday: number
  kind: DayKind | 'rest'
  plan: SessionPlan | null
  /** Rest days only: an optional easy walk is suggested, never required. */
  restWalk: boolean
  /** Muscle groups that already had two sessions this week (spec: Focus areas). */
  warnings: { area: FocusArea; count: number }[]
  problem?: 'training_days' | 'no_exercises'
}

const worked = (s: SessionSummary) => s.status === 'done' || s.status === 'partial'

/** Counts the sessions this week that already worked each focus area. */
export function focusWarnings(focus: FocusArea[], sessions: SessionSummary[], monday: string, ignoreDate?: string) {
  const end = addDays(monday, 6)
  const week = sessions.filter((s) => worked(s) && s.date >= monday && s.date <= end && s.date !== ignoreDate)
  return focus
    .map((area) => ({ area, count: week.filter((s) => s.plan.focus.includes(area)).length }))
    .filter((w) => w.count >= 2)
}

/** Weeks since a fixed Monday; only used to alternate options from week to week. */
export const weekNumber = (monday: string) => Math.floor(daysBetween('2024-01-01', monday) / 7)

export function planDay(i: DayPlanInput): DayPlan {
  const weekday = weekdayOf(i.date)
  const base = { date: i.date, weekday, plan: null, restWalk: false, warnings: [] }
  if (!(SUPPORTED_TRAINING_DAYS as readonly number[]).includes(new Set(i.trainingDays).size)) {
    return { ...base, kind: 'rest', problem: 'training_days' }
  }

  const monday = weekStart(i.date)
  const kind = planWeek(i.trainingDays, monday)[weekday].kind
  if (kind === 'rest') return { ...base, kind, restWalk: true }

  const week = weekNumber(monday)
  const plan = buildSessionPlan({
    kind, phase: i.phase, library: i.library, sessionLengthMin: i.sessionLengthMin,
    seed: `${monday}:${kind}`, weekNumber: week, focus: isStrengthDay(kind) ? i.focusOverride : undefined,
  })

  if (isStrengthDay(kind) && plan.exercises.length === 0) return { ...base, kind, plan, problem: 'no_exercises' }

  if (kind === 'pilates' || kind === 'pilates_cardio') {
    const yesterday = addDays(i.date, -1)
    const ySessions = i.sessions.filter((s) => s.date === yesterday && worked(s))
    const prevMonday = addDays(monday, -7)
    const plannedLastWeek = planWeek(i.trainingDays, prevMonday).filter((d) => d.kind !== 'rest').length
    const doneLastWeek = i.sessions.filter((s) => worked(s) && s.date >= prevMonday && s.date < monday).length
    const hasHistory = i.sessions.some((s) => s.date < monday)
    plan.pilates = pickPilatesType({
      heavyLowerYesterday: ySessions.some((s) => s.plan.focus.includes('legs') || s.plan.focus.includes('glutes')),
      restYesterday: ySessions.length === 0,
      lightWeek: hasHistory && plannedLastWeek > 0 && doneLastWeek < plannedLastWeek / 2,
      phase: i.phase,
      weekNumber: week,
    })
  }

  return { ...base, kind, plan, warnings: focusWarnings(plan.focus, i.sessions, monday, i.date) }
}
