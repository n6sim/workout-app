import { useMemo, useState } from 'react'
import { storage } from '../storage/instance'
import type { Food, ProfileId, SavedMeal } from '../storage'
import { normalizeName } from '../engine/nutrition'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')))

export default function Pantry({ profileId, foods, savedMeals, reload, onBack }: {
  profileId: ProfileId; foods: Food[]; savedMeals: SavedMeal[]; reload: () => void; onBack: () => void
}) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | 'new' | null>(null)

  const shown = useMemo(() => {
    const q = normalizeName(query)
    return [...foods]
      .filter((f) => !q || normalizeName([f.name, ...f.aliases].join(' ')).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [foods, query])

  if (editing) {
    return <FoodForm profileId={profileId} food={editing === 'new' ? null : editing} reload={reload} onClose={() => setEditing(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 underline">Back</button>
        <h1 className="text-2xl font-semibold">My pantry</h1>
      </div>
      <input className={inputCls} placeholder="Search foods" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button className={primaryBtn} onClick={() => setEditing('new')}>Add a food</button>
      <p className="text-xs text-slate-500">{foods.length} foods. Starter foods come from the Canadian Nutrient File (Health Canada). Tap one to edit it.</p>
      <ul className="divide-y divide-slate-800 rounded-2xl bg-slate-800">
        {shown.map((f) => (
          <li key={f.id}>
            <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setEditing(f)}>
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {f.kcalPer100g !== undefined ? `${f.kcalPer100g} kcal · ${f.proteinPer100g} g /100 g` : `${f.kcalPerPiece} kcal · ${f.proteinPerPiece} g /piece`}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No foods match.</li>}
      </ul>

      <Card className="space-y-2">
        <h2 className="font-semibold">Saved meals</h2>
        {savedMeals.length === 0 && <p className="text-sm text-slate-400">None yet. Save one when you confirm a meal.</p>}
        <ul className="divide-y divide-slate-700">
          {savedMeals.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0"><span className="block truncate">{m.name}</span>
                <span className="text-xs text-slate-400">{m.items.map((i) => i.name ?? i.foodId).join(', ')}</span></span>
              <button aria-label={`Delete ${m.name}`} className="px-2 text-slate-500" onClick={async () => { await storage.deleteEntry('savedMeals', profileId, m.id); reload() }}>✕</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function FoodForm({ profileId, food, reload, onClose }: { profileId: ProfileId; food: Food | null; reload: () => void; onClose: () => void }) {
  const [name, setName] = useState(food?.name ?? '')
  const [aliases, setAliases] = useState((food?.aliases ?? []).join(', '))
  const [kcal100, setKcal100] = useState(food?.kcalPer100g?.toString() ?? '')
  const [prot100, setProt100] = useState(food?.proteinPer100g?.toString() ?? '')
  const [kcalPc, setKcalPc] = useState(food?.kcalPerPiece?.toString() ?? '')
  const [protPc, setProtPc] = useState(food?.proteinPerPiece?.toString() ?? '')
  const [gramsPc, setGramsPc] = useState(food?.gramsPerPiece?.toString() ?? '')
  const [error, setError] = useState('')

  async function save() {
    const k100 = num(kcal100), p100 = num(prot100), kPc = num(kcalPc), pPc = num(protPc), gPc = num(gramsPc)
    const nums = [k100, p100, kPc, pPc, gPc]
    if (!name.trim()) return setError('Give the food a name.')
    if (nums.some((n) => n !== undefined && !(n >= 0))) return setError('Numbers must be zero or more.')
    if (!((k100 !== undefined && p100 !== undefined) || (kPc !== undefined && pPc !== undefined))) {
      return setError('Enter calories and protein per 100 g, or per piece, from the label.')
    }
    await storage.saveEntry('foods', profileId, {
      ...(food ?? { source: 'user' as const }),
      name: name.trim(),
      aliases: aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
      kcalPer100g: k100, proteinPer100g: p100, kcalPerPiece: kPc, proteinPerPiece: pPc, gramsPerPiece: gPc,
    })
    reload()
    onClose()
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">{food ? 'Edit food' : 'Add a food'}</h1>
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Other names you type for it (commas)"><input className={inputCls} value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
      <p className="text-sm text-slate-400">Per 100 g (from the label)</p>
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="kcal per 100 g" placeholder="kcal" inputMode="decimal" className={inputCls} value={kcal100} onChange={(e) => setKcal100(e.target.value)} />
        <input aria-label="protein per 100 g" placeholder="protein g" inputMode="decimal" className={inputCls} value={prot100} onChange={(e) => setProt100(e.target.value)} />
      </div>
      <p className="text-sm text-slate-400">Or per piece</p>
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="kcal per piece" placeholder="kcal" inputMode="decimal" className={inputCls} value={kcalPc} onChange={(e) => setKcalPc(e.target.value)} />
        <input aria-label="protein per piece" placeholder="protein g" inputMode="decimal" className={inputCls} value={protPc} onChange={(e) => setProtPc(e.target.value)} />
      </div>
      <Field label="Grams in one piece (if you count it in pieces)"><input inputMode="decimal" className={inputCls} value={gramsPc} onChange={(e) => setGramsPc(e.target.value)} /></Field>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className={primaryBtn} onClick={() => void save()}>Save</button>
      {food && (
        <button className={secondaryBtn} onClick={async () => { await storage.deleteEntry('foods', profileId, food.id); reload(); onClose() }}>Remove from pantry</button>
      )}
      <button className={secondaryBtn} onClick={onClose}>Cancel</button>
    </div>
  )
}
