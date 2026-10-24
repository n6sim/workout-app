import { ENTRY_TABLES, type ProfileDocument } from './types'
import { SchemaError, migrate } from './migrate'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Parse and sanity-check imported JSON text. Throws SchemaError with a plain-language message. */
export function parseProfileDocument(text: string): ProfileDocument {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SchemaError('That file is not valid JSON.')
  }
  if (!isObj(raw)) throw new SchemaError('That file is not a profile export.')
  for (const key of ['profile', 'settings', 'goal'] as const) {
    if (!isObj(raw[key]) || typeof raw[key].updatedAt !== 'string') {
      throw new SchemaError(`The file is missing "${key}".`)
    }
  }
  for (const t of ENTRY_TABLES) {
    const list = raw[t]
    if (list === undefined) {
      raw[t] = [] // older or hand-trimmed files
      continue
    }
    if (!Array.isArray(list)) throw new SchemaError(`"${t}" must be a list.`)
    for (const e of list) {
      if (!isObj(e) || typeof e.id !== 'string' || typeof e.updatedAt !== 'string') {
        throw new SchemaError(`An entry in "${t}" has no id or updatedAt.`)
      }
    }
  }
  return migrate(raw as unknown as ProfileDocument)
}
