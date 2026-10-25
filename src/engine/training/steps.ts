import type { SessionPlan } from './types'

export type Step =
  | { kind: 'timed'; group: 'warmup' | 'cardio' | 'finisher' | 'cooldown'; exerciseId: string; name: string; seconds: number; hint?: 'hard' | 'easy'; round?: number; rounds?: number }
  | { kind: 'set'; exerciseId: string; name: string; setNo: number; totalSets: number; repMin: number; repMax: number; restSec: number; usesDumbbells: boolean }
  | { kind: 'hold'; exerciseId: string; name: string; setNo: number; totalSets: number; seconds: number; restSec: number }

/** The order the player walks through (spec: Session structure):
 *  warm-up, steady cardio, strength sets, finisher intervals, cool-down stretches. */
export function expandSteps(plan: SessionPlan): Step[] {
  const steps: Step[] = []
  if (plan.warmup) steps.push({ kind: 'timed', group: 'warmup', ...plan.warmup })
  if (plan.cardio) steps.push({ kind: 'timed', group: 'cardio', ...plan.cardio })
  for (const e of plan.exercises) {
    for (let s = 1; s <= e.sets; s++) {
      steps.push(
        e.mode === 'timed'
          ? { kind: 'hold', exerciseId: e.exerciseId, name: e.name, setNo: s, totalSets: e.sets, seconds: e.seconds ?? 30, restSec: e.restSec }
          : { kind: 'set', exerciseId: e.exerciseId, name: e.name, setNo: s, totalSets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec, usesDumbbells: e.usesDumbbells },
      )
    }
  }
  if (plan.finisher) {
    const f = plan.finisher
    for (let r = 1; r <= f.rounds; r++) {
      steps.push({ kind: 'timed', group: 'finisher', exerciseId: f.exerciseId, name: f.name, seconds: f.hardSec, hint: 'hard', round: r, rounds: f.rounds })
      steps.push({ kind: 'timed', group: 'finisher', exerciseId: f.exerciseId, name: f.name, seconds: f.easySec, hint: 'easy', round: r, rounds: f.rounds })
    }
  }
  for (const c of plan.cooldown) steps.push({ kind: 'timed', group: 'cooldown', ...c })
  return steps
}

/** Index of the first step after `from` that belongs to a different exercise or block (for Skip). */
export function nextBlockIndex(steps: Step[], from: number): number {
  const cur = steps[from]
  if (!cur) return steps.length
  const block = (s: Step) => (s.kind === 'timed' ? `${s.group}:${s.exerciseId}` : s.exerciseId)
  let i = from + 1
  while (i < steps.length && block(steps[i]) === block(cur) && !(cur.kind === 'timed' && cur.group === 'cooldown')) i++
  return i
}
