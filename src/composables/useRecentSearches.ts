import { shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Found } from '@/composables/useSearch'
import type { ItemId, PokemonId } from '@/data/dex'
import type { TypeId } from '@/data/types'

// The site's search's last results opened (the home page's), the latest first, at most `MAX`, offered as its box is
// focused empty, each opening again in a tap: what was opened, not what was typed. One opened again moves to the front
// rather than showing twice. Each as it was shown: its name, what it is (its category, or its area for a page), its
// icon, and where it leads, as a path.
const KEY = 'sproutvgc.search.recent.v2'
const MAX = 10

export type RecentIcon =
  { kind: 'pokemon'; id: PokemonId } | { kind: 'item'; id: ItemId } | { kind: 'type'; id: TypeId }
export interface RecentResult {
  /** Where it leads, a path with its query: also what tells two apart. */
  to: string
  name: string
  /** What it is: "Meta › Pokémon", "Moves", an area's name. */
  sub: string
  icon?: RecentIcon
}

const isResult = (x: unknown): x is RecentResult =>
  !!x &&
  typeof x === 'object' &&
  typeof (x as RecentResult).to === 'string' &&
  typeof (x as RecentResult).name === 'string' &&
  typeof (x as RecentResult).sub === 'string'

function saved(): RecentResult[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(isResult).slice(0, MAX) : []
  } catch {
    return []
  }
}
const searches = shallowRef<RecentResult[]>(saved())
watch(searches, (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable: they last until the page reloads.
  }
})

export function useRecentSearches() {
  function record(r: RecentResult) {
    searches.value = [r, ...searches.value.filter((x) => x.to !== r.to)].slice(0, MAX)
  }
  function remove(to: string) {
    searches.value = searches.value.filter((x) => x.to !== to)
  }
  function clear() {
    searches.value = []
  }
  return { searches, record, remove, clear }
}

/** Records a result opened, where it leads made a path (in a component's setup, for the router). */
export function useRememberFound() {
  const router = useRouter()
  const { record } = useRecentSearches()
  return (f: Found) => record({ ...f, to: router.resolve(f.to).fullPath })
}
