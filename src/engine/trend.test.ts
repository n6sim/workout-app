import { describe, expect, it } from 'vitest'
import { currentWeight, projectedDate, trendRate, trendSeries, trendWeight, type WeighPoint } from './trend'

const w = (date: string, kg: number): WeighPoint => ({ date, kg })

describe('trend weight (rule 7)', () => {
  it('is the average of the weigh-ins in the 7 days ending that day', () => {
    const ws = [w('2026-10-19', 80), w('2026-10-21', 79), w('2026-10-23', 78)]
    expect(trendWeight(ws, '2026-10-25')).toBe(79)
  })
  it('needs at least 3 weigh-ins in the window', () => {
    expect(trendWeight([w('2026-10-24', 80), w('2026-10-25', 79)], '2026-10-25')).toBeNull()
    expect(trendWeight([w('2026-10-23', 80), w('2026-10-24', 79), w('2026-10-25', 78)], '2026-10-25')).toBe(79)
  })
  it('a weigh-in older than 7 days drops out of the window', () => {
    const ws = [w('2026-10-18', 90), w('2026-10-20', 80), w('2026-10-22', 80), w('2026-10-24', 80)]
    expect(trendWeight(ws, '2026-10-24')).toBe(82.5) // the 18th is 6 days earlier, so it is still in the window
    expect(trendWeight([w('2026-10-17', 90), ...ws.slice(1)], '2026-10-24')).toBe(80) // the 17th is 7 days earlier: out
  })
  it('one odd weigh-in barely moves the trend', () => {
    const ws = [w('2026-10-19', 80), w('2026-10-20', 80), w('2026-10-21', 80), w('2026-10-22', 80), w('2026-10-23', 80), w('2026-10-24', 80), w('2026-10-25', 82)]
    expect(trendWeight(ws, '2026-10-25')).toBeCloseTo(80.286, 3)
  })
  it('ignores weigh-ins on paused days', () => {
    const ws = [w('2026-10-20', 80), w('2026-10-21', 80), w('2026-10-22', 85), w('2026-10-23', 80)]
    expect(trendWeight(ws, '2026-10-24', new Set(['2026-10-22']))).toBe(80)
    expect(trendWeight(ws, '2026-10-24', new Set(['2026-10-22', '2026-10-23']))).toBeNull()
  })
  it('later weigh-ins do not leak into earlier days', () => {
    const ws = [w('2026-10-20', 80), w('2026-10-21', 80), w('2026-10-22', 80), w('2026-10-26', 70)]
    expect(trendWeight(ws, '2026-10-22')).toBe(80)
  })
})

describe('series and current weight', () => {
  const ws = [w('2026-10-20', 80), w('2026-10-21', 79), w('2026-10-22', 78)]
  it('builds one point per day, null until there are 3 weigh-ins', () => {
    const s = trendSeries(ws, '2026-10-20', '2026-10-23')
    expect(s.map((p) => p.trend)).toEqual([null, null, 79, 79])
  })
  it('falls back to the latest weigh-in when there is no trend yet', () => {
    expect(currentWeight(ws, '2026-10-22')).toEqual({ kg: 79, fromTrend: true })
    expect(currentWeight([w('2026-10-22', 78.4)], '2026-10-22')).toEqual({ kg: 78.4, fromTrend: false })
    expect(currentWeight([], '2026-10-22')).toBeNull()
  })
})

describe('rate and projection', () => {
  const daily = (from: string, n: number, start: number, perDay: number): WeighPoint[] =>
    Array.from({ length: n }, (_, i) => w(new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10), start + perDay * i))
  it('rate is the trend change per day over 21 days', () => {
    const ws = daily('2026-10-01', 40, 80, -0.05)
    expect(trendRate(ws, '2026-11-09')).toBeCloseTo(-0.05, 3)
  })
  it('is null without enough history', () => {
    expect(trendRate(daily('2026-11-01', 8, 80, -0.05), '2026-11-08')).toBeNull()
  })
  it('projects the date the trend reaches the target', () => {
    // 80 -> 78 at 0.05 kg/day = 40 days
    expect(projectedDate(80, 78, -0.05, '2026-11-01')).toBe('2026-12-11')
  })
  it('gives no date when flat, rising, or already there', () => {
    expect(projectedDate(80, 78, 0, '2026-11-01')).toBeNull()
    expect(projectedDate(80, 78, 0.02, '2026-11-01')).toBeNull()
    expect(projectedDate(78, 78, -0.05, '2026-11-01')).toBeNull()
    expect(projectedDate(80, 78, null, '2026-11-01')).toBeNull()
  })
})
