import { useCallback, useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { Phase, PilatesLink, ProfileHeader, ProfileId, Session, WeighIn } from './storage'

export interface ProfileData {
  header: ProfileHeader | null
  weighIns: WeighIn[]
  phases: Phase[]
  sessions: Session[]
  pilatesLinks: PilatesLink[]
}

/** Loads one profile from storage. `reload` refreshes after a write. */
export function useProfileData(profileId: ProfileId) {
  const [data, setData] = useState<ProfileData | null>(null)

  const reload = useCallback(async () => {
    const [header, weighIns, phases, sessions, pilatesLinks] = await Promise.all([
      storage.loadHeader(profileId),
      storage.listEntries('weighIns', profileId),
      storage.listEntries('phases', profileId),
      storage.listEntries('sessions', profileId),
      storage.listEntries('pilatesLinks', profileId),
    ])
    setData({ header, weighIns, phases, sessions, pilatesLinks })
  }, [profileId])

  useEffect(() => {
    setData(null)
    void reload()
  }, [reload])

  // Also reload when sync applies a pulled copy.
  useEffect(
    () => storage.onChange((e) => e.profileId === profileId && void reload()),
    [profileId, reload],
  )

  return { data, reload }
}

/** Latest weigh-in by date, then by creation time. */
export function latestWeighIn(weighIns: WeighIn[]): WeighIn | undefined {
  return [...weighIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
}
