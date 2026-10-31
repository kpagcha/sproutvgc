import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { available, availableIds, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { loadDescriptions } from '@/i18n/descriptions'
import { loadDexNames, refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'
import { useFavorites } from '@/composables/useFavorites'
import { AREAS } from '@/lib/areas'
import type { MetaData } from '@/data/meta'
import { ranksOf, usersOf, type UsageField } from '@/lib/entryUsage'

export type SectionKind = 'pokemon' | 'move' | 'ability' | 'item' | 'condition'

/** The dex's sections, in the order the home page shows them: their list page, and their entries' pages' route. */
export const SECTIONS: { kind: SectionKind; title: MessageKey; desc: MessageKey; list: string; route: string }[] = [
  { kind: 'pokemon', title: 'title.pokemon', desc: 'home.pokemonDesc', list: '/dex/pokemon', route: 'pokemon' },
  { kind: 'move', title: 'title.moves', desc: 'home.movesDesc', list: '/dex/moves', route: 'move' },
  { kind: 'ability', title: 'title.abilities', desc: 'home.abilitiesDesc', list: '/dex/abilities', route: 'ability' },
  { kind: 'item', title: 'title.items', desc: 'home.itemsDesc', list: '/dex/items', route: 'item' },
  {
    kind: 'condition',
    title: 'title.conditions',
    desc: 'home.conditionsDesc',
    list: '/dex/conditions',
    route: 'condition',
  },
]

/** Set by the header's Search link, for the home page to focus its search box (now, or once it mounts) and clear. */
export const searchFocus = ref(false)

/** A section shows this many results at most, and links to its list, searched the same way, for the rest. */
const LIMIT = 8

export interface Hit {
  id: string
  name: string
  parts: Marks
  to: RouteLocationRaw
  /** Whether the reader has starred it. */
  fav: boolean
}

/** A page of the site found by its name: an area's, or a section's (`src/lib/areas.ts`). */
export interface PageHit {
  key: string
  name: string
  parts: Marks
  to: RouteLocationRaw
  /** The area it's in, for a section's page. */
  area?: MessageKey
  soon?: boolean
}

/** A meta page found by its name: a Pokémon in the meta snapshot shown, or a move, ability or item its sets run, with
 * its usage rank. */
export interface MetaHit extends Hit {
  rank: number
}

export type MetaKind = 'pokemon' | 'move' | 'ability' | 'item'

/** The meta's categories, in the dex's order: their rankings, their entries' meta pages' route, and, but for the
 * Pokémon (ranked as they are), what of a Pokémon's sets their usage is counted from. */
const META_SECTIONS: { kind: MetaKind; title: MessageKey; list: string; route: string; field?: UsageField }[] = [
  { kind: 'pokemon', title: 'title.pokemon', list: 'rankings', route: 'metaPokemon' },
  { kind: 'move', title: 'title.moves', list: 'moveRankings', route: 'metaMove', field: 'moves' },
  { kind: 'ability', title: 'title.abilities', list: 'abilityRankings', route: 'metaAbility', field: 'abilities' },
  { kind: 'item', title: 'title.items', list: 'itemRankings', route: 'metaItem', field: 'items' },
]

/** Each category's entries in a snapshot's data, by ID, with their usage rank; worked out once per snapshot. */
const metaRanks = new WeakMap<MetaData, Map<MetaKind, Map<string, number>>>()
function ranksIn(d: MetaData) {
  let by = metaRanks.get(d)
  if (!by) {
    by = new Map(
      META_SECTIONS.map(({ kind, field }) => [
        kind,
        field ? ranksOf(usersOf(d, field)) : new Map(Object.entries(d).map(([id, m]) => [id, m!.rank])),
      ]),
    )
    metaRanks.set(d, by)
  }
  return by
}

export interface SearchResults {
  pages: PageHit[]
  /** The meta pages, by category (those without any left out), with their total: each shows `LIMIT` and links to its
   * rankings for the rest. */
  meta: ((typeof META_SECTIONS)[number] & { hits: MetaHit[]; more: number })[]
  types: { id: TypeId; parts: Marks }[]
  sections: ((typeof SECTIONS)[number] & { hits: Hit[]; more: number })[]
}

/** Loads what searching needs, in the background: every category's names and descriptions. */
export function preloadSearch() {
  void loadDexNames()
  void loadDescriptions(['ability', 'move', 'item', 'condition'])
}

/** The site's pages whose name (or, for a section, its page's longer title) matches the folded query `q`. */
function searchPages(q: string): PageHit[] {
  return AREAS.flatMap((a) => {
    const own = split(t(a.label), q)
    const area: PageHit[] = own ? [{ key: a.id, name: t(a.label), parts: own, to: { name: a.route } }] : []
    const sections = a.sections.flatMap((s): PageHit[] => {
      const names = [t(s.label), ...(s.title ? [t(s.title)] : [])]
      for (const name of names) {
        const parts = split(name, q)
        if (parts) return [{ key: `${a.id}.${s.key}`, name, parts, to: { name: s.route }, area: a.label, soon: s.soon }]
      }
      return []
    })
    return [...area, ...sections]
  })
}

/** The order hits show in: the reader's favorites first, then names starting with the search, then `rest`. */
const byRelevance =
  <H extends Hit>(rest: (a: H, b: H) => number) =>
  (a: H, b: H) =>
    +b.fav - +a.fav || +!!a.parts[0] - +!!b.parts[0] || rest(a, b)

/**
 * The dex searched by name in the reader's language, as the home and search pages do it: types, and `kinds`; with
 * `pages`, the site's pages too; given the `meta` shown, the meta pages of its Pokémon and of the moves, abilities and
 * items their sets run.
 */
export function useSearch(
  query: () => string,
  kinds: readonly SectionKind[] = SECTIONS.map((s) => s.kind),
  { pages = false, meta }: { pages?: boolean; meta?: () => MetaData | null } = {},
) {
  const { isFavorite, isMetaFavorite } = useFavorites()
  /** The meta snapshot's entries matching the folded query `q`, by category: the starred Pokémon meta entries first,
   * then by usage. */
  function searchMeta(q: string): SearchResults['meta'] {
    const d = meta?.()
    if (!d) return []
    const ranks = ranksIn(d)
    return META_SECTIONS.map((section) => {
      const hits = [...ranks.get(section.kind)!]
        .flatMap(([id, rank]): MetaHit[] => {
          const ref = { kind: section.kind, id } as Ref
          if (!available(ref)) return []
          const name = refName(ref)
          const parts = split(name, q)
          const to = { name: section.route, params: { id } }
          const fav = section.kind === 'pokemon' && isMetaFavorite(id)
          return parts ? [{ id, name, parts, to, fav, rank }] : []
        })
        .sort(byRelevance((a, b) => a.rank - b.rank))
      return { ...section, hits: hits.slice(0, LIMIT), more: Math.max(0, hits.length - LIMIT) }
    }).filter((s) => s.hits.length)
  }
  /** Each category's entries matching the search; categories without any left out. */
  const results = computed((): SearchResults | null => {
    const q = fold(query().trim())
    if (!q) return null
    const types = TYPES.flatMap((id) => {
      const parts = split(typeName(id), q)
      return parts ? [{ id, parts }] : []
    })
    // The reader's favorites first, then names starting with the search, then the rest, each alphabetically. Pokémon
    // formes that only look different are left to their species.
    const sections = SECTIONS.filter((s) => kinds.includes(s.kind))
      .map((section) => {
        const ids: string[] = availableIds(section.kind)
        const hits = ids
          .filter((id) => section.kind !== 'pokemon' || !POKEMON[id as PokemonId].cosmetic)
          .flatMap((id): Hit[] => {
            const ref = { kind: section.kind, id } as Ref
            const name = refName(ref)
            const parts = split(name, q)
            return parts ? [{ id, name, parts, to: { name: section.route, params: { id } }, fav: isFavorite(ref) }] : []
          })
          .sort(byRelevance((a, b) => a.name.localeCompare(b.name, locale.value)))
        return { ...section, hits: hits.slice(0, LIMIT), more: Math.max(0, hits.length - LIMIT) }
      })
      .filter((s) => s.hits.length)
    return { pages: pages ? searchPages(q) : [], meta: searchMeta(q), types, sections }
  })

  /** The only result, if the search has exactly one: Enter opens it. An entry found as both its meta page and its
   * dex entry is one result, its meta page. */
  const only = computed((): RouteLocationRaw | null => {
    const r = results.value
    if (!r) return null
    const hits = r.sections.flatMap((s) => s.hits)
    const [found, ...others] = r.meta
    if (found && (others.length || found.hits.length > 1 || found.more || r.pages.length || r.types.length)) return null
    if (found) {
      const m = found.hits[0]!
      const dex = r.sections.find((s) => s.kind === found.kind)
      const same = hits.length === 1 && dex?.hits[0]?.id === m.id && !dex.more
      return hits.length && !same ? null : m.to
    }
    if (r.pages.length === 1 && !r.types.length && !hits.length) return r.pages[0]!.to
    if (r.pages.length) return null
    if (r.types.length === 1 && !hits.length) return `/dex/types/${r.types[0]!.id}`
    if (hits.length === 1 && !r.types.length && !r.sections[0]!.more) return hits[0]!.to
    return null
  })

  return { results, only }
}
