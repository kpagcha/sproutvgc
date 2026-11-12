// The comparison read backwards: two Pokémon and which one moves first (seen, or wanted). Of each, its nature and its
// Speed points are either given (an open team sheet has the natures; yours are known) or worked out: every build the
// two could have, at every nature effect and number of points that's worked out, is checked against the order: the
// pairs where it moves first fit, those at the same Speed fit half the time (a tie goes either way, at random), the rest
// can't be. What fits is then weighed by how often players run each build, from the meta's sets (those at what's given
// of it), for the builds it most likely is.

import type { PokemonId } from '@/data/dex'
import { buildSpeed, type SpeedBuild } from './speedBuild'
import { movesBefore } from './speedLineup'
import { NATURE_EFFECTS, type SpeedBuildShare } from './speed'
import { MAX_POINTS, type NatureEffect } from './stats'

/** Every number of Speed points a Pokémon can have, from none to `MAX_POINTS`. */
export const POINTS = [...Array(MAX_POINTS + 1).keys()]

/** How a pair of builds goes with the order: it fits, it's a speed tie (fits half the time), or it can't be. */
export type Fit = 'fits' | 'tie' | 'no'

/** What's worked out of a side: its nature, its points, either or both; what isn't is as its build has it. */
export interface Unknowns {
  nature: boolean
  points: boolean
}

/** One side: its Pokémon, its build (what's given of it, and its modifiers), what's worked out of it, and the meta's
 * Speed builds of it. */
export interface ReverseSide {
  id: PokemonId
  build: SpeedBuild
  work: Unknowns
  builds: readonly SpeedBuildShare[]
}

/** A build a side could have: its nature's effect, its points and the Speed they give. */
export interface Candidate {
  effect: NatureEffect
  points: number
  speed: number
}

/** Each build a side could have, at what's given of it. */
function candidatesOf(side: ReverseSide): Candidate[] {
  const effects = side.work.nature ? NATURE_EFFECTS : [side.build.effect]
  const points = side.work.points ? POINTS : [side.build.points]
  return effects.flatMap((effect) =>
    points.map((p) => ({ effect, points: p, speed: buildSpeed(side.id, { ...side.build, effect, points: p }) })),
  )
}

/** The share of a side's sets (those at what's given of it) at each of its candidates; null with none there. */
function priorOf(side: ReverseSide, cands: readonly Candidate[]): number[] | null {
  const w = cands.map((c) =>
    side.builds.filter((b) => b.effect === c.effect && b.points === c.points).reduce((n, b) => n + b.share, 0),
  )
  const total = w.reduce((n, x) => n + x, 0)
  return total ? w.map((x) => x / total) : null
}

/** The points a side could have at one nature effect, as a range (Speed only grows with points, so what fits is one
 * stretch). */
export interface PointsRange {
  effect: NatureEffect
  from: number
  to: number
  speeds: readonly [number, number]
}

/**
 * The Speed a side could have, as a range: from `from` to `to`, `min` and `max` the slowest and fastest it could be
 * before the order was counted (an end at them binds nothing); `tieFrom`, `tieTo` when it's at that end only as a speed
 * tie.
 */
export interface SpeedRange {
  from: number
  to: number
  min: number
  max: number
  tieFrom: boolean
  tieTo: boolean
}

/** A build in a side's table: its candidate's place, and its share of the side's sets (null with none to go by). */
export interface TableBuild extends Candidate {
  i: number
  share: number | null
}

/**
 * Everything the two could be, with `first` the side that moves first: each one's candidates, the grid of how each
 * pair fits (`grid[a][b]`, by their places), each one's points by nature effect where some pair fits, and, weighed by
 * the meta's sets (a side with none there counting each candidate alike, `known` saying which have them; one with
 * nothing worked out not weighed): how likely the order is beforehand (`chance`), each side's builds as likely now
 * (`likely`, the most first), and each one's common builds for the table.
 */
export function reverse(a: ReverseSide, b: ReverseSide, first: 'a' | 'b', trickRoom: boolean) {
  const candA = candidatesOf(a)
  const candB = candidatesOf(b)
  const grid: Fit[][] = candA.map((ca) =>
    candB.map((cb) => {
      const r = movesBefore(ca.speed, cb.speed, trickRoom) * (first === 'a' ? 1 : -1)
      return r > 0 ? 'fits' : r === 0 ? 'tie' : 'no'
    }),
  )
  const fitsA = candA.map((_, i) => grid[i]!.some((f) => f !== 'no'))
  const fitsB = candB.map((_, j) => grid.some((row) => row[j] !== 'no'))
  const rangesOf = (cands: Candidate[], ok: boolean[]): PointsRange[] =>
    NATURE_EFFECTS.flatMap((effect) => {
      const fit = cands.filter((c, i) => c.effect === effect && ok[i])
      if (!fit.length) return []
      const lo = fit[0]!
      const hi = fit[fit.length - 1]!
      return [{ effect, from: lo.points, to: hi.points, speeds: [lo.speed, hi.speed] as const }]
    })
  const possible = fitsA.some(Boolean)
  /** A side's Speed where some pair fits; at an end where every pair of its is a tie, said so. */
  const speedRangeOf = (cands: Candidate[], ok: boolean[], fitsAt: (i: number) => Fit[]): SpeedRange | null => {
    const fit = cands.map((c, i) => ({ c, i })).filter((x) => ok[x.i])
    if (!fit.length) return null
    const speeds = fit.map((x) => x.c.speed)
    const from = Math.min(...speeds)
    const to = Math.max(...speeds)
    const tieOnly = (sp: number) => fit.filter((x) => x.c.speed === sp).every((x) => !fitsAt(x.i).includes('fits'))
    const all = cands.map((c) => c.speed)
    return { from, to, min: Math.min(...all), max: Math.max(...all), tieFrom: tieOnly(from), tieTo: tieOnly(to) }
  }

  const worked = (s: ReverseSide) => s.work.nature || s.work.points
  const priorA = worked(a) ? priorOf(a, candA) : null
  const priorB = worked(b) ? priorOf(b, candB) : null
  const flat = (n: number) => Array<number>(n).fill(1 / n)
  const wA = priorA ?? flat(candA.length)
  const wB = priorB ?? flat(candB.length)
  const LIKELIHOOD: Record<Fit, number> = { fits: 1, tie: 0.5, no: 0 }
  let chance = 0
  const pairs: { a: number; b: number; weight: number }[] = []
  for (let i = 0; i < candA.length; i++)
    for (let j = 0; j < candB.length; j++) {
      const weight = wA[i]! * wB[j]! * LIKELIHOOD[grid[i]![j]!]
      if (!weight) continue
      chance += weight
      pairs.push({ a: i, b: j, weight })
    }
  const likelyOf = (pick: (p: (typeof pairs)[number]) => number) => {
    const by = new Map<number, number>()
    for (const p of pairs) by.set(pick(p), (by.get(pick(p)) ?? 0) + p.weight / chance)
    return [...by.entries()].map(([i, share]) => ({ i, share })).sort((x, y) => y.share - x.share)
  }
  const likelyA = chance ? likelyOf((p) => p.a) : []
  const likelyB = chance ? likelyOf((p) => p.b) : []
  const commonA = commonOf(a, candA, priorA, likelyA)
  const commonB = commonOf(b, candB, priorB, likelyB)
  // None of the table's pairs fitting while some pair does (no set runs it), the nearest that does joins it: the first
  // side's most run build brought to the nearest that can fit, and the other's nearest its own that fits with it.
  if (possible && !commonA.some((ca) => commonB.some((cb) => grid[ca.i]![cb.i] !== 'no'))) {
    const near = (cands: Candidate[], ok: (i: number) => boolean, to: TableBuild) =>
      cands
        .map((c, i) => ({ c, i }))
        .filter((x) => ok(x.i))
        .reduce((x, y) => (distance(y.c, to) < distance(x.c, to) ? y : x)).i
    const ia = near(candA, (i) => fitsA[i]!, commonA.reduce(byShare))
    const ib = near(candB, (j) => grid[ia]![j] !== 'no', commonB.reduce(byShare))
    addTo(commonA, ia, candA, priorA)
    addTo(commonB, ib, candB, priorB)
  }
  return {
    candA,
    candB,
    grid,
    possible,
    rangesA: rangesOf(candA, fitsA),
    rangesB: rangesOf(candB, fitsB),
    speedA: speedRangeOf(candA, fitsA, (i) => grid[i]!),
    speedB: speedRangeOf(candB, fitsB, (j) => grid.map((row) => row[j]!)),
    /** Which sides have sets at what's given of them to weigh their builds by. */
    known: { a: !!priorA, b: !!priorB },
    /** Each side's builds to set against the other's, in the table. */
    commonA,
    commonB,
    chance,
    likelyA,
    likelyB,
  }
}

/** How far apart two builds are, for the nearest that fits: by points, a nature effect apart counting as more. */
const distance = (x: Candidate, y: Candidate) => Math.abs(x.points - y.points) + (x.effect === y.effect ? 0 : 100)
const byShare = (x: TableBuild, y: TableBuild) => ((y.share ?? 0) > (x.share ?? 0) ? y : x)
const EFFECT_ORDER: Record<NatureEffect, number> = { up: 0, neutral: 1, down: 2 }
/** The table's order: the fastest first. */
const tableOrder = (x: TableBuild, y: TableBuild) =>
  y.speed - x.speed || EFFECT_ORDER[x.effect] - EFFECT_ORDER[y.effect]
const tableBuild = (i: number, cands: Candidate[], prior: number[] | null): TableBuild => ({
  ...cands[i]!,
  i,
  share: prior ? prior[i]! : null,
})
/** A build put in a side's table, where it isn't already. */
function addTo(list: TableBuild[], i: number, cands: Candidate[], prior: number[] | null) {
  if (list.some((b) => b.i === i)) return
  list.push(tableBuild(i, cands, prior))
  list.sort(tableOrder)
}

/** The least share of a side's sets a build needs to be in the table, and the most it takes of them. */
const TABLE_MIN = 0.03
const TABLE_MAX = 4
/** The least share of what fits a build needs to join them, and the most that join. */
const LIKELY_MIN = 0.1
const LIKELY_MAX = 2
/**
 * A side's builds for the table, the fastest first: with nothing worked out, the one it has; else those most run at
 * what's given of it (on `TABLE_MIN` of those sets or more, up to `TABLE_MAX`), joined by those most likely once the
 * order is counted (its most run may be ruled out); with no sets there, its ends: none and all of its points, at each
 * nature effect worked out.
 */
function commonOf(
  side: ReverseSide,
  cands: Candidate[],
  prior: number[] | null,
  likely: readonly { i: number; share: number }[],
): TableBuild[] {
  let list: number[]
  if (cands.length === 1) list = [0]
  else if (prior) {
    list = cands
      .map((_, i) => i)
      .filter((i) => prior[i]! >= TABLE_MIN)
      .sort((x, y) => prior[y]! - prior[x]!)
      .slice(0, TABLE_MAX)
    for (const l of likely.filter((x) => x.share >= LIKELY_MIN).slice(0, LIKELY_MAX))
      if (!list.includes(l.i)) list.push(l.i)
  } else {
    const ends: { effect: NatureEffect; points: number }[] = side.work.points
      ? side.work.nature
        ? [
            { effect: 'up', points: MAX_POINTS },
            { effect: 'neutral', points: MAX_POINTS },
            { effect: 'neutral', points: 0 },
            { effect: 'down', points: 0 },
          ]
        : [
            { effect: side.build.effect, points: MAX_POINTS },
            { effect: side.build.effect, points: 0 },
          ]
      : NATURE_EFFECTS.map((effect) => ({ effect, points: side.build.points }))
    list = ends.map((e) => cands.findIndex((c) => c.effect === e.effect && c.points === e.points)).filter((i) => i >= 0)
  }
  return list.map((i) => tableBuild(i, cands, prior)).sort(tableOrder)
}
