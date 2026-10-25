import { describe, expect, it } from 'vitest'
import seed from '../data/seedFoods.json'
import { MEAL_IDEAS } from '../data/mealIdeas'
import { ideasWithTotals } from './mealIdeas'
import type { FoodInfo } from './nutrition'

const foods = seed as unknown as FoodInfo[]

describe('meal ideas', () => {
  it('has about 30 ideas', () => {
    expect(MEAL_IDEAS.length).toBeGreaterThanOrEqual(28)
    expect(MEAL_IDEAS.length).toBeLessThanOrEqual(32)
    expect(new Set(MEAL_IDEAS.map((m) => m.id)).size).toBe(MEAL_IDEAS.length)
  })
  it('every ingredient is in the starter pantry and has a usable serving size', () => {
    const names = new Set(foods.map((f) => f.name))
    for (const m of MEAL_IDEAS) for (const it of m.items) expect(names.has(it.food), `${m.name}: ${it.food}`).toBe(true)
    expect(ideasWithTotals(MEAL_IDEAS, foods)).toHaveLength(MEAL_IDEAS.length)
  })
  it('totals come from the pantry: 2 eggs + 2 rye slices + butter', () => {
    const t = ideasWithTotals(MEAL_IDEAS, foods).find((m) => m.id === 'scrambled-eggs-rye')!
    // scrambled egg 153 kcal/100 g x 122 g + rye 251 x 0.54 + butter 717 x 0.05
    expect(Math.abs(t.kcal - (153 * 1.22 + 251 * 0.54 + 717 * 0.05))).toBeLessThan(2) // each item is rounded, so allow 1 to 2 kcal
  })
  it('amounts are believable meals (100 to 900 kcal, some protein)', () => {
    for (const m of ideasWithTotals(MEAL_IDEAS, foods)) {
      expect(m.kcal, m.name).toBeGreaterThan(100)
      expect(m.kcal, m.name).toBeLessThan(900)
      expect(m.proteinG, m.name).toBeGreaterThan(3)
    }
  })
  it('leaves out an idea whose food was deleted', () => {
    const fewer = foods.filter((f) => f.name !== 'Almonds')
    const ids = ideasWithTotals(MEAL_IDEAS, fewer).map((m) => m.id)
    expect(ids).not.toContain('greek-yogurt-berries')
    expect(ids).toContain('chicken-rice-broccoli')
  })
})
