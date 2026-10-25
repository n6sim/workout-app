import type { ModeName, Sex } from './types'
import type { PhaseType } from '../storage/types'

export const KCAL_PER_KG_FAT = 7700

export interface VolumeRow {
  sets: number | { first: number; rest: number }
  repMin: number
  repMax: number
  restSec: number
}

export interface ModeConfig {
  /** Largest daily deficit the mode allows, kcal. */
  maxDeficitKcal: number
  /** Largest weekly loss as a fraction of body weight. */
  maxWeeklyLossFraction: number
  /** Longest run of deficit weeks before a diet break is proposed. */
  maxWeeksPerBlock: number
  proteinGPerKg: number
  calorieFloorKcal: Record<Sex, number>
  volumeTable: Partial<Record<PhaseType, VolumeRow>>
}

/** Every field is null until v2 defines it. Nothing in v1 can select this mode. */
export interface LockedModeConfig {
  maxDeficitKcal: null
  maxWeeklyLossFraction: null
  maxWeeksPerBlock: null
  proteinGPerKg: null
  calorieFloorKcal: null
  volumeTable: null
}

export const MODERATE: ModeConfig = {
  maxDeficitKcal: 500,
  maxWeeklyLossFraction: 0.0075,
  maxWeeksPerBlock: 12,
  proteinGPerKg: 1.8,
  calorieFloorKcal: { female: 1200, male: 1500 },
  volumeTable: {
    fat_loss: { sets: 3, repMin: 8, repMax: 12, restSec: 75 }, // rest 60 to 90 s, midpoint
    recomposition: { sets: 3, repMin: 8, repMax: 12, restSec: 75 },
    maintenance: { sets: { first: 3, rest: 2 }, repMin: 6, repMax: 10, restSec: 90 }, // "2 to 3 sets"
  },
}

export const AGGRESSIVE: LockedModeConfig = {
  // TODO(v2): define every value for the aggressive mode.
  maxDeficitKcal: null,
  maxWeeklyLossFraction: null,
  maxWeeksPerBlock: null,
  proteinGPerKg: null,
  calorieFloorKcal: null,
  volumeTable: null,
}

export const MODES: { moderate: ModeConfig; aggressive: LockedModeConfig } = { moderate: MODERATE, aggressive: AGGRESSIVE }

export function modeConfig(mode: ModeName = 'moderate'): ModeConfig {
  if (mode !== 'moderate') throw new RangeError('Aggressive mode is not available yet (coming in 2.0).')
  return MODERATE
}
