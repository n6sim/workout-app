import type { Sex } from './types'

/** Resting energy, Mifflin-St Jeor (spec rule 1), kcal/day. */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  const s = sex === 'male' ? 5 : -161
  return 10 * kg + 6.25 * cm - 5 * age + s
}
