import { expect, it } from 'vitest'
import { formatAgo } from './ago'

const now = Date.parse('2026-10-24T12:00:00Z')
it('formats elapsed time', () => {
  expect(formatAgo('2026-10-24T11:59:40Z', now)).toBe('just now')
  expect(formatAgo('2026-10-24T11:58:00Z', now)).toBe('2 min ago')
  expect(formatAgo('2026-10-24T09:00:00Z', now)).toBe('3 h ago')
  expect(formatAgo('2026-10-23T11:00:00Z', now)).toBe('1 day ago')
  expect(formatAgo('2026-10-21T11:00:00Z', now)).toBe('3 days ago')
  expect(formatAgo('2026-10-24T12:05:00Z', now)).toBe('just now') // clock skew never shows negative
})
