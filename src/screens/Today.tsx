import { useState } from 'react'
import { storage } from '../storage/instance'
import type { Phase, PhaseType, PilatesLink, ProfileHeader, ProfileId, Session, WeighIn } from '../storage'
import { dailyTargets } from '../engine/targets'
import { daysBetween } from '../engine/dates'
import { latestWeighIn } from '../useProfileData'
import { formatDate, todayLocal } from '../util/today'
import PlanCard from './PlanCard'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const PHASE_LABEL: Record<PhaseType, string> = {
  fat_loss: 'Fat loss',
  recomposition: 'Recomposition',
  maintenance: 'Maintenance',
  diet_break: 'Diet break',
  aggressive: 'Aggressive',
}

interface Props {
  profileId: ProfileId
  header: ProfileHeader
  weighIns: WeighIn[]
  phases: Phase[]
  sessions: Session[]
  pilatesLinks: PilatesLink[]
  reload: () => void
  onOpenSettings: () => void
}

export default function Today({ profileId, header, weighIns, phases, sessions, pilatesLinks, reload, onOpenSettings }: Props) {
  const today = todayLocal()
  const latest = latestWeighIn(weighIns)
  const dayNumber = Math.max(1, daysBetween(header.goal.startDate, today) + 1)
  const phase = phases.find((p) => p.endDate === null)
  const phaseKind = phase?.type === 'fat_loss' ? 'fat_loss' : 'maintenance'

  const targets = latest
    ? dailyTargets({
        sex: header.profile.sex,
        birthDate: header.profile.birthDate,
        heightCm: header.profile.heightCm,
        weightKg: latest.kg,
        activityLevel: header.profile.activityLevel,
        phase: phaseKind,
        targetWeightKg: header.goal.targetWeightKg,
        targetDate: header.goal.targetDate,
        today,
        mode: header.settings.mode,
      })
    : null

  async function moveDate(date: string) {
    await storage.saveHeader(profileId, {
      ...header,
      goal: { ...header.goal, targetDate: date, updatedAt: new Date().toISOString() },
    })
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            {dayNumber === 1 ? 'Day 1 of your plan' : `Day ${dayNumber}`}
          </span>
          {phase && (
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm text-sky-300">{PHASE_LABEL[phase.type]}</span>
          )}
        </div>
      </div>

      {targets && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-sm text-slate-400">Calories</p>
              <p className="text-3xl font-semibold">{targets.calorieTargetKcal}</p>
              <p className="text-xs text-slate-400">kcal target</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-400">Protein</p>
              <p className="text-3xl font-semibold">{targets.proteinTargetG}</p>
              <p className="text-xs text-slate-400">g target</p>
            </Card>
          </div>
          <p className="text-xs text-slate-500">
            Based on {latest!.kg} kg (weigh-in {formatDate(latest!.date)}). Hitting protein matters more than hitting
            calories exactly.
          </p>

          {targets.goalTooFast && targets.moderateDate && (
            <Card className="space-y-3 bg-amber-900/40 text-sm text-amber-100">
              <p>
                This goal needs a faster pace than moderate mode allows. At a moderate pace you'll reach it around{' '}
                {formatDate(targets.moderateDate)}.
              </p>
              <button className={secondaryBtn} onClick={() => moveDate(targets.moderateDate!)}>
                Move my date to {formatDate(targets.moderateDate)}
              </button>
            </Card>
          )}
          {targets.floorApplied && (
            <p className="text-xs text-slate-500">Raised to the minimum calorie floor for safety.</p>
          )}
        </>
      )}

      <PlanCard
        profileId={profileId} header={header} phases={phases} sessions={sessions} pilatesLinks={pilatesLinks}
        today={today} reload={reload} onOpenSettings={onOpenSettings}
      />

      <WeighInCard profileId={profileId} weighIns={weighIns} reload={reload} />
    </div>
  )
}

function WeighInCard({ profileId, weighIns, reload }: Pick<Props, 'profileId' | 'weighIns' | 'reload'>) {
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [error, setError] = useState('')

  async function add() {
    const value = parseFloat(kg.replace(',', '.'))
    if (!(value >= 30 && value <= 300)) {
      setError('Enter a weight between 30 and 300 kg.')
      return
    }
    setError('')
    await storage.saveEntry('weighIns', profileId, { date, kg: value })
    setKg('')
    reload()
  }

  async function remove(id: string) {
    await storage.deleteEntry('weighIns', profileId, id)
    reload()
  }

  const recent = [...weighIns]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Log weight</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight (kg)">
          <input inputMode="decimal" className={inputCls} value={kg} onChange={(e) => setKg(e.target.value)} />
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className={primaryBtn} onClick={add}>Save weigh-in</button>
      {recent.length > 0 && (
        <ul className="divide-y divide-slate-700 text-sm">
          {recent.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2">
              <span className="text-slate-400">{formatDate(w.date)}</span>
              <span className="font-medium">{w.kg} kg</span>
              <button className="px-2 text-slate-500" aria-label="Delete weigh-in" onClick={() => remove(w.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
