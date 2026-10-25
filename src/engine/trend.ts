import { addDays, daysBetween } from './dates'

export interface WeighPoint {
  date: string
  kg: number
}

export const TREND_WINDOW_DAYS = 7
export const TREND_MIN_WEIGH_INS = 3

/** Trend weight on `date` (spec rule 7): the average of the weigh-ins in the 7 days ending that day.
 *  Needs at least 3 weigh-ins in the window, otherwise null ("Not enough weigh-ins").
 *  Weigh-ins on paused days are left out. */
export function trendWeight(weighIns: WeighPoint[], date: string, paused: ReadonlySet<string> = new Set()): number | null {
  const from = addDays(date, -(TREND_WINDOW_DAYS - 1))
  const inWindow = weighIns.filter((w) => w.date >= from && w.date <= date && !paused.has(w.date))
  if (inWindow.length < TREND_MIN_WEIGH_INS) return null
  return inWindow.reduce((s, w) => s + w.kg, 0) / inWindow.length
}

export interface TrendPoint {
  date: string
  trend: number | null
}

/** The trend for every day from `from` to `to`, for the chart. */
export function trendSeries(weighIns: WeighPoint[], from: string, to: string, paused: ReadonlySet<string> = new Set()): TrendPoint[] {
  const out: TrendPoint[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, trend: trendWeight(weighIns, d, paused) })
  return out
}

/** The weight to base targets on: the trend if there is one, else the latest weigh-in (with a flag saying so). */
export function currentWeight(weighIns: WeighPoint[], date: string, paused: ReadonlySet<string> = new Set()): { kg: number; fromTrend: boolean } | null {
  const trend = trendWeight(weighIns, date, paused)
  if (trend !== null) return { kg: Math.round(trend * 10) / 10, fromTrend: true }
  const latest = weighIns
    .filter((w) => w.date <= date && !paused.has(w.date))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  return latest ? { kg: latest.kg, fromTrend: false } : null
}

/** Kilograms per day over the last `days` days, from trend values at both ends (negative = losing). */
export function trendRate(weighIns: WeighPoint[], today: string, days = 21, paused: ReadonlySet<string> = new Set()): number | null {
  const end = lastTrend(weighIns, addDays(today, -6), today, paused)
  const start = firstTrend(weighIns, addDays(today, -days), addDays(today, -days + 6), paused)
  if (!end || !start) return null
  const span = daysBetween(start.date, end.date)
  return span >= 14 ? (end.kg - start.kg) / span : null
}

export function firstTrend(w: WeighPoint[], from: string, to: string, paused: ReadonlySet<string>) {
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t = trendWeight(w, d, paused)
    if (t !== null) return { date: d, kg: t }
  }
  return null
}
export function lastTrend(w: WeighPoint[], from: string, to: string, paused: ReadonlySet<string>) {
  for (let d = to; d >= from; d = addDays(d, -1)) {
    const t = trendWeight(w, d, paused)
    if (t !== null) return { date: d, kg: t }
  }
  return null
}

/** When the trend should reach the target at the current rate, or null if it is not heading there. */
export function projectedDate(trendKg: number, targetKg: number, ratePerDay: number | null, today: string): string | null {
  if (ratePerDay === null || trendKg <= targetKg) return null
  if (ratePerDay >= -0.005) return null // flat or going up: no honest date
  return addDays(today, Math.ceil((trendKg - targetKg) / -ratePerDay))
}
