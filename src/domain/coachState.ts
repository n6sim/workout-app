import type { CoachEvent, Meal, Pause, Phase, PhaseType, ProfileHeader, ProfileId, WeighIn } from '../storage'
import { addDays, daysBetween } from '../engine/dates'
import { weekStartOf } from '../engine/budget'
import {
  PLATEAU_MIN_LOGGED_DAYS, plateauQuiet, plateauStatus, postponeState, proposeTransition,
  type CoachContext, type PlateauOptionId, type PlateauStatus, type ProposalKind,
} from '../engine/coach'
import { activePause, pauseDays, pausedDates, returnInfo, shouldPromptLongPause, type ReturnInfo } from '../engine/pause'
import { currentWeight, trendChange, trendWeight } from '../engine/trend'
import type { PhaseKind } from '../engine/targets'
import type { IntakeDay } from '../engine/adaptive'
import { eatenByDate, isLoggingDone } from './day'

export const maintId = (p: ProfileId, monday: string) => `maint-${p}-${monday}`
export const postponeId = (p: ProfileId, phaseId: string, kind: ProposalKind) => `postpone-${p}-${phaseId}-${kind}`
export const plateauId = (p: ProfileId, date: string) => `plateau-${p}-${date}`

function detail<T>(e: CoachEvent | undefined): Partial<T> {
  if (!e) return {}
  try {
    return JSON.parse(e.detail) as Partial<T>
  } catch {
    return {}
  }
}

export interface MaintenanceUpdate { maintenance: number; updated: boolean; estimate?: number; reason?: string }
export interface PlateauChoice { option: PlateauOptionId; date: string; kcal?: number; walk?: boolean; until?: string }

export interface CoachState {
  pausedSet: ReadonlySet<string>
  paused: Pause | null
  pausedDaysCount: number
  longPausePrompt: boolean
  returning: ReturnInfo | null
  phase: Phase | null
  phaseKind: PhaseKind
  /** The weight targets are based on, and whether it is a real trend (else the latest weigh-in). */
  weight: { kg: number; fromTrend: boolean } | null
  trendKg: number | null
  /** Adaptive maintenance, once it exists. */
  maintenanceOverride: number | null
  lastMaintenanceUpdate: { monday: string; data: Partial<MaintenanceUpdate> } | null
  proposal: { kind: ProposalKind; canPostpone: boolean } | null
  plateau: PlateauStatus
  /** Fat loss, stalled or short of logs: the message to show instead of a verdict. */
  needLogging: boolean
  adjustment: PlateauChoice | null
  ramp: { startKcal: number; weeksInPhase: number } | null
  /** Fully logged days (marked done, with meals, not paused), for adaptive maintenance. */
  loggedDays: IntakeDay[]
  loggedLast21: number
}

export interface CoachInput {
  profileId: ProfileId
  header: ProfileHeader
  weighIns: WeighIn[]
  phases: Phase[]
  meals: Meal[]
  pauses: Pause[]
  events: CoachEvent[]
  today: string
}

const KIND: Record<PhaseType, PhaseKind> = {
  fat_loss: 'fat_loss', recomposition: 'recomposition', maintenance: 'maintenance', diet_break: 'diet_break',
  aggressive: 'fat_loss', // locked in v1
}

export function currentPhase(phases: Phase[]): Phase | null {
  return [...phases].filter((p) => p.endDate === null).sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

export function coachState(i: CoachInput): CoachState {
  const { today } = i
  const pausedSet = pausedDates(i.pauses, today)
  const paused = activePause(i.pauses, today)
  const returning = returnInfo(i.pauses, i.weighIns, today)
  const phase = currentPhase(i.phases)

  const trendKg = trendWeight(i.weighIns, today, pausedSet)
  // While waiting for a new baseline after a break, keep using the weight from before the break.
  const weight = paused
    ? currentWeight(i.weighIns, addDays(paused.startDate, -1))
    : returning?.awaitingBaseline
      ? currentWeight(i.weighIns, addDays(returning.pause.startDate, -1)) ?? currentWeight(i.weighIns, today, pausedSet)
      : currentWeight(i.weighIns, today, pausedSet)

  const meals = eatenByDate(i.meals)
  const loggedDays: IntakeDay[] = Object.keys(meals)
    .filter((d) => d < today && !pausedSet.has(d) && isLoggingDone(i.events, i.profileId, d))
    .map((date) => ({ date, kcal: meals[date] }))
  const loggedLast21 = loggedDays.filter((d) => d.date >= addDays(today, -21)).length

  // Latest Monday that actually produced a number. A Monday with too little data records "no update"
  // and must not reset an earlier adaptive value back to the formula.
  const updates = i.events
    .filter((e) => e.kind === 'maintenance_update' && !e.deleted)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((e) => ({ monday: e.id.slice(-10), data: detail<MaintenanceUpdate>(e) }))
  const lastUpdate = updates.find((u) => typeof u.data.maintenance === 'number') ?? null
  const maintenanceOverride = lastUpdate ? (lastUpdate.data.maintenance as number) : null

  const choices = i.events
    .filter((e) => e.kind === 'plateau_choice' && !e.deleted)
    .map((e) => detail<PlateauChoice>(e) as PlateauChoice)
    .filter((c) => c.option && c.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  const lastChoice = choices[0] ?? null
  const adjustment = choices.find((c) => c.option === 'small_adjustment' && c.until && c.until >= today) ?? null

  const pausedInPhase = phase ? [...pausedSet].filter((d) => d >= phase.startDate).length : 0
  const change = trendChange(i.weighIns, today, 21, pausedSet)
  const ctx: CoachContext | null = phase
    ? {
        today, phase: { type: phase.type, startDate: phase.startDate, plannedEndDate: phase.plannedEndDate },
        trendKg, targetKg: i.header.goal.type === 'lose' ? i.header.goal.targetWeightKg ?? null : null,
        pausedDaysInPhase: pausedInPhase, loggedDaysLast21: loggedLast21, trendChange21: change ? change.kg : null,
        paused: !!paused, awaitingBaseline: !!returning?.awaitingBaseline,
      }
    : null

  const plateau = ctx ? plateauStatus(ctx) : 'too_early'
  let proposal: CoachState['proposal'] = null
  if (ctx && phase) {
    const kind = proposeTransition(ctx)
    if (kind) {
      const postponed = i.events.find((e) => e.id === postponeId(i.profileId, phase.id, kind) && !e.deleted)
      const st = postponeState(postponed ? postponed.detail : null, today)
      const quiet = kind === 'plateau_check' && plateauQuiet(lastChoice, today)
      if (!st.hidden && !quiet) proposal = { kind, canPostpone: st.canPostpone }
    }
  }
  const needLogging = plateau === 'need_logging' && !plateauQuiet(lastChoice, today)

  const ramp = phase && phase.type === 'maintenance'
    ? { startKcal: phase.calorieTargetKcal, weeksInPhase: Math.floor(Math.max(0, daysBetween(phase.startDate, today) + 1 - pausedInPhase) / 7) }
    : null

  return {
    pausedSet, paused, pausedDaysCount: paused ? pauseDays(paused, today) : 0,
    longPausePrompt: !!paused && shouldPromptLongPause(paused, today),
    returning, phase, phaseKind: phase ? KIND[phase.type] : 'fat_loss',
    weight, trendKg, maintenanceOverride, lastMaintenanceUpdate: lastUpdate,
    proposal, plateau, needLogging, adjustment, ramp, loggedDays, loggedLast21,
  }
}

export { PLATEAU_MIN_LOGGED_DAYS, weekStartOf }
