/** "just now", "2 min ago", "3 h ago", "2 days ago". */
export function formatAgo(iso: string, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}
