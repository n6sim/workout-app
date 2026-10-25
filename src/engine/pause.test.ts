import { describe, expect, it } from 'vitest'
import { activePause, pausedDates, pauseDays, returnInfo, shouldPromptLongPause, type PauseLike } from './pause'

const pause = (startDate: string, endDate: string | null, reason: PauseLike['reason'] = 'holiday'): PauseLike => ({ startDate, endDate, reason })

describe('pause mode', () => {
  it('lists every paused day, start and end included', () => {
    expect([...pausedDates([pause('2026-11-02', '2026-11-04')], '2026-11-30')]).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })
  it('an open pause runs up to today', () => {
    expect([...pausedDates([pause('2026-11-02', null)], '2026-11-04')]).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })
  it('a pause with a future end date is active until then', () => {
    const p = pause('2026-11-02', '2026-11-10')
    expect(activePause([p], '2026-11-05')).toBe(p)
    expect(activePause([p], '2026-11-10')).toBe(p)
    expect(activePause([p], '2026-11-11')).toBeNull()
    expect(activePause([p], '2026-11-01')).toBeNull()
  })
  it('after 14 days a gentle prompt asks to extend or resume', () => {
    expect(pauseDays(pause('2026-11-01', null), '2026-11-14')).toBe(14)
    expect(shouldPromptLongPause(pause('2026-11-01', null), '2026-11-13')).toBe(false)
    expect(shouldPromptLongPause(pause('2026-11-01', null), '2026-11-14')).toBe(true)
  })
})

describe('coming back', () => {
  const wi = (...dates: string[]) => dates.map((date) => ({ date, kg: 80 }))
  it('nothing to come back from without a recent pause', () => {
    expect(returnInfo([], [], '2026-11-20')).toBeNull()
    expect(returnInfo([pause('2026-10-01', '2026-10-10')], [], '2026-11-20')).toBeNull() // long ago
  })
  it('the first day back asks for a weigh-in each morning for 5 days, and waits for 3', () => {
    const r = returnInfo([pause('2026-11-01', '2026-11-09')], [], '2026-11-10')!
    expect(r).toMatchObject({ backOn: '2026-11-10', daysBack: 0, weighInsSince: 0, showWelcome: true, awaitingBaseline: true })
  })
  it('after 3 weigh-ins the coach has its new baseline', () => {
    const r = returnInfo([pause('2026-11-01', '2026-11-09')], wi('2026-11-10', '2026-11-11', '2026-11-12'), '2026-11-12')!
    expect(r.awaitingBaseline).toBe(false)
    expect(r.showWelcome).toBe(true) // still asks for the full 5 mornings
  })
  it('the welcome card goes away after 5 days or 5 weigh-ins', () => {
    expect(returnInfo([pause('2026-11-01', '2026-11-09')], [], '2026-11-15')!.showWelcome).toBe(false)
    expect(returnInfo([pause('2026-11-01', '2026-11-09')], wi('2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'), '2026-11-14')!.showWelcome).toBe(false)
  })
  it('after a break of more than 7 days, the first week back has one set fewer', () => {
    expect(returnInfo([pause('2026-11-01', '2026-11-07')], [], '2026-11-09')!.oneFewerSet).toBe(false) // 7 days
    expect(returnInfo([pause('2026-11-01', '2026-11-08')], [], '2026-11-10')!.oneFewerSet).toBe(true) // 8 days
    expect(returnInfo([pause('2026-11-01', '2026-11-08')], [], '2026-11-16')!.oneFewerSet).toBe(false) // a week later
  })
  it('a sick break is flagged for a lighter first session', () => {
    expect(returnInfo([pause('2026-11-01', '2026-11-03', 'sick')], [], '2026-11-04')!.sick).toBe(true)
    expect(returnInfo([pause('2026-11-01', '2026-11-03', 'busy')], [], '2026-11-04')!.sick).toBe(false)
  })
  it('is null while still paused', () => {
    expect(returnInfo([pause('2026-11-01', '2026-11-20')], [], '2026-11-10')).toBeNull()
  })
})
