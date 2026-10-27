import { storage } from '../storage/instance'
import type { Activity, CoachEvent, Meal, ProfileId, Session } from '../storage'
import { addDays } from '../engine/dates'
import { creditedKcal, estimateKcal, workoutBlocks, type ActivityType } from '../engine/exercise'
import { weekStartOf } from '../engine/budget'

/** kcal eaten per date, only for dates that have at least one meal. */
export function eatenByDate(meals: Meal[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of meals) out[m.date] = (out[m.date] ?? 0) + m.totals.kcal
  return out
}

export function proteinOn(meals: Meal[], date: string): number {
  return Math.round(meals.filter((m) => m.date === date).reduce((s, m) => s + m.totals.proteinG, 0) * 10) / 10
}

export function creditedByDate(activities: Activity[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of activities) out[a.date] = (out[a.date] ?? 0) + a.creditedKcal
  return out
}

// ---- "Done logging today" and the flex day, kept as coach events so they sync and merge like everything else ----

export const doneEventId = (profileId: ProfileId, date: string) => `done-${profileId}-${date}`
export const flexEventId = (profileId: ProfileId, monday: string) => `flex-${profileId}-${monday}`

export const isLoggingDone = (events: CoachEvent[], profileId: ProfileId, date: string) =>
  events.some((e) => e.id === doneEventId(profileId, date) && !e.deleted)

export async function setLoggingDone(profileId: ProfileId, date: string, done: boolean): Promise<void> {
  await storage.saveEntry('events', profileId, { id: doneEventId(profileId, date), kind: 'logging_done', detail: date, deleted: !done })
}

/** The flex day (a date) for the week containing `date`, if one is set. */
export function flexDayOfWeek(events: CoachEvent[], profileId: ProfileId, date: string): string | null {
  const e = events.find((x) => x.id === flexEventId(profileId, weekStartOf(date)) && !x.deleted)
  return e ? e.detail : null
}

/** One flex day per week: setting it again replaces the old one. Pass null to clear. */
export async function setFlexDay(profileId: ProfileId, weekDate: string, flexDate: string | null): Promise<void> {
  await storage.saveEntry('events', profileId, {
    id: flexEventId(profileId, weekStartOf(weekDate)), kind: 'flex_day', detail: flexDate ?? '', deleted: flexDate === null,
  })
}

/** A finished in-app workout becomes activity entries (one per block), replacing any it made before,
 *  so finishing or redoing a workout never counts twice. */
export async function recordWorkoutActivities(
  profileId: ProfileId, session: Session, minutes: number, weightKg: number, creditPct: number,
  existing: Activity[],
): Promise<void> {
  for (const a of existing.filter((x) => x.sessionId === session.id && !x.deleted)) {
    await storage.deleteEntry('activities', profileId, a.id)
  }
  if (session.status === 'skipped' || minutes <= 0) return
  for (const b of workoutBlocks(session.plan, minutes)) {
    const est = estimateKcal(b.type as ActivityType, weightKg, b.minutes)
    await storage.saveEntry('activities', profileId, {
      date: session.date, sessionId: session.id, type: b.type, minutes: Math.round(b.minutes * 10) / 10,
      estKcal: Math.round(est), creditedKcal: Math.round(creditedKcal(est, creditPct)),
    })
  }
}

export const dayBefore = (d: string) => addDays(d, -1)
