import { addDays, daysBetween } from './dates'
import type { WeighPoint } from './trend'

export type PauseReason = 'holiday' | 'sick' | 'busy'

export interface PauseLike {
  startDate: string
  /** The last paused day, inclusive. Null while the pause is still open. */
  endDate: string | null
  reason: PauseReason
}

export const PAUSE_PROMPT_DAYS = 14
export const RETURN_WEIGH_IN_DAYS = 5
export const RETURN_BASELINE_WEIGH_INS = 3

/** Every day that is paused, up to and including `today`. Paused days are left out of the trend,
 *  adaptive maintenance, plateau detection and the 12-week count (spec: Pause mode). */
export function pausedDates(pauses: PauseLike[], today: string): Set<string> {
  const out = new Set<string>()
  for (const p of pauses) {
    const last = p.endDate !== null && p.endDate < today ? p.endDate : today
    for (let d = p.startDate; d <= last; d = addDays(d, 1)) out.add(d)
  }
  return out
}

/** The pause that covers `today`, if any. A pause with an end date in the future is active until then. */
export function activePause<T extends PauseLike>(pauses: T[], today: string): T | null {
  return pauses.find((p) => p.startDate <= today && (p.endDate === null || p.endDate >= today)) ?? null
}

/** Days paused so far, counting the first and today. */
export const pauseDays = (p: PauseLike, today: string) => daysBetween(p.startDate, p.endDate !== null && p.endDate < today ? p.endDate : today) + 1

/** After 14 days a gentle prompt asks whether to extend or resume. */
export const shouldPromptLongPause = (p: PauseLike, today: string) => p.endDate === null && pauseDays(p, today) >= PAUSE_PROMPT_DAYS

export interface ReturnInfo {
  pause: PauseLike
  /** First day back. */
  backOn: string
  /** Days since you came back (0 on the first day). */
  daysBack: number
  /** Weigh-ins since coming back. */
  weighInsSince: number
  /** Show the "welcome back" card: a weigh-in each morning for the first 5 days. */
  showWelcome: boolean
  /** The coach holds its decisions until 3 weigh-ins after the break set a new baseline. */
  awaitingBaseline: boolean
  /** A break of more than 7 days: the first week back has one set fewer per exercise. */
  oneFewerSet: boolean
  /** A sick break: the first session is always lighter. */
  sick: boolean
}

/** Where you are after a pause (spec: Coming back). Null when there is no recent pause to come back from. */
export function returnInfo(pauses: PauseLike[], weighIns: WeighPoint[], today: string): ReturnInfo | null {
  const ended = pauses
    .filter((p) => p.endDate !== null && p.endDate < today)
    .sort((a, b) => b.endDate!.localeCompare(a.endDate!))[0]
  if (!ended || activePause(pauses, today)) return null
  const backOn = addDays(ended.endDate!, 1)
  const daysBack = daysBetween(backOn, today)
  if (daysBack > 14) return null
  const weighInsSince = weighIns.filter((w) => w.date >= backOn && w.date <= today).length
  return {
    pause: ended, backOn, daysBack, weighInsSince,
    showWelcome: daysBack < RETURN_WEIGH_IN_DAYS && weighInsSince < RETURN_WEIGH_IN_DAYS,
    awaitingBaseline: weighInsSince < RETURN_BASELINE_WEIGH_INS,
    oneFewerSet: daysBetween(ended.startDate, ended.endDate!) + 1 > 7 && daysBack <= 6,
    sick: ended.reason === 'sick',
  }
}
