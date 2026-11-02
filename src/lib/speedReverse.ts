// The comparison read backwards: two Pokémon whose natures are known (an open team sheet has them) but not their Speed
// points, and which one moved first. Every pair of points the two could have is checked against that: the pairs where
// it moves first fit, those at the same Speed fit half the time (a tie goes either way, at random), the rest can't be.
// What fits is then weighed by how often players run each build at that nature, from the meta's sets, for the spreads
// it most likely was.

import type { PokemonId } from '@/data/dex'
import { buildSpeed, type SpeedBuild } from './speedBuild'
import { movesBefore } from './speedLineup'
import type { SpeedBuildShare } from './speed'
import { MAX_POINTS } from './stats'

/** Every number of Speed points a Pokémon can have, from none to `MAX_POINTS`. */
export const POINTS = [...Array(MAX_POINTS + 1).keys()]

/** How a pair of points goes with what was seen: it fits, it's a speed tie (fits half the time), or it can't be. */
export type Fit = 'fits' | 'tie' | 'no'

/** One side: its Pokémon, its build (its nature's effect and modifiers; its points are what's worked out) and the
 * meta's Speed builds of it. */
export interface ReverseSide {
  id: PokemonId
  build: SpeedBuild
  builds: readonly SpeedBuildShare[]
}

/** The share of a Pokémon's sets at its nature's effect running each number of points; null with none at it. */
function priorOf(side: ReverseSide): number[] | null {
  const at = side.builds.filter((b) => b.effect === side.build.effect)
  const total = at.reduce((n, b) => n + b.share, 0)
  if (!total) return null
  const w = POINTS.map(() => 0)
  for (const b of at) w[b.points]! += b.share / total
  return w
}

/** The points a side could have, as a range (Speed only grows with points, so what fits is one stretch), or null. */
export interface PointsRange {
  from: number
  to: number
  speeds: readonly [number, number]
}

/**
 * Everything the two could be, with `first` the side that moved first: each one's Speed at every number of points, the
 * grid of how each pair fits (`grid[a][b]`), the points each could have, and, weighed by the meta's sets (each side
 * with none at its nature counting every number of points alike, `known` saying which have them): how likely what was
 * seen was beforehand (`chance`), each side's points as likely now (`likely`, the most first), and the pairs most likely.
 */
export function reverse(a: ReverseSide, b: ReverseSide, first: 'a' | 'b', trickRoom: boolean) {
  const speedsA = POINTS.map((p) => buildSpeed(a.id, { ...a.build, points: p }))
  const speedsB = POINTS.map((p) => buildSpeed(b.id, { ...b.build, points: p }))
  const grid: Fit[][] = speedsA.map((sa) =>
    speedsB.map((sb) => {
      const r = movesBefore(sa, sb, trickRoom) * (first === 'a' ? 1 : -1)
      return r > 0 ? 'fits' : r === 0 ? 'tie' : 'no'
    }),
  )
  const range = (ok: (p: number) => boolean, speeds: number[]): PointsRange | null => {
    const fit = POINTS.filter(ok)
    if (!fit.length) return null
    const from = fit[0]!
    const to = fit[fit.length - 1]!
    return { from, to, speeds: [speeds[from]!, speeds[to]!] }
  }
  const rangeA = range((pa) => grid[pa]!.some((f) => f !== 'no'), speedsA)
  const rangeB = range((pb) => grid.some((row) => row[pb] !== 'no'), speedsB)
  /** The other side's points that fit with one side's at `points`: `a`'s given `b`'s, or `b`'s given `a`'s. */
  const given = (side: 'a' | 'b', points: number) =>
    side === 'a'
      ? range((pb) => grid[points]![pb] !== 'no', speedsB)
      : range((pa) => grid[pa]![points] !== 'no', speedsA)

  const priorA = priorOf(a)
  const priorB = priorOf(b)
  const flat = POINTS.map(() => 1 / POINTS.length)
  const wA = priorA ?? flat
  const wB = priorB ?? flat
  const LIKELIHOOD: Record<Fit, number> = { fits: 1, tie: 0.5, no: 0 }
  let chance = 0
  const pairs: { a: number; b: number; weight: number; fit: Fit }[] = []
  for (const pa of POINTS)
    for (const pb of POINTS) {
      const fit = grid[pa]![pb]!
      const weight = wA[pa]! * wB[pb]! * LIKELIHOOD[fit]
      if (!weight) continue
      chance += weight
      pairs.push({ a: pa, b: pb, weight, fit })
    }
  const likelyOf = (pick: (p: (typeof pairs)[number]) => number, speeds: number[]) => {
    const by = new Map<number, number>()
    for (const p of pairs) by.set(pick(p), (by.get(pick(p)) ?? 0) + p.weight / chance)
    return [...by.entries()]
      .map(([points, share]) => ({ points, speed: speeds[points]!, share }))
      .sort((x, y) => y.share - x.share)
  }
  return {
    speedsA,
    speedsB,
    grid,
    rangeA,
    rangeB,
    given,
    /** Which sides have sets at their nature to weigh their points by. */
    known: { a: !!priorA, b: !!priorB },
    /** How the meta weighs each pair beforehand, what was seen aside: for the grid's marks. */
    prior: priorA || priorB ? POINTS.map((pa) => POINTS.map((pb) => wA[pa]! * wB[pb]!)) : null,
    chance,
    likelyA: chance ? likelyOf((p) => p.a, speedsA) : [],
    likelyB: chance ? likelyOf((p) => p.b, speedsB) : [],
    top: chance
      ? pairs
          .sort((x, y) => y.weight - x.weight)
          .slice(0, 5)
          .map((p) => ({ ...p, share: p.weight / chance, speeds: [speedsA[p.a]!, speedsB[p.b]!] as const }))
      : [],
  }
}
export type Reverse = ReturnType<typeof reverse>
