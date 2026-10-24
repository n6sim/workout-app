import { describe, expect, it } from 'vitest'
import { bmr } from './bmr'
import { ageYears } from './dates'

describe('bmr (Mifflin-St Jeor)', () => {
  it('female: 10*75 + 6.25*165 - 5*35 - 161 = 1445.25', () => {
    expect(bmr('female', 75, 165, 35)).toBeCloseTo(1445.25, 5)
  })
  it('male: 10*80 + 6.25*180 - 5*40 + 5 = 1730', () => {
    expect(bmr('male', 80, 180, 40)).toBeCloseTo(1730, 5)
  })
  it('male is 166 kcal above female for identical inputs', () => {
    expect(bmr('male', 70, 170, 30) - bmr('female', 70, 170, 30)).toBe(166)
  })
})

describe('ageYears', () => {
  it('counts whole years, before and after the birthday', () => {
    expect(ageYears('1991-03-15', '2026-10-24')).toBe(35)
    expect(ageYears('1991-12-01', '2026-10-24')).toBe(34)
    expect(ageYears('1991-10-24', '2026-10-24')).toBe(35)
    expect(ageYears('1991-10-25', '2026-10-24')).toBe(34)
  })
})
