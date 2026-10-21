// A tournament's teams filtered by what they have (`FilterSearch` on its standings and rounds, `?f=`): a Pokémon (one
// narrowed to a build, the one Pokémon with an item, ability or moves: `?f=pokemon:incineroar~item:sitrusberry`), an
// item, an ability or a move.

import { ability, item, move, type PokemonId } from '@/data/dex'
import type { Slot, Standing } from '@/data/tournaments'
import { filterKey } from '@/lib/filterGroups'
import type { Detail, Term } from '@/lib/searchTerms'

/** What a team can be filtered by. */
export const TEAM_KINDS = ['pokemon', 'item', 'ability', 'move'] as const

/** Whether a set has a detail: its item, ability, or among its moves. */
const hasDetail = ([, it, ab, , moves]: Slot, d: Detail) =>
  d.kind === 'item' ? it === d.id : d.kind === 'ability' ? ab === d.id : moves.includes(d.id as Slot[4][number])

/** Whether a set is a Pokémon filter's: that Pokémon, with every one of its details. */
export const isBuild = (slot: Slot, f: Term) => slot[0] === f.id && (f.with ?? []).every((d) => hasDetail(slot, d))

/** Whether a team passes a filter. */
export function teamHas(team: readonly Slot[], f: Term) {
  if (f.kind === 'pokemon') return team.some((x) => isBuild(x, f))
  if (f.kind === 'item') return team.some(([, it]) => it === f.id)
  if (f.kind === 'ability') return team.some(([, , ab]) => ab === f.id)
  if (f.kind === 'move') return team.some(([, , , , moves]) => (moves as string[]).includes(f.id))
  return false
}

/** What a Pokémon's sets in the standings run, to narrow its filter by: its items, abilities and moves, the most run
 * first. */
export function detailsIn(standings: readonly Standing[], pid: PokemonId): Detail[] {
  const n = new Map<string, { d: Detail; n: number }>()
  const add = (d: Detail) => {
    const key = filterKey(d)
    const x = n.get(key)
    if (x) x.n++
    else n.set(key, { d, n: 1 })
  }
  for (const s of standings)
    for (const [p, it, ab, , moves] of s.team) {
      if (p !== pid) continue
      if (it) add(item(it))
      if (ab) add(ability(ab))
      for (const m of moves) add(move(m))
    }
  return [...n.values()].sort((a, b) => b.n - a.n).map((x) => x.d)
}
