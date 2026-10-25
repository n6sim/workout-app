import type { Activity, CoachEvent, Meal, Phase, ProfileHeader, ProfileId, WeighIn } from '../storage'
import { calorieFloor, dailyTargets, type DailyTargets } from '../engine/targets'
import { todayBudget, type TodayBudget } from '../engine/budget'
import { creditedByDate, eatenByDate, flexDayOfWeek, proteinOn } from './day'

export function latestWeighIn(weighIns: WeighIn[]): WeighIn | undefined {
  return [...weighIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
}

export interface TodayInfo {
  latest: WeighIn | undefined
  targets: DailyTargets | null
  budget: TodayBudget | null
  proteinEaten: number
  flexDate: string | null
}

/** Everything Today and Week need, from one place. */
export function todayInfo(i: {
  profileId: ProfileId; header: ProfileHeader; weighIns: WeighIn[]; phases: Phase[]
  meals: Meal[]; activities: Activity[]; events: CoachEvent[]; today: string
}): TodayInfo {
  const latest = latestWeighIn(i.weighIns)
  const phase = i.phases.find((p) => p.endDate === null)
  const targets = latest
    ? dailyTargets({
        sex: i.header.profile.sex, birthDate: i.header.profile.birthDate, heightCm: i.header.profile.heightCm,
        weightKg: latest.kg, activityLevel: i.header.profile.activityLevel,
        phase: phase?.type === 'fat_loss' ? 'fat_loss' : 'maintenance',
        targetWeightKg: i.header.goal.targetWeightKg, targetDate: i.header.goal.targetDate,
        today: i.today, mode: i.header.settings.mode,
      })
    : null
  const flexDate = flexDayOfWeek(i.events, i.profileId, i.today)
  const budget = targets
    ? todayBudget({
        today: i.today, dailyTarget: targets.calorieTargetKcal,
        calorieFloor: calorieFloor(i.header.profile.sex, i.header.settings.mode),
        startDate: i.header.goal.startDate,
        eatenByDate: eatenByDate(i.meals), creditedByDate: creditedByDate(i.activities), flexDate,
      })
    : null
  return { latest, targets, budget, proteinEaten: proteinOn(i.meals, i.today), flexDate }
}
