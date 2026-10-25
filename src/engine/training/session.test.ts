import { describe, expect, it } from 'vitest'
import { LIBRARY, ownedLibrary } from '../../data/library'
import { applySwap, buildSessionPlan, cooldownFor, defaultFocus, exerciseCount, swapCandidates } from './session'
import { expandSteps, nextBlockIndex } from './steps'
import { focusOfExercise } from './focus'
import type { DayKind, SessionPlan } from './types'

const ALL = ownedLibrary(LIBRARY, ['dumbbell', 'body only', 'treadmill', 'standing bike', 'step platform'])
const build = (kind: DayKind, over: Partial<Parameters<typeof buildSessionPlan>[0]> = {}) =>
  buildSessionPlan({ kind, phase: 'fat_loss', library: ALL, sessionLengthMin: 45, seed: '2026-10-19:' + kind, weekNumber: 0, ...over })

describe('library', () => {
  it('has the imported strength moves and 20 hand-written pilates and mobility moves', () => {
    expect(LIBRARY.filter((e) => e.kind === 'strength').length).toBeGreaterThan(150)
    expect(LIBRARY.filter((e) => e.kind === 'pilates' || e.kind === 'mobility')).toHaveLength(20)
  })
  it('never invents video links', () => {
    expect(LIBRARY.every((e) => e.videoUrl === '')).toBe(true)
  })
  it('imported moves have two pictures for the motion loop', () => {
    expect(LIBRARY.filter((e) => e.kind === 'strength').every((e) => e.images.length === 2)).toBe(true)
  })
  it('is filtered to owned equipment', () => {
    const bodyOnly = ownedLibrary(LIBRARY, ['body only'])
    expect(bodyOnly.every((e) => e.equipment === 'body only')).toBe(true)
    expect(bodyOnly.some((e) => e.equipment === ('dumbbell' as string))).toBe(false)
    expect(ownedLibrary(LIBRARY, ['dumbbell']).every((e) => e.equipment === 'dumbbell')).toBe(true)
  })
  it('plank is timed, squats are reps', () => {
    expect(LIBRARY.find((e) => e.id === 'Plank')?.mode).toBe('timed')
    expect(LIBRARY.filter((e) => e.kind === 'stretch').every((e) => e.mode === 'timed')).toBe(true)
  })
})

describe('strength session', () => {
  it('upper day, 45 min, fat loss: 4 moves over chest/back/shoulders/arms, 3 x 8-12', () => {
    const p = build('upper')
    expect(p.exercises).toHaveLength(4)
    expect(p.exercises.map((e) => e.focus)).toEqual(['chest', 'back', 'shoulders', 'arms'])
    for (const e of p.exercises.filter((x) => x.mode === 'reps')) {
      expect(e).toMatchObject({ sets: 3, repMin: 8, repMax: 12 })
      expect(e.restSec).toBeGreaterThanOrEqual(60)
      expect(e.restSec).toBeLessThanOrEqual(90)
    }
  })
  it('has a 5 min bike warm-up, a 8-12 min interval finisher and a 3-5 min cool-down', () => {
    const p = build('lower')
    expect(p.warmup).toMatchObject({ exerciseId: 'Bicycling_Stationary', seconds: 300 })
    const f = p.finisher!
    expect(f.hardSec).toBe(30)
    expect(f.easySec).toBe(60)
    const finisherMin = (f.rounds * (f.hardSec + f.easySec)) / 60
    expect(finisherMin).toBeGreaterThanOrEqual(8)
    expect(finisherMin).toBeLessThanOrEqual(12)
    const coolMin = p.cooldown.reduce((s, c) => s + c.seconds, 0) / 60
    expect(coolMin).toBeGreaterThanOrEqual(3)
    expect(coolMin).toBeLessThanOrEqual(5)
  })
  it('4 to 6 exercises depending on session length', () => {
    expect(exerciseCount(30, 4)).toBe(4)
    expect(exerciseCount(45, 4)).toBe(4)
    expect(exerciseCount(60, 4)).toBe(6)
    expect(exerciseCount(90, 4)).toBe(6)
    expect(build('upper', { sessionLengthMin: 60 }).exercises).toHaveLength(6)
  })
  it('never repeats an exercise and only uses owned equipment', () => {
    for (const kind of ['upper', 'lower', 'full_body_a', 'full_body_b'] as DayKind[]) {
      const lib = ownedLibrary(LIBRARY, ['dumbbell', 'body only'])
      const p = build(kind, { library: lib, sessionLengthMin: 60 })
      const ids = p.exercises.map((e) => e.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(lib.some((e) => e.id === id)).toBe(true)
    }
  })
  it('without any cardio machine: warm-up falls back to marching and there is no finisher', () => {
    const p = build('upper', { library: ownedLibrary(LIBRARY, ['dumbbell', 'body only']) })
    expect(p.warmup?.exerciseId).toBe('warmup-march')
    expect(p.finisher).toBeNull()
  })
  it('the step platform can be the finisher', () => {
    const lib = ownedLibrary(LIBRARY, ['dumbbell', 'body only', 'step platform'])
    expect(build('upper', { library: lib }).finisher?.exerciseId).toBe('cardio-step-platform')
  })
  it('maintenance: 6-10 reps, 90 s, and 2 sets after the first two moves', () => {
    const p = build('upper', { phase: 'maintenance' })
    expect(p.exercises.map((e) => e.sets)).toEqual([3, 3, 2, 2])
    expect(p.exercises[0]).toMatchObject({ repMin: 6, repMax: 10, restSec: 90 })
  })
  it('the same seed gives the same plan; another week gives another', () => {
    expect(build('upper')).toEqual(build('upper'))
    const other = build('upper', { seed: '2026-10-26:upper' })
    expect(other.exercises.map((e) => e.exerciseId)).not.toEqual(build('upper').exercises.map((e) => e.exerciseId))
  })
  it('full body A and B differ, and the 4-day full body alternates by week', () => {
    expect(defaultFocus('full_body_a')).not.toEqual(defaultFocus('full_body_b'))
    expect(defaultFocus('full_body', 0)).toEqual(defaultFocus('full_body_a'))
    expect(defaultFocus('full_body', 1)).toEqual(defaultFocus('full_body_b'))
  })
  it('a 4-move session still includes core on full body days', () => {
    expect(build('full_body_a').focus.slice(0, 4)).toContain('core')
  })
  it('changing focus rebuilds the session around the new areas', () => {
    const p = build('upper', { focus: ['legs', 'glutes'] })
    expect(new Set(p.exercises.map((e) => e.focus))).toEqual(new Set(['legs', 'glutes']))
    expect(p.focus).toEqual(['legs', 'glutes'])
    expect(p.cooldown.length).toBeGreaterThan(0)
  })
  it('estimates a believable length', () => {
    const m = build('upper').estMinutes
    expect(m).toBeGreaterThanOrEqual(35)
    expect(m).toBeLessThanOrEqual(55)
  })
  it('the cool-down stretches the muscles that were worked', () => {
    const cd = cooldownFor(ALL, ['legs'], 'seed')
    expect(cd).toHaveLength(5)
    const legMuscles = ['quadriceps', 'hamstrings', 'calves', 'abductors', 'adductors']
    const first = ALL.find((e) => e.id === cd[0].exerciseId)!
    expect(first.primaryMuscles.some((m) => legMuscles.includes(m))).toBe(true)
  })
})

describe('other day kinds', () => {
  it('pilates days have no strength block', () => {
    const p = build('pilates')
    expect(p.exercises).toEqual([])
    expect(p.finisher).toBeNull()
  })
  it('pilates + cardio has a 20 min steady cardio block on the treadmill', () => {
    expect(build('pilates_cardio').cardio).toMatchObject({ exerciseId: 'Walking_Treadmill', seconds: 1200 })
  })
  it('steady cardio falls back to a plain walk with no machine', () => {
    const p = build('pilates_cardio', { library: ownedLibrary(LIBRARY, ['body only']) })
    expect(p.cardio?.name).toBe('Brisk walk')
  })
  it('cardio + mobility has 25 min cardio then stretches', () => {
    const p = build('cardio_mobility')
    expect(p.cardio?.seconds).toBe(1500)
    expect(p.cooldown.length).toBe(5)
  })
})

describe('steps for the player', () => {
  const plan = build('upper')
  const steps = expandSteps(plan)
  it('runs warm-up, sets, finisher, cool-down in order', () => {
    expect(steps[0]).toMatchObject({ kind: 'timed', group: 'warmup' })
    const groups: string[] = steps.map((s) => (s.kind === 'timed' ? s.group : 'strength'))
    const firstOf = (g: string) => groups.indexOf(g)
    expect(firstOf('warmup')).toBeLessThan(firstOf('strength'))
    expect(firstOf('strength')).toBeLessThan(firstOf('finisher'))
    expect(firstOf('finisher')).toBeLessThan(firstOf('cooldown'))
    expect(steps.at(-1)).toMatchObject({ kind: 'timed', group: 'cooldown' })
  })
  it('has one step per planned set', () => {
    const sets = steps.filter((s) => s.kind === 'set' || s.kind === 'hold')
    expect(sets).toHaveLength(plan.exercises.reduce((n, e) => n + e.sets, 0))
  })
  it('alternates hard 30 s and easy 60 s in the finisher', () => {
    const f = steps.filter((s) => s.kind === 'timed' && s.group === 'finisher')
    expect(f).toHaveLength(plan.finisher!.rounds * 2)
    expect(f[0]).toMatchObject({ seconds: 30, hint: 'hard', round: 1 })
    expect(f[1]).toMatchObject({ seconds: 60, hint: 'easy', round: 1 })
  })
  it('timed strength moves become holds', () => {
    const p: SessionPlan = { ...plan, exercises: [{ exerciseId: 'Plank', name: 'Plank', focus: 'core', mode: 'timed', sets: 2, repMin: 0, repMax: 0, restSec: 60, seconds: 30, usesDumbbells: false }] }
    expect(expandSteps(p).filter((s) => s.kind === 'hold')).toHaveLength(2)
  })
  it('skip jumps to the next exercise', () => {
    const i = steps.findIndex((s) => s.kind === 'set')
    const next = nextBlockIndex(steps, i)
    expect(next - i).toBe(plan.exercises[0].sets)
    expect(nextBlockIndex(steps, steps.length - 1)).toBe(steps.length)
  })
  it('skip in the cool-down moves one stretch at a time', () => {
    const i = steps.findIndex((s) => s.kind === 'timed' && s.group === 'cooldown')
    expect(nextBlockIndex(steps, i)).toBe(i + 1)
  })
})

describe('swap exercise', () => {
  const plan = build('upper')
  const first = plan.exercises[0]
  it('offers the same muscle, equipment and mode, never one already in the plan', () => {
    const cur = ALL.find((e) => e.id === first.exerciseId)!
    const options = swapCandidates(plan, first.exerciseId, ALL)
    expect(options.length).toBeGreaterThan(0)
    for (const o of options) {
      expect(focusOfExercise(o)).toBe(focusOfExercise(cur))
      expect(o.equipment).toBe(cur.equipment)
      expect(o.mode).toBe(cur.mode)
      expect(plan.exercises.some((e) => e.exerciseId === o.id)).toBe(false)
    }
  })
  it('replaces the move and keeps sets and reps', () => {
    const to = swapCandidates(plan, first.exerciseId, ALL)[0]
    const swapped = applySwap(plan, first.exerciseId, to)
    expect(swapped.exercises[0]).toMatchObject({ exerciseId: to.id, name: to.name, sets: first.sets, repMin: first.repMin, repMax: first.repMax })
    expect(swapped.exercises.slice(1)).toEqual(plan.exercises.slice(1))
  })
})
