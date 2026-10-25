import { useMemo, useRef, useState } from 'react'
import { storage } from '../storage/instance'
import { PROFILES, type Goal, type ProfileId, type Settings } from '../storage'
import { ageYears, daysBetween } from '../engine/dates'
import { dailyTargets } from '../engine/targets'
import type { ActivityLevel, Sex } from '../engine/types'
import { formatDate, todayLocal } from '../util/today'
import { syncManager } from '../sync/instance'
import SyncForm from './SyncForm'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

const LEVELS: { id: ActivityLevel; label: string }[] = [
  { id: 'desk', label: 'Desk-based (mostly sitting)' },
  { id: 'onFeet', label: 'On my feet part of the day' },
  { id: 'active', label: 'Active job (on my feet most of the day)' },
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_EQUIPMENT = ['dumbbell', 'body only', 'treadmill', 'standing bike', 'step platform']

export default function Onboarding({
  profileId, onDone, onSwitch,
}: { profileId: ProfileId; onDone: () => void; onSwitch: () => void }) {
  const name = PROFILES.find((p) => p.id === profileId)!.name
  const today = todayLocal()

  const [sex, setSex] = useState<Sex | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [level, setLevel] = useState<ActivityLevel | ''>('')
  const [goalType, setGoalType] = useState<'lose' | 'maintain'>('lose')
  const [targetKg, setTargetKg] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [trainingDays, setTrainingDays] = useState<number[]>([0, 2, 4])
  const [dumbbells, setDumbbells] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [restoreNote, setRestoreNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const kg = parseFloat(weightKg)
  const target = parseFloat(targetKg)
  const cm = parseFloat(heightCm)

  const problems = useMemo(() => {
    const p: { field: string; text: string }[] = []
    const add = (field: string, text: string) => p.push({ field, text })
    if (!sex) add('f-sex', 'Choose sex (used for the calorie formula).')
    const age = birthDate ? ageYears(birthDate, today) : NaN
    if (!(age >= 14 && age <= 100)) add('f-birth', 'Enter a valid birth date.')
    if (!(cm >= 120 && cm <= 230)) add('f-height', 'Height should be between 120 and 230 cm.')
    if (!(kg >= 30 && kg <= 300)) add('f-weight', 'Current weight should be between 30 and 300 kg.')
    if (!level) add('f-level', 'Choose your daily-life activity.')
    if (goalType === 'lose') {
      if (!(target >= 30 && target < kg)) add('f-target', 'Target weight must be below your current weight.')
      if (!targetDate || daysBetween(today, targetDate) < 1) add('f-date', 'Pick a target date in the future.')
    }
    if (trainingDays.length === 0) add('f-days', 'Pick at least one training day.')
    return p
  }, [sex, birthDate, cm, kg, level, goalType, target, targetDate, trainingDays, today])

  const preview = useMemo(() => {
    if (problems.length || !sex || !level) return null
    return dailyTargets({
      sex, birthDate, heightCm: cm, weightKg: kg, activityLevel: level, today,
      phase: goalType === 'lose' ? 'fat_loss' : 'maintenance',
      targetWeightKg: goalType === 'lose' ? target : undefined,
      targetDate: goalType === 'lose' ? targetDate : undefined,
    })
  }, [problems, sex, level, birthDate, cm, kg, goalType, target, targetDate, today])

  const toggleDay = (d: number) =>
    setTrainingDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))

  // After connecting, a found profile appears by itself (storage reload). Otherwise say why not.
  async function afterConnect() {
    if (await storage.loadHeader(profileId)) return
    const st = syncManager.getStatus()
    setRestoreNote(
      st.state === 'auth' ? 'GitHub did not accept that token.'
      : st.state === 'error' ? (st.message ?? 'Sync error.')
      : st.state === 'offline' ? 'You are offline. Connect to the internet and try again.'
      : `Connected, but no saved data for ${name} was found in that repo yet. Fill in the form below to start.`,
    )
  }

  function goTo(field: string) {
    document.getElementById(field)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function save() {
    if (!preview || !sex || !level) {
      // Save stays tappable so a tap explains what is missing and jumps to it.
      setAttempted(true)
      if (problems[0]) goTo(problems[0].field)
      return
    }
    setSaving(true)
    setError('')
    try {
      const stamp = new Date().toISOString()
      const dumbbellsKg = dumbbells
        .split(/[,\s]+/).map(parseFloat).filter((n) => n > 0).sort((a, b) => a - b)
      const settings: Settings = {
        exerciseCreditPct: 50, trainingDays, sessionLengthMin: 45,
        equipment: DEFAULT_EQUIPMENT, dumbbellsKg, mode: 'moderate',
      }
      const goal: Goal = goalType === 'lose'
        ? { type: 'lose', targetWeightKg: target, targetDate, startDate: today, startTrendKg: kg }
        : { type: 'maintain', startDate: today, startTrendKg: kg }
      await storage.saveEntry('weighIns', profileId, { date: today, kg })
      await storage.saveEntry('phases', profileId, {
        type: goalType === 'lose' ? 'fat_loss' : 'maintenance',
        startDate: today, endDate: null, reason: 'Initial goal',
        calorieTargetKcal: preview.calorieTargetKcal, proteinTargetG: preview.proteinTargetG,
      })
      // Header last: its existence is what marks onboarding as complete.
      await storage.saveHeader(profileId, {
        profile: { name, sex, birthDate, heightCm: cm, activityLevel: level, updatedAt: stamp },
        settings: { ...settings, updatedAt: stamp },
        goal: { ...goal, updatedAt: stamp },
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  async function restore(file: File) {
    try {
      await storage.importProfile(profileId, await file.text())
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-12 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
        <button onClick={onSwitch} className="text-sm text-slate-400 underline">Not {name}?</button>
      </div>

      <Card className="space-y-4">
        <Field group id="f-sex" label="Sex (for the calorie formula)">
          <div className="flex gap-2">
            {(['female', 'male'] as Sex[]).map((s) => (
              <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)}
                className={`flex-1 rounded-lg py-3 capitalize ${sex === s ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <Field id="f-birth" label="Birth date">
          <input type="date" className={inputCls} value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="f-height" label="Height (cm)">
            <input inputMode="decimal" className={inputCls} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </Field>
          <Field id="f-weight" label="Current weight (kg)">
            <input inputMode="decimal" className={inputCls} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </Field>
        </div>
        <Field group id="f-level" label="Daily life, not counting workouts">
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <button key={l.id} onClick={() => setLevel(l.id)}
                className={`w-full rounded-lg px-3 py-3 text-left ${level === l.id ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Goal</h2>
        <div className="flex gap-2">
          {([['lose', 'Lose weight'], ['maintain', 'Maintain']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setGoalType(id)}
              className={`flex-1 rounded-lg py-3 ${goalType === id ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        {goalType === 'lose' && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="f-target" label="Target weight (kg)">
              <input inputMode="decimal" className={inputCls} value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
            </Field>
            <Field id="f-date" label="Target date">
              <input type="date" className={inputCls} value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Training</h2>
        <Field group id="f-days" label="Training days">
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d, i) => (
              <button key={d} onClick={() => toggleDay(i)}
                className={`rounded-lg py-3 text-xs ${trainingDays.includes(i) ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Dumbbell weights you own, kg (separate with commas)">
          <input className={inputCls} placeholder="e.g. 4, 6, 8" value={dumbbells} onChange={(e) => setDumbbells(e.target.value)} />
        </Field>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Why only half your exercise counts</h2>
        <p className="text-sm text-slate-300">
          Treadmills, bikes, and calorie formulas often overestimate what you burn by 20 to 50%. If we added every
          exercise calorie back to your budget, your deficit would quietly disappear. So we credit 50% of exercise
          calories to today's budget. You can change this in Settings, but 50% is the honest default.
        </p>
      </Card>

      {preview ? (
        <Card className="space-y-2">
          <p className="text-sm text-slate-400">Your daily targets</p>
          <p className="text-3xl font-semibold">{preview.calorieTargetKcal} kcal</p>
          <p className="text-lg">{preview.proteinTargetG} g protein</p>
          {preview.goalTooFast && preview.moderateDate && (
            <div className="mt-2 rounded-lg bg-amber-900/40 p-3 text-sm text-amber-100">
              <p>
                This goal needs a faster pace than moderate mode allows. At a moderate pace you'll reach it around{' '}
                {formatDate(preview.moderateDate)}.
              </p>
              <button className={`${secondaryBtn} mt-3`} onClick={() => setTargetDate(preview.moderateDate!)}>
                Move my date to {formatDate(preview.moderateDate)}
              </button>
            </div>
          )}
          {preview.floorApplied && (
            <p className="text-sm text-slate-400">Raised to the minimum safe calorie floor.</p>
          )}
        </Card>
      ) : (
        problems.length > 0 && (
          <div className={`rounded-xl p-3 text-sm ${attempted ? 'bg-amber-900/40 text-amber-100' : 'bg-slate-800 text-slate-300'}`}>
            <p className="mb-1 font-medium">Still needed (tap to jump there):</p>
            <ul className="space-y-1">
              {problems.map((p) => (
                <li key={p.field}>
                  <button className="text-left underline" onClick={() => goTo(p.field)}>{p.text}</button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className={primaryBtn} disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save and start'}
      </button>
      <div className="border-t border-slate-800 pt-4">
        <p className="mb-2 text-sm text-slate-400">Already use this app on another device, or have a backup of {name}'s data?</p>
        <button className={`${secondaryBtn} mb-2`} onClick={() => setShowGitHub((v) => !v)}>Restore from GitHub</button>
        {showGitHub && (
          <div className="mb-3 space-y-3 rounded-xl bg-slate-800 p-3">
            <SyncForm tokenRequired submitLabel="Connect and restore" onSaved={() => void afterConnect()} />
            {restoreNote && <p className="text-sm text-amber-200">{restoreNote}</p>}
          </div>
        )}
        <button className={secondaryBtn} onClick={() => fileRef.current?.click()}>Restore from a backup file</button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void restore(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
