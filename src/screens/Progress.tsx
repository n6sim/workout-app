import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProfileHeader, ProfileId } from '../storage'
import { LIBRARY } from '../data/library'
import { addDays } from '../engine/dates'
import { projectedDate, trendRate, trendSeries } from '../engine/trend'
import { adherence } from '../engine/training/adherence'
import { planStart, todayInfo } from '../domain/todayInfo'
import { isLoggingDone } from '../domain/day'
import type { ProfileData } from '../useProfileData'
import { formatDate, todayLocal } from '../util/today'
import { Card, Field, inputCls } from './ui'

const PHASE_LABEL: Record<string, string> = { fat_loss: 'Fat loss', recomposition: 'Recomposition', maintenance: 'Maintenance', diet_break: 'Diet break', aggressive: 'Aggressive' }
const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const AXIS = { fontSize: 11, fill: '#94a3b8' }

export default function Progress({ profileId, header, data }: { profileId: ProfileId; header: ProfileHeader; data: ProfileData }) {
  const today = todayLocal()
  const info = useMemo(() => todayInfo({ profileId, header, data, today }), [profileId, header, data, today])
  const { coach } = info
  const start = planStart(data.phases, header)
  const target = header.goal.type === 'lose' ? header.goal.targetWeightKg ?? null : null

  // ---- trend chart ----
  const rows = useMemo(() => {
    if (data.weighIns.length === 0) return []
    const first = data.weighIns.map((w) => w.date).sort()[0]
    const from = [first, addDays(today, -120)].sort().at(-1)!
    const byDay = new Map<string, number[]>()
    for (const w of data.weighIns) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w.kg])
    return trendSeries(data.weighIns, from, today, coach.pausedSet).map((p) => {
      const day = byDay.get(p.date)
      return { date: p.date, trend: p.trend === null ? null : Math.round(p.trend * 100) / 100, kg: day ? Math.round((day.reduce((s, k) => s + k, 0) / day.length) * 10) / 10 : null }
    })
  }, [data.weighIns, today, coach.pausedSet])

  const rate = trendRate(data.weighIns, today, 21, coach.pausedSet)
  const projected = coach.trendKg !== null && target !== null ? projectedDate(coach.trendKg, target, rate, today) : null

  // ---- adherence ----
  const adh = useMemo(() => adherence({
    trainingDays: header.settings.trainingDays, startDate: start, today, paused: coach.pausedSet,
    doneSessionDates: new Set(data.sessions.filter((s) => s.status === 'done').map((s) => s.date)),
    loggedDoneDates: new Set(data.events.filter((e) => e.kind === 'logging_done' && isLoggingDone(data.events, profileId, e.detail)).map((e) => e.detail)),
  }), [header.settings.trainingDays, start, today, coach.pausedSet, data.sessions, data.events, profileId])

  // ---- strength chart: any exercise you have logged with a weight on at least 2 days ----
  const lifts = useMemo(() => {
    const byEx = new Map<string, Map<string, { kg: number; reps?: number }>>()
    for (const s of data.sessions.filter((x) => x.status !== 'skipped')) {
      for (const set of s.sets) {
        if (set.weightKg === undefined) continue
        const days = byEx.get(set.exerciseId) ?? new Map()
        const best = days.get(s.date)
        if (!best || set.weightKg > best.kg) days.set(s.date, { kg: set.weightKg, reps: set.reps })
        byEx.set(set.exerciseId, days)
      }
    }
    return [...byEx.entries()]
      .filter(([, d]) => d.size >= 2)
      .map(([id, d]) => ({ id, name: LIBRARY.find((e) => e.id === id)?.name ?? id, points: [...d.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })) }))
      .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name))
  }, [data.sessions])
  const [liftId, setLiftId] = useState('')
  const lift = lifts.find((l) => l.id === liftId) ?? lifts[0]

  const phases = [...data.phases].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Trend weight</h2>
          <p className="text-sm text-slate-300">{coach.trendKg !== null ? <><span className="text-xl font-semibold">{coach.trendKg.toFixed(1)}</span> kg</> : 'Not enough weigh-ins'}</p>
        </div>
        {rows.length > 1 ? (
          <div className="h-60 w-full" role="img" aria-label="Trend weight chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tickFormatter={short} tick={AXIS} minTickGap={32} />
                <YAxis domain={[(min: number) => Math.floor(Math.min(min, target ?? min) - 1), (max: number) => Math.ceil(max + 1)]} tick={AXIS} width={44} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={(d) => formatDate(String(d))} />
                {target !== null && <ReferenceLine y={target} stroke="#fbbf24" strokeDasharray="5 4" label={{ value: `Goal ${target} kg`, fill: '#fbbf24', fontSize: 11, position: 'insideBottomRight' }} />}
                <Line type="monotone" dataKey="kg" name="Weigh-in" stroke="none" dot={{ r: 3, fill: '#64748b', stroke: 'none' }} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="trend" name="Trend" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Log a few weigh-ins and the chart appears here.</p>
        )}
        <div className="space-y-1 text-sm text-slate-300">
          {rate !== null && <p>Trend is {rate < 0 ? 'down' : 'up'} about {Math.abs(rate * 7).toFixed(2)} kg a week over the last 3 weeks.</p>}
          {target !== null && coach.trendKg !== null && coach.trendKg > target && (
            projected
              ? <p>At this pace you reach {target} kg around <span className="font-semibold">{formatDate(projected)}</span>{header.goal.targetDate ? ` (your goal date is ${formatDate(header.goal.targetDate)})` : ''}.</p>
              : <p>No projected date yet: the trend is flat or not clear enough.</p>
          )}
          <p className="text-xs text-slate-500">The grey dots are your weigh-ins. The blue line is the 7-day average, which is what I use for every decision.</p>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Adherence</h2>
        <Bar label="Sessions done" value={adh.done} max={adh.planned} />
        <Bar label="Days fully logged" value={adh.daysFullyLogged} max={adh.daysTracked} />
        <p className="text-xs text-slate-500">Rest days, paused days and days before you started are never counted against you.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Strength</h2>
        {lifts.length === 0 ? (
          <p className="text-sm text-slate-400">After you log a weighted exercise on two different days, its chart shows up here.</p>
        ) : (
          <>
            <Field label="Exercise">
              <select className={inputCls} value={lift!.id} onChange={(e) => setLiftId(e.target.value)}>
                {lifts.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.points.length} days)</option>)}
              </select>
            </Field>
            <div className="h-48 w-full" role="img" aria-label={`Top set weight for ${lift!.name}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lift!.points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={short} tick={AXIS} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={AXIS} width={44} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={(d) => formatDate(String(d))} formatter={(v) => [`${v} kg`, 'Top set']} />
                  <Line type="monotone" dataKey="kg" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500">Heaviest set of each day, in kg.</p>
          </>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Phase history</h2>
        <ul className="divide-y divide-slate-700 text-sm">
          {phases.map((p) => (
            <li key={p.id} className="py-2">
              <p className="font-medium">{PHASE_LABEL[p.type] ?? p.type}{p.endDate === null && <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">Now</span>}</p>
              <p className="text-slate-400">{formatDate(p.startDate)} to {p.endDate ? formatDate(p.endDate) : 'today'}{p.reason ? ` · ${p.reason}` : ''}</p>
            </li>
          ))}
        </ul>
        {data.pauses.length > 0 && (
          <div className="border-t border-slate-700 pt-2">
            <p className="mb-1 text-sm text-slate-400">Pauses</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {[...data.pauses].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((p) => (
                <li key={p.id}>{formatDate(p.startDate)} to {p.endDate ? formatDate(p.endDate) : 'now'} · {p.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span><span className="font-semibold">{value}</span> of {max}{max > 0 ? ` (${pct}%)` : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemax={max}>
        <div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
