import { useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { ProfileId } from './storage'
import { useProfileData } from './useProfileData'
import ProfilePicker from './screens/ProfilePicker'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import More from './screens/More'

type Tab = 'today' | 'more'

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

  if (!data) return null
  if (!data.header) return <Onboarding profileId={profileId} onDone={reload} onSwitch={onSwitch} />

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6">
        {tab === 'today' ? (
          <Today profileId={profileId} header={data.header} weighIns={data.weighIns} phases={data.phases} reload={reload} />
        ) : (
          <More profileId={profileId} header={data.header} onSwitch={onSwitch} reload={reload} />
        )}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          {(['today', 'more'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-medium capitalize ${tab === t ? 'text-sky-400' : 'text-slate-400'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
