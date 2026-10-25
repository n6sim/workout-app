import { describe, expect, it } from 'vitest'
import { todayBudget, weekStartOf, type BudgetInput } from './budget'

// Week of Mon 2026-10-19 ... Sun 2026-10-25. Target 1800, floor 1200.
const base = (over: Partial<BudgetInput> = {}): BudgetInput => ({
  today: '2026-10-19', dailyTarget: 1800, calorieFloor: 1200, startDate: '2026-10-01',
  eatenByDate: {}, creditedByDate: {}, flexDate: null, ...over,
})

describe('weekly budget', () => {
  it('Monday with nothing logged: the daily target', () => {
    const b = todayBudget(base())
    expect(b).toMatchObject({ weekStart: '2026-10-19', weeklyBudget: 12600, daysLeft: 7, budget: 1800, eatenToday: 0, remaining: 1800 })
  })
  it('weekly budget adds credited exercise: 12600 + 300', () => {
    const b = todayBudget(base({ today: '2026-10-21', creditedByDate: { '2026-10-19': 100, '2026-10-21': 200, '2026-10-22': 999 } }))
    expect(b.weekCredited).toBe(300) // later days do not count yet
    expect(b.weeklyBudget).toBe(12900)
  })
  it('exercise done today raises today budget by its share of the rest of the week', () => {
    const none = todayBudget(base({ today: '2026-10-21' })).budget
    const some = todayBudget(base({ today: '2026-10-21', creditedByDate: { '2026-10-21': 350 } })).budget
    expect(some - none).toBe(70) // 350 / 5 days left
  })
  it('an overshoot is spread over the days left', () => {
    // Monday 2500 (700 over). Tuesday: (12600 - 2500) / 6 = 1683.33
    const b = todayBudget(base({ today: '2026-10-20', eatenByDate: { '2026-10-19': 2500 } }))
    expect(b.budget).toBe(1683)
  })
  it('an undershoot gives a little back', () => {
    const b = todayBudget(base({ today: '2026-10-20', eatenByDate: { '2026-10-19': 1500 } }))
    expect(b.budget).toBe(1850) // (12600 - 1500) / 6
  })
  it('is clamped to +/-20% of the target', () => {
    const big = todayBudget(base({ today: '2026-10-25', eatenByDate: { '2026-10-19': 1000, '2026-10-20': 1000, '2026-10-21': 1000, '2026-10-22': 1000, '2026-10-23': 1000, '2026-10-24': 1000 } }))
    expect(big.budget).toBe(2160) // would be 6600, capped at 1.2 x 1800
    const small = todayBudget(base({ today: '2026-10-25', eatenByDate: { '2026-10-19': 4000, '2026-10-20': 4000, '2026-10-21': 4000, '2026-10-22': 4000, '2026-10-23': 4000, '2026-10-24': 4000 } }))
    expect(small.budget).toBe(1440) // capped at 0.8 x 1800
  })
  it('an overshoot bigger than the clamp is not carried into next week', () => {
    const next = todayBudget(base({ today: '2026-10-26', eatenByDate: { '2026-10-19': 9000, '2026-10-25': 5000 } }))
    expect(next).toMatchObject({ weekStart: '2026-10-26', budget: 1800, daysLeft: 7 })
  })
  it('days with nothing logged count as on target, so skipping the log never inflates the budget', () => {
    const b = todayBudget(base({ today: '2026-10-22' })) // Mon to Wed unlogged
    expect(b.budget).toBe(1800)
    expect(b.countedBefore).toBe(5400)
  })
  it('days before the plan started count as on target', () => {
    const b = todayBudget(base({ today: '2026-10-22', startDate: '2026-10-22', eatenByDate: { '2026-10-20': 100 } }))
    expect(b.countedBefore).toBe(5400)
    expect(b.budget).toBe(1800)
  })
  it('the last day of the week', () => {
    const b = todayBudget(base({ today: '2026-10-25' }))
    expect(b.daysLeft).toBe(1)
    expect(b.budget).toBe(1800)
  })
  it('remaining is budget minus today eaten', () => {
    expect(todayBudget(base({ eatenByDate: { '2026-10-19': 650.4 } }))).toMatchObject({ eatenToday: 650, remaining: 1150 })
  })
  it('never below the calorie floor', () => {
    const b = todayBudget(base({ dailyTarget: 1250, today: '2026-10-25', eatenByDate: { '2026-10-19': 4000, '2026-10-20': 4000, '2026-10-21': 4000, '2026-10-22': 4000, '2026-10-23': 4000, '2026-10-24': 4000 } }))
    expect(b.budget).toBe(1200) // 0.8 x 1250 = 1000, lifted to the floor
  })
})

describe('flex day', () => {
  it('the flex day itself gets +400', () => {
    expect(todayBudget(base({ today: '2026-10-23', flexDate: '2026-10-23' }))).toMatchObject({ budget: 2200, isFlexToday: true })
  })
  it('the other remaining days give it back evenly: 400 / 6 others on Monday', () => {
    const b = todayBudget(base({ flexDate: '2026-10-23' }))
    expect(b.budget).toBe(1733) // 1800 - 66.67
    expect(b.isFlexToday).toBe(false)
  })
  it('over the whole week the extra and the cuts cancel out', () => {
    // No one eats anything unexpected: every day eats exactly its budget.
    const eaten: Record<string, number> = {}
    let total = 0
    for (let d = 19; d <= 25; d++) {
      const date = `2026-10-${d}`
      const b = todayBudget(base({ today: date, eatenByDate: { ...eaten }, flexDate: '2026-10-22' }))
      eaten[date] = b.budget
      total += b.budget
    }
    expect(total).toBeGreaterThan(12590)
    expect(total).toBeLessThan(12610)
  })
  it('a flex day that already passed changes nothing further', () => {
    const b = todayBudget(base({ today: '2026-10-24', flexDate: '2026-10-20', eatenByDate: { '2026-10-20': 2200 } }))
    expect(b.isFlexToday).toBe(false)
    expect(b.budget).toBe(1600) // (12600 - (3 x 1800 + 2200 + 1800)) / 2 days left
  })
  it('a flex day from another week is ignored', () => {
    expect(todayBudget(base({ flexDate: '2026-10-28' })).budget).toBe(1800)
  })
  it('the flex +400 is not clamped to 20%', () => {
    expect(todayBudget(base({ today: '2026-10-25', flexDate: '2026-10-25', eatenByDate: { '2026-10-19': 1000, '2026-10-20': 1000, '2026-10-21': 1000, '2026-10-22': 1000, '2026-10-23': 1000, '2026-10-24': 1000 } })).budget).toBe(2560)
  })
})

describe('week start', () => {
  it('is the Monday of that week', () => {
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19')
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19')
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26')
  })
})
