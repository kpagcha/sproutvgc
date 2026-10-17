// Filters on the Pokémon list: by type, ability or move, as Showdown's dex has them, as filter groups
// (`filterGroups.ts`, `FilterSearch`), kept in the URL:
//
//   ?f=type:fire,move:tailwind

import type { MoveId, PokemonId, Ref } from '@/data/dex'
import { POKEMON, movesOf } from '@/data/pokemon'
import { passesGroups } from '@/lib/filterGroups'
import { parseTermFilters, type TermFilters } from '@/lib/searchTerms'

export type PokemonFilter = Ref<'type' | 'ability' | 'move'>
export type FilterKind = PokemonFilter['kind']

export const FILTER_KINDS: readonly FilterKind[] = ['type', 'ability', 'move']

/** The filters in `?f=` and `?fm=`, leaving out any the regulation doesn't have (or that aren't filters). */
export const parseFilters = (f: unknown, fm: unknown): TermFilters => parseTermFilters(f, fm, FILTER_KINDS)

/**
 * Whether `id` passes the filters (or there are none). Move filters need the learnsets: until they've loaded, nothing
 * passes them, negated or not.
 */
export function passes(id: PokemonId, filters: TermFilters, learnsets: Record<PokemonId, MoveId[]> | null): boolean {
  const mon = POKEMON[id]
  return passesGroups(filters, (f) => {
    if (f.kind === 'type') return mon.types.includes(f.id)
    if (f.kind === 'ability') return mon.abilities.includes(f.id)
    if (f.kind === 'move') return learnsets ? movesOf(learnsets, id).includes(f.id) : null
    return false
  })
}
