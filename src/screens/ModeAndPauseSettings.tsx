import { useState } from 'react'
import type { ProfileId } from '../storage'
import type { TodayInfo } from '../domain/todayInfo'
import { resumePause } from '../domain/coachActions'
import { formatDate, todayLocal } from '../util/today'
import PauseSheet from './PauseSheet'
import { Card, primaryBtn, secondaryBtn } from './ui'

/** The pace (aggressive is visible but locked until 2.0) and Pause mode. */
export default function ModeAndPauseSettings({ profileId, info, reload }: { profileId: ProfileId; info: TodayInfo; reload: () => void }) {
  const [pausing, setPausing] = useState(false)
  const p = info.coach.paused
  return (
    <>
      <Card className="space-y-3">
        <h2 className="font-semibold">Pace</h2>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed="true" className="rounded-lg bg-sky-500 py-3 font-semibold text-slate-950">Moderate</button>
          <button type="button" disabled aria-disabled="true" className="rounded-lg bg-slate-800 py-3 text-slate-500">Aggressive</button>
        </div>
        <p className="text-sm text-slate-400">Moderate: at most 0.75% of your body weight a week, never below the calorie floor. Aggressive: Coming in 2.0.</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Pause</h2>
        {p ? (
          <>
            <p className="text-sm text-slate-300">Paused ({p.reason}) since {formatDate(p.startDate)}{p.endDate ? `, until ${formatDate(p.endDate)}` : ''}.</p>
            <button className={primaryBtn} onClick={async () => { await resumePause(profileId, p, todayLocal()); reload() }}>I'm back, resume</button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">Going on holiday, sick, or just too busy? Pausing means nothing is planned or judged, and the pause never counts against you.</p>
            <button className={secondaryBtn} onClick={() => setPausing(true)}>Start a pause</button>
          </>
        )}
      </Card>
      {pausing && <PauseSheet profileId={profileId} onClose={() => setPausing(false)} onStarted={() => { setPausing(false); reload() }} />}
    </>
  )
}
