import { useCallback, useEffect, useState } from 'react'
import { storage } from './storage/instance'
import type { Activity, CoachEvent, Food, Meal, Phase, PilatesLink, ProfileHeader, ProfileId, SavedMeal, Session, WeighIn } from './storage'

export interface ProfileData {
  header: ProfileHeader | null
  weighIns: WeighIn[]
  phases: Phase[]
  sessions: Session[]
  pilatesLinks: PilatesLink[]
  meals: Meal[]
  activities: Activity[]
  foods: Food[]
  savedMeals: SavedMeal[]
  events: CoachEvent[]
}

/** Loads one profile from storage. `reload` refreshes after a write. */
export function useProfileData(profileId: ProfileId) {
  const [data, setData] = useState<ProfileData | null>(null)

  const reload = useCallback(async () => {
    const [header, weighIns, phases, sessions, pilatesLinks, meals, activities, foods, savedMeals, events] = await Promise.all([
      storage.loadHeader(profileId),
      storage.listEntries('weighIns', profileId),
      storage.listEntries('phases', profileId),
      storage.listEntries('sessions', profileId),
      storage.listEntries('pilatesLinks', profileId),
      storage.listEntries('meals', profileId),
      storage.listEntries('activities', profileId),
      storage.listEntries('foods', profileId),
      storage.listEntries('savedMeals', profileId),
      storage.listEntries('events', profileId, { includeDeleted: true }),
    ])
    setData({ header, weighIns, phases, sessions, pilatesLinks, meals, activities, foods, savedMeals, events })
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

export { latestWeighIn } from './domain/todayInfo'
