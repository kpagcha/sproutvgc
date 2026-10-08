// The comparison's Pokémon beyond a pair: who moves when among several, and the speed order's list as its URL keeps
// it. Its own Pokémon in two teams (yours, `a` and `a2`; the opponents, `b` and `b2`, each build under its letters as
// `speedBuild` reads it), or, in speed order, any Pokémon at all in `list`.

import type { PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { readBuild, type SpeedBuild } from './speedBuild'

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
