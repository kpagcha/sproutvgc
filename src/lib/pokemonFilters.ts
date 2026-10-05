// Filters on the Pokémon list: by type, ability or move, as Showdown's dex has them, in groups. Each group joins its
// filters with "any" (OR) or "all" (AND), and the groups are joined the same way; any filter can be negated. They're
// kept in the URL, so the home page's search can link to them:
//
//   ?f=type:fire,type:water;all.move:fakeout,!move:protect&fm=any
//
// `f` lists the groups, split by `;`, each its filters split by `,`: `all.` before a group's first filter joins them
// all (they join any otherwise), `!` before a filter negates it. `fm=any` joins the groups any (all otherwise). A link
// from before groups (`?f=type:fire,move:fakeout`) is one group joining any, as those filters always did.

import type { RouteLocationRaw } from 'vue-router'
import { available, refKey, sameRef, type MoveId, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON, movesOf } from '@/data/pokemon'
import { isType } from '@/data/types'

export type PokemonFilter = Ref<'type' | 'ability' | 'move'>
export type FilterKind = PokemonFilter['kind']

export const FILTER_KINDS: readonly FilterKind[] = ['type', 'ability', 'move']
export const isFilterKind = (kind: string): kind is FilterKind => (FILTER_KINDS as readonly string[]).includes(kind)

/** How filters, or groups, join: a Pokémon has to pass any of them, or all of them. */
export type Join = 'any' | 'all'

/** A filter, passed by the Pokémon it doesn't match when negated. */
export type FilterTerm = PokemonFilter & { not?: boolean }

export interface FilterGroup {
  join: Join
  terms: FilterTerm[]
}

export interface Filters {
  join: Join
  groups: FilterGroup[]
}

export const NO_FILTERS: Filters = { join: 'all', groups: [] }

function parseTerm(key: string): FilterTerm[] {
  const not = key.startsWith('!')
  const [kind = '', id = ''] = (not ? key.slice(1) : key).split(':')
  const term = (not ? { kind, id, not } : { kind, id }) as FilterTerm
  if (kind === 'type') return isType(id) ? [term] : []
  if (kind !== 'ability' && kind !== 'move') return []
  return available(term) ? [term] : []
}

/** The filters in `?f=` and `?fm=`, leaving out any the regulation doesn't have (or that aren't filters). */
export function parseFilters(f: unknown, fm: unknown): Filters {
  if (typeof f !== 'string' || !f) return NO_FILTERS
  return {
    join: fm === 'any' ? 'any' : 'all',
    groups: f.split(';').map((g) => {
      const all = g.startsWith('all.')
      return { join: all ? 'all' : 'any', terms: (all ? g.slice(4) : g).split(',').flatMap(parseTerm) }
    }),
  }
}

/** `filters` as `?f=` and `?fm=` take them, each undefined to leave it out. */
export function formatFilters(filters: Filters): { f: string | undefined; fm: string | undefined } {
  const group = (g: FilterGroup) =>
    (g.join === 'all' ? 'all.' : '') + g.terms.map((t) => (t.not ? '!' : '') + refKey(t)).join(',')
  return {
    f: filters.groups.map(group).join(';') || undefined,
    fm: filters.groups.length > 1 && filters.join === 'any' ? 'any' : undefined,
  }
}

/** `filters` with `filter` added to its last group (or a first one), unless that group has it already. */
export function withFilter(filters: Filters, filter: PokemonFilter): Filters {
  const last = filters.groups.at(-1)
  if (!last) return { ...filters, groups: [{ join: 'any', terms: [filter] }] }
  if (last.terms.some((t) => sameRef(t, filter))) return filters
  return { ...filters, groups: [...filters.groups.slice(0, -1), { ...last, terms: [...last.terms, filter] }] }
}

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
export const allTerms = (filters: Filters) => filters.groups.flatMap((g) => g.terms)

/**
 * Whether `id` passes the filters (or there are none; empty groups don't count). Move filters need the learnsets:
 * until they've loaded, nothing passes them, negated or not.
 */
export function passes(id: PokemonId, filters: Filters, learnsets: Record<PokemonId, MoveId[]> | null): boolean {
  const mon = POKEMON[id]
  const matches = (f: FilterTerm) => {
    if (f.kind === 'type') return mon.types.includes(f.id) !== !!f.not
    if (f.kind === 'ability') return mon.abilities.includes(f.id) !== !!f.not
    return !!learnsets && movesOf(learnsets, id).includes(f.id) !== !!f.not
  }
  const joined = <T>(join: Join, items: T[], test: (item: T) => boolean) =>
    join === 'all' ? items.every(test) : items.some(test)
  const groups = filters.groups.filter((g) => g.terms.length)
  return !groups.length || joined(filters.join, groups, (g) => joined(g.join, g.terms, matches))
}
