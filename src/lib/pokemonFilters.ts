// Filters on the Pokémon list: by type, ability or move, as Showdown's dex has them, in groups (`filterGroups.ts`: each
// group joins its filters with "any" or "all", the groups joined the same way, any filter negated), kept in the URL so
// the home page's search can link to them:
//
//   ?f=type:fire,type:water;all.move:fakeout,!move:protect&fm=any
//
// A link from before groups (`?f=type:fire,move:fakeout`) is one group joining any, as those filters always did.

import type { RouteLocationRaw } from 'vue-router'
import { available, type MoveId, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON, movesOf } from '@/data/pokemon'
import { isType } from '@/data/types'
import {
  allFilters,
  formatGroups,
  noFilters,
  parseGroups,
  passesGroups,
  withFilter as withGroupFilter,
  type FilterGroup as Group,
  type Filters as GroupFilters,
  type Join,
  type Negatable,
} from '@/lib/filterGroups'

export type { Join }

export type PokemonFilter = Ref<'type' | 'ability' | 'move'>
export type FilterKind = PokemonFilter['kind']

export const FILTER_KINDS: readonly FilterKind[] = ['type', 'ability', 'move']
export const isFilterKind = (kind: string): kind is FilterKind => (FILTER_KINDS as readonly string[]).includes(kind)

/** A filter, passed by the Pokémon it doesn't match when negated. */
export type FilterTerm = Negatable<PokemonFilter>
export type FilterGroup = Group<PokemonFilter>
export type Filters = GroupFilters<PokemonFilter>

export const NO_FILTERS: Filters = noFilters()

function parseTerm(kind: string, id: string): PokemonFilter | null {
  const term = { kind, id } as PokemonFilter
  if (kind === 'type') return isType(id) ? term : null
  if (kind !== 'ability' && kind !== 'move') return null
  return available(term) ? term : null
}

/** The filters in `?f=` and `?fm=`, leaving out any the regulation doesn't have (or that aren't filters). */
export const parseFilters = (f: unknown, fm: unknown): Filters => parseGroups(f, fm, parseTerm)

/** `filters` as `?f=` and `?fm=` take them, each undefined to leave it out. */
export const formatFilters = (filters: Filters) => formatGroups(filters)

/** `filters` with `filter` added to its last group (or a first one), unless that group has it already. */
export const withFilter = (filters: Filters, filter: PokemonFilter): Filters => withGroupFilter(filters, filter)

/** The Pokémon list filtered by `filter` on top of the `current` filters, its search cleared. */
export function addFilter(filter: PokemonFilter, current: Filters): RouteLocationRaw {
  return { name: 'pokedex', query: formatFilters(withFilter(current, filter)) }
}

/**
 * Whether `filters` are the plain kind, which the list shows without its advanced mode: one group, any of its filters,
 * none negated.
 */
export const isPlain = (filters: Filters) =>
  filters.groups.length <= 1 && filters.groups.every((g) => g.join === 'any' && !g.terms.some((t) => t.not))

/** Every filter in `filters`. */
export const allTerms = (filters: Filters) => allFilters(filters)

/**
 * Whether `id` passes the filters (or there are none; empty groups don't count). Move filters need the learnsets:
 * until they've loaded, nothing passes them, negated or not.
 */
export function passes(id: PokemonId, filters: Filters, learnsets: Record<PokemonId, MoveId[]> | null): boolean {
  const mon = POKEMON[id]
  return passesGroups(filters, (f) => {
    if (f.kind === 'type') return mon.types.includes(f.id)
    if (f.kind === 'ability') return mon.abilities.includes(f.id)
    return learnsets ? movesOf(learnsets, id).includes(f.id) : null
  })
}
