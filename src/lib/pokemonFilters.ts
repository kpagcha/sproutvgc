// Filters on the Pokémon list: by type, ability or move, as Showdown's dex has them. A Pokémon has to pass any of them.
// They're kept in the URL (`?f=type:fire,move:fakeout`), so the home page's search can link to them.

import type { RouteLocationRaw } from 'vue-router'
import { available, refKey, sameRef, type MoveId, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON, movesOf } from '@/data/pokemon'
import { isType } from '@/data/types'

export type PokemonFilter = Ref<'type' | 'ability' | 'move'>
export type FilterKind = PokemonFilter['kind']

export const FILTER_KINDS: readonly FilterKind[] = ['type', 'ability', 'move']
export const isFilterKind = (kind: string): kind is FilterKind => (FILTER_KINDS as readonly string[]).includes(kind)

/** The filters in `?f=`, leaving out any the regulation doesn't have (or that aren't filters). */
export function parseFilters(param: unknown): PokemonFilter[] {
  if (typeof param !== 'string') return []
  return param.split(',').flatMap((key): PokemonFilter[] => {
    const [kind = '', id = ''] = key.split(':')
    if (kind === 'type') return isType(id) ? [{ kind, id }] : []
    if (kind !== 'ability' && kind !== 'move') return []
    const filter = { kind, id } as PokemonFilter
    return available(filter) ? [filter] : []
  })
}

/** `filters` as `?f=` takes them, or undefined to leave it out. */
export const formatFilters = (filters: readonly PokemonFilter[]) => filters.map(refKey).join(',') || undefined

/** The Pokémon list filtered by `filter` on top of the `current` filters, its search cleared. */
export function addFilter(filter: PokemonFilter, current: readonly PokemonFilter[]): RouteLocationRaw {
  const filters = current.some((f) => sameRef(f, filter)) ? current : [...current, filter]
  return { name: 'pokedex', query: { f: formatFilters(filters) } }
}

/**
 * Whether `id` passes any filter (or there are none). Move filters need the learnsets: until they've loaded, nothing
 * passes them.
 */
export function passes(
  id: PokemonId,
  filters: readonly PokemonFilter[],
  learnsets: Record<PokemonId, MoveId[]> | null,
): boolean {
  const mon = POKEMON[id]
  return (
    !filters.length ||
    filters.some((f) => {
      if (f.kind === 'type') return mon.types.includes(f.id)
      if (f.kind === 'ability') return Object.values(mon.abilities).includes(f.id)
      return !!learnsets && movesOf(learnsets, id).includes(f.id)
    })
  )
}
