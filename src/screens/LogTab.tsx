import type { ProfileId } from '../storage'
import type { ProfileData } from '../useProfileData'
import { latestWeighIn } from '../domain/todayInfo'
import LogActivity from './LogActivity'
import LogMeal from './LogMeal'
import { WeighInCard, type LogView } from './Today'

const TABS: [LogView, string][] = [['meal', 'Meal'], ['activity', 'Activity'], ['weight', 'Weight']]

export default function LogTab({ profileId, data, view, setView, reload, onSaved }: {
  profileId: ProfileId; data: ProfileData; view: LogView; setView: (v: LogView) => void; reload: () => void; onSaved: () => void
}) {
  const weightKg = latestWeighIn(data.weighIns)?.kg ?? 70
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Log</h1>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1" role="tablist">
        {TABS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`rounded-lg py-2 text-sm ${view === v ? 'bg-sky-500 font-semibold text-slate-950' : 'text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {view === 'meal' && <LogMeal profileId={profileId} foods={data.foods} savedMeals={data.savedMeals} reload={reload} onSaved={onSaved} />}
      {view === 'activity' && <LogActivity profileId={profileId} weightKg={weightKg} creditPct={data.header!.settings.exerciseCreditPct} reload={reload} onSaved={onSaved} />}
      {view === 'weight' && <WeighInCard profileId={profileId} weighIns={data.weighIns} reload={reload} />}
    </div>
  )
}
