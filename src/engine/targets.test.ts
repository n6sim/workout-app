import { describe, expect, it } from 'vitest'
import { dailyTargets, calorieFloor, maxDeficit, neededDeficit, proteinTarget, type TargetInput } from './targets'
import { baseMaintenance } from './maintenance'

// Fictional test profile. Hand calculation:
//   age 35 (born 1991-03-15, today 2026-10-24)
//   BMR = 10*75 + 6.25*165 - 5*35 - 161 = 1445.25
//   maintenance = 1445.25 * 1.3 (on feet) = 1878.825
const base: TargetInput = {
  sex: 'female',
  birthDate: '1991-03-15',
  heightCm: 165,
  weightKg: 75,
  activityLevel: 'onFeet',
  phase: 'fat_loss',
  targetWeightKg: 70,
  targetDate: '2027-02-01', // 100 days away
  today: '2026-10-24',
}

describe('maintenance', () => {
  it('applies the daily-life factor', () => {
    expect(baseMaintenance(1000, 'desk')).toBe(1200)
    expect(baseMaintenance(1000, 'onFeet')).toBe(1300)
    expect(baseMaintenance(1000, 'active')).toBe(1400)
  })
})

describe('neededDeficit', () => {
  it('(75-70) * 7700 / 100 days = 385', () => {
    expect(neededDeficit(75, 70, 100)).toBe(385)
  })
  it('is zero when the target is at or above current weight', () => {
    expect(neededDeficit(70, 70, 30)).toBe(0)
    expect(neededDeficit(70, 75, 30)).toBe(0)
  })
  it('treats a date that is today or past as 1 day', () => {
    expect(neededDeficit(75, 74, 0)).toBe(7700)
    expect(neededDeficit(75, 74, -5)).toBe(7700)
  })
})

describe('deficit cap', () => {
  it('is 500 kcal/day for heavier people (75 kg: percent cap would be 618.75)', () => {
    expect(maxDeficit(75)).toBe(500)
  })
  it('is the 0.75%/week cap for lighter people (60 kg: 60*0.0075*7700/7 = 495)', () => {
    expect(maxDeficit(60)).toBeCloseTo(495, 5)
  })
})

describe('calorie floor', () => {
  it('is 1200 female, 1500 male', () => {
    expect(calorieFloor('female')).toBe(1200)
    expect(calorieFloor('male')).toBe(1500)
  })
  it('lifts a female target that would fall below 1200', () => {
    // 55 kg, 160 cm, age 40: BMR 1189, desk 1426.8, goal 5 kg in 30 days wants 1283 -> capped at 55*0.0075*1100 = 453.75
    const t = dailyTargets({
      ...base, weightKg: 55, heightCm: 160, birthDate: '1986-01-01', activityLevel: 'desk',
      targetWeightKg: 50, targetDate: '2026-11-23',
    })
    expect(t.maintenanceKcal).toBeCloseTo(1426.8, 5)
    expect(t.deficitKcal).toBeCloseTo(453.75, 5)
    expect(t.floorApplied).toBe(true)
    expect(t.calorieTargetKcal).toBe(1200)
  })
  it('lifts a male target that would fall below 1500', () => {
    // 70 kg, 175 cm, age 50: BMR 1548.75, desk 1858.5, minus 500 = 1358.5 -> 1500
    const t = dailyTargets({
      ...base, sex: 'male', weightKg: 70, heightCm: 175, birthDate: '1976-01-01', activityLevel: 'desk',
      targetWeightKg: 60, targetDate: '2026-12-01',
    })
    expect(t.floorApplied).toBe(true)
    expect(t.calorieTargetKcal).toBe(1500)
  })
})

describe('protein target', () => {
  it('is 1.8 g/kg rounded to 5 g', () => {
    expect(proteinTarget(75)).toBe(135)
    expect(proteinTarget(70)).toBe(125)
    expect(proteinTarget(82)).toBe(150) // 147.6
    expect(proteinTarget(80)).toBe(145) // 144
    expect(proteinTarget(82.5)).toBe(150) // 148.5
  })
})

describe('dailyTargets', () => {
  it('test profile: 1878.825 - 385 = 1493.825 -> 1490 kcal, 135 g protein', () => {
    const t = dailyTargets(base)
    expect(t.bmrKcal).toBeCloseTo(1445.25, 5)
    expect(t.maintenanceKcal).toBeCloseTo(1878.825, 5)
    expect(t.neededDeficitKcal).toBe(385)
    expect(t.goalTooFast).toBe(false)
    expect(t.floorApplied).toBe(false)
    expect(t.calorieTargetKcal).toBe(1490)
    expect(t.proteinTargetG).toBe(135)
  })
  it('caps a too-fast goal and reports the moderate-pace date', () => {
    // 5 kg in 50 days needs 770/day; capped at 500. 38500/500 = 77 days -> 2027-01-09
    const t = dailyTargets({ ...base, targetDate: '2026-12-13' })
    expect(t.neededDeficitKcal).toBe(770)
    expect(t.goalTooFast).toBe(true)
    expect(t.deficitKcal).toBe(500)
    expect(t.moderateDate).toBe('2027-01-09')
    expect(t.calorieTargetKcal).toBe(1380) // 1378.825
  })
  it('maintenance phase has no deficit', () => {
    const t = dailyTargets({ ...base, phase: 'maintenance', targetWeightKg: undefined, targetDate: undefined })
    expect(t.deficitKcal).toBe(0)
    expect(t.calorieTargetKcal).toBe(1880) // 1878.825
  })
})

describe('phases and adjustments (M5)', () => {
  it('recomposition is maintenance minus 250', () => {
    const t = dailyTargets({ ...base, phase: 'recomposition' })
    expect(t.calorieTargetKcal).toBe(Math.round((1878.825 - 250) / 10) * 10) // 1630
  })
  it('a diet break eats at maintenance', () => {
    expect(dailyTargets({ ...base, phase: 'diet_break' }).calorieTargetKcal).toBe(1880)
  })
  it('adaptive maintenance replaces the formula', () => {
    const t = dailyTargets({ ...base, phase: 'maintenance', maintenanceOverrideKcal: 2100 })
    expect(t.maintenanceKcal).toBe(2100)
    expect(t.calorieTargetKcal).toBe(2100)
    expect(dailyTargets({ ...base, maintenanceOverrideKcal: 2100 }).calorieTargetKcal).toBe(1720) // 2100 - 385 = 1715, rounded to the nearest 10
  })
  it('a plateau adjustment lowers fat loss by 100 to 150, but never below the floor', () => {
    expect(dailyTargets({ ...base, extraDeficitKcal: 100 }).calorieTargetKcal).toBe(1390)
    expect(dailyTargets({ ...base, extraDeficitKcal: 150 }).calorieTargetKcal).toBe(1340)
    const low = dailyTargets({ ...base, maintenanceOverrideKcal: 1500, extraDeficitKcal: 150 })
    expect(low.calorieTargetKcal).toBe(1200)
    expect(low.floorApplied).toBe(true)
  })
  it('maintenance after a goal: calories rise 100 a week until they reach maintenance', () => {
    const ramp = (weeksInPhase: number) => dailyTargets({ ...base, phase: 'maintenance', ramp: { startKcal: 1630, weeksInPhase } }).calorieTargetKcal
    expect(ramp(0)).toBe(1630)
    expect(ramp(1)).toBe(1730)
    expect(ramp(2)).toBe(1830)
    expect(ramp(3)).toBe(1880) // capped at maintenance 1878.8
    expect(ramp(9)).toBe(1880)
  })
  it('protein follows the weight given (trend weight)', () => {
    expect(dailyTargets({ ...base, weightKg: 70 }).proteinTargetG).toBe(125)
  })
})
