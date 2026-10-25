import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../storage/instance'
import type { ProfileId, Session, Settings } from '../storage'
import { LIBRARY, ownedLibrary } from '../data/library'
import { applySwap, swapCandidates } from '../engine/training/session'
import { expandSteps, nextBlockIndex, type Step } from '../engine/training/steps'
import { historyFor, suggestWeight } from '../engine/training/progression'
import type { SetRecord } from '../engine/training/types'
import { createFeedback } from '../util/feedback'
import MotionLoop from './MotionLoop'
import { inputCls, primaryBtn, secondaryBtn } from './ui'

const BY_ID = new Map(LIBRARY.map((e) => [e.id, e]))
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const GROUP_LABEL = { warmup: 'Warm-up', cardio: 'Steady cardio', finisher: 'Finisher', cooldown: 'Cool-down stretch' }

interface Props {
  profileId: ProfileId
  session: Session
  /** Earlier sessions, for weight suggestions. */
  history: Session[]
  settings: Settings
  onExit: () => void
}

type Phase = 'intro' | 'step' | 'rest' | 'summary'
interface Countdown {
  endAt: number
  total: number
}

export default function Player({ profileId, session: initial, history, settings, onExit }: Props) {
  const sessionRef = useRef<Session>(initial)
  const [plan, setPlan] = useState(initial.plan)
  const [sets, setSets] = useState<SetRecord[]>(initial.sets)
  const steps = useMemo(() => expandSteps(plan), [plan])
  const [idx, setIdx] = useState(Math.min(initial.stepIndex ?? 0, Math.max(0, steps.length - 1)))
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState<Countdown | null>(null)
  const [pausedLeftMs, setPausedLeftMs] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [reps, setReps] = useState('')
  const [kg, setKg] = useState('')
  const [swapOpen, setSwapOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [finalStatus, setFinalStatus] = useState<Session['status']>('partial')

  const feedback = useRef(createFeedback())
  const lastBeep = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const step: Step | undefined = steps[idx]
  const paused = pausedLeftMs !== null
  const totalSetSteps = steps.filter((s) => s.kind !== 'timed').length

  // ---- keep the screen on while working out ----
  const phaseRef = useRef<Phase>('intro')
  phaseRef.current = phase
  const requestWake = useCallback(async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      wakeLock.current = null // not supported or refused: the workout still works
    }
  }, [])
  useEffect(() => {
    // The browser drops the lock when the tab is hidden, so ask again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (phaseRef.current === 'step' || phaseRef.current === 'rest')) void requestWake()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLock.current?.release()
    }
  }, [requestWake])

  // ---- saving ----
  const persist = useCallback(async (patch: Partial<Session>) => {
    sessionRef.current = (await storage.saveEntry('sessions', profileId, { ...sessionRef.current, ...patch })) as Session
  }, [profileId])

  // ---- countdown plumbing ----
  const startCountdown = useCallback((seconds: number) => {
    lastBeep.current = null
    setPausedLeftMs(null)
    setNow(Date.now())
    setCountdown({ endAt: Date.now() + seconds * 1000, total: seconds })
  }, [])

  const leftSec = !countdown ? 0 : paused ? Math.ceil((pausedLeftMs ?? 0) / 1000) : Math.max(0, Math.ceil((countdown.endAt - now) / 1000))

  const finish = useCallback(async (reachedEnd: boolean, logged: SetRecord[]) => {
    setCountdown(null)
    const status: Session['status'] =
      totalSetSteps > 0
        ? logged.length >= totalSetSteps && reachedEnd ? 'done' : logged.length > 0 ? 'partial' : 'skipped'
        : reachedEnd ? 'done' : 'skipped'
    setFinalStatus(status)
    await persist({ status, finishedAt: new Date().toISOString(), stepIndex: steps.length, sets: logged, plan })
    setPhase('summary')
    void wakeLock.current?.release()
  }, [persist, plan, steps.length, totalSetSteps])

  const goTo = useCallback((next: number, logged: SetRecord[]) => {
    if (next >= steps.length) return void finish(true, logged)
    setIdx(next)
    setPhase('step')
    setCountdown(null)
    setPausedLeftMs(null)
  }, [finish, steps.length])

  const afterSet = useCallback((from: number, logged: SetRecord[]) => {
    const done = steps[from]
    const next = steps[from + 1]
    if (done && done.kind !== 'timed' && next && next.kind !== 'timed') {
      setIdx(from + 1)
      setPhase('rest')
      startCountdown(done.restSec)
    } else {
      goTo(from + 1, logged)
    }
  }, [goTo, startCountdown, steps])

  const logSet = useCallback(async (record: SetRecord, from: number) => {
    const logged = [...sets, record]
    setSets(logged)
    await persist({ sets: logged, status: 'partial', stepIndex: from + 1, plan })
    afterSet(from, logged)
  }, [afterSet, persist, plan, sets])

  // ---- tick: drives countdowns, beeps and auto-advance ----
  useEffect(() => {
    if (!countdown || paused) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [countdown, paused])

  useEffect(() => {
    if (!countdown || paused) return
    const left = Math.ceil((countdown.endAt - now) / 1000)
    if (left > 0 && left <= 3 && lastBeep.current !== left) {
      lastBeep.current = left
      feedback.current.tick()
    }
    if (left <= 0) {
      feedback.current.go()
      setCountdown(null)
      if (phase === 'rest') goTo(idx, sets)
      else if (step?.kind === 'hold') void logSet({ exerciseId: step.exerciseId, setNo: step.setNo, seconds: step.seconds }, idx)
      else goTo(idx + 1, sets)
    }
  }, [now, countdown, paused, phase, step, idx, sets, goTo, logSet])

  // arriving at a timed step starts its countdown by itself
  useEffect(() => {
    if (phase === 'step' && step && (step.kind === 'timed' || step.kind === 'hold')) startCountdown(step.seconds)
  }, [phase, idx, step, startCountdown])

  // arriving at a rep set pre-fills reps and weight
  const exerciseId = step && step.kind !== 'timed' ? step.exerciseId : null
  const suggestion = useMemo(() => {
    if (!step || step.kind !== 'set') return null
    return suggestWeight(historyFor(step.exerciseId, history), {
      plannedSets: step.totalSets, repMin: step.repMin, repMax: step.repMax, dumbbellsKg: settings.dumbbellsKg,
    })
  }, [step, history, settings.dumbbellsKg])

  useEffect(() => {
    if (phase !== 'step' || !step || step.kind !== 'set') return
    const lastHere = [...sets].reverse().find((s) => s.exerciseId === step.exerciseId && s.weightKg !== undefined)
    setReps(String(step.repMax))
    setKg(String(lastHere?.weightKg ?? suggestion?.kg ?? ''))
  }, [phase, idx, exerciseId])

  // ---- actions ----
  function start() {
    feedback.current.unlock()
    void requestWake()
    setPhase('step')
  }

  function togglePause() {
    if (!countdown) return
    if (paused) {
      setCountdown({ ...countdown, endAt: Date.now() + (pausedLeftMs ?? 0) })
      setPausedLeftMs(null)
    } else {
      setPausedLeftMs(Math.max(0, countdown.endAt - Date.now()))
    }
  }

  function skip() {
    setCountdown(null)
    if (phase === 'rest') return goTo(idx, sets)
    goTo(nextBlockIndex(steps, idx), sets)
  }

  function saveRepSet() {
    if (!step || step.kind !== 'set') return
    const r = parseInt(reps, 10)
    if (!(r >= 0)) return
    const w = parseFloat(kg.replace(',', '.'))
    void logSet({ exerciseId: step.exerciseId, setNo: step.setNo, reps: r, ...(step.usesDumbbells && w >= 0 ? { weightKg: w } : {}) }, idx)
  }

  async function swapTo(id: string) {
    if (!step || step.kind === 'timed') return
    const to = BY_ID.get(id)
    if (!to) return
    const next = applySwap(plan, step.exerciseId, to)
    setPlan(next)
    setSwapOpen(false)
    await persist({ plan: next })
  }

  const swapOptions = useMemo(() => {
    if (!step || step.kind === 'timed') return []
    return swapCandidates(plan, step.exerciseId, ownedLibrary(LIBRARY, settings.equipment))
  }, [plan, step, settings.equipment])

  // ================= screens =================
  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-slate-950">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pb-8 pt-4">{children}</div>
    </div>
  )

  if (phase === 'intro') {
    return shell(
      <>
        <button onClick={onExit} className="self-start text-sm text-slate-400 underline">Back</button>
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        <p className="text-slate-300">About {plan.estMinutes} minutes. {steps.length} steps.</p>
        <ul className="space-y-1 text-sm text-slate-300">
          {plan.warmup && <li>Warm-up: {plan.warmup.name}, {fmt(plan.warmup.seconds)}</li>}
          {plan.cardio && <li>Steady cardio: {plan.cardio.name}, {Math.round(plan.cardio.seconds / 60)} min</li>}
          {plan.exercises.map((e) => (
            <li key={e.exerciseId}>{e.name}: {e.sets} x {e.mode === 'timed' ? `${e.seconds}s` : `${e.repMin}-${e.repMax}`}</li>
          ))}
          {plan.finisher && <li>Finisher: {plan.finisher.name}, {plan.finisher.rounds} x ({plan.finisher.hardSec}s hard, {plan.finisher.easySec}s easy)</li>}
          {plan.cooldown.length > 0 && <li>Cool-down: {plan.cooldown.length} stretches</li>}
        </ul>
        {idx > 0 && <p className="text-sm text-amber-200">Picking up where you left off (step {idx + 1} of {steps.length}).</p>}
        <button className={primaryBtn} onClick={start}>{idx > 0 ? 'Resume workout' : 'Start workout'}</button>
      </>,
    )
  }

  if (phase === 'summary') {
    const byEx = new Map<string, SetRecord[]>()
    for (const s of sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s])
    const volume = sets.reduce((v, s) => v + (s.reps ?? 0) * (s.weightKg ?? 0), 0)
    return shell(
      <>
        <h1 className="text-2xl font-semibold">{finalStatus === 'done' ? 'Workout done' : finalStatus === 'partial' ? 'Workout saved (partial)' : 'Nothing logged'}</h1>
        <p className="text-slate-300">{sets.length} of {totalSetSteps} sets logged{volume > 0 ? `, ${Math.round(volume)} kg lifted in total` : ''}.</p>
        <ul className="space-y-2 rounded-2xl bg-slate-800 p-4 text-sm">
          {[...byEx].map(([id, list]) => (
            <li key={id}>
              <p className="font-medium">{BY_ID.get(id)?.name ?? id}</p>
              <p className="text-slate-400">{list.map((s) => (s.seconds ? `${s.seconds}s` : `${s.reps}${s.weightKg !== undefined ? ` x ${s.weightKg} kg` : ''}`)).join(', ')}</p>
            </li>
          ))}
          {byEx.size === 0 && <li className="text-slate-400">No sets were logged.</li>}
        </ul>
        <button className={primaryBtn} onClick={onExit}>Back to Today</button>
      </>,
    )
  }

  if (!step) return shell(<button className={primaryBtn} onClick={() => void finish(true, sets)}>Finish</button>)

  const ex = BY_ID.get(step.exerciseId)
  const timedLeft = countdown ? leftSec : 0
  const progress = Math.round((idx / steps.length) * 100)
  const label =
    step.kind === 'timed'
      ? step.group === 'finisher' ? `Finisher: ${step.hint === 'hard' ? 'HARD' : 'easy'} (round ${step.round} of ${step.rounds})` : GROUP_LABEL[step.group]
      : `${step.name}: set ${step.setNo} of ${step.totalSets}`

  return shell(
    <>
      <div className="h-1 w-full overflow-hidden rounded bg-slate-800"><div className="h-full bg-sky-500" style={{ width: `${progress}%` }} /></div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Step {idx + 1} of {steps.length}</span>
        <button onClick={() => setConfirmEnd(true)} className="underline">End workout</button>
      </div>

      {phase === 'rest' ? (
        <>
          <h1 className="text-xl font-semibold">Rest</h1>
          <p className="text-6xl font-semibold tabular-nums">{fmt(timedLeft)}</p>
          <p className="text-slate-300">Next: {step.name}{step.kind !== 'timed' ? `, set ${step.setNo} of ${step.totalSets}` : ''}</p>
          {ex && <MotionLoop images={ex.images} name={ex.name} />}
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">{step.kind === 'timed' && step.group === 'finisher' ? step.name : label}</h1>
          {step.kind === 'timed' && step.group === 'finisher' && <p className="text-2xl font-semibold text-sky-400">{label.replace('Finisher: ', '')}</p>}
          <MotionLoop images={ex?.images ?? []} name={step.name} />
          {(step.kind === 'timed' || step.kind === 'hold') ? (
            <p className="text-6xl font-semibold tabular-nums">{fmt(timedLeft)}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-300">Target: {step.repMin} to {step.repMax} reps</p>
              {step.usesDumbbells && suggestion && (
                <p className="text-sm text-slate-400">{suggestion.kg !== null ? `Suggested: ${suggestion.kg} kg. ` : ''}{suggestion.reason}</p>
              )}
              <div className={`grid gap-3 ${step.usesDumbbells ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <label className="block"><span className="mb-1 block text-sm text-slate-400">Reps done</span>
                  <input inputMode="numeric" className={inputCls} value={reps} onChange={(e) => setReps(e.target.value)} /></label>
                {step.usesDumbbells && (
                  <label className="block"><span className="mb-1 block text-sm text-slate-400">Weight (kg)</span>
                    <input inputMode="decimal" className={inputCls} value={kg} onChange={(e) => setKg(e.target.value)} /></label>
                )}
              </div>
              <button className={primaryBtn} onClick={saveRepSet}>Save set</button>
            </div>
          )}
          {ex && ex.instructions.length > 0 && step.kind !== 'timed' && (
            <details className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
              <summary className="cursor-pointer text-slate-400">How to do it</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{ex.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol>
              {ex.videoUrl && <a className="mt-2 block text-sky-400 underline" href={ex.videoUrl} target="_blank" rel="noreferrer">Watch a video</a>}
            </details>
          )}
        </>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2">
        <button className={secondaryBtn} onClick={skip}>{phase === 'rest' ? 'Skip rest' : 'Skip'}</button>
        <button className={secondaryBtn} disabled={!countdown} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button className={secondaryBtn} disabled={phase === 'rest' || step.kind === 'timed' || swapOptions.length === 0} onClick={() => setSwapOpen(true)}>Swap</button>
      </div>

      {swapOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setSwapOpen(false)}>
          <div className="mx-auto max-h-[70%] w-full max-w-md overflow-y-auto rounded-t-2xl bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 font-semibold">Swap {step.name}</h2>
            <p className="mb-3 text-sm text-slate-400">Same muscle, same equipment.</p>
            <ul className="space-y-2">
              {swapOptions.map((o) => (
                <li key={o.id}><button className={secondaryBtn} onClick={() => void swapTo(o.id)}>{o.name}</button></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {confirmEnd && (
        <div className="fixed inset-0 z-40 flex items-center bg-black/60 px-4">
          <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl bg-slate-900 p-4">
            <h2 className="font-semibold">End this workout?</h2>
            <p className="text-sm text-slate-300">{sets.length} sets are saved. You can start again later today.</p>
            <button className={primaryBtn} onClick={() => { setConfirmEnd(false); void finish(false, sets) }}>End and save</button>
            <button className={secondaryBtn} onClick={() => setConfirmEnd(false)}>Keep going</button>
          </div>
        </div>
      )}
    </>,
  )
}
