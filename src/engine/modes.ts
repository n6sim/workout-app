import type { ModeName, Sex } from './types'

export interface ModeConfig {
  /** Largest daily deficit the mode allows, kcal. */
  maxDeficitKcal: number
  /** Largest weekly loss as a fraction of body weight. */
  maxWeeklyLossFraction: number
  proteinGPerKg: number
  calorieFloorKcal: Record<Sex, number>
}

// Only moderate is defined in M1. The aggressive config (all fields null) arrives with M5.
export const MODERATE: ModeConfig = {
  maxDeficitKcal: 500,
  maxWeeklyLossFraction: 0.0075,
  proteinGPerKg: 1.8,
  calorieFloorKcal: { female: 1200, male: 1500 },
}

export const KCAL_PER_KG_FAT = 7700

export function modeConfig(_mode: ModeName = 'moderate'): ModeConfig {
  return MODERATE
}
