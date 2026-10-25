import { useMemo, useState } from 'react'
import type { ProfileHeader, ProfileId } from '../storage'
import { daysBetween } from '../engine/dates'
import { dailyTargets } from '../engine/targets'
import { planStart, todayInfo } from '../domain/todayInfo'
import { saveGoal } from '../domain/coachActions'
import type { ProfileData } from '../useProfileData'
import { formatDate, todayLocal } from '../util/today'
import { Card, Field, inputCls, primaryBtn, secondaryBtn } from './ui'

/** Start or change a goal. From maintenance, a new weight goal returns you to fat loss (spec: Phase flow). */
export default function GoalSettings({ profileId, header, data, reload }: { profileId: ProfileId; header: ProfileHeader; data: ProfileData; reload: () => void }) {
  const today = todayLocal()
  const info = useMemo(() => todayInfo({ profileId, header, data, today }), [profileId, header, data, today])
  const weight = info.weight?.kg
  const [type, setType] = useState<'lose' | 'maintain'>(header.goal.type)
  const [targetKg, setTargetKg] = useState(header.goal.targetWeightKg?.toString() ?? '')
  const [targetDate, setTargetDate] = useState(header.goal.targetDate ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const target = parseFloat(targetKg.replace(',', '.'))
  const valid = type === 'maintain' || (weight !== undefined && target >= 30 && target < weight && !!targetDate && daysBetween(today, targetDate) >= 1)
  const preview = useMemo(() => {
    if (type !== 'lose' || !valid || weight === undefined) return null
    return dailyTargets({
      sex: header.profile.sex, birthDate: header.profile.birthDate, heightCm: header.profile.heightCm, weightKg: weight, activityLevel: header.profile.activityLevel,
      phase: 'fat_loss', targetWeightKg: target, targetDate, today, mode: header.settings.mode,
      maintenanceOverrideKcal: info.coach.maintenanceOverride ?? undefined,
    })
  }, [type, valid, weight, target, targetDate, header, today, info.coach.maintenanceOverride])

  async function save() {
    if (!valid || !info.targets) return
    await saveGoal(profileId, header, info.coach, type === 'lose' ? { type, targetWeightKg: target, targetDate } : { type }, {
      calorieTargetKcal: preview?.calorieTargetKcal ?? info.targets.calorieTargetKcal, proteinTargetG: info.targets.proteinTargetG,
    }, today)
    reload()
    setMsg({ ok: true, text: type === 'lose' ? 'New goal saved.' : 'Saved. Your plan is now maintenance.' })
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Goal</h2>
      <p className="text-sm text-slate-400">
        Now: {header.goal.type === 'lose' ? `${header.goal.targetWeightKg} kg by ${header.goal.targetDate ? formatDate(header.goal.targetDate) : '?'}` : 'maintain'}. Plan started {formatDate(planStart(data.phases, header))}.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {([['lose', 'Lose weight'], ['maintain', 'Maintain']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={type === id} onClick={() => setType(id)}
            className={`rounded-lg py-3 ${type === id ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}>{label}</button>
        ))}
      </div>
      {type === 'lose' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target weight (kg)"><input inputMode="decimal" className={inputCls} value={targetKg} onChange={(e) => setTargetKg(e.target.value)} /></Field>
          <Field label="Target date"><input type="date" className={inputCls} value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} /></Field>
        </div>
      )}
      {type === 'lose' && !valid && targetKg && <p className="text-sm text-slate-400">The target must be below your current {weight} kg, with a date in the future.</p>}
      {preview && (
        <p className="text-sm text-slate-300">
          That means about {preview.calorieTargetKcal} kcal a day.
          {preview.goalTooFast && preview.moderateDate && ` This goal needs a faster pace than moderate mode allows. At a moderate pace you'll reach it around ${formatDate(preview.moderateDate)}.`}
        </p>
      )}
      {preview?.goalTooFast && preview.moderateDate && (
        <button className={secondaryBtn} onClick={() => setTargetDate(preview.moderateDate!)}>Move my date to {formatDate(preview.moderateDate)}</button>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button className={primaryBtn} disabled={!valid} onClick={() => void save()}>Save goal</button>
    </Card>
  )
}
