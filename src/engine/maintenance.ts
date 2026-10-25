import type { ActivityLevel } from './types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  desk: 1.2,
  onFeet: 1.3,
  active: 1.4,
}

/** Base maintenance without workouts (spec rule 2): BMR x daily-life factor. */
export function baseMaintenance(bmrKcal: number, level: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[level]
}
