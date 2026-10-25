/** One logged session of one exercise. */
export interface LoggedExercise {
  date: string
  sets: { reps?: number; weightKg?: number }[]
}

export interface WeightSuggestion {
  kg: number | null
  reason: string
}

interface Options {
  plannedSets: number
  repMin: number
  repMax: number
  /** The user's dumbbell list, kg. The step size comes from this list. */
  dumbbellsKg: number[]
}

/** Double progression (spec: Progressive overload). `history` is newest first.
 *  - Every planned set at the top of the rep range at one weight: next dumbbell up.
 *  - Bottom of the range missed in two sessions in a row: one dumbbell down.
 *  - Otherwise: same weight. No history: no suggestion (never an invented number). */
export function suggestWeight(history: LoggedExercise[], o: Options): WeightSuggestion {
  const last = history[0]
  if (!last) return { kg: null, reason: 'First time: pick a weight you can lift for the full rep range.' }

  const weights = last.sets.map((s) => s.weightKg).filter((w): w is number => w !== undefined)
  if (weights.length === 0) return { kg: null, reason: 'No weight was logged last time.' }
  const w = Math.max(...weights)

  const list = [...new Set(o.dumbbellsKg)].sort((a, b) => a - b)
  const up = list.find((x) => x > w)
  const down = [...list].reverse().find((x) => x < w)

  const topHit =
    last.sets.length >= o.plannedSets &&
    last.sets.every((s) => s.weightKg === w && s.reps !== undefined && s.reps >= o.repMax)
  if (topHit) {
    return up !== undefined
      ? { kg: up, reason: `You hit ${o.repMax} reps on every set at ${w} kg. Move up.` }
      : { kg: w, reason: `You hit ${o.repMax} reps on every set. Add a heavier dumbbell in Settings to keep progressing.` }
  }

  const missed = (h: LoggedExercise) => h.sets.some((s) => s.reps !== undefined && s.reps < o.repMin)
  if (history.length >= 2 && missed(history[0]) && missed(history[1])) {
    return down !== undefined
      ? { kg: down, reason: `You missed ${o.repMin} reps in the last two sessions. Go down one step.` }
      : { kg: w, reason: `You missed ${o.repMin} reps twice, but ${w} kg is your lightest dumbbell.` }
  }

  return { kg: w, reason: `Stay at ${w} kg until every set reaches ${o.repMax} reps.` }
}

/** A stored session, as far as progression needs it. */
export interface SessionLike {
  date: string
  status: 'done' | 'partial' | 'skipped'
  sets: { exerciseId: string; reps?: number; weightKg?: number }[]
}

/** Past logs of one exercise, newest first. Skipped sessions and sessions without that exercise are ignored. */
export function historyFor(exerciseId: string, sessions: SessionLike[]): LoggedExercise[] {
  return sessions
    .filter((s) => s.status !== 'skipped')
    .map((s) => ({ date: s.date, sets: s.sets.filter((x) => x.exerciseId === exerciseId) }))
    .filter((h) => h.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}
