import { useEffect, useMemo, useState } from 'react'
import { storage } from '../storage/instance'
import type { Activity, Phase, PilatesLink, ProfileHeader, ProfileId, Session } from '../storage'
import { workoutBurn } from '../engine/exercise'
import { LIBRARY, ownedLibrary } from '../data/library'
import { planDay, type SessionSummary } from '../engine/training/plan'
import { FOCUS_LABEL } from '../engine/training/focus'
import { PILATES_LABEL } from '../engine/training/pilates'
import { isStrengthDay } from '../engine/training/week'
import { FOCUS_AREAS, type FocusArea, type SessionPlan } from '../engine/training/types'
import Player from './Player'
import { Card, primaryBtn, secondaryBtn } from './ui'

interface Props {
  profileId: ProfileId
  header: ProfileHeader
  phases: Phase[]
  sessions: Session[]
  pilatesLinks: PilatesLink[]
  activities: Activity[]
  weightKg: number | null
  today: string
  reload: () => void
  onOpenSettings: () => void
}

const summary = (s: Session): SessionSummary => ({ date: s.date, status: s.status, plan: { focus: s.plan.focus, kind: s.plan.kind } })

export default function PlanCard({ profileId, header, phases, sessions, pilatesLinks, activities, weightKg, today, reload, onOpenSettings }: Props) {
  const { settings } = header
  const phase = phases.find((p) => p.endDate === null)?.type ?? 'fat_loss'
  const focusKey = `focus:${profileId}:${today}`
  const [focusOverride, setFocusOverride] = useState<FocusArea[] | undefined>()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<FocusArea[]>([])
  const [playing, setPlaying] = useState<Session | null>(null)

  useEffect(() => {
    void storage.getMeta(focusKey).then((v) => setFocusOverride(v ? (JSON.parse(v) as FocusArea[]) : undefined))
  }, [focusKey])

  const library = useMemo(() => ownedLibrary(LIBRARY, settings.equipment), [settings.equipment])
  const summaries = useMemo(() => sessions.map(summary), [sessions])
  const day = useMemo(
    () => planDay({
      date: today, trainingDays: settings.trainingDays, phase, sessionLengthMin: settings.sessionLengthMin,
      library, sessions: summaries, focusOverride,
    }),
    [today, settings.trainingDays, settings.sessionLengthMin, phase, library, summaries, focusOverride],
  )

  const todays = sessions.filter((s) => s.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const resumable = todays.find((s) => s.status === 'partial' && (s.stepIndex ?? 0) > 0 && s.plan.kind === day.kind)
  const doneToday = todays.find((s) => s.status === 'done' && s.plan.kind === day.kind)
  const partialToday = todays.find((s) => s.status === 'partial' && s.plan.kind === day.kind)
  const others = sessions.filter((s) => s.date !== today)

  async function begin(plan: SessionPlan) {
    // Reuse a started-but-empty record instead of piling up new ones.
    const blank = todays.find((s) => s.status === 'skipped' && s.sets.length === 0 && s.plan.kind === plan.kind)
    const record = await storage.saveEntry('sessions', profileId, {
      ...(blank ?? {}), date: today, plan, status: 'skipped', sets: [], startedAt: new Date().toISOString(), stepIndex: 0,
    })
    setPlaying(record as Session)
  }

  async function markDone(plan: SessionPlan) {
    await storage.saveEntry('sessions', profileId, {
      date: today, plan, status: 'done', sets: [], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    })
    reload()
  }

  async function saveFocus(areas: FocusArea[] | undefined) {
    if (areas?.length) await storage.setMeta(focusKey, JSON.stringify(areas))
    else await storage.deleteMeta(focusKey)
    setFocusOverride(areas?.length ? areas : undefined)
    setEditing(false)
  }

  if (playing) {
    return (
      <Player
        profileId={profileId} session={playing} history={others} settings={settings}
        weightKg={weightKg ?? 70} creditPct={settings.exerciseCreditPct} activities={activities}
        onExit={() => { setPlaying(null); reload() }}
      />
    )
  }

  if (day.problem === 'training_days') {
    return (
      <Card className="space-y-3">
        <h2 className="font-semibold">Pick your training days</h2>
        <p className="text-sm text-slate-300">The weekly plan needs 3, 4 or 5 training days. You have {settings.trainingDays.length}.</p>
        <button className={primaryBtn} onClick={onOpenSettings}>Open settings</button>
      </Card>
    )
  }

  if (day.kind === 'rest') {
    return (
      <Card className="space-y-1">
        <h2 className="font-semibold">Rest day</h2>
        <p className="text-sm text-slate-300">Nothing planned. An easy walk is a nice option, but a rest day is never a missed day.</p>
      </Card>
    )
  }

  const plan = day.plan!
  const burn = weightKg ? workoutBurn(plan, weightKg, settings.exerciseCreditPct) : null
  const burnLine = burn && burn.estKcal > 0 ? <p className="text-sm text-slate-400">Burned ~{burn.estKcal}, counted {burn.creditedKcal}</p> : null
  if (day.problem === 'no_exercises') {
    return (
      <Card className="space-y-3">
        <h2 className="font-semibold">{plan.title}</h2>
        <p className="text-sm text-slate-300">There are no exercises for the equipment you have selected. Add dumbbells or body-weight moves in Settings.</p>
        <button className={primaryBtn} onClick={onOpenSettings}>Open settings</button>
      </Card>
    )
  }

  // ----- pilates days -----
  if (plan.pilates) {
    const link = pilatesLinks.find((l) => l.type === plan.pilates!.type && l.url)
    const hasRoutine = plan.exercises.length > 0
    return (
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{plan.title}</h2>
          <span className="text-sm text-slate-400">about {plan.estMinutes} min</span>
        </div>
        <p className="text-lg font-medium text-sky-300">{PILATES_LABEL[plan.pilates.type]}</p>
        <p className="text-sm text-slate-300">{plan.pilates.reason}</p>
        {burnLine}

        {plan.cardio && (
          <p className="text-sm text-slate-300">Starts with {Math.round(plan.cardio.seconds / 60)} min steady cardio ({plan.cardio.name}).</p>
        )}
        {hasRoutine && (
          <ul className="space-y-1 text-sm">
            {plan.exercises.map((e) => (
              <li key={e.exerciseId} className="flex justify-between gap-3">
                <span>{e.name}</span>
                <span className="shrink-0 text-slate-400">{e.sets} x {e.mode === 'timed' ? `${e.seconds}s` : `${e.repMin}-${e.repMax}`}</span>
              </li>
            ))}
          </ul>
        )}
        {(hasRoutine || plan.cardio) && (resumable ? (
          <>
            <button className={primaryBtn} onClick={() => setPlaying(resumable)}>Resume session</button>
            <button className={secondaryBtn} onClick={() => void begin(plan)}>Start over</button>
          </>
        ) : (
          <button className={doneToday ? secondaryBtn : primaryBtn} onClick={() => void begin(plan)}>
            {doneToday ? 'Do it again' : 'Start session'}
          </button>
        ))}

        {link ? (
          <a className={`${secondaryBtn} block text-center`} href={link.url} target="_blank" rel="noreferrer">
            Or follow the video: {link.title || 'MadFit'}
          </a>
        ) : (
          <div className="rounded-xl bg-slate-900 p-3 text-sm text-slate-300">
            Add a MadFit link for this type in Settings.
            <button className="mt-2 block underline" onClick={onOpenSettings}>Open settings</button>
          </div>
        )}
        {doneToday ? (
          <p className="text-sm text-emerald-400">Done today.</p>
        ) : (
          <>
            {partialToday && <p className="text-sm text-amber-300">Partly done today. You can do it again or mark it done.</p>}
            <button className={secondaryBtn} onClick={() => void markDone(plan)}>I did the video instead, mark done</button>
          </>
        )}
      </Card>
    )
  }

  // ----- strength and cardio + mobility days -----
  const strength = isStrengthDay(plan.kind)
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{plan.title}</h2>
        <span className="text-sm text-slate-400">about {plan.estMinutes} min</span>
      </div>

      {burnLine}
      {strength && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {plan.focus.map((f) => (
              <span key={f} className="rounded-full bg-slate-700 px-3 py-1 text-xs">{FOCUS_LABEL[f]}</span>
            ))}
            <button className="text-xs text-sky-400 underline" onClick={() => { setDraft(plan.focus); setEditing((v) => !v) }}>
              Change focus
            </button>
          </div>
          {day.warnings.length > 0 && (
            <p className="rounded-lg bg-amber-900/40 p-2 text-xs text-amber-100">
              {day.warnings.map((w) => `${FOCUS_LABEL[w.area]} already had ${w.count} sessions this week`).join('. ')}. You can still go ahead, or pick another focus.
            </p>
          )}
          {editing && (
            <div className="space-y-2 rounded-xl bg-slate-900 p-3">
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((f) => (
                  <button
                    key={f} aria-pressed={draft.includes(f)}
                    onClick={() => setDraft((d) => (d.includes(f) ? d.filter((x) => x !== f) : [...d, f]))}
                    className={`rounded-full px-3 py-2 text-sm ${draft.includes(f) ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-700'}`}
                  >
                    {FOCUS_LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className={primaryBtn} disabled={draft.length === 0} onClick={() => void saveFocus(draft)}>Rebuild session</button>
                <button className={secondaryBtn} onClick={() => void saveFocus(undefined)}>Back to default</button>
              </div>
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {plan.exercises.map((e) => (
              <li key={e.exerciseId} className="flex justify-between gap-3">
                <span>{e.name}</span>
                <span className="shrink-0 text-slate-400">{e.sets} x {e.mode === 'timed' ? `${e.seconds}s` : `${e.repMin}-${e.repMax}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {!strength && plan.cardio && (
        <p className="text-sm text-slate-300">
          {Math.round(plan.cardio.seconds / 60)} min steady cardio ({plan.cardio.name}), then {plan.cooldown.length} mobility stretches.
        </p>
      )}

      {doneToday && !resumable && <p className="text-sm text-emerald-400">Done today. Nice work.</p>}
      {resumable ? (
        <>
          <button className={primaryBtn} onClick={() => setPlaying(resumable)}>Resume workout</button>
          <button className={secondaryBtn} onClick={() => void begin(plan)}>Start over</button>
        </>
      ) : (
        <button className={doneToday ? secondaryBtn : primaryBtn} onClick={() => void begin(plan)}>
          {doneToday ? 'Do it again' : 'Start workout'}
        </button>
      )}
    </Card>
  )
}
