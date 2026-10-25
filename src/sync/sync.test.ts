import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutDB } from '../storage/db'
import { createStorage, type ProfileHeader, type ProfileId, type Storage } from '../storage'
import { FakeGitHub } from './testing'
import { GitHubSync } from './github'
import { syncProfile } from './syncProfile'
import { SyncManager } from './manager'
import { AuthError, ConflictError, NetworkError, RemoteError } from './types'
import { expiryInfo, isStale, saveSyncConfig, loadSyncConfig } from './config'

const TOKEN = 'github_pat_SECRET_TOKEN_123'
const header: ProfileHeader = {
  profile: { name: 'Nasim', sex: 'female', birthDate: '1991-03-15', heightCm: 165, activityLevel: 'onFeet', updatedAt: '2026-10-24T10:00:00.000Z' },
  settings: { exerciseCreditPct: 50, trainingDays: [0, 2, 4], sessionLengthMin: 45, equipment: ['dumbbell'], dumbbellsKg: [4, 6], mode: 'moderate', updatedAt: '2026-10-24T10:00:00.000Z' },
  goal: { type: 'lose', targetWeightKg: 70, targetDate: '2027-02-01', startDate: '2026-10-24', startTrendKg: 75, updatedAt: '2026-10-24T10:00:00.000Z' },
}

let n = 0
let gh: FakeGitHub
const device = () => {
  const g = gh
  const storage = createStorage(new WorkoutDB(`sync-${n++}`))
  const remote = () => new GitHubSync({ owner: 'n6sim', repo: 'workout-data', token: TOKEN }, g.fetch)
  return { storage, sync: (id: ProfileId = 'nasim') => syncProfile(storage, remote(), id), remote }
}
const kgs = async (s: Storage) => (await s.listEntries('weighIns', 'nasim')).map((w) => w.kg).sort()

beforeEach(() => {
  gh = new FakeGitHub(TOKEN)
})

describe('syncProfile', () => {
  it('first sync creates the file; the dirty flag clears', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    expect(await a.storage.getDirty('nasim')).not.toBeNull()
    await a.sync()
    expect(gh.files.has('nasim.json')).toBe(true)
    expect(await a.storage.getDirty('nasim')).toBeNull()
  })

  it('a new device pulls everything', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    await a.sync()
    const b = device()
    await b.sync()
    expect(await kgs(b.storage)).toEqual([75])
    expect(await b.storage.loadHeader('nasim')).toEqual(header)
    expect(await b.storage.getDirty('nasim')).toBeNull() // pulling is not a local change
  })

  it('two devices edit offline, then sync: both sets of entries survive', async () => {
    const a = device()
    const b = device()
    await a.storage.saveHeader('nasim', header)
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    await a.sync()
    await b.sync()
    // both go offline and log different things
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    await b.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-26', kg: 74.5 })
    await b.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-27', kg: 74.2 })
    await a.sync()
    await b.sync()
    await a.sync()
    expect(await kgs(a.storage)).toEqual([74.2, 74.5, 74.8, 75])
    expect(await kgs(b.storage)).toEqual([74.2, 74.5, 74.8, 75])
  })

  it('a delete on one device reaches the other', async () => {
    const a = device()
    const b = device()
    await a.storage.saveHeader('nasim', header)
    const w = await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-24', kg: 75 })
    await a.sync()
    await b.sync()
    await a.storage.deleteEntry('weighIns', 'nasim', w.id)
    await a.sync()
    await b.sync()
    expect(await kgs(b.storage)).toEqual([])
  })

  it('retries after a 409 and succeeds', async () => {
    const a = device()
    const other = device()
    await a.storage.saveHeader('nasim', header)
    await a.sync()
    await other.sync()
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    await other.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-26', kg: 74.5 })
    // The other device pushes between our GET and our PUT.
    gh.beforePut = (path) => {
      gh.beforePut = null
      // synchronous write straight into the fake (the other device's push landing first)
      const doc = gh.read(path) as { weighIns: unknown[] }
      doc.weighIns.push({ id: 'raced-1', date: '2026-10-28', kg: 73, createdAt: 'x', updatedAt: '2026-10-28T00:00:00.000Z', deleted: false, deviceId: 'z' })
      gh.write(path, JSON.stringify(doc))
    }
    const putsBefore = gh.calls.filter((c) => c.method === 'PUT').length
    await a.sync()
    expect(await kgs(a.storage)).toEqual([73, 74.8])
    expect(gh.calls.filter((c) => c.method === 'PUT').length - putsBefore).toBe(2) // one 409, one success
  })

  it('gives up after 3 conflicting tries', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.sync()
    await a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    gh.beforePut = (path) => gh.write(path, gh.files.get(path)!.text) // always changes the sha first
    const putsBefore = gh.calls.filter((c) => c.method === 'PUT').length
    await expect(a.sync()).rejects.toBeInstanceOf(ConflictError)
    expect(gh.calls.filter((c) => c.method === 'PUT').length - putsBefore).toBe(3)
    expect(await a.storage.getDirty('nasim')).not.toBeNull() // still queued
  })

  it('a change made during the push stays queued', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    gh.beforePut = () => {
      gh.beforePut = null
      // the user logs something while the push is in flight
      void a.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    }
    await a.sync()
    await new Promise((r) => setTimeout(r, 20))
    expect(await a.storage.getDirty('nasim')).not.toBeNull()
    await a.sync()
    expect(await a.storage.getDirty('nasim')).toBeNull()
    expect((gh.read('nasim.json') as { weighIns: unknown[] }).weighIns).toHaveLength(1)
  })

  it('refuses a remote file that belongs to the other profile', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.sync()
    const doc = gh.read('nasim.json') as { profile: { name: string } }
    doc.profile.name = 'Kash'
    gh.write('nasim.json', JSON.stringify(doc))
    await expect(a.sync()).rejects.toBeInstanceOf(RemoteError)
  })

  it('reads a file over 1 MB through the raw fallback', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.sync()
    gh.inlineLimit = 10
    const b = device()
    await b.sync()
    expect(await b.storage.loadHeader('nasim')).toEqual(header)
  })

  it('keeps non-ASCII text intact', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.storage.saveEntry('foods', 'nasim', { name: 'Crème fraîche 🥛', aliases: [] })
    await a.sync()
    const b = device()
    await b.sync()
    expect((await b.storage.listEntries('foods', 'nasim'))[0].name).toBe('Crème fraîche 🥛')
  })

  it('does nothing when neither side has data', async () => {
    const a = device()
    await a.sync()
    expect(gh.files.size).toBe(0)
  })
})

describe('GitHubSync errors', () => {
  it('401 on a wrong token', async () => {
    const bad = new GitHubSync({ owner: 'n6sim', repo: 'workout-data', token: 'wrong' }, gh.fetch)
    await expect(bad.fetch('nasim')).rejects.toBeInstanceOf(AuthError)
  })
  it('offline becomes NetworkError', async () => {
    gh.offline = true
    const a = device()
    await expect(a.remote().fetch('nasim')).rejects.toBeInstanceOf(NetworkError)
  })
  it('a missing repo is an error, a missing file is not', async () => {
    const a = device()
    expect(await a.remote().fetch('nasim')).toEqual({ doc: null, version: null })
    gh.repoExists = false
    await expect(a.remote().fetch('nasim')).rejects.toThrow(/not found/)
  })
})

describe('token safety', () => {
  it('is only ever sent in the Authorization header', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await a.sync()
    for (const c of gh.calls) {
      expect(c.url).not.toContain(TOKEN)
      expect(c.body).not.toContain(TOKEN)
    }
    expect(JSON.stringify(gh.files.get('nasim.json'))).not.toContain(TOKEN)
  })

  it('is not in the export or the synced file, though it is stored on the device', async () => {
    const a = device()
    await a.storage.saveHeader('nasim', header)
    await saveSyncConfig(a.storage, { token: TOKEN, repo: 'n6sim/workout-data', expiry: '2027-01-01' })
    expect((await loadSyncConfig(a.storage))?.token).toBe(TOKEN)
    expect(JSON.stringify(await a.storage.exportProfile('nasim'))).not.toContain(TOKEN)
    await a.sync()
    expect(gh.files.get('nasim.json')!.text).not.toContain(TOKEN)
  })

  it('is never logged and never in an error message', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k))
    const manager = new SyncManager(device().storage, { makeRemote: () => { throw new RemoteError(`oops ${TOKEN}`) } })
    const d = device()
    await saveSyncConfig(d.storage, { token: TOKEN, repo: 'n6sim/workout-data', expiry: '' })
    const m = new SyncManager(d.storage, { makeRemote: () => ({ fetch: async () => { throw new RemoteError(`bad ${TOKEN} here`) }, put: async () => '' }) })
    await m.start('nasim')
    m.stop()
    manager.stop()
    expect(m.getStatus().state).toBe('error')
    expect(m.getStatus().message).not.toContain(TOKEN)
    for (const s of spies) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN)
    spies.forEach((s) => s.mockRestore())
  })
})

describe('config helpers', () => {
  it('warns 7 days before expiry', () => {
    expect(expiryInfo(null, '2026-10-24')).toEqual({ kind: 'none' })
    expect(expiryInfo('2026-11-24', '2026-10-24').kind).toBe('ok')
    expect(expiryInfo('2026-10-31', '2026-10-24')).toEqual({ kind: 'soon', daysLeft: 7 })
    expect(expiryInfo('2026-10-24', '2026-10-24')).toEqual({ kind: 'soon', daysLeft: 0 })
    expect(expiryInfo('2026-10-23', '2026-10-24')).toEqual({ kind: 'expired' })
  })
  it('flags a device that has not synced in 3 days', () => {
    const now = Date.parse('2026-10-24T12:00:00Z')
    expect(isStale(null, now)).toBe(false)
    expect(isStale('2026-10-22T13:00:00Z', now)).toBe(false)
    expect(isStale('2026-10-21T11:00:00Z', now)).toBe(true)
  })
  it('rejects a bad repo name', async () => {
    const d = device()
    await expect(saveSyncConfig(d.storage, { token: 'x', repo: 'nope', expiry: '' })).rejects.toThrow(/owner\/name/)
  })
})

describe('SyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function ready(opts: { online?: () => boolean } = {}) {
    const g = gh
    const d = device()
    await saveSyncConfig(d.storage, { token: TOKEN, repo: 'n6sim/workout-data', expiry: '' })
    await d.storage.saveHeader('nasim', header)
    const m = new SyncManager(d.storage, { makeRemote: (cfg) => new GitHubSync({ owner: cfg.owner, repo: cfg.repo, token: cfg.token }, g.fetch), isOnline: opts.online, now: () => Date.parse('2026-10-24T12:00:00Z') })
    return { d, m }
  }
  const puts = () => gh.calls.filter((c) => c.method === 'PUT').length
  const gets = () => gh.calls.filter((c) => c.method === 'GET' && c.url.endsWith('nasim.json')).length
  /** Fake timers do not flush IndexedDB's real async work; wait for the effect instead. */
  const until = (check: () => void) => vi.waitFor(check, { timeout: 2000, interval: 5 })

  it('is off without a token', async () => {
    const d = device()
    const m = new SyncManager(d.storage)
    await m.start('nasim')
    expect(m.getStatus().state).toBe('off')
    m.stop()
  })

  it('syncs on open, then pushes 5 seconds after a change (not before)', async () => {
    const { d, m } = await ready()
    await m.start('nasim')
    expect(m.getStatus().state).toBe('synced')
    expect(m.getStatus().lastSyncAt).toBe('2026-10-24T12:00:00.000Z')
    const before = puts()
    await d.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    expect(m.getStatus().pending).toBe(true)
    await vi.advanceTimersByTimeAsync(4900)
    expect(puts()).toBe(before)
    await vi.advanceTimersByTimeAsync(200)
    await until(() => expect(puts()).toBe(before + 1))
    await until(() => expect(m.getStatus().pending).toBe(false))
    m.stop()
  })

  it('several quick changes make one push', async () => {
    const { d, m } = await ready()
    await m.start('nasim')
    const before = puts()
    for (let i = 0; i < 3; i++) {
      await d.storage.saveEntry('weighIns', 'nasim', { date: `2026-10-2${i}`, kg: 70 + i })
      await vi.advanceTimersByTimeAsync(1000)
    }
    await vi.advanceTimersByTimeAsync(5500)
    await until(() => expect(puts()).toBe(before + 1))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(puts()).toBe(before + 1)
    m.stop()
  })

  it('pulls every 5 minutes', async () => {
    const { m } = await ready()
    await m.start('nasim')
    const before = gets()
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 100)
    await until(() => expect(gets()).toBe(before + 1))
    m.stop()
  })

  it('offline: queues, shows Offline, and syncs on reconnect', async () => {
    let online = false
    const { d, m } = await ready({ online: () => online })
    await m.start('nasim')
    expect(m.getStatus().state).toBe('offline')
    await d.storage.saveEntry('weighIns', 'nasim', { date: '2026-10-25', kg: 74.8 })
    await vi.advanceTimersByTimeAsync(5100)
    await until(() => expect(m.getStatus()).toMatchObject({ state: 'offline', pending: true }))
    expect(gh.files.size).toBe(0)
    online = true
    await m.syncNow()
    expect(m.getStatus()).toMatchObject({ state: 'synced', pending: false })
    expect((gh.read('nasim.json') as { weighIns: unknown[] }).weighIns).toHaveLength(1)
    m.stop()
  })

  it('a network failure mid-sync also reads as Offline and keeps the change queued', async () => {
    const { d, m } = await ready()
    gh.offline = true
    await m.start('nasim')
    expect(m.getStatus()).toMatchObject({ state: 'offline', pending: true })
    gh.offline = false
    await m.syncNow()
    expect(m.getStatus().state).toBe('synced')
    expect(await d.storage.getDirty('nasim')).toBeNull()
    m.stop()
  })

  it('a wrong or expired token shows the auth state and stops retrying until a new token', async () => {
    const { d, m } = await ready()
    gh.token = 'rotated-on-github'
    await m.start('nasim')
    expect(m.getStatus().state).toBe('auth')
    const calls = gh.calls.length
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 100)
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    expect(gh.calls.length).toBe(calls) // no hammering
    await saveSyncConfig(d.storage, { token: 'rotated-on-github', repo: 'n6sim/workout-data', expiry: '' })
    await m.syncNow(true)
    expect(m.getStatus().state).toBe('synced')
    m.stop()
  })

  it('a missing repo shows a plain error, not the auth screen', async () => {
    const { m } = await ready()
    gh.repoExists = false
    await m.start('nasim')
    expect(m.getStatus().state).toBe('error')
    expect(m.getStatus().message).toMatch(/not found/)
    m.stop()
  })
})
