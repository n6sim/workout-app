import { describe, expect, it } from 'vitest'
import { pickPilatesType, type PilatesInput } from './pilates'
import { volumeFor } from './volume'

const base: PilatesInput = { heavyLowerYesterday: false, restYesterday: false, lightWeek: false, phase: 'fat_loss', weekNumber: 0 }

describe('pilates type', () => {
  it('after heavy lower body: low impact, with the spec reason', () => {
    const r = pickPilatesType({ ...base, heavyLowerYesterday: true })
    expect(r.type).toBe('low_impact_recovery')
    expect(r.reason).toBe('Low impact today: you did heavy lower body yesterday.')
  })
  it('heavy lower body beats everything else', () => {
    expect(pickPilatesType({ ...base, heavyLowerYesterday: true, phase: 'maintenance', restYesterday: true }).type).toBe('low_impact_recovery')
  })
  it('maintenance: lower body strength', () => {
    expect(pickPilatesType({ ...base, phase: 'maintenance' }).type).toBe('lower_body_strength')
  })
  it('after a rest day: full body or higher intensity, alternating by week', () => {
    expect(pickPilatesType({ ...base, restYesterday: true, weekNumber: 2 }).type).toBe('full_body')
    expect(pickPilatesType({ ...base, restYesterday: true, weekNumber: 3 }).type).toBe('higher_intensity')
  })
  it('after a light week: full body or higher intensity', () => {
    const r = pickPilatesType({ ...base, lightWeek: true, weekNumber: 1 })
    expect(r.type).toBe('higher_intensity')
    expect(r.reason).toMatch(/last week was light/)
  })
  it('otherwise core', () => {
    expect(pickPilatesType(base).type).toBe('core')
  })
  it('every pick comes with a one-line reason', () => {
    for (const input of [base, { ...base, heavyLowerYesterday: true }, { ...base, restYesterday: true }]) {
      const { reason } = pickPilatesType(input)
      expect(reason.length).toBeGreaterThan(10)
      expect(reason).not.toContain('\n')
    }
  })
})

describe('volume by phase', () => {
  it('fat loss and recomposition: 3 sets of 8 to 12, 60 to 90 s rest', () => {
    for (const p of ['fat_loss', 'recomposition'] as const) {
      const v = volumeFor(p, 3)
      expect(v).toMatchObject({ sets: 3, repMin: 8, repMax: 12 })
      expect(v.restSec).toBeGreaterThanOrEqual(60)
      expect(v.restSec).toBeLessThanOrEqual(90)
    }
  })
  it('maintenance: 6 to 10 reps, 90 s, 3 sets then 2 sets', () => {
    expect(volumeFor('maintenance', 0)).toEqual({ sets: 3, repMin: 6, repMax: 10, restSec: 90 })
    expect(volumeFor('maintenance', 1).sets).toBe(3)
    expect(volumeFor('maintenance', 2).sets).toBe(2)
  })
})
