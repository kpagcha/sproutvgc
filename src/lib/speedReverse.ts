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
 * seen was beforehand (`chance`), each side's points as likely now (`likely`, the most first), and each one's common builds.
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

  const priorA = priorOf(a)
  const priorB = priorOf(b)
  const flat = POINTS.map(() => 1 / POINTS.length)
  const wA = priorA ?? flat
  const wB = priorB ?? flat
  const LIKELIHOOD: Record<Fit, number> = { fits: 1, tie: 0.5, no: 0 }
  let chance = 0
  const pairs: { a: number; b: number; weight: number }[] = []
  for (const pa of POINTS)
    for (const pb of POINTS) {
      const weight = wA[pa]! * wB[pb]! * LIKELIHOOD[grid[pa]![pb]!]
      if (!weight) continue
      chance += weight
      pairs.push({ a: pa, b: pb, weight })
    }
  const likelyOf = (pick: (p: (typeof pairs)[number]) => number, speeds: number[]) => {
    const by = new Map<number, number>()
    for (const p of pairs) by.set(pick(p), (by.get(pick(p)) ?? 0) + p.weight / chance)
    return [...by.entries()]
      .map(([points, share]) => ({ points, speed: speeds[points]!, share }))
      .sort((x, y) => y.share - x.share)
  }
  const likelyA = chance ? likelyOf((p) => p.a, speedsA) : []
  const likelyB = chance ? likelyOf((p) => p.b, speedsB) : []
  const commonA = commonOf(priorA, speedsA, likelyA)
  const commonB = commonOf(priorB, speedsB, likelyB)
  // None of the table's pairs fitting while some pair does (no set runs it), the nearest that does joins it: the first
  // side's most run build brought into what it could have, and the other's nearest its own that fits with it.
  if (rangeA && !commonA.some((ca) => commonB.some((cb) => grid[ca.points]![cb.points] !== 'no'))) {
    const clamp = (p: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, p))
    const pa = clamp(commonA.reduce(byShare).points, rangeA.from, rangeA.to)
    const fitB = POINTS.filter((pb) => grid[pa]![pb] !== 'no')
    const topB = commonB.reduce(byShare).points
    const pb = fitB.reduce((x, y) => (Math.abs(y - topB) < Math.abs(x - topB) ? y : x))
    addTo(commonA, pa, speedsA, priorA)
    addTo(commonB, pb, speedsB, priorB)
  }
  return {
    speedsA,
    speedsB,
    grid,
    rangeA,
    rangeB,
    /** Which sides have sets at their nature to weigh their points by. */
    known: { a: !!priorA, b: !!priorB },
    /** Each side's builds to set against the other's, in the table. */
    commonA,
    commonB,
    chance,
    likelyA,
    likelyB,
  }
}

type TableBuild = { points: number; speed: number; share: number | null }
const byShare = (x: TableBuild, y: TableBuild) => ((y.share ?? 0) > (x.share ?? 0) ? y : x)
/** A build put in a side's table, where it isn't already, the most points first. */
function addTo(list: TableBuild[], points: number, speeds: number[], prior: number[] | null) {
  if (list.some((b) => b.points === points)) return
  list.push({ points, speed: speeds[points]!, share: prior ? prior[points]! : null })
  list.sort((x, y) => y.points - x.points)
}

/** The least share of a side's sets at its nature a build needs to be in the table, and the most it takes of them. */
const TABLE_MIN = 0.03
const TABLE_MAX = 4
/** The least share of what fits a build needs to join them, and the most that join. */
const LIKELY_MIN = 0.1
const LIKELY_MAX = 2
/**
 * A side's builds for the table, the most points first: those most run at its nature (on `TABLE_MIN` of those sets or
 * more, up to `TABLE_MAX`), joined by those most likely once what was seen is counted (its most run may be ruled out);
 * with no sets there, none and all of its points.
 */
function commonOf(
  prior: number[] | null,
  speeds: number[],
  likely: readonly { points: number; share: number }[],
): TableBuild[] {
  const list = prior
    ? POINTS.filter((p) => prior[p]! >= TABLE_MIN)
        .sort((x, y) => prior[y]! - prior[x]!)
        .slice(0, TABLE_MAX)
    : [0, MAX_POINTS]
  if (prior)
    for (const l of likely.filter((x) => x.share >= LIKELY_MIN).slice(0, LIKELY_MAX))
      if (!list.includes(l.points)) list.push(l.points)
  return list
    .sort((x, y) => y - x)
    .map((points) => ({ points, speed: speeds[points]!, share: prior ? prior[points]! : null }))
}
