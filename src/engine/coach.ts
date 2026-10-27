import { addDays } from './dates'
import { modeConfig } from './modes'
import type { PhaseType } from '../storage/types'

export const RECOMPOSITION_DEFICIT_KCAL = 250
export const MAINTENANCE_RAMP_KCAL_PER_WEEK = 100
export const NEAR_TARGET_KG = 1
export const PLATEAU_MIN_LOGGED_DAYS = 14
export const PLATEAU_MAX_LOSS_KG = 0.2
export const PLATEAU_WINDOW_DAYS = 21
export const PLATEAU_QUIET_DAYS = 21 // after you pick an option it is not offered again for 3 weeks
export const LOGGING_CHECK_DAYS = 7
export const POSTPONE_DAYS = 7

export type ProposalKind = 'to_recomposition' | 'to_maintenance' | 'diet_break' | 'end_diet_break' | 'plateau_check'

export interface CoachContext {
  today: string
  phase: { type: PhaseType; startDate: string; plannedEndDate?: string }
  /** Trend weight today, or null when there are fewer than 3 weigh-ins in the week. */
  trendKg: number | null
  /** The goal weight, or null for a "maintain" goal. */
  targetKg: number | null
  /** Days of the current phase that were paused. */
  pausedDaysInPhase: number
  /** Fully logged days among the last 21 (paused days excluded). */
  loggedDaysLast21: number
  /** Trend change over the last 21 days (end minus start), or null if it cannot be told yet. */
  trendChange21: number | null
  paused: boolean
  /** After a break, the coach waits for 3 weigh-ins before deciding anything. */
  awaitingBaseline: boolean
}

/** Whole deficit weeks in the current fat-loss phase. Paused days do not count, and a diet break starts a new phase,
 *  so the counter resets by itself (spec: Phases table). */
export function deficitWeeks(phaseStart: string, today: string, pausedDaysInPhase: number): number {
  let days = 0
  for (let d = phaseStart; d <= today; d = addDays(d, 1)) days += 1
  return Math.floor(Math.max(0, days - pausedDaysInPhase) / 7)
}

export type PlateauStatus = 'stalled' | 'moving' | 'need_logging' | 'too_early'

/** A stall is a trend that dropped less than 0.2 kg over 21 days, with at least 14 fully logged days, in fat loss.
 *  With fewer logged days there is no verdict at all. */
export function plateauStatus(c: CoachContext): PlateauStatus {
  if (c.phase.type !== 'fat_loss') return 'too_early'
  const phaseDays = deficitWeeks(c.phase.startDate, c.today, c.pausedDaysInPhase) * 7
  if (phaseDays < PLATEAU_WINDOW_DAYS || c.trendChange21 === null) return 'too_early'
  if (c.loggedDaysLast21 < PLATEAU_MIN_LOGGED_DAYS) return 'need_logging'
  return -c.trendChange21 < PLATEAU_MAX_LOSS_KG ? 'stalled' : 'moving'
}

/** What the coach wants to propose right now, if anything (spec: Coach brain). Every decision uses trend weight only.
 *  Order: reaching the target, then a diet break after 12 deficit weeks, then a plateau check. */
export function proposeTransition(c: CoachContext): ProposalKind | null {
  if (c.paused || c.awaitingBaseline) return null
  const { type } = c.phase

  if (type === 'diet_break') return c.phase.plannedEndDate && c.today >= c.phase.plannedEndDate ? 'end_diet_break' : null
  if (c.trendKg === null) return null

  if (type === 'fat_loss') {
    if (c.targetKg !== null) {
      if (c.trendKg <= c.targetKg) return 'to_maintenance'
      if (c.trendKg - c.targetKg <= NEAR_TARGET_KG) return 'to_recomposition'
    }
    if (deficitWeeks(c.phase.startDate, c.today, c.pausedDaysInPhase) >= modeConfig().maxWeeksPerBlock) return 'diet_break'
    if (plateauStatus(c) === 'stalled') return 'plateau_check'
    return null
  }
  if (type === 'recomposition') {
    return c.targetKg !== null && c.trendKg <= c.targetKg ? 'to_maintenance' : null
  }
  return null
}

export const PROPOSAL_TEXT: Record<Exclude<ProposalKind, 'plateau_check'>, { title: string; body: string; accept: string }> = {
  to_recomposition: {
    title: 'You are close to your goal',
    body: 'Your trend weight is within 1 kg of your target. Time to ease into recomposition: eat 250 kcal under maintenance and keep building strength.',
    accept: 'Start recomposition',
  },
  to_maintenance: {
    title: 'You reached your goal',
    body: 'Your trend weight is at your target. Time for maintenance. Your calories step up by 100 a week until they reach maintenance.',
    accept: 'Start maintenance',
  },
  diet_break: {
    title: 'Time for a diet break',
    body: 'You have been in a deficit for 12 weeks in a row. A short break at maintenance calories helps you recover. Pick 1 or 2 weeks.',
    accept: 'Start the break',
  },
  end_diet_break: {
    title: 'Your diet break is over',
    body: 'Time to go back to where you were. Your deficit-week count starts again from zero.',
    accept: 'Go back',
  },
}

// ---- plateau options (spec: Plateau check) ----

export type PlateauOptionId = 'logging_check' | 'diet_break' | 'small_adjustment' | 'aggressive_block'

export interface PlateauOption {
  id: PlateauOptionId
  title: string
  detail: string
  disabled?: boolean
}

/** Shown in this order. Option 4 exists but can never be chosen in v1. */
export const PLATEAU_OPTIONS: PlateauOption[] = [
  { id: 'logging_check', title: 'Logging check', detail: 'Weigh yourself and log everything for 7 days, then I check again.' },
  { id: 'diet_break', title: 'Diet break', detail: '1 or 2 weeks at maintenance calories.' },
  { id: 'small_adjustment', title: 'Small adjustment', detail: '100 to 150 kcal less per day, or a daily 20 minute walk.' },
  { id: 'aggressive_block', title: 'Short aggressive block', detail: 'Coming in 2.0', disabled: true },
]

export const NEED_LOGGING_MESSAGE = "Log every meal for a week so I can tell what's happening"

/** A small adjustment never takes you below the calorie floor. */
export function limitAdjustment(targetKcal: number, floorKcal: number, adjustKcal: number): number {
  return Math.max(0, Math.min(adjustKcal, targetKcal - floorKcal))
}

/** True while a plateau option still blocks a new offer. A logging check re-checks after 7 days; the rest wait 3 weeks. */
export function plateauQuiet(choice: { option: PlateauOptionId; date: string } | null, today: string): boolean {
  if (!choice) return false
  const days = choice.option === 'logging_check' ? LOGGING_CHECK_DAYS : PLATEAU_QUIET_DAYS
  return today < addDays(choice.date, days)
}

/** A proposal you postponed stays quiet for a week, and can be postponed only once. */
export function postponeState(postponedOn: string | null, today: string): { hidden: boolean; canPostpone: boolean } {
  if (!postponedOn) return { hidden: false, canPostpone: true }
  return { hidden: today < addDays(postponedOn, POSTPONE_DAYS), canPostpone: false }
}
