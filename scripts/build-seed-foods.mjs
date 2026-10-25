// Builds src/data/seedFoods.json from the Canadian Nutrient File CSV files in data-source/cnf/.
// Run: npm run build-seed-foods
// Calories and protein are read from the file (per 100 g). Nothing is typed in by hand.
import { readFile, writeFile } from 'node:fs/promises'
import { STAPLES } from './seed-foods.config.mjs'

const DIR = 'data-source/cnf'
const KCAL = '208' // ENERGY (KILOCALORIES)
const PROTEIN = '203' // PROTEIN

/** Minimal CSV reader (quotes, doubled quotes, CRLF). The files are ISO-8859-1. */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const load = async (name) => parseCsv((await readFile(`${DIR}/${name}.csv`)).toString('latin1'))

const foods = new Map((await load('FOOD NAME')).map((r) => [r.FoodID, r]))
const measures = new Map((await load('MEASURE NAME')).map((r) => [r.MeasureID, r.MeasureDescription]))
const wanted = new Set(STAPLES.map((s) => String(s.cnf)))

const amounts = new Map() // foodId -> { kcal, protein }
for (const r of await load('NUTRIENT AMOUNT')) {
  if (!wanted.has(r.FoodID) || (r.NutrientID !== KCAL && r.NutrientID !== PROTEIN)) continue
  const a = amounts.get(r.FoodID) ?? {}
  a[r.NutrientID === KCAL ? 'kcal' : 'protein'] = Number(r.NutrientValue)
  amounts.set(r.FoodID, a)
}

const servings = new Map() // foodId -> [{ description, grams }]
for (const r of await load('CONVERSION FACTOR')) {
  if (!wanted.has(r.FoodID)) continue
  const list = servings.get(r.FoodID) ?? []
  // The factor multiplies the per-100 g values, so grams = factor x 100.
  list.push({ description: measures.get(r.MeasureID) ?? '', grams: Number(r.ConversionFactorValue) * 100 })
  servings.set(r.FoodID, list)
}

const round = (n) => Math.round(n * 100) / 100
const problems = []
const out = STAPLES.map((s) => {
  const id = String(s.cnf)
  const food = foods.get(id)
  const a = amounts.get(id)
  if (!food) problems.push(`FoodID ${id} (${s.name}) is not in FOOD NAME.csv`)
  if (!a || a.kcal === undefined || a.protein === undefined) problems.push(`FoodID ${id} (${s.name}) has no calories or protein`)
  const list = servings.get(id) ?? []
  const find = (pattern) => list.find((m) => new RegExp(pattern, 'i').test(m.description))
  const entry = {
    id: `seed-${id}`,
    cnfFoodId: Number(id),
    name: s.name,
    aliases: s.aliases,
    cnfDescription: food?.FoodDescription ?? '',
    kcalPer100g: a?.kcal,
    proteinPer100g: a?.protein,
  }
  if (s.piece) {
    const m = find(s.piece)
    if (!m) problems.push(`${s.name}: no serving matches /${s.piece}/ (have: ${list.map((x) => x.description).join('; ')})`)
    else entry.gramsPerPiece = round(m.grams)
  }
  if (s.slice) {
    const m = find(s.slice)
    if (!m) problems.push(`${s.name}: no serving matches /${s.slice}/`)
    else entry.gramsPerSlice = round(m.grams)
  }
  // Volume servings ("250ml") give grams per ml, which covers ml, l, tsp (5 ml), tbsp (15 ml) and cup (250 ml).
  const vol = list.find((m) => /^100\s*ml$/i.test(m.description)) ?? list.find((m) => /^\d+\s*ml\b/i.test(m.description))
  if (vol) entry.gramsPerMl = round(vol.grams / Number(vol.description.match(/^(\d+)/)[1]))
  return entry
})

if (problems.length) {
  console.error('Problems:\n- ' + problems.join('\n- '))
  process.exit(1)
}
await writeFile('src/data/seedFoods.json', JSON.stringify(out, null, 1) + '\n')
console.log(`wrote ${out.length} foods; ${out.filter((f) => f.gramsPerPiece).length} with a piece size, ${out.filter((f) => f.gramsPerMl).length} with a volume size`)
