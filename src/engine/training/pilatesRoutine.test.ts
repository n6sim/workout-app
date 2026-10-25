import { describe, expect, it } from 'vitest'
import { LIBRARY, ownedLibrary } from '../../data/library'
import { PILATES_LABEL } from './pilates'
import { PILATES_ROUTINES } from './pilatesRoutine'
import { planDay } from './plan'
import { expandSteps } from './steps'
import type { PilatesType } from './types'

const library = ownedLibrary(LIBRARY, ['dumbbell', 'body only', 'treadmill', 'standing bike', 'step platform'])
const types = Object.keys(PILATES_LABEL) as PilatesType[]

describe('pilates routines', () => {
  it('every type has a routine of real, body-weight moves with written instructions', () => {
    for (const t of types) {
      const ids = PILATES_ROUTINES[t]
      expect(ids.length, t).toBeGreaterThanOrEqual(5)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        const e = LIBRARY.find((x) => x.id === id)
        expect(e, `${t}: ${id}`).toBeDefined()
        expect(e!.equipment).toBe('body only')
        expect(e!.instructions.length).toBeGreaterThan(0)
      }
    }
  })
  it('core is built around the hundred, lower body around glutes and hips', () => {
    expect(PILATES_ROUTINES.core).toContain('pilates-the-hundred')
    expect(PILATES_ROUTINES.lower_body_strength).toContain('pilates-glute-bridge')
    expect(PILATES_ROUTINES.low_impact_recovery).not.toContain('pilates-the-hundred')
  })
})

describe('pilates day plan', () => {
  // Wed 2026-10-21 is the pilates day for Mon/Tue/Wed/Fri? use 4 days: Mon upper, Tue lower, Thu pilates, Fri full body
  const four = { date: '2026-10-22', trainingDays: [0, 1, 3, 4], phase: 'fat_loss' as const, sessionLengthMin: 45, library, sessions: [] }

  it('a pilates day comes with a routine, a warm-up and stretches', () => {
    const p = planDay(four).plan!
    expect(p.kind).toBe('pilates')
    expect(p.exercises.length).toBeGreaterThanOrEqual(5)
    expect(p.warmup?.exerciseId).toBe('mobility-cat-cow')
    expect(p.cooldown.length).toBeGreaterThanOrEqual(2)
    expect(p.estMinutes).toBeGreaterThanOrEqual(10)
    expect(p.estMinutes).toBeLessThanOrEqual(30)
  })
  it('the routine matches the picked type', () => {
    const p = planDay(four).plan!
    const wanted = PILATES_ROUTINES[p.pilates!.type]
    expect(p.exercises.map((e) => e.exerciseId)).toEqual(wanted)
  })
  it('holds are timed, other moves are 2 sets of 8 to 10', () => {
    for (const t of types) {
      const p = planDay({ ...four, sessions: t === 'low_impact_recovery' ? [{ date: '2026-10-21', status: 'done', plan: { kind: 'lower', focus: ['legs'] } }] : [] }).plan!
      for (const e of p.exercises) {
        if (e.mode === 'timed') expect(e.seconds).toBeGreaterThan(0)
        else expect(e).toMatchObject({ sets: 2, repMin: 8, repMax: 10 })
      }
    }
  })
  it('pilates + cardio runs the cardio first, then the routine, in one session', () => {
    const p = planDay({ ...four, date: '2026-10-21', trainingDays: [0, 2, 4] }).plan!
    expect(p.kind).toBe('pilates_cardio')
    const steps = expandSteps(p)
    const groups = steps.map((s) => (s.kind === 'timed' ? s.group : 'moves'))
    expect(groups.indexOf('cardio')).toBeLessThan(groups.indexOf('moves'))
    expect(p.estMinutes).toBeGreaterThan(30)
  })
  it('without body-weight equipment the day falls back to the video link only', () => {
    const p = planDay({ ...four, library: ownedLibrary(LIBRARY, ['dumbbell']) }).plan!
    expect(p.exercises).toEqual([])
    expect(p.estMinutes).toBe(45)
  })
})
