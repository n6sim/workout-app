import type { PhaseType } from '../../storage/types'
import { MODERATE } from '../modes'

export interface Volume {
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

/** Volume by phase (spec: Volume by phase). `index` is the exercise's position in the session, 0 first.
 *  Maintenance is "2 to 3 sets": 3 for the first two exercises, 2 for the rest. */
export function volumeFor(phase: PhaseType, index: number): Volume {
  // A diet break eats at maintenance, so it trains like maintenance (assumption, see the PR notes).
  // Aggressive is locked in v1 and never reached; it falls back to fat loss.
  const key = phase === 'diet_break' ? 'maintenance' : phase === 'aggressive' ? 'fat_loss' : phase
  const row = MODERATE.volumeTable[key] ?? MODERATE.volumeTable.fat_loss!
  const sets = typeof row.sets === 'number' ? row.sets : index < 2 ? row.sets.first : row.sets.rest
  return { sets, repMin: row.repMin, repMax: row.repMax, restSec: row.restSec }
}
