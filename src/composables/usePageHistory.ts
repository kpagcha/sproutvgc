import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import { isVisit, setupKey, type PageVisit } from '@/composables/useRecent'

// The setups a page whose setup can be starred (the speed tiers, the comparison) was at lately, most recent first, saved
// in this browser and listed at the top of the page itself (`PageHistory`): the home page's recently viewed keeps one
// per page (a comparison per pair), this one per visit. What counts as one visit is the Pokémon it's of (its route's
// `meta.history`: the speed tiers' yours, or the Pokémon found; a comparison's matchup; the speed order, whatever its
// list): new ones, or the page arrived at, start one, at the front; its entry then follows the setup as it changes, in
// its place, saved as it goes. A setup picked from the list is visited where it is, rather than moved to the front, so
// the list keeps still under the reader. Nothing worth keeping (reset, yours taken away) ends the visit. At most
// `LIMIT` per page. Imports nothing from the dex's data, as the router records them.

const KEY = 'sproutvgc.pageHistory.v1'
const LIMIT = 9

type Stored = Record<string, PageVisit[]>

function parse(raw: string | null): Stored {
  try {
    const saved: unknown = raw ? JSON.parse(raw) : {}
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    return Object.fromEntries(
      Object.entries(saved).flatMap(([page, list]) =>
        Array.isArray(list) ? [[page, list.filter(isVisit).slice(0, LIMIT)]] : [],
      ),
    )
  } catch {
    return {}
  }
}

function read(): Stored {
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return {} // Storage unavailable.
  }
}

const pages = ref<Stored>(read())

// Visits in another tab show here too.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) pages.value = parse(e.newValue)
})

function save() {
  try {
    if (Object.keys(pages.value).length) localStorage.setItem(KEY, JSON.stringify(pages.value))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the visits last for this page load.
  }
}

/** The page's list as it was, then saved. */
function set(page: string, list: PageVisit[]) {
  pages.value = { ...pages.value, [page]: list.slice(0, LIMIT) }
  save()
}

/** Each page's visit now: what it's of, and its entry's setup. */
const live = new Map<string, { visit: string; key: string }>()
/** The pages whose next setup is one picked from their list. */
const picked = new Set<string>()

/** A page's visit ends (it's left, or another starts). */
export function endVisit(page: string) {
  live.delete(page)
}

/** The next setup of the page is one picked from its list: visited in its place. */
export function pickVisit(page: string) {
  picked.add(page)
}

/** A page's setup now, and what it's a visit of (none: nothing worth keeping, which ends the visit). A visit of other
 * Pokémon starts one at the front (or, picked from the list, where it is); the same visit's setup takes its entry's
 * place. */
export function recordSetup(visit: PageVisit, of: string | null) {
  const pick = picked.delete(visit.page)
  if (of === null) return endVisit(visit.page)
  const key = setupKey(visit)
  const now = live.get(visit.page)
  const list = pages.value[visit.page] ?? []
  // Where its entry is: the one picked, or the one this visit has been at so far.
  const was = pick ? key : now?.visit === of ? now.key : null
  const at = was === null ? -1 : list.findIndex((v) => setupKey(v) === was)
  live.set(visit.page, { visit: of, key })
  if (at < 0) {
    if (list[0] && setupKey(list[0]) === key) return
    return set(visit.page, [visit, ...list.filter((v) => setupKey(v) !== key)])
  }
  if (was === key) return
  set(
    visit.page,
    list.flatMap((v, i) => (i === at ? [visit] : setupKey(v) === key ? [] : [v])),
  )
}

/** A page's setups lately, most recent first, and whether each is `current` (the one shown now). */
export function usePageHistory(page: MaybeRefOrGetter<string>, current: MaybeRefOrGetter<PageVisit | null>) {
  const items = computed(() => {
    const now = toValue(current)
    const id = now && setupKey(now)
    return (pages.value[toValue(page)] ?? []).map((visit) => ({ visit, current: setupKey(visit) === id }))
  })
  const clear = () => {
    const rest = { ...pages.value }
    delete rest[toValue(page)]
    pages.value = rest
    save()
  }
  return { items, clear }
}
