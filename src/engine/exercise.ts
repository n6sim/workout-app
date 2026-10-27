import type { SessionPlan } from './training/types'

export type ActivityType = 'strength' | 'pilates' | 'treadmill_walk' | 'bike' | 'stepper' | 'easy_walk'

/** MET values (spec rule 5). The one table to edit if you want different numbers. */
export const MET: Record<ActivityType, number> = {
  strength: 4.5, // strength with dumbbells
  pilates: 3.0,
  treadmill_walk: 5.0, // treadmill incline walk
  bike: 6.8, // bike, moderate
  stepper: 8.0,
  easy_walk: 3.5,
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  strength: 'Strength (dumbbells)',
  pilates: 'Pilates',
  treadmill_walk: 'Treadmill incline walk',
  bike: 'Bike, moderate',
  stepper: 'Stepper',
  easy_walk: 'Easy walk',
}

export const DEFAULT_CREDIT_PCT = 50

/** Estimated calories burned: MET x body kg x hours (spec rule 5). */
export function estimateKcal(type: ActivityType, kg: number, minutes: number): number {
  return MET[type] * kg * (minutes / 60)
}

/** Share of the estimate that counts toward the budget (default 50%). */
export function creditedKcal(estKcal: number, creditPct: number): number {
  return (estKcal * creditPct) / 100
}

export interface ActivityBlock {
  type: ActivityType
  minutes: number
}

/** Splits a planned or finished workout into blocks so each gets its own MET.
 *  Steady cardio keeps its machine's MET; the rest is strength or pilates. */
export function workoutBlocks(plan: Pick<SessionPlan, 'kind' | 'estMinutes' | 'cardio'>, totalMinutes = plan.estMinutes): ActivityBlock[] {
  const scale = plan.estMinutes > 0 ? totalMinutes / plan.estMinutes : 1
  const blocks: ActivityBlock[] = []
  let rest = totalMinutes
  if (plan.cardio) {
    const id = plan.cardio.exerciseId
    const type: ActivityType = id === 'Walking_Treadmill' ? 'treadmill_walk' : id === 'Bicycling_Stationary' ? 'bike' : 'easy_walk'
    const minutes = (plan.cardio.seconds / 60) * scale
    blocks.push({ type, minutes })
    rest -= minutes
  }
  const strength = ['upper', 'lower', 'full_body', 'full_body_a', 'full_body_b'].includes(plan.kind)
  if (rest > 0.5) blocks.push({ type: strength ? 'strength' : 'pilates', minutes: rest })
  return blocks
}

/** "Burned ~X, counted Y" for a workout. */
export function workoutBurn(plan: Pick<SessionPlan, 'kind' | 'estMinutes' | 'cardio'>, kg: number, creditPct: number, minutes = plan.estMinutes) {
  const est = workoutBlocks(plan, minutes).reduce((s, b) => s + estimateKcal(b.type, kg, b.minutes), 0)
  return { estKcal: Math.round(est), creditedKcal: Math.round(creditedKcal(est, creditPct)) }
}
