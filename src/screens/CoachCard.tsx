import { useState } from 'react'
import type { Phase, ProfileId } from '../storage'
import { NEED_LOGGING_MESSAGE, PLATEAU_OPTIONS, PROPOSAL_TEXT, type ProposalKind } from '../engine/coach'
import { RETURN_WEIGH_IN_DAYS, RETURN_BASELINE_WEIGH_INS } from '../engine/pause'
import { acceptProposal, choosePlateau, extendPause, postponeProposal, resumePause } from '../domain/coachActions'
import type { TodayInfo } from '../domain/todayInfo'
import { formatDate, todayLocal } from '../util/today'
import { Card, inputCls, primaryBtn, secondaryBtn } from './ui'

const REASON_LABEL = { holiday: 'holiday', sick: 'sick', busy: 'busy' } as const

/** Everything the coach has to say on Today: pause, welcome back, a phase change, a plateau check (spec: Coach brain). */
export default function CoachCard({ profileId, info, today, reload, onWeighIn }: {
  profileId: ProfileId; info: TodayInfo; today: string; reload: () => void; onWeighIn: () => void
}) {
  const { coach, targets } = info
  const [extendTo, setExtendTo] = useState('')
  const done = async (fn: () => Promise<unknown>) => {
    await fn()
    reload()
  }

  // ---- paused ----
  if (coach.paused) {
    const p = coach.paused
    return (
      <Card className="space-y-3 bg-sky-950">
        <h2 className="text-lg font-semibold">Paused: {REASON_LABEL[p.reason]}</h2>
        <p className="text-sm text-slate-300">
          Day {coach.pausedDaysCount} of your pause{p.endDate ? `, until ${formatDate(p.endDate)}` : ''}. No plan and no targets for now, and nothing is judged. Log whatever you like.
        </p>
        {targets && <p className="text-sm text-slate-300">As a loose guide, your maintenance is about <span className="font-semibold">{Math.round(targets.maintenanceKcal / 10) * 10} kcal</span> a day.</p>}
        {coach.longPausePrompt && (
          <div className="space-y-2 rounded-xl bg-slate-900 p-3 text-sm">
            <p>You have been paused for {coach.pausedDaysCount} days. Want to keep going, or ease back in?</p>
            <input type="date" className={inputCls} min={today} value={extendTo} onChange={(e) => setExtendTo(e.target.value)} aria-label="New end date" />
            <button className={secondaryBtn} onClick={() => void done(() => extendPause(profileId, p, extendTo || null))}>
              {extendTo ? 'Extend until that day' : 'Keep pausing, no end date'}
            </button>
          </div>
        )}
        <button className={primaryBtn} onClick={() => void done(() => resumePause(profileId, p, today))}>I'm back, resume</button>
      </Card>
    )
  }

  const cards = []

  // ---- welcome back ----
  const r = coach.returning
  if (r && r.showWelcome) {
    cards.push(
      <Card key="welcome" className="space-y-3 bg-emerald-950">
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="text-sm text-slate-200">
          Please weigh yourself each morning for the next {RETURN_WEIGH_IN_DAYS} days. After {RETURN_BASELINE_WEIGH_INS} weigh-ins I will use their average as your new starting point.
        </p>
        <p className="text-sm text-slate-300">
          Weight after a holiday is often 1 to 2 kg of water, and it settles within a week. I will never treat that jump as fat.
        </p>
        <p className="text-sm text-slate-400">{r.weighInsSince} of {RETURN_BASELINE_WEIGH_INS} weigh-ins so far{r.awaitingBaseline ? '. Your targets stay as they were until then.' : '. Your new starting point is set.'}</p>
        {r.oneFewerSet && <p className="text-sm text-slate-300">This first week your workouts have one set fewer per exercise.</p>}
        {r.sick && <p className="text-sm text-slate-300">Your first session back is a lighter one.</p>}
        <button className={primaryBtn} onClick={onWeighIn}>Weigh in now</button>
      </Card>,
    )
  }

  // ---- a phase change or a plateau check ----
  const prop = coach.proposal
  if (prop && coach.phase) {
    const phase = coach.phase
    const accept = (weeks?: 1 | 2) => done(() => acceptProposal(profileId, prop.kind, {
      phase, calorieTargetKcal: targets?.calorieTargetKcal ?? phase.calorieTargetKcal, proteinTargetG: targets?.proteinTargetG ?? phase.proteinTargetG, today, weeks,
    }))
    const postpone = prop.canPostpone && (
      <button className="text-sm text-slate-400 underline" onClick={() => void done(() => postponeProposal(profileId, phase, prop.kind, today))}>
        Not now, ask me again in a week
      </button>
    )
    if (prop.kind === 'plateau_check') {
      cards.push(<PlateauCard key="plateau" profileId={profileId} phase={phase} today={today} reload={reload} postpone={postpone} />)
    } else {
      const text = PROPOSAL_TEXT[prop.kind]
      cards.push(
        <Card key="proposal" className="space-y-3 bg-amber-950/60">
          <h2 className="text-lg font-semibold">{text.title}</h2>
          <p className="text-sm text-slate-200">{text.body}</p>
          {prop.kind === 'diet_break' ? (
            <div className="grid grid-cols-2 gap-2">
              <button className={primaryBtn} onClick={() => void accept(1)}>1 week</button>
              <button className={primaryBtn} onClick={() => void accept(2)}>2 weeks</button>
            </div>
          ) : (
            <button className={primaryBtn} onClick={() => void accept()}>{text.accept}</button>
          )}
          {postpone}
        </Card>,
      )
    }
  } else if (coach.needLogging) {
    cards.push(
      <Card key="logging" className="space-y-1 bg-slate-800">
        <p className="text-sm text-slate-200">{NEED_LOGGING_MESSAGE}.</p>
        <p className="text-xs text-slate-500">I need 14 fully logged days out of 21 before I judge a slow patch. Tap "Done logging today" each evening.</p>
      </Card>,
    )
  }

  // ---- a small adjustment you chose ----
  if (coach.adjustment) {
    const a = coach.adjustment
    cards.push(
      <Card key="adjust" className="bg-slate-800 text-sm text-slate-200">
        {a.walk ? `Plateau plan: a daily 20 minute walk, until ${formatDate(a.until!)}.` : `Plateau plan: ${a.kcal} kcal less per day, until ${formatDate(a.until!)}.`}
      </Card>,
    )
  }
  return <>{cards}</>
}

function PlateauCard({ profileId, phase, today, reload, postpone }: { profileId: ProfileId; phase: Phase; today: string; reload: () => void; postpone: React.ReactNode }) {
  const go = async (fn: () => Promise<unknown>) => {
    await fn()
    reload()
  }
  const targetFor = { calorieTargetKcal: phase.calorieTargetKcal, proteinTargetG: phase.proteinTargetG }
  const breakNow = (weeks: 1 | 2) => go(async () => {
    await choosePlateau(profileId, 'diet_break', today)
    await acceptProposal(profileId, 'diet_break', { phase, ...targetFor, today, weeks })
  })
  return (
    <Card className="space-y-3 bg-amber-950/60">
      <h2 className="text-lg font-semibold">Your weight has stalled</h2>
      <p className="text-sm text-slate-200">Your trend has barely moved in 3 weeks, and you logged enough days for me to be sure. Here is what we can do, in this order:</p>
      {PLATEAU_OPTIONS.map((o, n) => (
        <div key={o.id} className={`space-y-2 rounded-xl bg-slate-900 p-3 ${o.disabled ? 'opacity-50' : ''}`}>
          <p className="font-medium">{n + 1}. {o.title}</p>
          <p className="text-sm text-slate-400">{o.detail}</p>
          {o.id === 'logging_check' && <button className={secondaryBtn} onClick={() => void go(() => choosePlateau(profileId, 'logging_check', today))}>Do a logging check</button>}
          {o.id === 'diet_break' && (
            <div className="grid grid-cols-2 gap-2">
              <button className={secondaryBtn} onClick={() => void breakNow(1)}>1 week</button>
              <button className={secondaryBtn} onClick={() => void breakNow(2)}>2 weeks</button>
            </div>
          )}
          {o.id === 'small_adjustment' && (
            <div className="grid grid-cols-3 gap-2">
              <button className={secondaryBtn} onClick={() => void go(() => choosePlateau(profileId, 'small_adjustment', today, { kcal: 100 }))}>-100 kcal</button>
              <button className={secondaryBtn} onClick={() => void go(() => choosePlateau(profileId, 'small_adjustment', today, { kcal: 150 }))}>-150 kcal</button>
              <button className={secondaryBtn} onClick={() => void go(() => choosePlateau(profileId, 'small_adjustment', today, { walk: true }))}>20 min walk</button>
            </div>
          )}
          {o.id === 'aggressive_block' && <button className={secondaryBtn} disabled>Coming in 2.0</button>}
        </div>
      ))}
      {postpone}
    </Card>
  )
}

export type { ProposalKind }
export { todayLocal }
