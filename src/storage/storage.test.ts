import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { WorkoutDB } from './db'
import { createStorage, type ProfileHeader, type Storage } from './index'
import { mergeEntries } from './merge'

const header: ProfileHeader = {
  profile: { name: 'Nasim', sex: 'female', birthDate: '1991-03-15', heightCm: 165, activityLevel: 'onFeet', updatedAt: '2026-10-24T10:00:00.000Z' },
  settings: { exerciseCreditPct: 50, trainingDays: [0, 2, 4], sessionLengthMin: 45, equipment: ['dumbbell'], dumbbellsKg: [4, 6, 8], mode: 'moderate', updatedAt: '2026-10-24T10:00:00.000Z' },
  goal: { type: 'lose', targetWeightKg: 70, targetDate: '2027-02-01', startDate: '2026-10-24', startTrendKg: 75, updatedAt: '2026-10-24T10:00:00.000Z' },
}

let n = 0
let s: Storage
beforeEach(() => {
  s = createStorage(new WorkoutDB(`test-${n++}`))
})

describe('storage', () => {
  it('a profile starts empty', async () => {
    expect(await s.loadHeader('nasim')).toBeNull()
    expect(await s.listEntries('weighIns', 'nasim')).toEqual([])
    expect(await s.exportProfile('nasim')).toBeNull()
  })

  it('saves and lists entries with id, timestamps and deviceId', async () => {
    await s.saveHeader('nasim', header)
    const w = await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    expect(w.id).toBeTruthy()
    expect(w.deleted).toBe(false)
    expect(w.deviceId).toBeTruthy()
    const list = await s.listEntries('weighIns', 'nasim')
    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('profileId')
  })

  it('keeps profiles separate', async () => {
    await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    expect(await s.listEntries('weighIns', 'kash')).toEqual([])
  })

  it('soft delete hides an entry but keeps it for merging', async () => {
    const w = await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    await s.deleteEntry('weighIns', 'nasim', w.id)
    expect(await s.listEntries('weighIns', 'nasim')).toEqual([])
    const all = await s.listEntries('weighIns', 'nasim', { includeDeleted: true })
    expect(all[0].deleted).toBe(true)
  })

  it('editing keeps createdAt and bumps updatedAt', async () => {
    const a = await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    await new Promise((r) => setTimeout(r, 5))
    const b = await s.saveEntry('weighIns', 'nasim', { ...a, kg: 74.5 })
    expect(b.createdAt).toBe(a.createdAt)
    expect(b.updatedAt > a.updatedAt).toBe(true)
  })

  it('round trip: export, clear, import loses nothing', async () => {
    await s.saveHeader('nasim', header)
    await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    const gone = await s.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    await s.deleteEntry('weighIns', 'nasim', gone.id)
    await s.saveEntry('phases', 'nasim', {
      type: 'fat_loss', startDate: '2026-10-24', endDate: null, reason: 'Initial goal',
      calorieTargetKcal: 1490, proteinTargetG: 135,
    })

    const before = await s.exportProfile('nasim')
    const text = JSON.stringify(before)
    await s.clearProfile('nasim')
    expect(await s.exportProfile('nasim')).toBeNull()

    await s.importProfile('nasim', text)
    expect(await s.exportProfile('nasim')).toEqual(before)
  })

  it('import merges: union by id, later updatedAt wins', async () => {
    await s.saveHeader('nasim', header)
    const a = await s.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    const file = JSON.parse(JSON.stringify(await s.exportProfile('nasim')))
    // another device edited a, and added b
    file.weighIns[0] = { ...a, kg: 74, updatedAt: '2099-01-01T00:00:00.000Z' }
    file.weighIns.push({ ...a, id: 'other-device-id', date: '2026-10-26', kg: 73.9 })
    // meanwhile this device added c
    await s.saveEntry('weighIns', 'nasim', { date: '2026-10-27', kg: 73.5 })

    await s.importProfile('nasim', JSON.stringify(file))
    const list = await s.listEntries('weighIns', 'nasim')
    expect(list).toHaveLength(3)
    expect(list.find((e) => e.id === a.id)!.kg).toBe(74)
  })

  it('import rejects a file for the other profile', async () => {
    await s.saveHeader('nasim', header)
    const text = JSON.stringify(await s.exportProfile('nasim'))
    await expect(s.importProfile('kash', text)).rejects.toThrow(/Nasim/)
  })

  it('import rejects bad files with a plain message', async () => {
    await expect(s.importProfile('nasim', 'not json')).rejects.toThrow(/not valid JSON/)
    await expect(s.importProfile('nasim', '{"schemaVersion":99}')).rejects.toThrow()
  })

  it('remembers the last profile and a stable deviceId', async () => {
    expect(await s.getLastProfile()).toBeNull()
    await s.setLastProfile('kash')
    expect(await s.getLastProfile()).toBe('kash')
    const a = await s.saveEntry('weighIns', 'kash', { date: '2026-10-24', kg: 80 })
    const b = await s.saveEntry('weighIns', 'kash', { date: '2026-10-25', kg: 80 })
    expect(a.deviceId).toBe(b.deviceId)
  })
})

describe('mergeEntries', () => {
  const e = (id: string, updatedAt: string, kg: number) => ({ id, updatedAt, createdAt: '', deleted: false, deviceId: 'd', date: '', kg })
  it('a tie keeps the local copy', () => {
    const merged = mergeEntries([e('1', 't', 1)], [e('1', 't', 2)])
    expect(merged[0].kg).toBe(1)
  })
  it('a soft delete with a later updatedAt wins', () => {
    const merged = mergeEntries([e('1', 'a', 1)], [{ ...e('1', 'b', 1), deleted: true }])
    expect(merged[0].deleted).toBe(true)
  })
})
