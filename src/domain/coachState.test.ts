import { describe, expect, it } from 'vitest'
import type { CoachEvent, Meal, Pause, Phase, ProfileHeader, WeighIn } from '../storage'
import { addDays } from '../engine/dates'
import { coachState, maintId, plateauId, postponeId, type CoachInput } from './coachState'
import { doneEventId } from './day'

const base = { createdAt: 'x', updatedAt: 'x', deleted: false, deviceId: 'd' }
const header = (target = 70): ProfileHeader => ({
  profile: { name: 'Nasim', sex: 'female', birthDate: '1991-03-15', heightCm: 165, activityLevel: 'onFeet', updatedAt: 'x' },
  settings: { exerciseCreditPct: 50, trainingDays: [0, 2, 4], sessionLengthMin: 45, equipment: [], dumbbellsKg: [], mode: 'moderate', updatedAt: 'x' },
  goal: { type: 'lose', targetWeightKg: target, targetDate: '2027-06-01', startDate: '2026-09-01', startTrendKg: 80, updatedAt: 'x' },
})
const phase = (over: Partial<Phase> = {}): Phase => ({ ...base, id: 'ph1', type: 'fat_loss', startDate: '2026-11-02', endDate: null, reason: '', calorieTargetKcal: 1500, proteinTargetG: 135, ...over })
const wi = (date: string, kg: number): WeighIn => ({ ...base, id: `w-${date}`, date, kg })
const daily = (from: string, n: number, start: number, perDay: number) => Array.from({ length: n }, (_, k) => wi(addDays(from, k), Math.round((start + perDay * k) * 100) / 100))
const ev = (id: string, kind: string, detail: string): CoachEvent => ({ ...base, id, kind, detail })
const pause = (startDate: string, endDate: string | null, reason: Pause['reason'] = 'holiday'): Pause => ({ ...base, id: `p-${startDate}`, startDate, endDate, reason, note: '' })
const meal = (date: string, kcal: number): Meal => ({ ...base, id: `m-${date}`, date, time: '12:00', rawText: '', items: [], totals: { kcal, proteinG: 100 } })

const input = (over: Partial<CoachInput> = {}): CoachInput => ({
  profileId: 'nasim', header: header(), weighIns: [], phases: [phase()], meals: [], pauses: [], events: [], today: '2026-12-01', ...over,
})

describe('coach state', () => {
  it('uses the latest weigh-in until there are 3 in a week', () => {
    const s = coachState(input({ weighIns: [wi('2026-12-01', 80)] }))
    expect(s.weight).toEqual({ kg: 80, fromTrend: false })
    expect(s.trendKg).toBeNull()
    expect(s.proposal).toBeNull()
  })
  it('uses the trend once there are 3', () => {
    const s = coachState(input({ weighIns: [wi('2026-11-29', 81), wi('2026-11-30', 80), wi('2026-12-01', 79)] }))
    expect(s.weight).toEqual({ kg: 80, fromTrend: true })
  })
})

describe('proposals and postponing', () => {
  const near = daily('2026-11-20', 12, 71.0, -0.05) // trend about 70.6 on 2026-12-01
  it('within 1 kg of the target proposes recomposition', () => {
    const s = coachState(input({ weighIns: near }))
    expect(s.trendKg).toBeLessThan(71)
    expect(s.proposal).toEqual({ kind: 'to_recomposition', canPostpone: true })
  })
  it('postponing hides it for a week, then it comes back and cannot be postponed again', () => {
    const e = ev(postponeId('nasim', 'ph1', 'to_recomposition'), 'phase_postponed', '2026-12-01')
    expect(coachState(input({ weighIns: near, events: [e], today: '2026-12-01' })).proposal).toBeNull()
    expect(coachState(input({ weighIns: near, events: [e], today: '2026-12-07' })).proposal).toBeNull()
    expect(coachState(input({ weighIns: daily('2026-11-20', 19, 71.0, -0.05), events: [e], today: '2026-12-08' })).proposal).toEqual({ kind: 'to_recomposition', canPostpone: false })
  })
  it('12 straight deficit weeks proposes a diet break', () => {
    const s = coachState(input({ today: '2026-11-24', phases: [phase({ startDate: '2026-09-01' })], weighIns: daily('2026-11-10', 15, 78, -0.05) }))
    expect(s.proposal?.kind).toBe('diet_break')
  })
  it('a pause holds everything back and pauses the week count', () => {
    const s = coachState(input({ weighIns: near, pauses: [pause('2026-11-28', null)] }))
    expect(s.paused).not.toBeNull()
    expect(s.proposal).toBeNull()
    expect(s.pausedSet.has('2026-11-30')).toBe(true)
  })
})

describe('plateau', () => {
  const flat = daily('2026-10-26', 37, 78, 0)
  const logged = (n: number) => {
    const dates = Array.from({ length: n }, (_, k) => addDays('2026-12-01', -1 - k))
    return { meals: dates.map((d) => meal(d, 1800)), events: dates.map((d) => ev(doneEventId('nasim', d), 'logging_done', d)) }
  }
  it('a stall with 14+ fully logged days proposes the plateau check', () => {
    const s = coachState(input({ weighIns: flat, ...logged(15) }))
    expect(s.plateau).toBe('stalled')
    expect(s.proposal?.kind).toBe('plateau_check')
    expect(s.loggedLast21).toBe(15)
  })
  it('with fewer logged days there is no verdict, only the nudge', () => {
    const s = coachState(input({ weighIns: flat, ...logged(10) }))
    expect(s.proposal).toBeNull()
    expect(s.needLogging).toBe(true)
  })
  it('days without a "done logging" tap, or with no meals, are not fully logged', () => {
    const l = logged(15)
    const s = coachState(input({ weighIns: flat, meals: l.meals, events: l.events.slice(0, 5) }))
    expect(s.loggedLast21).toBe(5)
  })
  it('after you choose an option it stays quiet for 3 weeks; a small adjustment is remembered', () => {
    const choice = ev(plateauId('nasim', '2026-11-25'), 'plateau_choice', JSON.stringify({ option: 'small_adjustment', date: '2026-11-25', kcal: 100, until: '2026-12-23' }))
    const l = logged(15)
    const s = coachState(input({ weighIns: flat, meals: l.meals, events: [...l.events, choice] }))
    expect(s.proposal).toBeNull()
    expect(s.adjustment).toMatchObject({ kcal: 100, until: '2026-12-23' })
    const later = coachState(input({ weighIns: flat, meals: l.meals, events: [...l.events, choice], today: '2026-12-24' }))
    expect(later.adjustment).toBeNull()
  })
})

describe('coming back from a pause', () => {
  const before = daily('2026-10-20', 12, 80, 0) // steady 80 kg until 2026-10-31
  it('holds the pre-pause weight until 3 weigh-ins after the break set a new baseline', () => {
    const back = [wi('2026-11-12', 82)] // post-holiday water
    const s = coachState(input({ weighIns: [...before, ...back], pauses: [pause('2026-11-01', '2026-11-11')], today: '2026-11-12' }))
    expect(s.returning?.awaitingBaseline).toBe(true)
    expect(s.weight).toEqual({ kg: 80, fromTrend: true }) // not the 82
    expect(s.proposal).toBeNull()
  })
  it('then the average of the new weigh-ins is the baseline', () => {
    const back = [wi('2026-11-12', 82), wi('2026-11-13', 81.5), wi('2026-11-14', 81)]
    const s = coachState(input({ weighIns: [...before, ...back], pauses: [pause('2026-11-01', '2026-11-11')], today: '2026-11-14' }))
    expect(s.returning?.awaitingBaseline).toBe(false)
    expect(s.weight).toEqual({ kg: 81.5, fromTrend: true })
  })
  it('weigh-ins taken during the pause are ignored', () => {
    const during = [wi('2026-11-03', 90), wi('2026-11-05', 90), wi('2026-11-07', 90)]
    const back = [wi('2026-11-12', 81), wi('2026-11-13', 81), wi('2026-11-14', 81)]
    const s = coachState(input({ weighIns: [...before, ...during, ...back], pauses: [pause('2026-11-01', '2026-11-11')], today: '2026-11-14' }))
    expect(s.trendKg).toBe(81)
  })
})

describe('maintenance', () => {
  it('uses the latest adaptive update', () => {
    const events = [
      ev(maintId('nasim', '2026-11-09'), 'maintenance_update', JSON.stringify({ maintenance: 2100, updated: true })),
      ev(maintId('nasim', '2026-11-16'), 'maintenance_update', JSON.stringify({ maintenance: 2150, updated: true })),
    ]
    const s = coachState(input({ events }))
    expect(s.maintenanceOverride).toBe(2150)
    expect(s.lastMaintenanceUpdate?.monday).toBe('2026-11-16')
  })
  it('a later Monday with too little data does not reset it', () => {
    const events = [
      ev(maintId('nasim', '2026-11-09'), 'maintenance_update', JSON.stringify({ maintenance: 2100, updated: true })),
      ev(maintId('nasim', '2026-11-16'), 'maintenance_update', JSON.stringify({ updated: false, reason: 'not_enough_days' })),
    ]
    expect(coachState(input({ events })).maintenanceOverride).toBe(2100)
  })
  it('no update yet: the formula is used', () => {
    expect(coachState(input()).maintenanceOverride).toBeNull()
  })
  it('maintenance phase: the ramp starts at the phase snapshot and counts whole weeks', () => {
    const s = coachState(input({ phases: [phase({ type: 'maintenance', startDate: '2026-11-17', calorieTargetKcal: 1630 })], today: '2026-12-01' }))
    expect(s.ramp).toEqual({ startKcal: 1630, weeksInPhase: 2 }) // 15 days
  })
})
