import type { ProfileHeader, ProfileId, WeighIn } from '../storage'
import { calorieFloor, dailyTargets, type DailyTargets } from '../engine/targets'
import { todayBudget, type TodayBudget } from '../engine/budget'
import type { ProfileData } from '../useProfileData'
import { creditedByDate, eatenByDate, flexDayOfWeek, proteinOn } from './day'
import { coachState, type CoachState } from './coachState'

export function latestWeighIn(weighIns: WeighIn[]): WeighIn | undefined {
  return [...weighIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
}

export interface TodayInfo {
  coach: CoachState
  /** The weight the targets are based on: the 7-day trend, or the latest weigh-in until there are 3. */
  weight: CoachState['weight']
  targets: DailyTargets | null
  /** Null while paused: nothing is judged. */
  budget: TodayBudget | null
  proteinEaten: number
  flexDate: string | null
}

/** Everything Today and Week need, from one place. */
export function todayInfo(i: { profileId: ProfileId; header: ProfileHeader; data: ProfileData; today: string }): TodayInfo {
  const { profileId, header, data, today } = i
  const coach = coachState({ profileId, header, weighIns: data.weighIns, phases: data.phases, meals: data.meals, pauses: data.pauses, events: data.events, today })
  const weight = coach.weight
  const targets = weight
    ? dailyTargets({
        sex: header.profile.sex, birthDate: header.profile.birthDate, heightCm: header.profile.heightCm,
        weightKg: weight.kg, activityLevel: header.profile.activityLevel,
        phase: coach.phaseKind, targetWeightKg: header.goal.targetWeightKg, targetDate: header.goal.targetDate,
        today, mode: header.settings.mode,
        maintenanceOverrideKcal: coach.maintenanceOverride ?? undefined,
        extraDeficitKcal: coach.adjustment?.kcal,
        ramp: coach.ramp ?? undefined,
      })
    : null
  const flexDate = flexDayOfWeek(data.events, profileId, today)
  const budget = targets && !coach.paused
    ? todayBudget({
        today, dailyTarget: targets.calorieTargetKcal, calorieFloor: calorieFloor(header.profile.sex, header.settings.mode),
        startDate: planStart(data.phases, header), eatenByDate: eatenByDate(data.meals), creditedByDate: creditedByDate(data.activities), flexDate,
      })
    : null
  return { coach, weight, targets, budget, proteinEaten: proteinOn(data.meals, today), flexDate }
}

/** The first day of the plan: the earliest phase, or the goal start. A new goal later on does not reset "Day 1". */
export function planStart(phases: { startDate: string }[], header: ProfileHeader): string {
  return [header.goal.startDate, ...phases.map((p) => p.startDate)].sort()[0]
}
