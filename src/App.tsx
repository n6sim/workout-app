import { useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { ProfileId } from './storage'
import { useProfileData } from './useProfileData'
import ProfilePicker from './screens/ProfilePicker'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import More from './screens/More'
import Settings from './screens/Settings'
import Week from './screens/Week'
import LogTab from './screens/LogTab'
import Pantry from './screens/Pantry'
import type { LogView } from './screens/Today'
import { ensurePantry } from './domain/pantry'
import SyncHeader from './screens/SyncHeader'
import TokenScreen from './screens/TokenScreen'
import { syncManager } from './sync/instance'
import { useSyncStatus } from './useSync'

type Tab = 'today' | 'week' | 'log' | 'more' | 'settings' | 'pantry'

export default function App() {
  const [profileId, setProfileId] = useState<ProfileId | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    // Ask the browser to keep our data. Harmless if already granted.
    void navigator.storage?.persist?.()
    void storage.getLastProfile().then((id) => {
      setProfileId(id)
      setBooting(false)
    })
  }, [])

  if (booting) return null

  const pick = (id: ProfileId | null) => {
    if (id) void storage.setLastProfile(id)
    setProfileId(id)
  }

  if (!profileId) return <ProfilePicker onPick={pick} />
  return <ProfileApp key={profileId} profileId={profileId} onSwitch={() => pick(null)} />
}

function ProfileApp({ profileId, onSwitch }: { profileId: ProfileId; onSwitch: () => void }) {
  const { data, reload } = useProfileData(profileId)
  const [tab, setTab] = useState<Tab>('today')
  const [logView, setLogView] = useState<LogView>('meal')
  const status = useSyncStatus()
  const [tokenDismissed, setTokenDismissed] = useState(false)

  useEffect(() => {
    void syncManager.start(profileId)
    return () => syncManager.stop()
  }, [profileId])

  // Starter pantry (about 120 foods from the Canadian Nutrient File). Adds only what is missing.
  const hasProfile = !!data?.header
  useEffect(() => {
    if (hasProfile) void ensurePantry(profileId)
  }, [hasProfile, profileId])

  // Ask again the next time GitHub rejects the token.
  useEffect(() => {
    if (status.state !== 'auth') setTokenDismissed(false)
  }, [status.state])

  if (!data) return null
  if (!data.header) return <Onboarding profileId={profileId} onDone={reload} onSwitch={onSwitch} />

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <SyncHeader name={data.header.profile.name} onOpenSettings={() => setTab('settings')} />
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {tab === 'today' && (
          <Today
            profileId={profileId} header={data.header} data={data} reload={reload} onOpenSettings={() => setTab('settings')}
            onQuickLog={(v) => { setLogView(v); setTab('log') }}
          />
        )}
        {tab === 'week' && <Week profileId={profileId} header={data.header} data={data} reload={reload} onOpenSettings={() => setTab('settings')} />}
        {tab === 'log' && <LogTab profileId={profileId} data={data} view={logView} setView={setLogView} reload={reload} onSaved={() => setTab('today')} />}
        {tab === 'more' && (
          <More
            profileId={profileId} header={data.header} onSwitch={onSwitch} reload={reload}
            onOpenSettings={() => setTab('settings')} onOpenPantry={() => setTab('pantry')}
          />
        )}
        {tab === 'settings' && (
          <Settings profileId={profileId} header={data.header} pilatesLinks={data.pilatesLinks} reload={reload} onBack={() => setTab('more')} />
        )}
        {tab === 'pantry' && <Pantry profileId={profileId} foods={data.foods} savedMeals={data.savedMeals} reload={reload} onBack={() => setTab('more')} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          {(['today', 'week', 'log', 'more'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-medium capitalize ${(tab === t || (t === 'more' && (tab === 'settings' || tab === 'pantry'))) ? 'text-sky-400' : 'text-slate-400'}`}
            >
              {t === 'log' ? 'Log +' : t}
            </button>
          ))}
        </div>
      </nav>
      {status.state === 'auth' && !tokenDismissed && <TokenScreen onDismiss={() => setTokenDismissed(true)} />}
    </div>
  )
}
