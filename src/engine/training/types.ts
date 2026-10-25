export type FocusArea = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'glutes' | 'legs'
export const FOCUS_AREAS: FocusArea[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs']

export type Equipment = 'dumbbell' | 'body only' | 'treadmill' | 'standing bike' | 'step platform'
export const ALL_EQUIPMENT: Equipment[] = ['dumbbell', 'body only', 'treadmill', 'standing bike', 'step platform']

export type ExerciseKind = 'strength' | 'stretch' | 'cardio' | 'pilates' | 'mobility' | 'warmup'

/** One entry of the exercise library (imported or hand-written). */
export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  equipment: Equipment
  /** free-exercise-db muscle names, e.g. "abdominals", "middle back". */
  primaryMuscles: string[]
  secondaryMuscles: string[]
  mechanic?: string | null
  level?: string
  /** `timed` for holds, stretches and cardio; `reps` for everything else. */
  mode: 'reps' | 'timed'
  defaultSeconds?: number
  /** Start and end picture, relative to the app base. Empty for hand-written moves. */
  images: string[]
  instructions: string[]
  /** Optional reference link, filled in by the user. Never invented. */
  videoUrl: string
}

/** The days a weekly template can contain (spec: Weekly templates). */
export type DayKind =
  | 'full_body_a' | 'full_body_b' | 'upper' | 'lower' | 'full_body'
  | 'pilates' | 'pilates_cardio' | 'cardio_mobility'

export type PilatesType = 'core' | 'lower_body_strength' | 'full_body' | 'low_impact_recovery' | 'higher_intensity'

export interface PlannedExercise {
  exerciseId: string
  name: string
  focus: FocusArea | null
  mode: 'reps' | 'timed'
  sets: number
  repMin: number
  repMax: number
  restSec: number
  /** Hold length for timed strength moves such as plank. */
  seconds?: number
  usesDumbbells: boolean
}

export interface TimedItem {
  exerciseId: string
  name: string
  seconds: number
}

/** Intervals on a bike, treadmill or step (spec: 30 s hard, 60 s easy). */
export interface Finisher {
  exerciseId: string
  name: string
  rounds: number
  hardSec: number
  easySec: number
}

/** Everything the player needs for one day, saved with the session so history stays readable. */
export interface SessionPlan {
  kind: DayKind
  title: string
  focus: FocusArea[]
  warmup: TimedItem | null
  exercises: PlannedExercise[]
  finisher: Finisher | null
  /** Steady cardio block (pilates + cardio day, cardio + mobility day). */
  cardio: TimedItem | null
  cooldown: TimedItem[]
  pilates: { type: PilatesType; reason: string } | null
  estMinutes: number
}

/** Logged work, as stored on a session. */
export interface SetRecord {
  exerciseId: string
  setNo: number
  reps?: number
  seconds?: number
  weightKg?: number
}
