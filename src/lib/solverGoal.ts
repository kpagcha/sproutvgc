import type { OpponentUnknowns } from '@/lib/damageReverse'

// The damage solver's goals: what each one works out of each side. Its spread (the opponent's stat points), its build
// (its nature, item and stat points; the default) or what yours needs (your nature and stat points, and its build);
// Custom, whatever's worked out part by part.

export type GoalPart = keyof OpponentUnknowns
export type GoalSide = 'a' | 'b'
export const GOAL_PARTS: readonly GoalPart[] = ['nature', 'item', 'points']
const NONE: OpponentUnknowns = { nature: false, item: false, points: false }
const ALL: OpponentUnknowns = { nature: true, item: true, points: true }
export const GOALS = {
  spread: { a: NONE, b: { nature: false, item: false, points: true } },
  build: { a: NONE, b: ALL },
  need: { a: { nature: true, item: false, points: true }, b: ALL },
} as const
export type FixedGoal = keyof typeof GOALS
export type Goal = FixedGoal | 'custom'
export const GOAL_OPTIONS = ['spread', 'build', 'need', 'custom'] as const

export interface GoalWork {
  a: OpponentUnknowns
  b: OpponentUnknowns
  /** Whether a side's item is fixed (a Mega's stone, Ogerpon's mask), never worked out. */
  fixed: { a: boolean; b: boolean }
}

/** A side's work as it's read: its item not, where it can't be anything else. */
const norm = (w: OpponentUnknowns, fixed: boolean): OpponentUnknowns => ({ ...w, item: w.item && !fixed })

/** Where what's worked out differs from a goal's: each side's part, and whether it's worked out now. */
export function goalDiff(g: FixedGoal, w: GoalWork): { side: GoalSide; part: GoalPart; worked: boolean }[] {
  const out: { side: GoalSide; part: GoalPart; worked: boolean }[] = []
  for (const side of ['a', 'b'] as const) {
    const now = norm(w[side], w.fixed[side])
    const want = norm(GOALS[g][side], w.fixed[side])
    for (const part of GOAL_PARTS) if (now[part] !== want[part]) out.push({ side, part, worked: now[part] })
  }
  return out
}

/** The goal what's worked out is, or Custom. */
export const goalOf = (w: GoalWork): Goal =>
  (Object.keys(GOALS) as FixedGoal[]).find((g) => !goalDiff(g, w).length) ?? 'custom'
