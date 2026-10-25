import { addDays, daysBetween } from './dates'
import { KCAL_PER_KG_FAT } from './modes'
import { firstTrend, lastTrend, type WeighPoint } from './trend'

export const ADAPTIVE_WINDOW_DAYS = 21
export const ADAPTIVE_MIN_LOGGED_DAYS = 14
export const ADAPTIVE_OLD_WEIGHT = 0.7
export const ADAPTIVE_MAX_CHANGE = 0.05

export interface IntakeDay {
  date: string
  kcal: number
}

export interface AdaptiveInput {
  /** The Monday the update runs. The window is the 21 days before it. */
  monday: string
  oldMaintenance: number
  /** Fully logged days only (marked done, with meals). Unlogged days are simply absent: skipped, never zero. */
  loggedDays: IntakeDay[]
  weighIns: WeighPoint[]
  paused?: ReadonlySet<string>
}

export type AdaptiveResult =
  | { updated: true; maintenance: number; estimate: number; avgIntake: number; loggedCount: number; days: number; trendChangeKg: number }
  | { updated: false; maintenance: number; reason: 'not_enough_days' | 'no_trend' }

/** Adaptive maintenance (spec rule 8). Every Monday, using the last 21 days:
 *  estimate = average intake - (trend change kg x 7700 / days);
 *  new maintenance = 0.7 x old + 0.3 x estimate, changing by at most 5% a week. */
export function adaptiveMaintenance(i: AdaptiveInput): AdaptiveResult {
  const paused = i.paused ?? new Set<string>()
  const end = addDays(i.monday, -1)
  const start = addDays(i.monday, -ADAPTIVE_WINDOW_DAYS)

  const logged = i.loggedDays.filter((d) => d.date >= start && d.date <= end && !paused.has(d.date) && d.kcal > 0)
  if (logged.length < ADAPTIVE_MIN_LOGGED_DAYS) return { updated: false, maintenance: i.oldMaintenance, reason: 'not_enough_days' }

  const first = firstTrend(i.weighIns, start, addDays(start, 6), paused)
  const last = lastTrend(i.weighIns, addDays(end, -6), end, paused)
  if (!first || !last) return { updated: false, maintenance: i.oldMaintenance, reason: 'no_trend' }
  // Paused days sit inside the span but are not part of it.
  let days = daysBetween(first.date, last.date)
  for (let d = first.date; d < last.date; d = addDays(d, 1)) if (paused.has(d)) days -= 1
  if (days < 14) return { updated: false, maintenance: i.oldMaintenance, reason: 'no_trend' }

  const avgIntake = logged.reduce((s, d) => s + d.kcal, 0) / logged.length
  const trendChangeKg = last.kg - first.kg
  const estimate = avgIntake - (trendChangeKg * KCAL_PER_KG_FAT) / days

  const blended = ADAPTIVE_OLD_WEIGHT * i.oldMaintenance + (1 - ADAPTIVE_OLD_WEIGHT) * estimate
  const limit = i.oldMaintenance * ADAPTIVE_MAX_CHANGE
  const maintenance = Math.round(Math.min(i.oldMaintenance + limit, Math.max(i.oldMaintenance - limit, blended)))
  return { updated: true, maintenance, estimate: Math.round(estimate), avgIntake: Math.round(avgIntake), loggedCount: logged.length, days, trendChangeKg: Math.round(trendChangeKg * 100) / 100 }
}
