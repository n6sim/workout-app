import { SCHEMA_VERSION, type ProfileDocument } from './types'

export class SchemaError extends Error {}

/** Upgrade an older document to the current schema. Add a step per version bump. */
export function migrate(doc: ProfileDocument): ProfileDocument {
  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    throw new SchemaError('This file has no valid schemaVersion.')
  }
  if (doc.schemaVersion > SCHEMA_VERSION) {
    throw new SchemaError('This file was made by a newer version of the app. Update the app and try again.')
  }
  // No migrations yet: version 1 is the first schema.
  return doc
}
