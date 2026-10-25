import type { PhaseType } from '../../storage/types'

export interface Volume {
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

/** Volume by phase (spec: Volume by phase). `index` is the exercise's position in the session, 0 first.
 *  Maintenance is "2 to 3 sets": 3 for the first two exercises, 2 for the rest. */
export function volumeFor(phase: PhaseType, index: number): Volume {
  switch (phase) {
    case 'maintenance':
    case 'diet_break': // assumption: a diet break eats at maintenance, so train like maintenance. Revisit in M5.
      return { sets: index < 2 ? 3 : 2, repMin: 6, repMax: 10, restSec: 90 }
    case 'fat_loss':
    case 'recomposition':
    case 'aggressive': // locked in v1; never reached
    default:
      return { sets: 3, repMin: 8, repMax: 12, restSec: 75 } // rest 60 to 90 s, midpoint
  }
}
