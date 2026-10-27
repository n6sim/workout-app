import { storage } from '../storage/instance'
import type { Food, ProfileId } from '../storage'
import type { FoodInfo } from '../engine/nutrition'
import seed from '../data/seedFoods.json'

/** Old on purpose: any real edit, on any device, is newer and wins when copies merge. */
const SEED_STAMP = '2000-01-01T00:00:00.000Z'

interface SeedFood {
  id: string
  cnfFoodId: number
  name: string
  aliases: string[]
  kcalPer100g: number
  proteinPer100g: number
  gramsPerPiece?: number
  gramsPerSlice?: number
  gramsPerMl?: number
}

/** Puts the ~120 starter foods into this profile's pantry. Safe to run every launch: it only adds the
 *  ones that are missing, and never brings back one you deleted. Ids are per profile (both profiles share one database). */
export async function ensurePantry(profileId: ProfileId): Promise<void> {
  const rows = (seed as SeedFood[]).map(({ id, cnfFoodId, ...rest }) => ({
    ...rest, id: `${profileId}-${id}`, cnfFoodId, source: 'cnf' as const,
  }))
  await storage.seedEntries('foods', profileId, rows, SEED_STAMP)
}

export const toInfo = (f: Food): FoodInfo => f

/** Remember "chicken breast" -> this food, so the next log does not ask again. */
export async function saveAlias(profileId: ProfileId, food: Food, alias: string): Promise<Food> {
  const clean = alias.trim().toLowerCase()
  if (!clean || food.aliases.some((a) => a.toLowerCase() === clean)) return food
  return storage.saveEntry('foods', profileId, { ...food, aliases: [...food.aliases, clean] }) as Promise<Food>
}
