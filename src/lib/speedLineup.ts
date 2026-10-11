// The comparison's Pokémon beyond a pair: who moves when among several, and the speed order's list as its URL keeps
// it. Its own Pokémon in two teams (yours, `a` and `a2`; the opponents, `b` and `b2`, each build under its letters as
// `speedBuild` reads it), or, in speed order, any Pokémon at all in `list`.

import type { PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import type { NatureEffect } from './stats'
import type { SpeedBuildShare } from './speed'
import { buildSpeed, readBuild, type SpeedBuild } from './speedBuild'

/** The most Pokémon the speed order takes. */
export const LIST_MAX = 20

export interface ListEntry {
  id: PokemonId
  build: SpeedBuild
}

/**
 * The speed order's list as the URL keeps it: each one its ID, its nature's effect and its points, then its modifiers
 * (joined by `_`) and its stage when it has them, all joined by `.` (`garchomp.up.32.tailwind_scarf.1`), the entries by
 * commas. Those the regulation doesn't have are left out, as are any beyond the most it takes.
 */
export function readList(v: unknown): ListEntry[] {
  if (typeof v !== 'string' || !v) return []
  const list: ListEntry[] = []
  for (const part of v.split(',')) {
    const [id, nat, pts, mods, stage] = part.split('.')
    if (!id || !(id in POKEMON)) continue
    list.push({
      id: id as PokemonId,
      build: readBuild({ xnat: nat, xpts: pts, xmods: mods?.replaceAll('_', ','), xstage: stage }, 'x'),
    })
  }
  return list.slice(0, LIST_MAX)
}

/** The list as the URL keeps it (`readList`); none, with nothing in it. */
export function listQuery(list: readonly ListEntry[]): string | undefined {
  if (!list.length) return undefined
  return list
    .map(({ id, build: b }) => {
      const parts: string[] = [id, b.effect, String(b.points)]
      if (b.toggles.length || b.stage) parts.push(b.toggles.join('_'))
      if (b.stage) parts.push(String(b.stage))
      return parts.join('.')
    })
    .join(',')
}

/** Where one moves among others: its place (1 for the first), and whether another moves at its Speed, at random. */
export interface Place {
  rank: number
  tie: boolean
}

/**
 * Where each moves, by its key: the faster first, or under Trick Room the slower. One as fast as another shares its
 * place, the next after them counting both (1, 2, 2, 4).
 */
export function movePlaces(entries: readonly { key: string; speed: number }[], trickRoom: boolean) {
  const places = new Map<string, Place>()
  for (const e of entries) {
    const ahead = entries.filter((o) => (trickRoom ? o.speed < e.speed : o.speed > e.speed)).length
    const tie = entries.some((o) => o !== e && o.speed === e.speed)
    places.set(e.key, { rank: ahead + 1, tie })
  }
  return places
}

/** Whether `a` moves before `b`: 1 when it does, −1 when it moves after, 0 on a tie. */
export const movesBefore = (a: number, b: number, trickRoom: boolean): 1 | 0 | -1 =>
  a === b ? 0 : a > b !== trickRoom ? 1 : -1

/** A Speed one of the comparison's Pokémon can be at: its share of its sets, and the builds reaching it. */
export interface SpreadPoint {
  speed: number
  share: number
  builds: { effect: NatureEffect; points: number; share: number }[]
}

/** One build alone, as a spread: its Speed, at every one of its sets. */
export const exactSpread = (id: PokemonId, b: SpeedBuild): SpreadPoint[] => [
  { speed: buildSpeed(id, b), share: 1, builds: [{ effect: b.effect, points: b.points, share: 1 }] },
]

/**
 * A Pokémon at its sets: the Speeds its builds in the meta reach with the modifiers of `b` (its own, which every set
 * has here), the builds reaching the same one together, their shares out of every set the data has a Speed for; the
 * fastest first. None with no builds.
 */
export function setSpread(id: PokemonId, builds: readonly SpeedBuildShare[], b: SpeedBuild): SpreadPoint[] {
  const total = builds.reduce((n, x) => n + x.share, 0)
  if (!total) return []
  const bySpeed = new Map<number, SpreadPoint>()
  for (const x of builds) {
    const speed = buildSpeed(id, { ...b, effect: x.effect, points: x.points })
    const p = bySpeed.get(speed) ?? { speed, share: 0, builds: [] }
    p.share += x.share / total
    p.builds.push({ effect: x.effect, points: x.points, share: x.share / total })
    bySpeed.set(speed, p)
  }
  return [...bySpeed.values()].sort((x, y) => y.speed - x.speed)
}

/** A spread's most common Speed (the faster of two as common). */
export const commonSpeed = (spread: readonly SpreadPoint[]) =>
  spread.reduce((a, b) => (b.share > a.share ? b : a)).speed

/** What it takes to move before every Speed of a spread: its fastest, or under Trick Room its slowest. */
export const toBeatAll = (spread: readonly SpreadPoint[], trickRoom: boolean) =>
  trickRoom ? spread[spread.length - 1]!.speed : spread[0]!.speed

/** How `a` does against `b`, each at its spread: the share of their matchups it moves first in, ties, moves after. */
export function odds(a: readonly SpreadPoint[], b: readonly SpreadPoint[], trickRoom: boolean) {
  const tally = { first: 0, tie: 0, after: 0 }
  for (const x of a)
    for (const y of b) {
      const r = movesBefore(x.speed, y.speed, trickRoom)
      tally[r > 0 ? 'first' : r < 0 ? 'after' : 'tie'] += x.share * y.share
    }
  return tally
}
export type Odds = ReturnType<typeof odds>
