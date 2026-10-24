import Dexie, { type Table } from 'dexie'
import type { EntryMap, ProfileHeader, ProfileId } from './types'

export type HeaderRow = ProfileHeader & { id: ProfileId; schemaVersion: number }
export type MetaRow = { key: string; value: string }
type Row<T> = T & { profileId: ProfileId }

/** IndexedDB layout: one header row per profile plus one table per entry type, indexed by profile.
 *  Only src/storage/ may touch this. */
export class WorkoutDB extends Dexie {
  headers!: Table<HeaderRow, ProfileId>
  meta!: Table<MetaRow, string>
  phases!: Table<Row<EntryMap['phases']>, string>
  weighIns!: Table<Row<EntryMap['weighIns']>, string>
  meals!: Table<Row<EntryMap['meals']>, string>
  activities!: Table<Row<EntryMap['activities']>, string>
  sessions!: Table<Row<EntryMap['sessions']>, string>
  pauses!: Table<Row<EntryMap['pauses']>, string>
  foods!: Table<Row<EntryMap['foods']>, string>
  savedMeals!: Table<Row<EntryMap['savedMeals']>, string>
  pilatesLinks!: Table<Row<EntryMap['pilatesLinks']>, string>
  events!: Table<Row<EntryMap['events']>, string>

  constructor(name = 'workout-app') {
    super(name)
    this.version(1).stores({
      headers: 'id',
      meta: 'key',
      phases: 'id, profileId',
      weighIns: 'id, profileId, [profileId+date]',
      meals: 'id, profileId, [profileId+date]',
      activities: 'id, profileId, [profileId+date]',
      sessions: 'id, profileId, [profileId+date]',
      pauses: 'id, profileId',
      foods: 'id, profileId',
      savedMeals: 'id, profileId',
      pilatesLinks: 'id, profileId',
      events: 'id, profileId',
    })
  }
}
