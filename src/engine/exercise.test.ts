import { describe, expect, it } from 'vitest'
import { creditedKcal, estimateKcal, MET, workoutBlocks, workoutBurn } from './exercise'

describe('exercise calories', () => {
  it('uses the spec MET table', () => {
    expect(MET).toEqual({ strength: 4.5, pilates: 3.0, treadmill_walk: 5.0, bike: 6.8, stepper: 8.0, easy_walk: 3.5 })
  })
  it('MET x kg x hours: 4.5 x 70 kg x 0.5 h = 157.5', () => {
    expect(estimateKcal('strength', 70, 30)).toBeCloseTo(157.5, 6)
    expect(estimateKcal('bike', 80, 60)).toBeCloseTo(544, 6)
    expect(estimateKcal('stepper', 60, 15)).toBeCloseTo(120, 6)
  })
  it('credits 50% by default and follows the setting', () => {
    expect(creditedKcal(220, 50)).toBe(110) // the spec example: "Burned ~220, counted 110"
    expect(creditedKcal(220, 25)).toBe(55)
    expect(creditedKcal(220, 100)).toBe(220)
    expect(creditedKcal(220, 0)).toBe(0)
  })
})

describe('workouts', () => {
  it('a strength day is one strength block', () => {
    expect(workoutBlocks({ kind: 'upper', estMinutes: 45, cardio: null })).toEqual([{ type: 'strength', minutes: 45 }])
  })
  it('pilates + cardio splits into treadmill walk and pilates', () => {
    const b = workoutBlocks({ kind: 'pilates_cardio', estMinutes: 40, cardio: { exerciseId: 'Walking_Treadmill', name: 'Walk', seconds: 1200 } })
    expect(b).toEqual([{ type: 'treadmill_walk', minutes: 20 }, { type: 'pilates', minutes: 20 }])
  })
  it('actual time scales the blocks', () => {
    const b = workoutBlocks({ kind: 'pilates_cardio', estMinutes: 40, cardio: { exerciseId: 'Walking_Treadmill', name: 'Walk', seconds: 1200 } }, 20)
    expect(b).toEqual([{ type: 'treadmill_walk', minutes: 10 }, { type: 'pilates', minutes: 10 }])
  })
  it('burned and counted for a 45 min strength session at 70 kg', () => {
    // 4.5 x 70 x 0.75 = 236.25 -> 236, counted 118
    expect(workoutBurn({ kind: 'upper', estMinutes: 45, cardio: null }, 70, 50)).toEqual({ estKcal: 236, creditedKcal: 118 })
  })
})
