/** Small deterministic hash (FNV-1a). The same seed always gives the same plan, so Today does not
 *  reshuffle when you reopen the app. */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Stable "random" order: sorts by hash of seed + key. */
export function seededOrder<T>(items: T[], seed: string, key: (t: T) => string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${key(a)}`) - hash(`${seed}:${key(b)}`))
}
