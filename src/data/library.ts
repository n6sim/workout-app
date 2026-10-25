import type { Equipment, Exercise } from '../engine/training/types'
import imported from './exercises.json'
import { HANDMADE } from './handmade'

/** The full library: imported from free-exercise-db (npm run import-exercises) plus hand-written moves. */
export const LIBRARY: Exercise[] = [...(imported as unknown as Exercise[]), ...HANDMADE]

/** Keep only what the user can do with the equipment they own (spec: filtered to owned equipment). */
export function ownedLibrary(library: Exercise[], owned: string[]): Exercise[] {
  const have = new Set<string>(owned as Equipment[])
  return library.filter((e) => have.has(e.equipment))
}
