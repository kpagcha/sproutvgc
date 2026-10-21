// Filters in groups, for any list: each group joins its filters with "all" (AND) or "any" (OR), and the groups are
// joined the same way; any filter can be negated. Plainly (`isPlain`) they're one group, all of its filters to pass,
// none negated: what the search box's chips are (`FilterSearch`); the advanced mode shows the groups. They're kept in
// the URL:
//
//   ?f=type:fire,move:tailwind                         (plain: Fire and Tailwind)
//   ?f=any.type:fire,type:water;move:fakeout,!move:protect&fm=any
//   ?f=pokemon:incineroar~item:sitrusberry~move:fakeout     (an Incineroar holding Sitrus Berry, with Fake Out)
//
// `f` lists the groups, split by `;`, each its filters split by `,`: `any.` before a group's first filter joins any of
// them (they join all otherwise; `all.`, from when groups joined any by default, is still read), `!` before a filter
// negates it. `fm=any` joins the groups any (all otherwise). A filter can carry details after it, each after a `~`,
// that narrow what it matches (a Pokémon's on a team: its item, ability, moves). What a filter is, and which ones a
// list takes, details too, is the list's: it parses them (`parseTerm`) and tests them (`matches`).

/** A filter: a kind and an ID within it (a type, an ability, a move's tag…). */
export interface FilterLike {
  kind: string
  id: string
  /** What narrows it, the list's to say: a Pokémon's item, ability and moves, on the one Pokémon. */
  with?: readonly FilterLike[]
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

/** A filter's key in the URL: `kind:id`, each of its details after a `~`. */
export const filterKey = (f: FilterLike): string =>
  `${f.kind}:${f.id}` + (f.with ?? []).map((w) => `~${filterKey(w)}`).join('')
export const sameFilter = (a: FilterLike, b: FilterLike) => filterKey(a) === filterKey(b)

/**
 * The filters in `?f=` and `?fm=`, each read by `parseTerm` (a kind and ID, and the details after it; null for one the
 * list doesn't take, left out, as are repeats within a group and groups left empty). A group joins all of its filters
 * unless `any.` says otherwise.
 */
export function parseGroups<F extends FilterLike>(
  f: unknown,
  fm: unknown,
  parseTerm: (kind: string, id: string, details: FilterLike[]) => F | null,
): Filters<F> {
  if (typeof f !== 'string' || !f) return noFilters()
  const groups = f.split(';').flatMap((g): FilterGroup<F>[] => {
    const any = g.startsWith('any.')
    const body = any || g.startsWith('all.') ? g.slice(4) : g
    const terms: Negatable<F>[] = []
    for (const key of body.split(',')) {
      const not = key.startsWith('!')
      const [head = '', ...rest] = (not ? key.slice(1) : key).split('~')
      const pair = (k: string) => {
        const [kind = '', id = ''] = k.split(':')
        return { kind, id }
      }
      const { kind, id } = pair(head)
      const term = parseTerm(kind, id, rest.map(pair))
      if (term && !terms.some((x) => sameFilter(x, term))) terms.push(not ? { ...term, not } : term)
    }
    return terms.length ? [{ join: any ? 'any' : 'all', terms }] : []
  })
  return { join: fm === 'any' ? 'any' : 'all', groups }
}

/** `filters` as `?f=` and `?fm=` take them, each undefined to leave it out. */
export function formatGroups(filters: Filters<FilterLike>): { f: string | undefined; fm: string | undefined } {
  const group = (g: FilterGroup<FilterLike>) =>
    (g.join === 'any' && g.terms.length > 1 ? 'any.' : '') +
    g.terms.map((t) => ((t as Negatable<FilterLike>).not ? '!' : '') + filterKey(t)).join(',')
  const groups = filters.groups.filter((g) => g.terms.length)
  return {
    f: groups.map(group).join(';') || undefined,
    fm: groups.length > 1 && filters.join === 'any' ? 'any' : undefined,
  }
}

/** Whether `filters` are plain: one group at most, all of its filters to pass, none negated. */
export const isPlain = (filters: Filters<FilterLike>) =>
  filters.groups.length <= 1 &&
  filters.groups.every(
    (g) => (g.join === 'all' || g.terms.length < 2) && !g.terms.some((t) => (t as Negatable<FilterLike>).not),
  )

/** `filters` with `filter` added to group `i` (a new one, joining all, at the end when there's no such group), unless
 * that group has it. */
export function withFilterIn<F extends FilterLike>(filters: Filters<F>, i: number, filter: F): Filters<F> {
  const g = filters.groups[i]
  if (!g) return { ...filters, groups: [...filters.groups, { join: 'all', terms: [filter] }] }
  if (g.terms.some((t) => sameFilter(t, filter))) return filters
  const groups = filters.groups.slice()
  groups[i] = { ...g, terms: [...g.terms, filter] }
  return { ...filters, groups }
}

/** `filters` with `filter` added to its last group (or a first one), unless that group has it. */
export const withFilter = <F extends FilterLike>(filters: Filters<F>, filter: F): Filters<F> =>
  withFilterIn(filters, Math.max(0, filters.groups.length - 1), filter)

/** `filters` with a group of its own for `filter`, joined to the others. */
export const withGroup = <F extends FilterLike>(filters: Filters<F>, filter: F): Filters<F> =>
  withFilterIn(filters, filters.groups.length, filter)

/** `filters` with `filter` in place of `old`, wherever it is (`old` just going where its group has `filter` already). */
export function replaced<F extends FilterLike>(filters: Filters<F>, old: FilterLike, filter: Negatable<F>): Filters<F> {
  const groups = filters.groups.map((g) => {
    if (!g.terms.some((t) => sameFilter(t, old))) return g
    const has = g.terms.some((t) => sameFilter(t, filter))
    return { ...g, terms: g.terms.flatMap((t) => (!sameFilter(t, old) ? [t] : has ? [] : [filter])) }
  })
  return { ...filters, groups }
}

/** `filters` without the last filter of its last group (the group gone with it, left empty). */
export function withoutLast<F extends FilterLike>(filters: Filters<F>): Filters<F> {
  const last = filters.groups.at(-1)
  if (!last) return filters
  const terms = last.terms.slice(0, -1)
  const rest = filters.groups.slice(0, -1)
  return { ...filters, groups: terms.length ? [...rest, { ...last, terms }] : rest }
}

/** `filters` without `filter`, wherever it is (groups left empty gone). */
export function without<F extends FilterLike>(filters: Filters<F>, filter: FilterLike): Filters<F> {
  const groups = filters.groups
    .map((g) => ({ ...g, terms: g.terms.filter((t) => !sameFilter(t, filter)) }))
    .filter((g) => g.terms.length)
  return { ...filters, groups }
}

/** Every filter in `filters`. */
export const allFilters = <F extends FilterLike>(filters: Filters<F>) => filters.groups.flatMap((g) => g.terms)

/** The filters that narrow to what matches them: every one not negated. */
export const positiveFilters = <F extends FilterLike>(filters: Filters<F>) => allFilters(filters).filter((t) => !t.not)

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
