import { addDays, daysBetween } from './dates'

export const FLEX_EXTRA_KCAL = 400
export const CLAMP_FRACTION = 0.2

export interface BudgetInput {
  /** 'YYYY-MM-DD' */
  today: string
  /** Daily calorie target from rule 3. */
  dailyTarget: number
  /** Never go below this (spec: calorie floor). */
  calorieFloor: number
  /** First day of the plan. Days before it are neutral (counted as on target). */
  startDate: string
  /** kcal eaten per date, only for dates with at least one meal logged. */
  eatenByDate: Record<string, number>
  /** Credited exercise kcal per date. */
  creditedByDate: Record<string, number>
  /** The week's flex day, if one is set. */
  flexDate?: string | null
}

export interface TodayBudget {
  weekStart: string
  weeklyBudget: number
  /** Credited exercise so far this week, today included. */
  weekCredited: number
  /** Eaten Monday to yesterday, with unlogged and pre-start days counted as exactly on target. */
  countedBefore: number
  daysLeft: number
  /** Today's budget after clamp, flex and floor. */
  budget: number
  eatenToday: number
  remaining: number
  isFlexToday: boolean
}

export function weekStartOf(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(date, -weekday)
}

/** Today's budget (spec rule 6).
 *  weekly budget = target x 7 + credited exercise this week.
 *  today = (weekly budget - eaten before today) / days left, within +/-20% of the target.
 *  A flex day gets +400, taken evenly from the other remaining days. */
export function todayBudget(i: BudgetInput): TodayBudget {
  const weekStart = weekStartOf(i.today)
  const T = i.dailyTarget
  const weekday = daysBetween(weekStart, i.today) // 0 = Monday
  const daysLeft = 7 - weekday

  let weekCredited = 0
  let countedBefore = 0
  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d)
    if (date <= i.today) weekCredited += i.creditedByDate[date] ?? 0
    if (date < i.today) countedBefore += date < i.startDate ? T : (i.eatenByDate[date] ?? T)
  }

  const weeklyBudget = T * 7 + weekCredited
  const average = (weeklyBudget - countedBefore) / daysLeft
  const clamp = (v: number) => Math.min(T * (1 + CLAMP_FRACTION), Math.max(T * (1 - CLAMP_FRACTION), v))

  const flex = i.flexDate && weekStartOf(i.flexDate) === weekStart && i.flexDate >= i.today ? i.flexDate : null
  const isFlexToday = flex === i.today
  let budget: number
  if (isFlexToday) {
    budget = clamp(average) + FLEX_EXTRA_KCAL
  } else if (flex) {
    const others = daysLeft - 1 // remaining days other than the flex day, today included
    budget = clamp(average - FLEX_EXTRA_KCAL / others)
  } else {
    budget = clamp(average)
  }
  budget = Math.round(Math.max(i.calorieFloor, budget))

  const eatenToday = Math.round(i.eatenByDate[i.today] ?? 0)
  return { weekStart, weeklyBudget: Math.round(weeklyBudget), weekCredited: Math.round(weekCredited), countedBefore: Math.round(countedBefore), daysLeft, budget, eatenToday, remaining: budget - eatenToday, isFlexToday }
}
