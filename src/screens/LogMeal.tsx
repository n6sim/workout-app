import { useState } from 'react'
import { storage } from '../storage/instance'
import type { Food, MealItem, ProfileId, SavedMeal } from '../storage'
import { foodFromLabel, itemAmount, matchFood, normalizeName, parseMealText, sumItems, type ItemAmount, type Unit } from '../engine/nutrition'
import { saveAlias, toInfo } from '../domain/pantry'
import { todayLocal } from '../util/today'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup', 'slice', 'piece']
const ML_PER: Partial<Record<Unit, number>> = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 }

interface Row {
  key: number
  raw: string
  qty: number
  unit: Unit
  name: string
  food: Food | null
  candidates: Food[] | null
  manual: { kcal: number; proteinG: number } | null
  removed: boolean
}

export default function LogMeal({ profileId, foods, savedMeals, reload, onSaved }: {
  profileId: ProfileId; foods: Food[]; savedMeals: SavedMeal[]; reload: () => void; onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saveName, setSaveName] = useState('')
  const [portion, setPortion] = useState(1)
  const [note, setNote] = useState('')

  function check() {
    const items = parseMealText(text)
    if (items.length === 0) return setNote('Type what you ate, for example: 2 eggs, 40g rye bread, 1 cucumber')
    setNote('')
    setRows(items.map((it, i) => {
      const m = matchFood(it.name, foods.map(toInfo))
      const byId = (id: string) => foods.find((f) => f.id === id) ?? null
      return {
        key: i, raw: it.raw, qty: it.qty, unit: it.unit, name: it.name,
        food: m.status === 'matched' ? byId(m.food.id) : null,
        candidates: m.status === 'ambiguous' ? m.candidates.map((c) => byId(c.id)!).filter(Boolean) : null,
        manual: null, removed: false,
      }
    }))
  }

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const amountOf = (r: Row): ItemAmount | null =>
    r.manual ? { ok: true, grams: null, ...r.manual } : r.food ? itemAmount(toInfo(r.food), r.qty, r.unit) : null

  const live = (rows ?? []).filter((r) => !r.removed)
  const amounts = live.map(amountOf)
  const ready = live.length > 0 && amounts.every((a) => a && a.ok)
  const totals = sumItems(amounts.filter((a): a is Extract<ItemAmount, { ok: true }> => !!a && a.ok))

  async function pick(row: Row, food: Food) {
    const updated = await saveAlias(profileId, food, row.name) // the choice is remembered
    patch(row.key, { food: updated, candidates: null })
    reload()
  }

  async function updateFood(row: Row, food: Food) {
    const saved = (await storage.saveEntry('foods', profileId, food)) as Food
    patch(row.key, { food: saved })
    reload()
  }

  async function createFood(row: Row, f: { per: '100g' | 'piece'; kcal: number; proteinG: number; gramsPerPiece?: number }) {
    const base = foodFromLabel({ name: titleCase(row.name), ...f })
    const saved = (await storage.saveEntry('foods', profileId, {
      ...base, aliases: [normalizeName(row.name)], source: 'user',
    })) as Food
    patch(row.key, { food: saved, candidates: null })
    reload()
  }

  const toItem = (r: Row, a: Extract<ItemAmount, { ok: true }>, mult = 1): MealItem => ({
    name: r.food?.name ?? titleCase(r.name), foodId: r.food?.id ?? '', qty: round(r.qty * mult), unit: r.unit,
    kcal: Math.round(a.kcal * mult), proteinG: round(a.proteinG * mult),
  })

  async function save() {
    if (!rows || !ready) return
    const items = live.map((r, i) => toItem(r, amounts[i] as Extract<ItemAmount, { ok: true }>))
    const t = sumItems(items)
    await storage.saveEntry('meals', profileId, {
      date, time: new Date().toTimeString().slice(0, 5), rawText: text, items, totals: { kcal: t.kcal, proteinG: t.proteinG },
    })
    if (saveName.trim()) await storage.saveEntry('savedMeals', profileId, { name: saveName.trim(), items })
    setRows(null); setText(''); setSaveName(''); reload(); onSaved()
  }

  async function logSaved(m: SavedMeal) {
    const items = m.items.map((i) => ({ ...i, qty: round(i.qty * portion), kcal: Math.round(i.kcal * portion), proteinG: round(i.proteinG * portion) }))
    const t = sumItems(items)
    await storage.saveEntry('meals', profileId, {
      date, time: new Date().toTimeString().slice(0, 5), rawText: portion === 1 ? m.name : `${m.name} x${portion}`, items,
      totals: { kcal: t.kcal, proteinG: t.proteinG },
    })
    reload(); onSaved()
  }

  if (rows) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Check your meal</h2>
        {rows.map((r) => (
          <RowCard key={r.key} row={r} amount={amountOf(r)} onChange={(p) => patch(r.key, p)} onPick={(f) => void pick(r, f)}
            onFood={(f) => void updateFood(r, f)} onCreate={(f) => void createFood(r, f)} />
        ))}
        <Card className="space-y-1">
          <p className="text-sm text-slate-400">Total</p>
          <p className="text-3xl font-semibold">{totals.kcal} kcal</p>
          <p>{totals.proteinG} g protein</p>
        </Card>
        <Field label="Save as a meal you can log again (optional name)">
          <input className={inputCls} placeholder="e.g. usual shake" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        </Field>
        {!ready && live.length > 0 && <p className="text-sm text-amber-300">Finish the items marked above, or remove them.</p>}
        <button className={primaryBtn} disabled={!ready} onClick={() => void save()}>Save meal</button>
        <button className={secondaryBtn} onClick={() => setRows(null)}>Back</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {savedMeals.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Saved meals</p>
            <div className="flex gap-1">
              {[0.5, 1, 1.5, 2].map((p) => (
                <button key={p} aria-pressed={portion === p} onClick={() => setPortion(p)}
                  className={`rounded-lg px-2 py-1 text-xs ${portion === p ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>x{p}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedMeals.map((m) => (
              <button key={m.id} onClick={() => void logSaved(m)} className="rounded-full bg-slate-700 px-3 py-2 text-sm active:bg-slate-600">
                {m.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Tap one to log it right away.</p>
        </Card>
      )}
      <Field label="What did you eat?">
        <textarea className={`${inputCls} min-h-28`} placeholder="2 eggs, 40g rye bread, 1 cucumber" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Field label="Day">
        <input type="date" className={inputCls} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {note && <p className="text-sm text-amber-300">{note}</p>}
      <button className={primaryBtn} onClick={check}>Check meal</button>
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10
const titleCase = (s: string) => s.trim().replace(/^./, (c) => c.toUpperCase())

function RowCard({ row, amount, onChange, onPick, onFood, onCreate }: {
  row: Row
  amount: ItemAmount | null
  onChange: (p: Partial<Row>) => void
  onPick: (f: Food) => void
  onFood: (f: Food) => void
  onCreate: (f: { per: '100g' | 'piece'; kcal: number; proteinG: number; gramsPerPiece?: number }) => void
}) {
  if (row.removed) return null
  const ok = amount && amount.ok
  return (
    <Card className={`space-y-3 ${!ok ? 'ring-1 ring-amber-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{row.food?.name ?? titleCase(row.name)}</p>
        <button aria-label="Remove item" className="px-1 text-slate-500" onClick={() => onChange({ removed: true })}>✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label="Quantity" inputMode="decimal" className={inputCls} value={String(row.qty)}
          onChange={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); onChange({ qty: Number.isFinite(n) ? n : 0, manual: null }) }} />
        <select aria-label="Unit" className={inputCls} value={row.unit} onChange={(e) => onChange({ unit: e.target.value as Unit, manual: null })}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {row.candidates && (
        <div className="space-y-2">
          <p className="text-sm text-amber-200">Which one did you mean?</p>
          {row.candidates.map((c) => <button key={c.id} className={secondaryBtn} onClick={() => onPick(c)}>{c.name}</button>)}
        </div>
      )}

      {!row.food && !row.candidates && <UnknownFood name={row.name} onCreate={onCreate} />}

      {row.food && amount && !amount.ok && <NeedInfo row={row} need={amount.need} onFood={onFood} />}

      {ok && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-xs text-slate-400">kcal</span>
            <input inputMode="numeric" className={inputCls} value={String(amount.kcal)}
              onChange={(e) => onChange({ manual: { kcal: Number(e.target.value) || 0, proteinG: amount.proteinG } })} /></label>
          <label className="block"><span className="mb-1 block text-xs text-slate-400">protein (g)</span>
            <input inputMode="decimal" className={inputCls} value={String(amount.proteinG)}
              onChange={(e) => onChange({ manual: { kcal: amount.kcal, proteinG: Number(e.target.value.replace(',', '.')) || 0 } })} /></label>
        </div>
      )}
    </Card>
  )
}

/** A food the pantry does not know: ask once, from the label, then remember it (spec: Unknown food). */
function UnknownFood({ name, onCreate }: { name: string; onCreate: (f: { per: '100g' | 'piece'; kcal: number; proteinG: number; gramsPerPiece?: number }) => void }) {
  const [per, setPer] = useState<'100g' | 'piece'>('100g')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [grams, setGrams] = useState('')
  const valid = kcal.trim() !== '' && protein.trim() !== '' && Number.isFinite(Number(kcal)) && Number.isFinite(Number(protein.replace(',', '.')))
  return (
    <div className="space-y-2 rounded-xl bg-slate-900 p-3">
      <p className="text-sm text-amber-200">"{name}" is not in your pantry yet. Enter the numbers from its label once and it is remembered.</p>
      <div className="grid grid-cols-2 gap-1">
        {(['100g', 'piece'] as const).map((p) => (
          <button key={p} aria-pressed={per === p} onClick={() => setPer(p)}
            className={`rounded-lg py-2 text-sm ${per === p ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{p === '100g' ? 'Per 100 g' : 'Per piece'}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input inputMode="decimal" placeholder="kcal" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} />
        <input inputMode="decimal" placeholder="protein g" className={inputCls} value={protein} onChange={(e) => setProtein(e.target.value)} />
      </div>
      <input inputMode="decimal" placeholder={per === 'piece' ? 'grams per piece (optional)' : 'grams per piece, if you count it in pieces (optional)'} className={inputCls} value={grams} onChange={(e) => setGrams(e.target.value)} />
      <button className={primaryBtn} disabled={!valid} onClick={() => onCreate({ per, kcal: Number(kcal), proteinG: Number(protein.replace(',', '.')), gramsPerPiece: Number(grams) > 0 ? Number(grams) : undefined })}>
        Add to my pantry
      </button>
    </div>
  )
}

/** The food has no serving size for this unit. Ask once and save it on the food. */
function NeedInfo({ row, need, onFood }: { row: Row; need: string; onFood: (f: Food) => void }) {
  const [grams, setGrams] = useState('')
  const food = row.food!
  const g = Number(grams.replace(',', '.'))
  const what = need === 'gramsPerMl' ? `1 ${row.unit}` : need === 'gramsPerSlice' ? '1 slice' : '1 piece'
  function save() {
    if (!(g > 0)) return
    if (need === 'gramsPerPiece') onFood({ ...food, gramsPerPiece: g })
    else if (need === 'gramsPerSlice') onFood({ ...food, gramsPerSlice: g })
    else onFood({ ...food, gramsPerMl: g / (ML_PER[row.unit] ?? 1) })
  }
  return (
    <div className="space-y-2 rounded-xl bg-slate-900 p-3">
      <p className="text-sm text-amber-200">How many grams is {what} of {food.name}? (Asked once, then remembered.)</p>
      <input inputMode="decimal" placeholder="grams" className={inputCls} value={grams} onChange={(e) => setGrams(e.target.value)} />
      <button className={primaryBtn} disabled={!(g > 0)} onClick={save}>Save</button>
    </div>
  )
}
