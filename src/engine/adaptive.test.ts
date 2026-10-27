import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { adaptiveMaintenance, type IntakeDay } from './adaptive'
import type { WeighPoint } from './trend'

const MONDAY = '2026-11-16'
// Weigh-ins every day for the 28 days before the Monday, falling 0.05 kg a day from 80 kg.
const falling = (perDay: number): WeighPoint[] =>
  Array.from({ length: 28 }, (_, i) => ({ date: addDays(addDays(MONDAY, -28), i), kg: 80 + perDay * i }))
const logged = (n: number, kcal: number, skip: number[] = []): IntakeDay[] =>
  Array.from({ length: 21 }, (_, i) => ({ date: addDays(MONDAY, -21 + i), kcal })).filter((_, i) => i < n + skip.length && !skip.includes(i)).slice(0, n)

describe('adaptive maintenance (rule 8), sample data', () => {
  it('eating 2000 while losing 1 kg of trend in 20 days means maintenance is about 2385', () => {
    // estimate = 2000 - (-1.0 x 7700 / 20) = 2385; new = 0.7 x 2300 + 0.3 x 2385 = 2325.5 -> 2326
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(21, 2000), weighIns: falling(-0.05) })
    expect(r).toMatchObject({ updated: true, estimate: 2385, avgIntake: 2000, loggedCount: 21, days: 20, trendChangeKg: -1 })
    expect(r.updated && r.maintenance).toBe(2326)
  })
  it('stable weight: maintenance is what you eat', () => {
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2000, loggedDays: logged(21, 2000), weighIns: falling(0) })
    expect(r.updated && r.estimate).toBe(2000)
    expect(r.updated && r.maintenance).toBe(2000)
  })
  it('gaining weight while eating 2500 means maintenance is lower', () => {
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2500, loggedDays: logged(21, 2500), weighIns: falling(0.05) })
    expect(r.updated && r.estimate).toBe(2115) // 2500 - 1.0 x 7700 / 20
  })
  it('changes by at most 5% a week', () => {
    // estimate 3500 (flat weight, eating 3500). 0.7 x 2000 + 0.3 x 3500 = 2450, capped at 2100.
    const up = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2000, loggedDays: logged(21, 3500), weighIns: falling(0) })
    expect(up.updated && up.maintenance).toBe(2100)
    const down = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 3000, loggedDays: logged(21, 1000), weighIns: falling(0) })
    expect(down.updated && down.maintenance).toBe(2850)
  })
  it('needs at least 14 fully logged days of the 21', () => {
    expect(adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(13, 2000), weighIns: falling(-0.05) })).toEqual({ updated: false, maintenance: 2300, reason: 'not_enough_days' })
    expect(adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(14, 2000), weighIns: falling(-0.05) }).updated).toBe(true)
  })
  it('unlogged days are skipped, never treated as zero', () => {
    // 14 logged days at 2000 and 7 unlogged days: the average is still 2000, not 1333
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(14, 2000), weighIns: falling(-0.05) })
    expect(r.updated && r.avgIntake).toBe(2000)
  })
  it('only counts days in the 21-day window', () => {
    const days = [...logged(14, 2000), { date: addDays(MONDAY, -40), kcal: 9000 }, { date: MONDAY, kcal: 9000 }]
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: days, weighIns: falling(-0.05) })
    expect(r.updated && r.avgIntake).toBe(2000)
  })
  it('paused days do not count', () => {
    const paused = new Set(Array.from({ length: 8 }, (_, i) => addDays(MONDAY, -21 + i)))
    const r = adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(21, 2000), weighIns: falling(-0.05), paused })
    expect(r).toMatchObject({ updated: false, reason: 'not_enough_days' }) // only 13 usable days are left
  })
  it('a day with no meals logged is not a logged day', () => {
    const days = logged(21, 2000).map((d, i) => (i < 8 ? { ...d, kcal: 0 } : d))
    expect(adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: days, weighIns: falling(-0.05) }).updated).toBe(false)
  })
  it('without enough weigh-ins there is no trend, so no update', () => {
    const few: WeighPoint[] = [{ date: addDays(MONDAY, -3), kg: 80 }, { date: addDays(MONDAY, -2), kg: 80 }]
    expect(adaptiveMaintenance({ monday: MONDAY, oldMaintenance: 2300, loggedDays: logged(21, 2000), weighIns: few })).toEqual({ updated: false, maintenance: 2300, reason: 'no_trend' })
  })
})
