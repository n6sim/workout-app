import { FOCUS_AREAS, type Exercise, type FocusArea } from './types'

/** Which library muscles count toward each focus area (the library has 17, the user picks from 7). */
export const FOCUS_MUSCLES: Record<FocusArea, string[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abdominals'],
  glutes: ['glutes'],
  legs: ['quadriceps', 'hamstrings', 'calves', 'abductors', 'adductors'],
}

export function focusOfMuscle(muscle: string): FocusArea | null {
  return FOCUS_AREAS.find((f) => FOCUS_MUSCLES[f].includes(muscle)) ?? null
}

/** The focus area an exercise mainly works, from its first primary muscle. */
export function focusOfExercise(e: Pick<Exercise, 'primaryMuscles'>): FocusArea | null {
  return e.primaryMuscles.length ? focusOfMuscle(e.primaryMuscles[0]) : null
}

export const FOCUS_LABEL: Record<FocusArea, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', glutes: 'Glutes', legs: 'Legs',
}
