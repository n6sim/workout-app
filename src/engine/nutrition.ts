// Plain-words meal logging (spec: Nutrition logging). Runs fully offline against the pantry.

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'cup' | 'slice' | 'piece'

/** The part of a pantry food the maths needs. */
export interface FoodInfo {
  id: string
  name: string
  aliases: string[]
  kcalPer100g?: number
  proteinPer100g?: number
  kcalPerPiece?: number
  proteinPerPiece?: number
  gramsPerPiece?: number
  gramsPerSlice?: number
  /** Grams in 1 ml; gives ml, l, tsp (5 ml), tbsp (15 ml) and cup (250 ml). */
  gramsPerMl?: number
}

export interface ParsedItem {
  raw: string
  qty: number
  unit: Unit
  /** False when the text had no unit, so the unit defaults to pieces. */
  unitGiven: boolean
  name: string
}

const UNITS: Record<string, Unit> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup', slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
}
const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

/** Items split on commas, "and", or new lines. A comma between digits is a decimal comma, not a split. */
export function splitItems(text: string): string[] {
  return text
    .split(/\n|,(?!\d)|\s+and\s+|;/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseQty(s: string): number | null {
  if (s in VULGAR) return VULGAR[s]
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** One item = optional quantity + optional unit + food name. */
export function parseItem(raw: string): ParsedItem | null {
  const m = /^(?:(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔]|an?(?=\s))(?!\s*%)\s*)?(?:([a-zA-Z]+)\b\.?(?:\s+of\b)?\s*)?(.*)$/.exec(raw.trim())
  if (!m) return null
  let [, qtyText, unitText, rest] = m
  let unit: Unit | undefined = unitText ? UNITS[unitText.toLowerCase()] : undefined
  // The word after the number was not a unit, so it belongs to the food name ("2 eggs").
  if (!unit && unitText) rest = `${unitText} ${rest}`.trim()
  // "a"/"an" only means 1 when something follows it.
  const qty = qtyText ? (/^an?$/i.test(qtyText) ? 1 : parseQty(qtyText)) : 1
  if (qty === null) return null
  const name = rest.trim().replace(/^of\s+/i, '')
  if (!name) return null
  return { raw: raw.trim(), qty, unit: unit ?? 'piece', unitGiven: !!unit, name }
}

export function parseMealText(text: string): ParsedItem[] {
  return splitItems(text).flatMap((s) => {
    const p = parseItem(s)
    return p ? [p] : []
  })
}

// ---------- matching ----------

function singular(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (/(ss|us|is)$/.test(word)) return word
  if (/(ches|shes|xes|zes|sses|oes)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

/** Lower case, no punctuation, plural endings removed, so "Eggs" matches "egg". */
export function tokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(singular)
}
export const normalizeName = (name: string) => tokens(name).join(' ')

export type Match =
  | { status: 'matched'; food: FoodInfo }
  | { status: 'ambiguous'; candidates: FoodInfo[] }
  | { status: 'unknown' }

/** Exact name or alias first. Otherwise every word of the item must appear in a food's name or alias.
 *  Several matches: the user picks one, and the choice is saved as an alias. */
export function matchFood(name: string, foods: FoodInfo[]): Match {
  const want = normalizeName(name)
  if (!want) return { status: 'unknown' }
  const labels = (f: FoodInfo) => [f.name, ...f.aliases]
  const exact = foods.filter((f) => labels(f).some((l) => normalizeName(l) === want))
  if (exact.length === 1) return { status: 'matched', food: exact[0] }
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact }

  const wanted = tokens(name)
  const partial = foods.filter((f) => labels(f).some((l) => { const t = tokens(l); return wanted.every((w) => t.includes(w)) }))
  if (partial.length === 1) return { status: 'matched', food: partial[0] }
  if (partial.length > 1) return { status: 'ambiguous', candidates: partial }
  return { status: 'unknown' }
}

// ---------- amounts ----------

export type Need = 'gramsPerPiece' | 'gramsPerSlice' | 'gramsPerMl'

export type ItemAmount =
  | { ok: true; grams: number | null; kcal: number; proteinG: number }
  | { ok: false; need: Need }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Grams for an amount in some unit, or what is missing to know it. */
export function toGrams(food: FoodInfo, qty: number, unit: Unit): { grams: number } | { need: Need } {
  switch (unit) {
    case 'g': return { grams: qty }
    case 'kg': return { grams: qty * 1000 }
    case 'piece': return food.gramsPerPiece ? { grams: qty * food.gramsPerPiece } : { need: 'gramsPerPiece' }
    case 'slice': {
      const g = food.gramsPerSlice ?? food.gramsPerPiece
      return g ? { grams: qty * g } : { need: 'gramsPerSlice' }
    }
    default: {
      if (!food.gramsPerMl) return { need: 'gramsPerMl' }
      const ml = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 }[unit]
      return { grams: qty * ml * food.gramsPerMl }
    }
  }
}

/** Calories and protein for an amount of a food (nutrition per 100 g or per piece, whichever the food has). */
export function itemAmount(food: FoodInfo, qty: number, unit: Unit): ItemAmount {
  const hasPer100 = food.kcalPer100g !== undefined && food.proteinPer100g !== undefined
  // Pieces of a food that is only known per piece: use that directly.
  if (unit === 'piece' && food.kcalPerPiece !== undefined && (!hasPer100 || !food.gramsPerPiece)) {
    return { ok: true, grams: food.gramsPerPiece ? qty * food.gramsPerPiece : null, kcal: Math.round(qty * food.kcalPerPiece), proteinG: r1(qty * (food.proteinPerPiece ?? 0)) }
  }
  const g = toGrams(food, qty, unit)
  if ('need' in g) return { ok: false, need: g.need }
  if (hasPer100) {
    return { ok: true, grams: g.grams, kcal: Math.round((g.grams * food.kcalPer100g!) / 100), proteinG: r1((g.grams * food.proteinPer100g!) / 100) }
  }
  // Only per-piece values: turn grams into pieces.
  if (food.kcalPerPiece !== undefined && food.gramsPerPiece) {
    const pieces = g.grams / food.gramsPerPiece
    return { ok: true, grams: g.grams, kcal: Math.round(pieces * food.kcalPerPiece), proteinG: r1(pieces * (food.proteinPerPiece ?? 0)) }
  }
  return { ok: false, need: 'gramsPerPiece' }
}

export function sumItems(items: { kcal: number; proteinG: number }[]) {
  return { kcal: Math.round(items.reduce((s, i) => s + i.kcal, 0)), proteinG: r1(items.reduce((s, i) => s + i.proteinG, 0)) }
}

/** A new pantry food from a label, per 100 g or per piece (spec: Unknown food). */
export function foodFromLabel(input: {
  name: string
  per: '100g' | 'piece'
  kcal: number
  proteinG: number
  gramsPerPiece?: number
}): Omit<FoodInfo, 'id' | 'aliases'> {
  const base = { name: input.name.trim(), ...(input.gramsPerPiece ? { gramsPerPiece: input.gramsPerPiece } : {}) }
  return input.per === '100g'
    ? { ...base, kcalPer100g: input.kcal, proteinPer100g: input.proteinG }
    : { ...base, kcalPerPiece: input.kcal, proteinPerPiece: input.proteinG }
}
