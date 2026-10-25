import { describe, expect, it } from 'vitest'
import seed from '../data/seedFoods.json'
import { foodFromLabel, itemAmount, matchFood, normalizeName, parseItem, parseMealText, splitItems, sumItems, toGrams, type FoodInfo } from './nutrition'

const foods = seed as unknown as FoodInfo[]
const byName = (n: string) => foods.find((f) => f.name === n)!

describe('splitting', () => {
  it('splits on commas, "and" and new lines', () => {
    expect(splitItems('2 eggs, 40g rye bread, 1 cucumber')).toEqual(['2 eggs', '40g rye bread', '1 cucumber'])
    expect(splitItems('tea and toast')).toEqual(['tea', 'toast'])
    expect(splitItems('2 eggs\n1 apple')).toEqual(['2 eggs', '1 apple'])
  })
  it('keeps a decimal comma together', () => {
    expect(splitItems('1,5 cups rice, 2 eggs')).toEqual(['1,5 cups rice', '2 eggs'])
  })
})

describe('parsing one item', () => {
  const p = (s: string) => parseItem(s)!
  it('the spec example', () => {
    expect(parseMealText('2 eggs, 40g rye bread, 1 cucumber')).toMatchObject([
      { qty: 2, unit: 'piece', unitGiven: false, name: 'eggs' },
      { qty: 40, unit: 'g', unitGiven: true, name: 'rye bread' },
      { qty: 1, unit: 'piece', name: 'cucumber' },
    ])
  })
  it('every unit', () => {
    expect(p('250 ml milk')).toMatchObject({ qty: 250, unit: 'ml', name: 'milk' })
    expect(p('1.5 l water')).toMatchObject({ qty: 1.5, unit: 'l' })
    expect(p('0.2 kg chicken')).toMatchObject({ qty: 0.2, unit: 'kg' })
    expect(p('2 tbsp olive oil')).toMatchObject({ qty: 2, unit: 'tbsp', name: 'olive oil' })
    expect(p('1 tsp sugar')).toMatchObject({ unit: 'tsp' })
    expect(p('1 cup rice')).toMatchObject({ unit: 'cup', name: 'rice' })
    expect(p('2 slices bread')).toMatchObject({ qty: 2, unit: 'slice', name: 'bread' })
    expect(p('3 pieces chicken')).toMatchObject({ qty: 3, unit: 'piece' })
  })
  it('no quantity means 1 piece; "a" and fractions work', () => {
    expect(p('banana')).toMatchObject({ qty: 1, unit: 'piece', name: 'banana' })
    expect(p('a banana')).toMatchObject({ qty: 1, name: 'banana' })
    expect(p('1/2 avocado')).toMatchObject({ qty: 0.5, name: 'avocado' })
    expect(p('½ cup oats')).toMatchObject({ qty: 0.5, unit: 'cup' })
    expect(p('a cup of milk')).toMatchObject({ qty: 1, unit: 'cup', name: 'milk' })
    expect(p('2 cups of rice')).toMatchObject({ qty: 2, unit: 'cup', name: 'rice' })
  })
  it('a percent sign belongs to the food, not the quantity', () => {
    expect(p('2% milk')).toMatchObject({ qty: 1, unit: 'piece', name: '2% milk' })
    expect(p('200 ml 1% milk')).toMatchObject({ qty: 200, unit: 'ml', name: '1% milk' })
  })
})

describe('matching foods', () => {
  it('ignores case and plural endings', () => {
    expect(normalizeName('Eggs')).toBe(normalizeName('egg'))
    expect(normalizeName('Strawberries')).toBe(normalizeName('strawberry'))
    const m = matchFood('EGGS', foods)
    expect(m.status === 'matched' && m.food.name).toBe('Egg, boiled')
  })
  it('matches by alias and by name', () => {
    const m = (n: string) => matchFood(n, foods)
    expect(m('rye bread')).toMatchObject({ status: 'matched', food: { name: 'Bread, rye' } })
    expect(m('cucumber')).toMatchObject({ status: 'matched', food: { name: 'Cucumber' } })
    expect(m('greek yogurt')).toMatchObject({ status: 'matched', food: { name: 'Greek yogurt, plain 2%' } })
    expect(m('olive oil')).toMatchObject({ status: 'matched', food: { name: 'Olive oil' } })
  })
  it('several matches: the user picks', () => {
    const m = matchFood('chicken breast', foods)
    expect(m.status).toBe('ambiguous')
    expect(m.status === 'ambiguous' && m.candidates.map((c) => c.name)).toEqual(['Chicken breast, raw', 'Chicken breast, grilled'])
  })
  it('a choice saved as an alias resolves next time', () => {
    const grilled = { ...byName('Chicken breast, grilled'), aliases: ['chicken breast'] }
    const pantry = foods.map((f) => (f.id === grilled.id ? grilled : f))
    expect(matchFood('chicken breast', pantry)).toMatchObject({ status: 'matched', food: { name: 'Chicken breast, grilled' } })
  })
  it('unknown food', () => {
    expect(matchFood('dragonfruit smoothie', foods).status).toBe('unknown')
    expect(matchFood('', foods).status).toBe('unknown')
  })
})

describe('amounts, using values from the Canadian Nutrient File', () => {
  const rye = byName('Bread, rye')
  const egg = byName('Egg, boiled')
  it('grams: 40 g rye bread = 251 kcal per 100 g x 0.4', () => {
    expect(rye.kcalPer100g).toBe(251)
    expect(itemAmount(rye, 40, 'g')).toMatchObject({ ok: true, grams: 40, kcal: 100, proteinG: 3.6 })
  })
  it('pieces use the serving size from the file: 2 boiled eggs = 100 g', () => {
    expect(egg.gramsPerPiece).toBe(50)
    expect(itemAmount(egg, 2, 'piece')).toMatchObject({ ok: true, grams: 100, kcal: 141, proteinG: 11.8 })
  })
  it('slices of bread', () => {
    expect(itemAmount(rye, 2, 'slice')).toMatchObject({ grams: 54, kcal: 136 })
  })
  it('volume units come from grams per ml: 250 ml of 2% milk', () => {
    const milk = byName('Milk, 2%')
    expect(milk.gramsPerMl).toBeCloseTo(1.03, 2)
    const cup = itemAmount(milk, 1, 'cup')
    const ml = itemAmount(milk, 250, 'ml')
    expect(cup).toEqual(ml)
    expect(cup).toMatchObject({ ok: true, kcal: 129, proteinG: 8.5 })
  })
  it('tablespoon and teaspoon are 15 ml and 5 ml', () => {
    const oil = byName('Olive oil')
    const tbsp = toGrams(oil, 1, 'tbsp')
    const tsp = toGrams(oil, 3, 'tsp')
    expect('grams' in tbsp && 'grams' in tsp && Math.abs(tbsp.grams - tsp.grams)).toBeLessThan(1e-9)
    expect(itemAmount(oil, 1, 'tbsp')).toMatchObject({ ok: true, kcal: 121 })
  })
  it('kg and litres', () => {
    expect(itemAmount(rye, 0.1, 'kg')).toMatchObject({ grams: 100, kcal: 251 })
    const milk = byName('Milk, 2%')
    expect(itemAmount(milk, 1, 'l')).toEqual(itemAmount(milk, 1000, 'ml'))
  })
  it('asks for what is missing instead of guessing', () => {
    expect(itemAmount(byName('Chicken breast, raw'), 1, 'piece')).toEqual({ ok: false, need: 'gramsPerPiece' })
    expect(itemAmount(byName('Bread, rye'), 1, 'cup')).toEqual({ ok: false, need: 'gramsPerMl' })
  })
  it('a food that is only known per piece', () => {
    const bar = { id: 'u1', aliases: [], ...foodFromLabel({ name: 'Protein bar', per: 'piece', kcal: 200, proteinG: 20 }) }
    expect(itemAmount(bar, 2, 'piece')).toMatchObject({ ok: true, kcal: 400, proteinG: 40 })
    expect(itemAmount(bar, 30, 'g')).toEqual({ ok: false, need: 'gramsPerPiece' }) // grams to pieces needs a piece weight
    const bar2 = { ...bar, gramsPerPiece: 60 }
    expect(itemAmount(bar2, 30, 'g')).toMatchObject({ ok: true, kcal: 100, proteinG: 10 })
  })
  it('a food from a per-100 g label', () => {
    const f = { id: 'u2', aliases: [], ...foodFromLabel({ name: 'Granola', per: '100g', kcal: 450, proteinG: 10, gramsPerPiece: 25 }) }
    expect(itemAmount(f, 40, 'g')).toMatchObject({ kcal: 180, proteinG: 4 })
    expect(itemAmount(f, 2, 'piece')).toMatchObject({ kcal: 225, proteinG: 5 })
  })
  it('totals', () => {
    expect(sumItems([{ kcal: 100, proteinG: 3.6 }, { kcal: 141, proteinG: 11.8 }])).toEqual({ kcal: 241, proteinG: 15.4 })
  })
})

describe('the starter pantry', () => {
  it('is about 100 foods, each with calories and protein from the file', () => {
    expect(foods.length).toBeGreaterThanOrEqual(100)
    for (const f of foods) {
      expect(typeof f.kcalPer100g, f.name).toBe('number')
      expect(typeof f.proteinPer100g, f.name).toBe('number')
      expect((f as unknown as { cnfDescription: string }).cnfDescription.length, f.name).toBeGreaterThan(0)
    }
  })
  it('has no duplicate ids and no alias that two foods share', () => {
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length)
    const seen = new Map<string, string>()
    for (const f of foods) for (const l of [f.name, ...f.aliases]) {
      const k = normalizeName(l)
      expect(seen.get(k) && seen.get(k) !== f.id ? `${l} used by two foods` : null).toBeNull()
      seen.set(k, f.id)
    }
  })
  it('a spread of everyday meals parses and matches without asking', () => {
    const text = '2 eggs, 40g rye bread, 1 cucumber, 1 tbsp olive oil, a banana, 200 ml milk, 150 g rice, 30 g almonds'
    for (const item of parseMealText(text)) {
      const m = matchFood(item.name, foods)
      expect(m.status, item.name).toBe('matched')
      if (m.status === 'matched') expect(itemAmount(m.food, item.qty, item.unit).ok, item.raw).toBe(true)
    }
  })
})
