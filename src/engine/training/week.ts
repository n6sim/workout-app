import { addDays } from '../dates'
import type { DayKind, FocusArea } from './types'

/** Weekly templates by training days per week (spec: Weekly templates). */
export const TEMPLATES: Record<3 | 4 | 5, DayKind[]> = {
  3: ['full_body_a', 'pilates_cardio', 'full_body_b'],
  4: ['upper', 'lower', 'pilates', 'full_body'],
  5: ['upper', 'lower', 'pilates', 'full_body', 'cardio_mobility'],
}

export const SUPPORTED_TRAINING_DAYS = [3, 4, 5] as const

export const DAY_TITLE: Record<DayKind, string> = {
  full_body_a: 'Full body A',
  full_body_b: 'Full body B',
  upper: 'Upper body',
  lower: 'Lower body',
  full_body: 'Full body',
  pilates: 'Pilates',
  pilates_cardio: 'Pilates + steady cardio',
  cardio_mobility: 'Steady cardio + mobility',
}

/** Muscle groups a strength day works, used to keep hard days on the same muscles apart. */
const STRENGTH_GROUPS: Partial<Record<DayKind, FocusArea[]>> = {
  full_body_a: ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs'],
  full_body_b: ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs'],
  full_body: ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs'],
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['glutes', 'legs'],
}

export const isStrengthDay = (k: DayKind) => k in STRENGTH_GROUPS

function clash(a: DayKind, b: DayKind): boolean {
  const ga = STRENGTH_GROUPS[a]
  const gb = STRENGTH_GROUPS[b]
  return !!ga && !!gb && ga.some((g) => gb.includes(g))
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items
    return
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) yield [items[i], ...p]
  }
}

/** Two training days are neighbours if they are consecutive days. Sunday and Monday count as neighbours
 *  too, because the next week starts right after. Weekdays are 0 = Monday ... 6 = Sunday. */
const adjacent = (a: number, b: number) => (a - b + 7) % 7 === 1 || (b - a + 7) % 7 === 1

/** Assigns the template to the chosen weekdays, in order. If that would put two strength days on the same
 *  muscles back to back, the closest arrangement without a clash is used instead (spec: Rest days). */
export function assignTemplate(trainingDays: number[]): Map<number, DayKind> {
  const days = [...new Set(trainingDays)].sort((a, b) => a - b)
  const template = TEMPLATES[days.length as 3 | 4 | 5]
  if (!template) throw new RangeError(`No weekly template for ${days.length} training days. Pick 3, 4 or 5.`)

  const ok = (order: DayKind[]) =>
    days.every((d, i) => days.every((e, j) => i >= j || !adjacent(d, e) || !clash(order[i], order[j])))

  let best: DayKind[] | null = null
  let bestCost = Infinity
  for (const order of permutations(template)) {
    if (!ok(order)) continue
    const cost = order.reduce((sum, k, i) => sum + Math.abs(template.indexOf(k) - i), 0)
    if (cost < bestCost) {
      best = order
      bestCost = cost
    }
  }
  // Every supported template has a clash-free arrangement; the fallback only guards future template edits.
  const order = best ?? template
  return new Map(days.map((d, i) => [d, order[i]]))
}

export interface WeekDay {
  date: string
  /** 0 = Monday ... 6 = Sunday */
  weekday: number
  kind: DayKind | 'rest'
}

/** Monday of the week containing `date` ('YYYY-MM-DD'). */
export function weekStart(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(date, -weekday)
}

export function weekdayOf(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** The Monday-to-Sunday plan for the week that starts at `monday`. */
export function planWeek(trainingDays: number[], monday: string): WeekDay[] {
  const map = assignTemplate(trainingDays)
  return Array.from({ length: 7 }, (_, weekday) => ({
    date: addDays(monday, weekday),
    weekday,
    kind: map.get(weekday) ?? 'rest',
  }))
}
