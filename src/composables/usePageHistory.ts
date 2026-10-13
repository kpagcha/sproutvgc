import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import { isVisit, setupKey, type PageVisit } from '@/composables/useRecent'

// The setups a page whose setup can be starred (the speed tiers, the comparison) was at lately, most recent first, saved
// in this browser and listed at the top of the page itself (`PageHistory`): the home page's recently viewed keeps one
// per page (a comparison per pair), this one per setup. A setup (what the route's `meta.setup` keeps of the URL) is
// saved where a visit starts and where it ends, not as it changes between: a visit starts as the page is arrived at,
// as one of the setups listed is picked, or, on the comparison, as another matchup is (another of the home page's), and
// ends as the next starts, as the page is left or closed, or as there's nothing left worth keeping (reset, or yours
// taken away on the speed tiers: its route's `meta.history` says what's kept, the setup unless it says otherwise). A setup
// saved goes to the front, out of where it was. At most `LIMIT` per page. Imports nothing from the dex's data, as the
// router records them.

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

/** Moves a setup to the front of its page's. */
function put(visit: PageVisit) {
  const id = setupKey(visit)
  const list = pages.value[visit.page] ?? []
  if (list[0] && setupKey(list[0]) === id) return
  pages.value = { ...pages.value, [visit.page]: [visit, ...list.filter((v) => setupKey(v) !== id)].slice(0, LIMIT) }
  save()
}

/** Each page's setup now, while it's visited. */
const live = new Map<string, PageVisit>()
/** The pages whose next setup starts a visit. */
const starting = new Set<string>()

/** A page's visit ends: its setup now is saved. */
export function endVisit(page: string) {
  const visit = live.get(page)
  live.delete(page)
  if (visit) put(visit)
}

/** A visit to `page` starts (the one before ending): its next setup is saved. */
export function startVisit(page: string) {
  endVisit(page)
  starting.add(page)
}

/** A page's setup now: saved if its visit has just started. None worth keeping (empty) ends the visit. */
export function recordSetup(visit: PageVisit) {
  if (!Object.keys(visit.query).length) return startVisit(visit.page)
  live.set(visit.page, visit)
  if (starting.delete(visit.page)) put(visit)
}

// The tab closed or put away: what's visited saved as it is (and again as it's left, if it comes back).
window.addEventListener('pagehide', () => [...live.values()].forEach(put))
document.addEventListener('visibilitychange', () => document.hidden && [...live.values()].forEach(put))

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
