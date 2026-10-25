import { describe, expect, it } from 'vitest'
import { adherence } from './adherence'

// Mon/Wed/Fri plan. Week of Mon 2026-10-19.
const base = { trainingDays: [0, 2, 4], startDate: '2026-10-19', today: '2026-10-25', paused: new Set<string>(), doneSessionDates: new Set<string>(), loggedDoneDates: new Set<string>() }

describe('adherence', () => {
  it('a full week with 2 of 3 sessions done', () => {
    const a = adherence({ ...base, doneSessionDates: new Set(['2026-10-19', '2026-10-21']) })
    expect(a).toMatchObject({ planned: 3, done: 2 })
  })
  it('days before you started are not planned', () => {
    expect(adherence({ ...base, startDate: '2026-10-21' }).planned).toBe(2) // Wed and Fri only
  })
  it('paused days are left out', () => {
    expect(adherence({ ...base, paused: new Set(['2026-10-21', '2026-10-22']) }).planned).toBe(2)
  })
  it('today only counts once its session is done', () => {
    const wed = { ...base, today: '2026-10-21' }
    expect(adherence(wed).planned).toBe(1) // Monday only
    expect(adherence({ ...wed, doneSessionDates: new Set(['2026-10-21']) })).toMatchObject({ planned: 2, done: 1 })
  })
  it('a session done on a rest day still counts as done', () => {
    expect(adherence({ ...base, doneSessionDates: new Set(['2026-10-20']) }).done).toBe(0) // rest day: not part of the plan
  })
  it('days fully logged out of days tracked, today excluded', () => {
    const a = adherence({ ...base, loggedDoneDates: new Set(['2026-10-19', '2026-10-20', '2026-10-25']) })
    expect(a.daysTracked).toBe(6) // 19 to 24
    expect(a.daysFullyLogged).toBe(2)
  })
  it('paused days are not tracked', () => {
    expect(adherence({ ...base, paused: new Set(['2026-10-19', '2026-10-20']) }).daysTracked).toBe(4)
  })
})
