import { addDays } from '../dates'
import { planWeek, weekStart, weekdayOf } from './week'

export interface Adherence {
  planned: number
  done: number
  /** Days from the start to yesterday that were not paused. */
  daysTracked: number
  daysFullyLogged: number
}

/** Sessions done vs planned, and days fully logged (spec: Progress, Adherence).
 *  Rest days, paused days and days before you started never count against you, and today only counts once it is done. */
export function adherence(i: {
  trainingDays: number[]; startDate: string; today: string
  paused: ReadonlySet<string>; doneSessionDates: ReadonlySet<string>; loggedDoneDates: ReadonlySet<string>
}): Adherence {
  let planned = 0, done = 0, daysTracked = 0, daysFullyLogged = 0
  for (let d = i.startDate; d <= i.today; d = addDays(d, 1)) {
    if (i.paused.has(d)) continue
    const isToday = d === i.today
    const kind = planWeek(i.trainingDays, weekStart(d))[weekdayOf(d)].kind
    if (kind !== 'rest') {
      const did = i.doneSessionDates.has(d)
      if (!isToday || did) planned += 1
      if (did) done += 1
    }
    if (!isToday) {
      daysTracked += 1
      if (i.loggedDoneDates.has(d)) daysFullyLogged += 1
    }
  }
  return { planned, done, daysTracked, daysFullyLogged }
}
