import { describe, expect, it } from 'vitest'
import { deficitWeeks, limitAdjustment, plateauQuiet, plateauStatus, PLATEAU_OPTIONS, postponeState, proposeTransition, type CoachContext } from './coach'
import { MODES, modeConfig } from './modes'

const ctx = (over: Partial<CoachContext> = {}, phase: Partial<CoachContext['phase']> = {}): CoachContext => ({
  today: '2027-02-01', phase: { type: 'fat_loss', startDate: '2026-11-02', ...phase }, trendKg: 80, targetKg: 70,
  pausedDaysInPhase: 0, loggedDaysLast21: 20, trendChange21: -1.2, paused: false, awaitingBaseline: false, ...over,
})

describe('deficit weeks', () => {
  it('counts whole weeks since the phase started', () => {
    expect(deficitWeeks('2026-11-02', '2026-11-02', 0)).toBe(0) // first day
    expect(deficitWeeks('2026-11-02', '2026-11-07', 0)).toBe(0) // 6 days
    expect(deficitWeeks('2026-11-02', '2026-11-08', 0)).toBe(1) // 2 Nov to 8 Nov is 7 days
  })
  it('12 weeks is 84 days', () => {
    expect(deficitWeeks('2026-11-02', '2027-01-24', 0)).toBe(12)
    expect(deficitWeeks('2026-11-02', '2027-01-23', 0)).toBe(11)
  })
  it('paused days do not count', () => {
    expect(deficitWeeks('2026-11-02', '2027-01-24', 7)).toBe(11)
  })
})

describe('phase proposals', () => {
  it('fat loss, still far from the goal: nothing', () => {
    expect(proposeTransition(ctx({ today: '2026-12-01' }))).toBeNull()
  })
  it('within 1 kg of the target: recomposition', () => {
    expect(proposeTransition(ctx({ today: '2026-12-01', trendKg: 71 }))).toBe('to_recomposition')
    expect(proposeTransition(ctx({ today: '2026-12-01', trendKg: 71.1 }))).toBeNull()
  })
  it('at the target: maintenance, even straight from fat loss', () => {
    expect(proposeTransition(ctx({ today: '2026-12-01', trendKg: 70 }))).toBe('to_maintenance')
    expect(proposeTransition(ctx({ today: '2026-12-01', trendKg: 69.6 }))).toBe('to_maintenance')
  })
  it('recomposition ends when the trend reaches the target', () => {
    expect(proposeTransition(ctx({ trendKg: 70.4 }, { type: 'recomposition' }))).toBeNull()
    expect(proposeTransition(ctx({ trendKg: 70 }, { type: 'recomposition' }))).toBe('to_maintenance')
  })
  it('12 straight deficit weeks: a diet break', () => {
    expect(proposeTransition(ctx({ today: '2027-01-24', trendChange21: -1.5 }))).toBe('diet_break')
    expect(proposeTransition(ctx({ today: '2027-01-23', trendChange21: -1.5 }))).toBeNull()
  })
  it('reaching the target comes before a diet break', () => {
    expect(proposeTransition(ctx({ today: '2027-01-24', trendKg: 70.5 }))).toBe('to_recomposition')
  })
  it('a stall proposes the plateau check', () => {
    expect(proposeTransition(ctx({ today: '2026-12-01', trendChange21: -0.1 }))).toBe('plateau_check')
  })
  it('a diet break ends when its time is up', () => {
    expect(proposeTransition(ctx({ today: '2027-02-07' }, { type: 'diet_break', plannedEndDate: '2027-02-08' }))).toBeNull()
    expect(proposeTransition(ctx({ today: '2027-02-08' }, { type: 'diet_break', plannedEndDate: '2027-02-08' }))).toBe('end_diet_break')
  })
  it('maintenance proposes nothing (a new goal is yours to start)', () => {
    expect(proposeTransition(ctx({ trendKg: 70 }, { type: 'maintenance' }))).toBeNull()
  })
  it('without a trend, or while paused or waiting for a new baseline: nothing', () => {
    expect(proposeTransition(ctx({ trendKg: null }))).toBeNull()
    expect(proposeTransition(ctx({ trendKg: 70, paused: true }))).toBeNull()
    expect(proposeTransition(ctx({ trendKg: 70, awaitingBaseline: true }))).toBeNull()
  })
  it('a maintain goal has no target to reach', () => {
    expect(proposeTransition(ctx({ today: '2026-12-01', targetKg: null }))).toBeNull()
  })
})

describe('plateau', () => {
  const at = (over: Partial<CoachContext>) => ctx({ today: '2026-12-01', ...over })
  it('stalled: under 0.2 kg lost in 21 days with 14+ logged days', () => {
    expect(plateauStatus(at({ trendChange21: -0.19, loggedDaysLast21: 14 }))).toBe('stalled')
    expect(plateauStatus(at({ trendChange21: 0.3, loggedDaysLast21: 14 }))).toBe('stalled')
  })
  it('moving: 0.2 kg or more', () => {
    expect(plateauStatus(at({ trendChange21: -0.2 }))).toBe('moving')
  })
  it('fewer than 14 logged days: no verdict, and the message to log more', () => {
    expect(plateauStatus(at({ trendChange21: -0.05, loggedDaysLast21: 13 }))).toBe('need_logging')
    expect(proposeTransition(at({ trendChange21: -0.05, loggedDaysLast21: 13 }))).toBeNull()
  })
  it('only while in fat loss, and not in the first 3 weeks of a phase', () => {
    expect(plateauStatus(ctx({ trendChange21: 0 }, { type: 'recomposition' }))).toBe('too_early')
    expect(plateauStatus(ctx({ today: '2026-11-15', trendChange21: 0 }))).toBe('too_early')
  })
  it('lists the four options in order, the last one locked', () => {
    expect(PLATEAU_OPTIONS.map((o) => o.id)).toEqual(['logging_check', 'diet_break', 'small_adjustment', 'aggressive_block'])
    expect(PLATEAU_OPTIONS.map((o) => !!o.disabled)).toEqual([false, false, false, true])
    expect(PLATEAU_OPTIONS[3].detail).toBe('Coming in 2.0')
  })
  it('a small adjustment never goes below the floor', () => {
    expect(limitAdjustment(1500, 1200, 150)).toBe(150)
    expect(limitAdjustment(1250, 1200, 150)).toBe(50)
    expect(limitAdjustment(1200, 1200, 100)).toBe(0)
    expect(limitAdjustment(1100, 1200, 100)).toBe(0)
  })
  it('after a choice it is not offered again for 3 weeks (a logging check re-checks after 7 days)', () => {
    expect(plateauQuiet(null, '2026-12-01')).toBe(false)
    expect(plateauQuiet({ option: 'diet_break', date: '2026-12-01' }, '2026-12-21')).toBe(true)
    expect(plateauQuiet({ option: 'diet_break', date: '2026-12-01' }, '2026-12-22')).toBe(false)
    expect(plateauQuiet({ option: 'logging_check', date: '2026-12-01' }, '2026-12-07')).toBe(true)
    expect(plateauQuiet({ option: 'logging_check', date: '2026-12-01' }, '2026-12-08')).toBe(false)
  })
})

describe('postponing', () => {
  it('can be postponed once, for one week', () => {
    expect(postponeState(null, '2026-12-01')).toEqual({ hidden: false, canPostpone: true })
    expect(postponeState('2026-12-01', '2026-12-07')).toEqual({ hidden: true, canPostpone: false })
    expect(postponeState('2026-12-01', '2026-12-08')).toEqual({ hidden: false, canPostpone: false })
  })
})

describe('aggressive mode stub', () => {
  it('has every field null, and cannot be selected', () => {
    expect(Object.values(MODES.aggressive).every((v) => v === null)).toBe(true)
    expect(Object.keys(MODES.aggressive).sort()).toEqual(['calorieFloorKcal', 'maxDeficitKcal', 'maxWeeklyLossFraction', 'maxWeeksPerBlock', 'proteinGPerKg', 'volumeTable'])
    expect(() => modeConfig('aggressive')).toThrow(/coming in 2.0/i)
  })
  it('moderate has the spec values', () => {
    expect(modeConfig()).toMatchObject({ maxDeficitKcal: 500, maxWeeksPerBlock: 12, proteinGPerKg: 1.8, calorieFloorKcal: { female: 1200, male: 1500 } })
  })
})
