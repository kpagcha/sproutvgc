// Filters in groups, for any list (the Pokémon list's `pokemonFilters.ts`, the move rankings'): each group joins its
// filters with "any" (OR) or "all" (AND), and the groups are joined the same way; any filter can be negated. They're
// kept in the URL:
//
//   ?f=type:fire,type:water;all.move:fakeout,!move:protect&fm=any
//
// `f` lists the groups, split by `;`, each its filters split by `,`: `all.` before a group's first filter joins them
// all (they join any otherwise), `!` before a filter negates it. `fm=any` joins the groups any (all otherwise). What
// a filter is, and which ones a list takes, is the list's: it parses them (`parseTerm`) and tests them (`matches`).

/** A filter: a kind and an ID within it (a type, an ability, a move's tag…). */
export interface FilterLike {
  kind: string
  id: string
}

/** How filters, or groups, join: an entry has to pass any of them, or all of them. */
export type Join = 'any' | 'all'

/** A filter, passed by the entries it doesn't match when negated. */
export type Negatable<F extends FilterLike> = F & { not?: boolean }

export interface FilterGroup<F extends FilterLike> {
  join: Join
  terms: Negatable<F>[]
}

export interface Filters<F extends FilterLike> {
  join: Join
  groups: FilterGroup<F>[]
}

export const noFilters = <F extends FilterLike>(): Filters<F> => ({ join: 'all', groups: [] })

/** A filter's key in the URL: `kind:id`. */
export const filterKey = (f: FilterLike) => `${f.kind}:${f.id}`
export const sameFilter = (a: FilterLike, b: FilterLike) => a.kind === b.kind && a.id === b.id

/**
 * The filters in `?f=` and `?fm=`, each read by `parseTerm` (a kind and ID, null for one the list doesn't take, left
 * out). A group joins any of its filters unless `all.` says otherwise.
 */
export function parseGroups<F extends FilterLike>(
  f: unknown,
  fm: unknown,
  parseTerm: (kind: string, id: string) => F | null,
): Filters<F> {
  if (typeof f !== 'string' || !f) return noFilters()
  return {
    join: fm === 'any' ? 'any' : 'all',
    groups: f.split(';').map((g) => {
      const all = g.startsWith('all.')
      const terms = (all ? g.slice(4) : g).split(',').flatMap((key): Negatable<F>[] => {
        const not = key.startsWith('!')
        const [kind = '', id = ''] = (not ? key.slice(1) : key).split(':')
        const term = parseTerm(kind, id)
        return term ? [not ? { ...term, not } : term] : []
      })
      return { join: all ? 'all' : 'any', terms }
    }),
  }
}

/** `filters` as `?f=` and `?fm=` take them, each undefined to leave it out. */
export function formatGroups(filters: Filters<FilterLike>): { f: string | undefined; fm: string | undefined } {
  const group = (g: FilterGroup<FilterLike>) =>
    (g.join === 'all' ? 'all.' : '') +
    g.terms.map((t) => ((t as Negatable<FilterLike>).not ? '!' : '') + filterKey(t)).join(',')
  return {
    f: filters.groups.map(group).join(';') || undefined,
    fm: filters.groups.length > 1 && filters.join === 'any' ? 'any' : undefined,
  }
}

/** `filters` with `filter` added to its last group (or a first one, joining `join`), unless that group has it. */
export function withFilter<F extends FilterLike>(filters: Filters<F>, filter: F, join: Join = 'any'): Filters<F> {
  const last = filters.groups.at(-1)
  if (!last) return { ...filters, groups: [{ join, terms: [filter] }] }
  if (last.terms.some((t) => sameFilter(t, filter))) return filters
  return { ...filters, groups: [...filters.groups.slice(0, -1), { ...last, terms: [...last.terms, filter] }] }
}

/** Every filter in `filters`. */
export const allFilters = <F extends FilterLike>(filters: Filters<F>) => filters.groups.flatMap((g) => g.terms)

/**
 * Whether an entry passes the filters (or there are none; empty groups don't count), `matches` testing each: null for
 * one it can't tell yet (what it needs is loading), which fails, negated or not.
 */
export function passesGroups<F extends FilterLike>(filters: Filters<F>, matches: (f: F) => boolean | null): boolean {
  const test = (f: Negatable<F>) => {
    const m = matches(f)
    return m !== null && m !== !!f.not
  }
  const joined = <T>(join: Join, items: T[], ok: (item: T) => boolean) =>
    join === 'all' ? items.every(ok) : items.some(ok)
  const groups = filters.groups.filter((g) => g.terms.length)
  return !groups.length || joined(filters.join, groups, (g) => joined(g.join, g.terms, test))
}
