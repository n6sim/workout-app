import { addDays, ageYears, daysBetween } from './dates'
import { bmr } from './bmr'
import { baseMaintenance } from './maintenance'
import { KCAL_PER_KG_FAT, modeConfig } from './modes'
import type { ActivityLevel, ModeName, Sex } from './types'

/** Deficit needed to reach targetKg by the target date (spec rule 3). Zero if no loss is needed.
 *  A date that is today or already past counts as 1 day, so the mode cap and message take over. */
export function neededDeficit(currentKg: number, targetKg: number, daysToTarget: number): number {
  if (targetKg >= currentKg) return 0
  return ((currentKg - targetKg) * KCAL_PER_KG_FAT) / Math.max(1, daysToTarget)
}

/** Lower of the mode's kcal/day cap and its weekly-percent-of-body-weight cap. */
export function maxDeficit(currentKg: number, mode: ModeName = 'moderate'): number {
  const cfg = modeConfig(mode)
  const fromPercent = (currentKg * cfg.maxWeeklyLossFraction * KCAL_PER_KG_FAT) / 7
  return Math.min(cfg.maxDeficitKcal, fromPercent)
}

export function calorieFloor(sex: Sex, mode: ModeName = 'moderate'): number {
  return modeConfig(mode).calorieFloorKcal[sex]
}

/** 1.8 g per kg of current weight, rounded to the nearest 5 g (spec rule 4). */
export function proteinTarget(kg: number, mode: ModeName = 'moderate'): number {
  return Math.round((kg * modeConfig(mode).proteinGPerKg) / 5) * 5
}

export type PhaseKind = 'fat_loss' | 'maintenance'

export interface TargetInput {
  sex: Sex
  birthDate: string
  heightCm: number
  /** Latest weigh-in until trend weight arrives in M5. */
  weightKg: number
  activityLevel: ActivityLevel
  phase: PhaseKind
  targetWeightKg?: number
  targetDate?: string
  today: string
  mode?: ModeName
}

export interface DailyTargets {
  bmrKcal: number
  maintenanceKcal: number
  neededDeficitKcal: number
  deficitKcal: number
  /** True when the goal needs a bigger deficit than the mode allows. */
  goalTooFast: boolean
  /** Date the goal is reached at the capped pace, set when goalTooFast. */
  moderateDate?: string
  floorApplied: boolean
  /** Daily calorie target, rounded to the nearest 10 kcal. */
  calorieTargetKcal: number
  proteinTargetG: number
}

/** Daily calorie and protein target (spec rules 1 to 4). */
export function dailyTargets(input: TargetInput): DailyTargets {
  const mode = input.mode ?? 'moderate'
  const bmrKcal = bmr(input.sex, input.weightKg, input.heightCm, ageYears(input.birthDate, input.today))
  const maintenanceKcal = baseMaintenance(bmrKcal, input.activityLevel)

  let needed = 0
  if (input.phase === 'fat_loss' && input.targetWeightKg !== undefined && input.targetDate) {
    needed = neededDeficit(input.weightKg, input.targetWeightKg, daysBetween(input.today, input.targetDate))
  }

  const cap = maxDeficit(input.weightKg, mode)
  const goalTooFast = needed > cap
  const deficitKcal = Math.min(needed, cap)

  let moderateDate: string | undefined
  if (goalTooFast && input.targetWeightKg !== undefined) {
    const days = ((input.weightKg - input.targetWeightKg) * KCAL_PER_KG_FAT) / cap
    moderateDate = addDays(input.today, Math.ceil(days))
  }

  const floor = calorieFloor(input.sex, mode)
  const raw = maintenanceKcal - deficitKcal
  const floorApplied = raw < floor

  return {
    bmrKcal,
    maintenanceKcal,
    neededDeficitKcal: needed,
    deficitKcal,
    goalTooFast,
    moderateDate,
    floorApplied,
    calorieTargetKcal: Math.round(Math.max(raw, floor) / 10) * 10,
    proteinTargetG: proteinTarget(input.weightKg, mode),
  }
}
