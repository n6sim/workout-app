import { storage } from '../storage/instance'
import type { Goal, Pause, Phase, PhaseType, ProfileHeader, ProfileId } from '../storage'
import { addDays } from '../engine/dates'
import { adaptiveMaintenance } from '../engine/adaptive'
import type { PlateauOptionId, ProposalKind } from '../engine/coach'
import type { PauseReason } from '../engine/pause'
import { dailyTargets } from '../engine/targets'
import { weekStartOf } from '../engine/budget'
import type { ProfileData } from '../useProfileData'
import { maintId, plateauId, postponeId, type CoachState } from './coachState'

// ---------- pause mode ----------

export async function startPause(profileId: ProfileId, p: { today: string; reason: PauseReason; endDate: string | null; note: string }): Promise<void> {
  await storage.saveEntry('pauses', profileId, { startDate: p.today, endDate: p.endDate, reason: p.reason, note: p.note.trim() })
}

/** Keep pausing: a new end date, or no end date at all. */
export async function extendPause(profileId: ProfileId, pause: Pause, endDate: string | null): Promise<void> {
  await storage.saveEntry('pauses', profileId, { ...pause, endDate })
}

/** Today is the first day back, so the pause ran up to yesterday. A pause that began today just disappears. */
export async function resumePause(profileId: ProfileId, pause: Pause, today: string): Promise<void> {
  if (pause.startDate >= today) await storage.deleteEntry('pauses', profileId, pause.id)
  else await storage.saveEntry('pauses', profileId, { ...pause, endDate: addDays(today, -1) })
}

// ---------- phase changes ----------

/** Ends the current phase and starts the next one (spec: Coach brain). `weeks` is the diet break length. */
export async function acceptProposal(
  profileId: ProfileId, kind: ProposalKind, s: { phase: Phase; calorieTargetKcal: number; proteinTargetG: number; today: string; weeks?: 1 | 2 },
): Promise<void> {
  const { phase: cur, today } = s
  await storage.saveEntry('phases', profileId, { ...cur, endDate: today })
  const next = (type: PhaseType, reason: string, extra: Partial<Phase> = {}) =>
    storage.saveEntry('phases', profileId, {
      type, startDate: today, endDate: null, reason, calorieTargetKcal: s.calorieTargetKcal, proteinTargetG: s.proteinTargetG, ...extra,
    })
  switch (kind) {
    case 'to_recomposition': return void (await next('recomposition', 'Within 1 kg of your target'))
    case 'to_maintenance': return void (await next('maintenance', 'Reached your target'))
    case 'diet_break': {
      const weeks = s.weeks ?? 1
      return void (await next('diet_break', `Diet break, ${weeks} week${weeks === 1 ? '' : 's'}`, { plannedEndDate: addDays(today, 7 * weeks), previousType: cur.type }))
    }
    case 'end_diet_break':
      return void (await next(cur.previousType ?? 'fat_loss', 'Diet break finished'))
    case 'plateau_check':
      throw new Error('A plateau check is not a phase change.')
  }
}

export async function postponeProposal(profileId: ProfileId, phase: Phase, kind: ProposalKind, today: string): Promise<void> {
  await storage.saveEntry('events', profileId, { id: postponeId(profileId, phase.id, kind), kind: 'phase_postponed', detail: today })
}

/** Records your plateau choice. Not offered again for 3 weeks (a logging check re-checks after 7 days). */
export async function choosePlateau(
  profileId: ProfileId, option: Exclude<PlateauOptionId, 'aggressive_block'>, today: string,
  extra: { kcal?: number; walk?: boolean } = {},
): Promise<void> {
  const detail = { option, date: today, ...extra, ...(option === 'small_adjustment' ? { until: addDays(today, 28) } : {}) }
  await storage.saveEntry('events', profileId, { id: plateauId(profileId, today), kind: 'plateau_choice', detail: JSON.stringify(detail) })
}

// ---------- goal ----------

/** A new or changed goal, started by you. From maintenance it returns to fat loss (spec: Phase flow). */
export async function saveGoal(
  profileId: ProfileId, header: ProfileHeader, s: CoachState, goal: { type: 'lose' | 'maintain'; targetWeightKg?: number; targetDate?: string },
  snapshot: { calorieTargetKcal: number; proteinTargetG: number }, today: string,
): Promise<void> {
  const current = s.weight?.kg ?? header.goal.startTrendKg
  const next: Goal = goal.type === 'lose'
    ? { type: 'lose', targetWeightKg: goal.targetWeightKg, targetDate: goal.targetDate, startDate: today, startTrendKg: current }
    : { type: 'maintain', startDate: today, startTrendKg: current }
  await storage.saveHeader(profileId, { ...header, goal: { ...next, updatedAt: new Date().toISOString() } })

  const cur = s.phase
  const wantType: PhaseType = goal.type === 'lose' ? 'fat_loss' : 'maintenance'
  const alreadyRight = cur && (goal.type === 'lose' ? ['fat_loss', 'recomposition'].includes(cur.type) : cur.type === 'maintenance')
  if (alreadyRight) return
  if (cur) await storage.saveEntry('phases', profileId, { ...cur, endDate: today })
  await storage.saveEntry('phases', profileId, {
    type: wantType, startDate: today, endDate: null, reason: goal.type === 'lose' ? 'New goal' : 'Maintain',
    calorieTargetKcal: snapshot.calorieTargetKcal, proteinTargetG: snapshot.proteinTargetG,
  })
}

// ---------- adaptive maintenance, every Monday ----------

/** Runs this Monday's update once (spec rule 8). Returns true when it wrote something. */
export async function runAdaptiveIfDue(profileId: ProfileId, header: ProfileHeader, data: ProfileData, s: CoachState, today: string): Promise<boolean> {
  const monday = weekStartOf(today)
  const id = maintId(profileId, monday)
  if (data.events.some((e) => e.id === id)) return false
  if (!s.weight || data.weighIns.length === 0) return false

  const formula = dailyTargets({
    sex: header.profile.sex, birthDate: header.profile.birthDate, heightCm: header.profile.heightCm, weightKg: s.weight.kg,
    activityLevel: header.profile.activityLevel, phase: 'maintenance', today, mode: header.settings.mode,
  }).maintenanceKcal
  const old = s.maintenanceOverride ?? Math.round(formula)

  const r = adaptiveMaintenance({ monday, oldMaintenance: old, loggedDays: s.loggedDays, weighIns: data.weighIns, paused: s.pausedSet })
  const detail = r.updated
    ? { maintenance: r.maintenance, updated: true, estimate: r.estimate, avgIntake: r.avgIntake, loggedCount: r.loggedCount, days: r.days }
    : { maintenance: s.maintenanceOverride ?? undefined, updated: false, reason: r.reason }
  await storage.saveEntry('events', profileId, { id, kind: 'maintenance_update', detail: JSON.stringify(detail) })
  return true
}
