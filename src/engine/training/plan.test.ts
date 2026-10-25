import { describe, expect, it } from 'vitest'
import { LIBRARY, ownedLibrary } from '../../data/library'
import { focusWarnings, planDay, weekNumber, type DayPlanInput, type SessionSummary } from './plan'

const library = ownedLibrary(LIBRARY, ['dumbbell', 'body only', 'treadmill', 'standing bike', 'step platform'])
// Week of Mon 2026-10-19: 19 Mon, 20 Tue, 21 Wed, 22 Thu, 23 Fri, 24 Sat, 25 Sun
const input = (date: string, over: Partial<DayPlanInput> = {}): DayPlanInput => ({
  date, trainingDays: [0, 2, 4], phase: 'fat_loss', sessionLengthMin: 45, library, sessions: [], ...over,
})
const sess = (date: string, focus: SessionSummary['plan']['focus'], status: SessionSummary['status'] = 'done'): SessionSummary => ({
  date, status, plan: { focus, kind: 'upper' },
})

describe('planDay', () => {
  it('3 days Mon/Wed/Fri: strength, pilates + cardio, strength, with rest days between', () => {
    expect(planDay(input('2026-10-19')).kind).toBe('full_body_a')
    expect(planDay(input('2026-10-21')).kind).toBe('pilates_cardio')
    expect(planDay(input('2026-10-23')).kind).toBe('full_body_b')
    const rest = planDay(input('2026-10-20'))
    expect(rest).toMatchObject({ kind: 'rest', plan: null, restWalk: true })
  })
  it('a rest day is never a problem or a miss', () => {
    expect(planDay(input('2026-10-24')).problem).toBeUndefined()
  })
  it('asks for 3 to 5 training days', () => {
    expect(planDay(input('2026-10-19', { trainingDays: [0, 2] })).problem).toBe('training_days')
    expect(planDay(input('2026-10-19', { trainingDays: [0, 1, 2, 3, 4, 5] })).problem).toBe('training_days')
  })
  it('the plan is stable through the week and changes the next week', () => {
    const a = planDay(input('2026-10-19')).plan!.exercises.map((e) => e.exerciseId)
    expect(planDay(input('2026-10-19')).plan!.exercises.map((e) => e.exerciseId)).toEqual(a)
    expect(planDay(input('2026-10-26')).plan!.exercises.map((e) => e.exerciseId)).not.toEqual(a)
  })
  it('reports when the equipment cannot build a session', () => {
    const none = ownedLibrary(LIBRARY, ['treadmill'])
    expect(planDay(input('2026-10-19', { library: none })).problem).toBe('no_exercises')
  })
  it('focus override changes the session', () => {
    const p = planDay(input('2026-10-19', { focusOverride: ['legs', 'glutes'] })).plan!
    expect(p.focus).toEqual(['legs', 'glutes'])
  })
})

describe('pilates days', () => {
  const four = { trainingDays: [0, 1, 3, 4] } // Mon upper, Tue lower, Thu pilates, Fri full body
  it('after heavy lower body the day before: low impact with the spec reason', () => {
    const p = planDay(input('2026-10-22', { ...four, sessions: [sess('2026-10-21', ['legs', 'glutes', 'core'])] }))
    expect(p.kind).toBe('pilates')
    expect(p.plan!.pilates).toEqual({ type: 'low_impact_recovery', reason: 'Low impact today: you did heavy lower body yesterday.' })
  })
  it('after a rest day: full body or higher intensity', () => {
    const p = planDay(input('2026-10-22', four))
    expect(['full_body', 'higher_intensity']).toContain(p.plan!.pilates!.type)
    expect(p.plan!.pilates!.reason).toMatch(/rested yesterday/)
  })
  it('in maintenance: lower body strength', () => {
    const p = planDay(input('2026-10-22', { ...four, phase: 'maintenance', sessions: [sess('2026-10-21', ['chest'])] }))
    expect(p.plan!.pilates!.type).toBe('lower_body_strength')
  })
  it('after a trained upper-body day: core', () => {
    const p = planDay(input('2026-10-22', { ...four, sessions: [sess('2026-10-21', ['chest', 'back'])] }))
    expect(p.plan!.pilates!.type).toBe('core')
  })
  it('a light week counts only when there is history to compare against', () => {
    const none = planDay(input('2026-10-22', { ...four, sessions: [sess('2026-10-21', ['chest'])] }))
    expect(none.plan!.pilates!.type).toBe('core') // yesterday trained, no history before this week
    const light = planDay(input('2026-10-22', {
      ...four, sessions: [sess('2026-10-21', ['chest']), sess('2026-10-13', ['chest'])], // 1 of 4 planned last week
    }))
    expect(light.plan!.pilates!.reason).toMatch(/last week was light/)
  })
  it('a skipped session does not count as trained', () => {
    const p = planDay(input('2026-10-22', { ...four, sessions: [sess('2026-10-21', ['legs'], 'skipped')] }))
    expect(p.plan!.pilates!.type).not.toBe('low_impact_recovery')
  })
})

describe('focus warnings', () => {
  it('warns when a muscle group already had two sessions this week', () => {
    const sessions = [sess('2026-10-19', ['chest', 'back']), sess('2026-10-21', ['chest', 'legs'])]
    expect(focusWarnings(['chest', 'back', 'legs'], sessions, '2026-10-19')).toEqual([{ area: 'chest', count: 2 }])
  })
  it('ignores skipped sessions, other weeks, and the day being planned', () => {
    const sessions = [sess('2026-10-19', ['chest']), sess('2026-10-12', ['chest']), sess('2026-10-21', ['chest'], 'skipped'), sess('2026-10-23', ['chest'])]
    expect(focusWarnings(['chest'], sessions, '2026-10-19', '2026-10-23')).toEqual([])
  })
})

describe('weekNumber', () => {
  it('counts whole weeks from a fixed Monday', () => {
    expect(weekNumber('2024-01-01')).toBe(0)
    expect(weekNumber('2024-01-08')).toBe(1)
  })
})
