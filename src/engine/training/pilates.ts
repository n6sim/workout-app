import type { PhaseType } from '../../storage/types'
import type { PilatesType } from './types'

export const PILATES_LABEL: Record<PilatesType, string> = {
  core: 'Core',
  lower_body_strength: 'Lower body strength',
  full_body: 'Full body',
  low_impact_recovery: 'Low impact recovery',
  higher_intensity: 'Higher intensity',
}

export interface PilatesInput {
  /** Yesterday had a done or partial session that worked legs or glutes. */
  heavyLowerYesterday: boolean
  /** Yesterday had no done or partial session. */
  restYesterday: boolean
  /** Last week had fewer than half of its planned sessions done. */
  lightWeek: boolean
  phase: PhaseType
  /** Counts weeks, so the full body / higher intensity choice alternates. */
  weekNumber: number
}

/** Picks the pilates type and the one-line reason (spec: Pilates and mobility). Rules in priority order. */
export function pickPilatesType(i: PilatesInput): { type: PilatesType; reason: string } {
  if (i.heavyLowerYesterday) {
    return { type: 'low_impact_recovery', reason: 'Low impact today: you did heavy lower body yesterday.' }
  }
  if (i.phase === 'maintenance') {
    return { type: 'lower_body_strength', reason: 'Lower body strength today: in maintenance, extra leg work helps keep your muscle.' }
  }
  if (i.restYesterday || i.lightWeek) {
    const why = i.restYesterday ? 'you rested yesterday' : 'last week was light'
    return i.weekNumber % 2 === 0
      ? { type: 'full_body', reason: `Full body today: ${why}, so you are fresh.` }
      : { type: 'higher_intensity', reason: `Higher intensity today: ${why}, so you are fresh.` }
  }
  return { type: 'core', reason: 'Core today: you trained yesterday, so keep it centered on your middle.' }
}
