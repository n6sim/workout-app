import { describe, expect, it } from 'vitest'
import { suggestMeals, type MealIdea } from './suggestions'

const ideas: MealIdea[] = [
  { id: 'a', name: 'Chicken and rice', kcal: 550, proteinG: 45 },
  { id: 'b', name: 'Fruit and nuts', kcal: 300, proteinG: 6 },
  { id: 'c', name: 'Greek yogurt bowl', kcal: 250, proteinG: 25 },
  { id: 'd', name: 'Big pasta', kcal: 900, proteinG: 25 },
  { id: 'e', name: 'Egg toast', kcal: 400, proteinG: 22 },
  { id: 'f', name: 'Tuna salad', kcal: 350, proteinG: 38 },
]

describe('meal suggestions', () => {
  it('returns three that fit the calories left', () => {
    const s = suggestMeals(ideas, { kcal: 600, proteinG: 60 }, 135)
    expect(s).toHaveLength(3)
    expect(s.every((m) => m.kcal <= 600)).toBe(true)
    expect(s.map((m) => m.id)).not.toContain('d')
  })
  it('prefers protein when protein is behind', () => {
    const s = suggestMeals(ideas, { kcal: 600, proteinG: 90 }, 135)
    expect(s[0].id).toBe('a') // 45 g protein for 550 kcal
    expect(s.map((m) => m.id)).not.toContain('b')
  })
  it('with little room left, smaller meals win', () => {
    const s = suggestMeals(ideas, { kcal: 280, proteinG: 25 }, 135)
    expect(s[0].id).toBe('c')
  })
  it('with nothing left, offers the lightest high-protein options', () => {
    const s = suggestMeals(ideas, { kcal: 0, proteinG: 10 }, 135)
    expect(s.map((m) => m.id)).toContain('c')
    expect(s.map((m) => m.id)).not.toContain('d')
  })
  it('is stable and handles short lists', () => {
    expect(suggestMeals(ideas, { kcal: 500, proteinG: 50 }, 135)).toEqual(suggestMeals([...ideas].reverse(), { kcal: 500, proteinG: 50 }, 135))
    expect(suggestMeals(ideas.slice(0, 2), { kcal: 500, proteinG: 50 }, 135)).toHaveLength(2)
    expect(suggestMeals([], { kcal: 500, proteinG: 50 }, 135)).toEqual([])
  })
})
