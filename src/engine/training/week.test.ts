import { describe, expect, it } from 'vitest'
import { assignTemplate, isStrengthDay, planWeek, TEMPLATES, weekdayOf, weekStart } from './week'

const kinds = (days: number[]) => [...assignTemplate(days)].map(([d, k]) => `${d}:${k}`)

describe('weekly templates', () => {
  it('3 days: Full body A, Pilates + cardio, Full body B', () => {
    expect(kinds([0, 2, 4])).toEqual(['0:full_body_a', '2:pilates_cardio', '4:full_body_b'])
  })
  it('4 days: Upper, Lower, Pilates, Full body', () => {
    expect(kinds([0, 1, 3, 4])).toEqual(['0:upper', '1:lower', '3:pilates', '4:full_body'])
  })
  it('5 days: adds steady cardio + mobility', () => {
    expect(kinds([0, 1, 2, 3, 4])).toEqual(['0:upper', '1:lower', '2:pilates', '3:full_body', '4:cardio_mobility'])
  })
  it('order of the chosen days does not matter', () => {
    expect(kinds([4, 0, 2])).toEqual(kinds([0, 2, 4]))
  })
  it('rejects counts with no template', () => {
    expect(() => assignTemplate([0, 1])).toThrow(/3, 4 or 5/)
    expect(() => assignTemplate([0, 1, 2, 3, 4, 5])).toThrow(/3, 4 or 5/)
  })
})

describe('no back-to-back strength days on the same muscles', () => {
  // Every choice of 3, 4 or 5 days (all 21 + 35 + 35 combinations).
  const combos: number[][] = []
  for (let mask = 0; mask < 128; mask++) {
    const d = [0, 1, 2, 3, 4, 5, 6].filter((i) => mask & (1 << i))
    if ([3, 4, 5].includes(d.length)) combos.push(d)
  }
  it('holds for every possible choice of training days, including Sunday into Monday', () => {
    expect(combos).toHaveLength(91)
    for (const days of combos) {
      const map = assignTemplate(days)
      for (const d of days) {
        const next = (d + 1) % 7
        const a = map.get(d)!
        const b = map.get(next)
        if (!b || !isStrengthDay(a) || !isStrengthDay(b)) continue
        const lowerUpper = (a === 'upper' && b === 'lower') || (a === 'lower' && b === 'upper')
        expect(lowerUpper, `days ${days}: ${a} then ${b}`).toBe(true)
      }
    }
  })
  it('every template kind is used exactly once', () => {
    for (const days of combos) {
      expect([...assignTemplate(days).values()].sort()).toEqual([...TEMPLATES[days.length as 3 | 4 | 5]].sort())
    }
  })
  it('keeps the template order when it already works', () => {
    expect(kinds([0, 1, 2, 3])).toEqual(['0:upper', '1:lower', '2:pilates', '3:full_body'])
  })
  it('moves a clashing day: Mon Tue Wed as 3 days puts pilates between the full-body days', () => {
    expect(kinds([0, 1, 2])).toEqual(['0:full_body_a', '1:pilates_cardio', '2:full_body_b'])
  })
  it('Sunday and Monday are neighbours', () => {
    // Sat Sun Mon Tue: template would put full_body on Tue after pilates, upper Mon... must not put full_body next to upper/lower across Sun-Mon.
    const map = assignTemplate([0, 1, 5, 6])
    const sun = map.get(6)!
    const mon = map.get(0)!
    if (isStrengthDay(sun) && isStrengthDay(mon)) {
      expect([sun, mon].sort()).toEqual(['lower', 'upper'])
    }
  })
})

describe('planWeek', () => {
  it('lists Monday to Sunday with rest days', () => {
    const w = planWeek([0, 2, 4], '2026-10-19')
    expect(w.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
    expect(w.map((d) => d.kind)).toEqual(['full_body_a', 'rest', 'pilates_cardio', 'rest', 'full_body_b', 'rest', 'rest'])
  })
})

describe('dates', () => {
  it('finds the Monday of a week and the weekday', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-19') // a Saturday
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // Sunday
    expect(weekdayOf('2026-10-19')).toBe(0)
    expect(weekdayOf('2026-10-25')).toBe(6)
  })
})
