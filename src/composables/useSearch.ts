import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { availableIds, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { loadDescriptions } from '@/i18n/descriptions'
import { loadDexNames, refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'
import { useFavorites } from '@/composables/useFavorites'
import { AREAS } from '@/lib/areas'
import type { MetaData } from '@/data/meta'

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

/** A Pokémon's meta page found by its name: one in the meta snapshot shown, with its usage rank. */
export interface MetaHit extends Hit {
  rank: number
}

export interface SearchResults {
  pages: PageHit[]
  /** The meta pages, with their total: the section shows `LIMIT` and links to the rankings for the rest. */
  meta: { hits: MetaHit[]; more: number }
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
 * `pages`, the site's pages too; given the `meta` shown, the meta pages of its Pokémon.
 */
export function useSearch(
  query: () => string,
  kinds: readonly SectionKind[] = SECTIONS.map((s) => s.kind),
  { pages = false, meta }: { pages?: boolean; meta?: () => MetaData | null } = {},
) {
  const { isFavorite, isMetaFavorite } = useFavorites()
  /** The meta snapshot's Pokémon matching the folded query `q`: their starred meta entries first, then by usage. */
  function searchMeta(q: string): SearchResults['meta'] {
    const hits = Object.entries(meta?.() ?? {})
      .flatMap(([id, m]): MetaHit[] => {
        const name = refName({ kind: 'pokemon', id } as Ref)
        const parts = split(name, q)
        const to = { name: 'metaPokemon', params: { id } }
        return parts ? [{ id, name, parts, to, fav: isMetaFavorite(id), rank: m!.rank }] : []
      })
      .sort(byRelevance((a, b) => a.rank - b.rank))
    return { hits: hits.slice(0, LIMIT), more: Math.max(0, hits.length - LIMIT) }
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

  /** The only result, if the search has exactly one: Enter opens it. A Pokémon found as both its meta page and its
   * dex entry is one result, its meta page. */
  const only = computed((): RouteLocationRaw | null => {
    const r = results.value
    if (!r) return null
    const hits = r.sections.flatMap((s) => s.hits)
    const [m, ...others] = r.meta.hits
    if (m && (others.length || r.meta.more || r.pages.length || r.types.length)) return null
    if (m) {
      const dex = r.sections.find((s) => s.kind === 'pokemon')
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
