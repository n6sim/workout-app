import type { ActivityLevel, ModeName, Sex } from '../engine/types'
import type { SessionPlan, SetRecord } from '../engine/training/types'

/** Bump when the document shape changes and add a step to migrate.ts. */
export const SCHEMA_VERSION = 1

export type ProfileId = 'nasim' | 'kash'
export const PROFILES: { id: ProfileId; name: string }[] = [
  { id: 'nasim', name: 'Nasim' },
  { id: 'kash', name: 'Kash' },
]

/** Fields on every entry (spec: Data model). Soft delete so deletes merge like edits. */
export interface EntryBase {
  id: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  deviceId: string
}

export type Stamped<T> = T & { updatedAt: string }

export interface ProfileInfo {
  name: string
  sex: Sex
  birthDate: string
  heightCm: number
  activityLevel: ActivityLevel
}

export interface Settings {
  /** Share of estimated exercise calories credited to the budget, percent. */
  exerciseCreditPct: number
  /** Weekdays, 0 = Monday ... 6 = Sunday. */
  trainingDays: number[]
  sessionLengthMin: number
  equipment: string[]
  /** Dumbbell weights owned, kg. */
  dumbbellsKg: number[]
  mode: ModeName
}

export interface Goal {
  type: 'lose' | 'maintain'
  targetWeightKg?: number
  targetDate?: string
  startDate: string
  startTrendKg: number
}

export type PhaseType = 'fat_loss' | 'recomposition' | 'maintenance' | 'diet_break' | 'aggressive'

export interface Phase extends EntryBase {
  type: PhaseType
  startDate: string
  endDate: string | null
  reason: string
  calorieTargetKcal: number
  proteinTargetG: number
}

export interface WeighIn extends EntryBase {
  date: string
  kg: number
}

// The shapes below are not used until later milestones; they exist so the data model matches the spec.

export interface MealItem {
  foodId: string
  qty: number
  unit: string
  kcal: number
  proteinG: number
}
export interface Meal extends EntryBase {
  date: string
  time: string
  rawText: string
  items: MealItem[]
  totals: { kcal: number; proteinG: number }
}

export interface Activity extends EntryBase {
  date: string
  type: string
  minutes: number
  estKcal: number
  creditedKcal: number
}

export interface Session extends EntryBase {
  date: string
  /** The plan as it was when the workout started (focus changes and swaps included). */
  plan: SessionPlan
  status: 'done' | 'partial' | 'skipped'
  sets: SetRecord[]
  startedAt?: string
  finishedAt?: string
  /** Where to pick up if the app is closed mid-workout. */
  stepIndex?: number
}

export interface Pause extends EntryBase {
  startDate: string
  endDate: string | null
  reason: 'holiday' | 'sick' | 'busy'
  note: string
}

/** Nutrition values are entered by the user or generated from the Canadian Nutrient File. Never invented. */
export interface Food extends EntryBase {
  name: string
  aliases: string[]
  kcalPer100g?: number
  proteinPer100g?: number
  kcalPerPiece?: number
  proteinPerPiece?: number
  gramsPerPiece?: number
}

export interface SavedMeal extends EntryBase {
  name: string
  items: MealItem[]
}

export interface PilatesLink extends EntryBase {
  type: string
  title: string
  /** Filled in by the user. Never invented. */
  url: string
}

export interface CoachEvent extends EntryBase {
  kind: string
  detail: string
}

export interface EntryMap {
  phases: Phase
  weighIns: WeighIn
  meals: Meal
  activities: Activity
  sessions: Session
  pauses: Pause
  foods: Food
  savedMeals: SavedMeal
  pilatesLinks: PilatesLink
  events: CoachEvent
}
export type EntryTable = keyof EntryMap

export const ENTRY_TABLES: EntryTable[] = [
  'phases', 'weighIns', 'meals', 'activities', 'sessions',
  'pauses', 'foods', 'savedMeals', 'pilatesLinks', 'events',
]

/** The profile header: single objects, merged by their own updatedAt. */
export interface ProfileHeader {
  profile: Stamped<ProfileInfo>
  settings: Stamped<Settings>
  goal: Stamped<Goal>
}

/** The JSON document that is exported, imported and (from M2) synced. Never contains a token. */
export type ProfileDocument = { schemaVersion: number } & ProfileHeader & { [K in EntryTable]: EntryMap[K][] }
