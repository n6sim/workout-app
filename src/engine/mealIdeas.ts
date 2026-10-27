import { itemAmount, sumItems, type FoodInfo, type Unit } from './nutrition'
import type { MealIdea } from './suggestions'

export interface IdeaDefLike {
  id: string
  name: string
  items: { food: string; qty: number; unit: Unit }[]
}

/** Totals for each idea from the pantry's own values. An idea whose foods are missing or lack a serving size
 *  is left out (for example if the user deleted a pantry food). */
export function ideasWithTotals(defs: IdeaDefLike[], foods: FoodInfo[]): (MealIdea & { items: IdeaDefLike['items'] })[] {
  const byName = new Map(foods.map((f) => [f.name, f]))
  const out: (MealIdea & { items: IdeaDefLike['items'] })[] = []
  for (const d of defs) {
    const parts = d.items.map((it) => {
      const food = byName.get(it.food)
      return food ? itemAmount(food, it.qty, it.unit) : null
    })
    if (parts.some((p) => !p || !p.ok)) continue
    const total = sumItems(parts as { kcal: number; proteinG: number }[])
    out.push({ id: d.id, name: d.name, kcal: total.kcal, proteinG: total.proteinG, items: d.items })
  }
  return out
}
