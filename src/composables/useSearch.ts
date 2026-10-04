import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { locale, typeName, type MessageKey } from '@/i18n'
import { availableIds, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { loadDescriptions } from '@/i18n/descriptions'
import { loadDexNames, refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'

export type SectionKind = 'pokemon' | 'move' | 'ability' | 'item' | 'condition'

/** The dex's sections, in the order the home page shows them: their list page, and their entries' pages' route. */
export const SECTIONS: { kind: SectionKind; title: MessageKey; desc: MessageKey; list: string; route: string }[] = [
  { kind: 'pokemon', title: 'title.pokemon', desc: 'home.pokemonDesc', list: '/pokemon', route: 'pokemon' },
  { kind: 'move', title: 'title.moves', desc: 'home.movesDesc', list: '/moves', route: 'move' },
  { kind: 'ability', title: 'title.abilities', desc: 'home.abilitiesDesc', list: '/abilities', route: 'ability' },
  { kind: 'item', title: 'title.items', desc: 'home.itemsDesc', list: '/items', route: 'item' },
  {
    kind: 'condition',
    title: 'title.conditions',
    desc: 'home.conditionsDesc',
    list: '/conditions',
    route: 'condition',
  },
]

/** A section shows this many results at most, and links to its list, searched the same way, for the rest. */
const LIMIT = 8

export interface Hit {
  id: string
  name: string
  parts: [string, string, string]
  to: RouteLocationRaw
}

export interface SearchResults {
  types: { id: TypeId; parts: [string, string, string] }[]
  sections: ((typeof SECTIONS)[number] & { hits: Hit[]; more: number })[]
}

/** Loads what searching needs, in the background: every category's names and descriptions. */
export function preloadSearch() {
  void loadDexNames()
  void loadDescriptions(['ability', 'move', 'item', 'condition'])
}

/** The dex searched by name in the reader's language, as the home and search pages do it: types, and `kinds`. */
export function useSearch(query: () => string, kinds: readonly SectionKind[] = SECTIONS.map((s) => s.kind)) {
  /** Each category's entries matching the search; categories without any left out. */
  const results = computed((): SearchResults | null => {
    const q = fold(query().trim())
    if (!q) return null
    const types = TYPES.flatMap((id) => {
      const parts = split(typeName(id), q)
      return parts ? [{ id, parts }] : []
    })
    // Names starting with the search first, then the rest, each alphabetically. Pokémon formes that only look
    // different are left to their species.
    const sections = SECTIONS.filter((s) => kinds.includes(s.kind))
      .map((section) => {
        const ids: string[] = availableIds(section.kind)
        const hits = ids
          .filter((id) => section.kind !== 'pokemon' || !POKEMON[id as PokemonId].cosmetic)
          .flatMap((id): Hit[] => {
            const name = refName({ kind: section.kind, id } as Ref)
            const parts = split(name, q)
            return parts ? [{ id, name, parts, to: { name: section.route, params: { id } } }] : []
          })
          .sort((a, b) => +!!a.parts[0] - +!!b.parts[0] || a.name.localeCompare(b.name, locale.value))
        return { ...section, hits: hits.slice(0, LIMIT), more: Math.max(0, hits.length - LIMIT) }
      })
      .filter((s) => s.hits.length)
    return { types, sections }
  })

  /** The only result, if the search has exactly one: Enter opens it. */
  const only = computed((): RouteLocationRaw | null => {
    const r = results.value
    if (!r) return null
    const hits = r.sections.flatMap((s) => s.hits)
    if (r.types.length === 1 && !hits.length) return `/types/${r.types[0]!.id}`
    if (hits.length === 1 && !r.types.length && !r.sections[0]!.more) return hits[0]!.to
    return null
  })

  return { results, only }
}
