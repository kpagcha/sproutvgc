import { computed, ref } from 'vue'
import type { Kind, Ref } from '@/data/dex'
import type { PageVisit } from '@/composables/useRecent'

// The entries the reader has starred, saved in this browser, and the setups of pages whose view is in their URL (the
// speed tiers, a comparison): what the page's `meta.setup` keeps of it, reopening as it was saved. Entries are kept as
// `refKey`s (`move:protect`), setups as a `PageVisit`, its `page` the route's name; in the order they were starred. A
// setup is one favorite per page and query, so a page can have several. Entries the regulation no longer has stay
// saved, and show again if it brings them back. Imports nothing from the dex's data, so the router can check for
// favorites without loading it.

const KEY = 'sproutvgc.favorites.v1'

/** The categories that can be starred: those with an entry page of their own. */
const KINDS: readonly Kind[] = ['pokemon', 'move', 'ability', 'item', 'condition']

type Stored = string | PageVisit

const isSetup = (v: unknown): v is PageVisit =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as PageVisit).page === 'string' &&
  typeof (v as PageVisit).path === 'string' &&
  !!(v as PageVisit).query &&
  typeof (v as PageVisit).query === 'object' &&
  Object.values((v as PageVisit).query).every((q) => typeof q === 'string')

/** A setup's identity: its page and its query, whatever their order. */
const setupKey = (v: PageVisit) =>
  `${v.page}?${Object.entries(v.query)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, q]) => `${k}=${q}`)
    .join('&')}`
const identity = (s: Stored) => (typeof s === 'string' ? s : setupKey(s))

function parse(raw: string | null): Stored[] {
  try {
    const keys: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(keys)
      ? keys.filter((k): k is Stored => (typeof k === 'string' && toRef(k) !== null) || isSetup(k))
      : []
  } catch {
    return []
  }
}

function read(): Stored[] {
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return [] // Storage unavailable.
  }
}

const keys = ref<Stored[]>(read())

// Starring in another tab shows here too.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) keys.value = parse(e.newValue)
})

function save() {
  try {
    if (keys.value.length) localStorage.setItem(KEY, JSON.stringify(keys.value))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the favorites last for this page load.
  }
}

const keyOf = (ref: Ref) => `${ref.kind}:${ref.id}`

function toRef(key: string): Ref | null {
  const i = key.indexOf(':')
  const kind = key.slice(0, i) as Kind
  return i > 0 && KINDS.includes(kind) ? ({ kind, id: key.slice(i + 1) } as Ref) : null
}

/** Whether the reader has starred anything. */
export const hasFavorites = () => keys.value.length > 0

export function useFavorites() {
  const set = computed(() => new Set(keys.value.map(identity)))
  /** The starred entries, in the order they were starred. */
  const favorites = computed(() => keys.value.flatMap((k) => (typeof k === 'string' ? [toRef(k)!] : [])))
  /** The starred setups, in the order they were starred. */
  const setups = computed(() => keys.value.filter((k): k is PageVisit => typeof k !== 'string'))
  /** Stars or unstars something, by its identity. */
  const flip = (item: Stored) => {
    const id = identity(item)
    keys.value = set.value.has(id) ? keys.value.filter((k) => identity(k) !== id) : [...keys.value, item]
    save()
  }
  const isFavorite = (ref: Ref) => set.value.has(keyOf(ref))
  const toggle = (ref: Ref) => flip(keyOf(ref))
  const isSetupFavorite = (v: PageVisit) => set.value.has(setupKey(v))
  const toggleSetup = (v: PageVisit) => flip(v)
  /** Unstars everything, the entries the regulation doesn't have included. */
  const clear = () => {
    keys.value = []
    save()
  }
  return { favorites, setups, isFavorite, toggle, isSetupFavorite, toggleSetup, clear, count: () => keys.value.length }
}
