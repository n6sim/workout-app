import { storage } from '../storage/instance'
import { SyncManager } from './manager'

/** The app-wide sync manager. */
export const syncManager = new SyncManager(storage)
