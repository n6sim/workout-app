import { describe, expect, it } from 'vitest'
import { historyFor, suggestWeight, type LoggedExercise } from './progression'

const o = { plannedSets: 3, repMin: 8, repMax: 12, dumbbellsKg: [4, 6, 8, 10] }
const sess = (date: string, ...sets: [number, number][]): LoggedExercise => ({ date, sets: sets.map(([reps, weightKg]) => ({ reps, weightKg })) })

describe('double progression', () => {
  it('no history: no suggestion (never an invented number)', () => {
    expect(suggestWeight([], o).kg).toBeNull()
  })
  it('every set at the top at one weight: next dumbbell up', () => {
    expect(suggestWeight([sess('d1', [12, 6], [12, 6], [12, 6])], o).kg).toBe(8)
  })
  it('uses the dumbbell list for the step, not a fixed increment', () => {
    expect(suggestWeight([sess('d1', [12, 4], [12, 4], [12, 4])], { ...o, dumbbellsKg: [4, 7.5, 12] }).kg).toBe(7.5)
  })
  it('one set short of the top: stay', () => {
    expect(suggestWeight([sess('d1', [12, 6], [12, 6], [11, 6])], o).kg).toBe(6)
  })
  it('fewer sets than planned does not count as hitting the top', () => {
    expect(suggestWeight([sess('d1', [12, 6], [12, 6])], o).kg).toBe(6)
  })
  it('mixed weights do not progress', () => {
    expect(suggestWeight([sess('d1', [12, 6], [12, 6], [12, 8])], o).kg).toBe(8)
  })
  it('at the heaviest dumbbell: stays and says so', () => {
    const r = suggestWeight([sess('d1', [12, 10], [12, 10], [12, 10])], o)
    expect(r.kg).toBe(10)
    expect(r.reason).toMatch(/heavier dumbbell/)
  })
  it('missing the bottom of the range twice in a row: one step down', () => {
    expect(suggestWeight([sess('d2', [7, 8], [7, 8], [6, 8]), sess('d1', [8, 8], [7, 8], [6, 8])], o).kg).toBe(6)
  })
  it('missing the bottom once is not enough', () => {
    expect(suggestWeight([sess('d2', [7, 8], [8, 8], [8, 8]), sess('d1', [9, 8], [9, 8], [9, 8])], o).kg).toBe(8)
  })
  it('already at the lightest dumbbell: stays', () => {
    expect(suggestWeight([sess('d2', [5, 4], [5, 4], [5, 4]), sess('d1', [5, 4], [5, 4], [5, 4])], o).kg).toBe(4)
  })
  it('a weight not in the list still steps to the next one up', () => {
    expect(suggestWeight([sess('d1', [12, 5], [12, 5], [12, 5])], o).kg).toBe(6)
  })
  it('sets with no weight give no suggestion', () => {
    expect(suggestWeight([{ date: 'd1', sets: [{ reps: 12 }] }], o).kg).toBeNull()
  })
  it('maintenance range 6 to 10', () => {
    const m = { ...o, repMin: 6, repMax: 10 }
    expect(suggestWeight([sess('d1', [10, 6], [10, 6])], { ...m, plannedSets: 2 }).kg).toBe(8)
  })
})

describe('historyFor', () => {
  const s = (date: string, status: 'done' | 'partial' | 'skipped', ...sets: [string, number, number][]) => ({
    date, status, sets: sets.map(([exerciseId, reps, weightKg]) => ({ exerciseId, reps, weightKg })),
  })
  it('returns one exercise\'s logs, newest first, without skipped sessions', () => {
    const h = historyFor('curl', [
      s('2026-10-12', 'done', ['curl', 10, 6], ['press', 10, 8]),
      s('2026-10-19', 'partial', ['curl', 12, 6]),
      s('2026-10-16', 'skipped', ['curl', 1, 1]),
      s('2026-10-14', 'done', ['press', 10, 8]),
    ])
    expect(h.map((x) => x.date)).toEqual(['2026-10-19', '2026-10-12'])
    expect(h[1].sets).toEqual([{ exerciseId: 'curl', reps: 10, weightKg: 6 }])
  })
  it('feeds suggestWeight end to end', () => {
    const h = historyFor('curl', [s('2026-10-12', 'done', ['curl', 12, 6], ['curl', 12, 6], ['curl', 12, 6])])
    expect(suggestWeight(h, o).kg).toBe(8)
  })
})
