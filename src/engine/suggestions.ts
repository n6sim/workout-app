export interface MealIdea {
  id: string
  name: string
  kcal: number
  proteinG: number
}

export interface Remaining {
  kcal: number
  proteinG: number
}

/** The 3 ideas that best fit what is left today (spec: Meal suggestions).
 *  They should fit the calories left, and prefer protein when it is behind. */
export function suggestMeals<T extends MealIdea>(ideas: T[], left: Remaining, proteinTarget: number, count = 3): T[] {
  const proteinBehind = left.proteinG > proteinTarget * 0.25
  const kcalLeft = Math.max(0, left.kcal)
  const score = (m: T) => {
    const over = Math.max(0, m.kcal - kcalLeft)
    const under = Math.max(0, kcalLeft - m.kcal)
    const proteinUseful = Math.min(m.proteinG, Math.max(0, left.proteinG))
    // Going over the calories left is costly; leaving some room is only a small cost; protein is the reward.
    return proteinUseful * (proteinBehind ? 4 : 1.5) - over * 3 - under * 0.15 - (kcalLeft === 0 ? m.kcal * 0.5 : 0)
  }
  return [...ideas].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, count)
}
