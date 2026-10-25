import { useCallback, useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { Phase, ProfileHeader, ProfileId, WeighIn } from './storage'

export interface ProfileData {
  header: ProfileHeader | null
  weighIns: WeighIn[]
  phases: Phase[]
}

/** Loads one profile from storage. `reload` refreshes after a write. */
export function useProfileData(profileId: ProfileId) {
  const [data, setData] = useState<ProfileData | null>(null)

  const reload = useCallback(async () => {
    const [header, weighIns, phases] = await Promise.all([
      storage.loadHeader(profileId),
      storage.listEntries('weighIns', profileId),
      storage.listEntries('phases', profileId),
    ])
    setData({ header, weighIns, phases })
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
