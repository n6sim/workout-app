import type { PhaseType } from '../../storage/types'
import { FOCUS_MUSCLES, focusOfExercise } from './focus'
import { hash, seededOrder } from './hash'
import { DAY_TITLE } from './week'
import { volumeFor } from './volume'
import type { DayKind, Exercise, Finisher, FocusArea, PlannedExercise, SessionPlan, TimedItem } from './types'

/** Default focus areas for a strength day. Core sits fourth so a 4-exercise session still includes it. */
export function defaultFocus(kind: DayKind, weekNumber = 0): FocusArea[] {
  switch (kind) {
    case 'upper': return ['chest', 'back', 'shoulders', 'arms']
    case 'lower': return ['legs', 'glutes', 'core']
    case 'full_body_a': return ['legs', 'chest', 'back', 'core', 'shoulders']
    case 'full_body_b': return ['glutes', 'back', 'chest', 'core', 'arms']
    case 'full_body': return defaultFocus(weekNumber % 2 === 0 ? 'full_body_a' : 'full_body_b')
    default: return []
  }
}

const WARMUP_SECONDS = 300
const COOLDOWN_STRETCHES = 5
const STEADY_CARDIO_MIN = 20
const MOBILITY_CARDIO_MIN = 25

export interface BuildInput {
  kind: DayKind
  phase: PhaseType
  /** Library already filtered to the user's equipment. */
  library: Exercise[]
  sessionLengthMin: number
  /** Same seed, same plan. */
  seed: string
  weekNumber: number
  focus?: FocusArea[]
}

const byId = (lib: Exercise[], id: string) => lib.find((e) => e.id === id)
const item = (e: Exercise, seconds: number): TimedItem => ({ exerciseId: e.id, name: e.name, seconds })

function warmupFor(lib: Exercise[]): TimedItem | null {
  const e = byId(lib, 'Bicycling_Stationary') ?? byId(lib, 'Walking_Treadmill') ?? byId(lib, 'warmup-march')
  return e ? item(e, WARMUP_SECONDS) : null
}

function finisherFor(lib: Exercise[], seed: string): Finisher | null {
  const options = ['Bicycling_Stationary', 'Running_Treadmill', 'cardio-step-platform']
    .map((id) => byId(lib, id))
    .filter((e): e is Exercise => !!e)
  if (!options.length) return null
  const e = seededOrder(options, seed, (x) => x.id)[0]
  const rounds = 6 + (hash(`${seed}:rounds`) % 3) // 6 to 8 rounds of 30 s + 60 s = 9 to 12 minutes
  return { exerciseId: e.id, name: e.name, rounds, hardSec: 30, easySec: 60 }
}

function steadyCardio(lib: Exercise[], minutes: number): TimedItem {
  const e = byId(lib, 'Walking_Treadmill') ?? byId(lib, 'Bicycling_Stationary')
  return e ? item(e, minutes * 60) : { exerciseId: 'walk', name: 'Brisk walk', seconds: minutes * 60 }
}

/** 3 to 5 minutes of stretches for the muscles that were worked, topped up from general mobility. */
export function cooldownFor(lib: Exercise[], focus: FocusArea[], seed: string): TimedItem[] {
  const stretches = lib.filter((e) => e.kind === 'stretch' || e.kind === 'mobility')
  const muscles = new Set(focus.flatMap((f) => FOCUS_MUSCLES[f]))
  const matching = stretches.filter((e) => e.primaryMuscles.some((m) => muscles.has(m)))
  const general = stretches.filter((e) => e.kind === 'mobility' && !matching.includes(e))
  const picked: Exercise[] = []
  // one per focus area first, so every worked area gets a stretch, then fill up
  for (const f of focus) {
    const pool = seededOrder(matching.filter((e) => e.primaryMuscles.some((m) => FOCUS_MUSCLES[f].includes(m))), seed, (e) => e.id)
    const next = pool.find((e) => !picked.includes(e))
    if (next && picked.length < COOLDOWN_STRETCHES) picked.push(next)
  }
  for (const e of [...seededOrder(matching, seed, (x) => x.id), ...seededOrder(general, seed, (x) => x.id)]) {
    if (picked.length >= COOLDOWN_STRETCHES) break
    if (!picked.includes(e)) picked.push(e)
  }
  return picked.map((e) => item(e, e.defaultSeconds ?? 40))
}

/** How many strength exercises fit the session length (4 to 6, spec: Session structure). */
export function exerciseCount(sessionLengthMin: number, focusCount: number): number {
  // warm-up 5 + finisher ~10 + cool-down ~4 = 19 min; each exercise ~6 min (3 sets with rest)
  const fit = Math.min(6, Math.max(4, Math.round((sessionLengthMin - 19) / 6)))
  return Math.max(fit, Math.min(focusCount, 6))
}

function pickStrength(lib: Exercise[], focus: FocusArea, seed: string, used: Set<string>): Exercise | undefined {
  const pool = lib.filter((e) => e.kind === 'strength' && focusOfExercise(e) === focus && !used.has(e.id))
  // compound moves first, then a stable shuffle so weeks vary
  return seededOrder(pool, seed, (e) => e.id).sort((a, b) => Number(b.mechanic === 'compound') - Number(a.mechanic === 'compound'))[0]
}

export function buildStrengthExercises(
  lib: Exercise[], focus: FocusArea[], phase: PhaseType, count: number, seed: string,
): PlannedExercise[] {
  const used = new Set<string>()
  const out: PlannedExercise[] = []
  // round-robin over the focus areas; an area with nothing left is skipped
  for (let i = 0, tries = 0; out.length < count && tries < count * focus.length + focus.length; i++, tries++) {
    const area = focus[i % focus.length]
    const e = pickStrength(lib, area, `${seed}:${area}:${out.length}`, used)
    if (!e) continue
    used.add(e.id)
    const v = volumeFor(phase, out.length)
    const timed = e.mode === 'timed'
    out.push({
      exerciseId: e.id, name: e.name, focus: area, mode: e.mode,
      sets: v.sets, repMin: timed ? 0 : v.repMin, repMax: timed ? 0 : v.repMax, restSec: v.restSec,
      ...(timed ? { seconds: e.defaultSeconds ?? 30 } : {}),
      usesDumbbells: e.equipment === 'dumbbell',
    })
  }
  return out
}

export function estimateMinutes(p: Pick<SessionPlan, 'warmup' | 'exercises' | 'finisher' | 'cardio' | 'cooldown'>): number {
  let sec = (p.warmup?.seconds ?? 0) + (p.cardio?.seconds ?? 0)
  for (const e of p.exercises) sec += e.sets * ((e.seconds ?? 40) + e.restSec)
  if (p.finisher) sec += p.finisher.rounds * (p.finisher.hardSec + p.finisher.easySec)
  sec += p.cooldown.reduce((s, c) => s + c.seconds, 0)
  return Math.round(sec / 60)
}

/** Builds the plan for one day. Pilates info is added by the caller (plan.ts), which knows the history. */
export function buildSessionPlan(i: BuildInput): SessionPlan {
  const title = DAY_TITLE[i.kind]
  const empty: SessionPlan = {
    kind: i.kind, title, focus: [], warmup: null, exercises: [], finisher: null, cardio: null,
    cooldown: [], pilates: null, estMinutes: 0,
  }

  switch (i.kind) {
    case 'pilates':
      return { ...empty, estMinutes: i.sessionLengthMin }
    case 'pilates_cardio':
      return { ...empty, cardio: steadyCardio(i.library, STEADY_CARDIO_MIN), estMinutes: i.sessionLengthMin }
    case 'cardio_mobility': {
      const focus: FocusArea[] = ['legs', 'glutes', 'back']
      const base = { ...empty, focus, cardio: steadyCardio(i.library, MOBILITY_CARDIO_MIN), cooldown: cooldownFor(i.library, focus, i.seed) }
      return { ...base, estMinutes: estimateMinutes(base) }
    }
    default: {
      const focus = i.focus?.length ? i.focus : defaultFocus(i.kind, i.weekNumber)
      const exercises = buildStrengthExercises(
        i.library, focus, i.phase, exerciseCount(i.sessionLengthMin, focus.length), i.seed,
      )
      const base = {
        ...empty, focus, exercises,
        warmup: warmupFor(i.library), finisher: finisherFor(i.library, i.seed),
        cooldown: cooldownFor(i.library, focus, i.seed),
      }
      return { ...base, estMinutes: estimateMinutes(base) }
    }
  }
}

/** Other exercises for the same muscle, equipment and mode (spec: swap exercise). */
export function swapCandidates(plan: SessionPlan, exerciseId: string, lib: Exercise[]): Exercise[] {
  const current = lib.find((e) => e.id === exerciseId)
  if (!current) return []
  const inPlan = new Set(plan.exercises.map((e) => e.exerciseId))
  const area = focusOfExercise(current)
  return lib
    .filter((e) =>
      e.kind === 'strength' && e.id !== exerciseId && !inPlan.has(e.id) &&
      e.equipment === current.equipment && e.mode === current.mode && focusOfExercise(e) === area)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function applySwap(plan: SessionPlan, fromId: string, to: Exercise): SessionPlan {
  return {
    ...plan,
    exercises: plan.exercises.map((e) =>
      e.exerciseId === fromId
        ? { ...e, exerciseId: to.id, name: to.name, usesDumbbells: to.equipment === 'dumbbell', ...(to.mode === 'timed' ? { seconds: to.defaultSeconds ?? 30 } : {}) }
        : e),
  }
}
