import { estimateMinutes } from './session'
import type { Exercise, PilatesType, PlannedExercise, SessionPlan, TimedItem } from './types'

// In-app pilates routines built only from the hand-written moves, so a pilates day always has something
// to do even before you add a MadFit video link. Each is a short mat session (about 15 to 20 minutes).
const P = (name: string) => `pilates-${name}`
const M = (name: string) => `mobility-${name}`

export const PILATES_ROUTINES: Record<PilatesType, string[]> = {
  core: [P('the-hundred'), P('single-leg-stretch'), P('double-leg-stretch'), P('criss-cross'), P('roll-up'), P('dead-bug'), P('side-plank')],
  lower_body_strength: [P('glute-bridge'), P('clamshell'), P('side-lying-leg-lift'), P('bird-dog'), P('leg-circles'), P('dead-bug')],
  full_body: [P('dead-bug'), P('glute-bridge'), P('bird-dog'), P('swimming'), P('spine-twist'), P('roll-up'), P('side-plank')],
  low_impact_recovery: [P('dead-bug'), P('glute-bridge'), P('bird-dog'), P('clamshell'), P('spine-twist')],
  higher_intensity: [P('the-hundred'), P('roll-up'), P('criss-cross'), P('double-leg-stretch'), P('swimming'), P('side-plank'), P('single-leg-stretch')],
}

const COOLDOWN: Record<PilatesType, string[]> = {
  core: [M('childs-pose'), M('cat-cow')],
  lower_body_strength: [M('figure-four'), M('hip-flexor-stretch'), M('childs-pose')],
  full_body: [M('childs-pose'), M('figure-four'), M('open-book')],
  low_impact_recovery: [M('cat-cow'), M('open-book'), M('figure-four'), M('hip-flexor-stretch'), M('childs-pose')],
  higher_intensity: [M('childs-pose'), M('hip-flexor-stretch'), M('cat-cow')],
}

/** Fills a pilates day with a routine for the chosen type. Moves missing from the library are skipped. */
export function applyPilatesRoutine(plan: SessionPlan, type: PilatesType, library: Exercise[]): SessionPlan {
  const find = (id: string) => library.find((e) => e.id === id)
  const exercises: PlannedExercise[] = PILATES_ROUTINES[type].flatMap((id) => {
    const e = find(id)
    if (!e) return []
    const timed = e.mode === 'timed'
    const seconds = e.defaultSeconds ?? 30
    return [{
      exerciseId: e.id, name: e.name, focus: null, mode: e.mode,
      // The hundred is one 60 s block; holds are done twice (once per side); other moves are 2 sets of 8 to 10.
      sets: e.id === P('the-hundred') ? 1 : 2,
      repMin: timed ? 0 : 8, repMax: timed ? 0 : 10, restSec: timed ? 20 : 30,
      ...(timed ? { seconds } : {}),
      usesDumbbells: false,
    }]
  })
  const cooldown: TimedItem[] = COOLDOWN[type].flatMap((id) => {
    const e = find(id)
    return e ? [{ exerciseId: e.id, name: e.name, seconds: e.defaultSeconds ?? 40 }] : []
  })
  const cat = find(M('cat-cow'))
  const warmup: TimedItem | null = cat ? { exerciseId: cat.id, name: cat.name, seconds: 40 } : null
  const next = { ...plan, exercises, cooldown, warmup }
  return { ...next, estMinutes: exercises.length ? estimateMinutes(next) : plan.estMinutes }
}
