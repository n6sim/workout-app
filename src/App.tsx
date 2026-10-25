import { useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { ProfileId } from './storage'
import { useProfileData } from './useProfileData'
import ProfilePicker from './screens/ProfilePicker'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import More from './screens/More'
import Settings from './screens/Settings'
import SyncHeader from './screens/SyncHeader'
import TokenScreen from './screens/TokenScreen'
import { syncManager } from './sync/instance'
import { useSyncStatus } from './useSync'

type Tab = 'today' | 'more' | 'settings'

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
  const status = useSyncStatus()
  const [tokenDismissed, setTokenDismissed] = useState(false)

  useEffect(() => {
    void syncManager.start(profileId)
    return () => syncManager.stop()
  }, [profileId])

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
          <Today profileId={profileId} header={data.header} weighIns={data.weighIns} phases={data.phases} reload={reload} />
        )}
        {tab === 'more' && (
          <More profileId={profileId} header={data.header} onSwitch={onSwitch} reload={reload} onOpenSettings={() => setTab('settings')} />
        )}
        {tab === 'settings' && <Settings onBack={() => setTab('more')} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          {(['today', 'more'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-medium capitalize ${(tab === t || (t === 'more' && tab === 'settings')) ? 'text-sky-400' : 'text-slate-400'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>
      {status.state === 'auth' && !tokenDismissed && <TokenScreen onDismiss={() => setTokenDismissed(true)} />}
    </div>
  )
}
