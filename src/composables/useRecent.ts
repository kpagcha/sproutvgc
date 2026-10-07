import { computed, ref } from 'vue'
import type { Kind, Ref } from '@/data/dex'

// The entries and pages the reader has opened lately, most recent first, saved in this browser (shown on the home
// page), at most `LIMIT` of them. Entries are kept as `refKey`s (`move:protect`); pages whose view lives in their URL
// (the speed tiers, a comparison, the type matchups) as a `PageVisit`: one per `page`, which says what counts as the
// same visit (the speed tiers whatever's picked, a comparison per pair), with where it was left, so it reopens as it
// was. Imports nothing from the dex's data, so the router can check for them without loading it.

const KEY = 'sproutvgc.recent.v1'
const LIMIT = 12

/** A page visited: what makes it one visit, and where it was left (its path and query). */
export interface PageVisit {
  page: string
  path: string
  query: Record<string, string>
}

/** What the home page lists: an entry, or a page as it was left. */
export type RecentItem = { kind: 'entry'; ref: Ref } | ({ kind: 'page' } & PageVisit)

type Stored = string | PageVisit

const isVisit = (v: unknown): v is PageVisit =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as PageVisit).page === 'string' &&
  typeof (v as PageVisit).path === 'string' &&
  !!(v as PageVisit).query &&
  typeof (v as PageVisit).query === 'object' &&
  Object.values((v as PageVisit).query).every((q) => typeof q === 'string')

/** What makes two of them one visit. */
const identity = (s: Stored) => (typeof s === 'string' ? s : `page:${s.page}`)

/** The categories with an entry page of their own, the only ones visited. */
const KINDS: readonly Kind[] = ['pokemon', 'move', 'ability', 'item', 'condition']

function toRef(key: string): Ref | null {
  const i = key.indexOf(':')
  const kind = key.slice(0, i) as Kind
  return i > 0 && KINDS.includes(kind) ? ({ kind, id: key.slice(i + 1) } as Ref) : null
}

function parse(raw: string | null): Stored[] {
  try {
    const keys: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(keys)
      ? keys.filter((k): k is Stored => (typeof k === 'string' && toRef(k) !== null) || isVisit(k))
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

// Visits in another tab show here too.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) keys.value = parse(e.newValue)
})

function save() {
  try {
    if (keys.value.length) localStorage.setItem(KEY, JSON.stringify(keys.value))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the visits last for this page load.
  }
}

/** Moves a visit to the front, as it was left now. */
function put(item: Stored) {
  const id = identity(item)
  keys.value = [item, ...keys.value.filter((k) => identity(k) !== id)].slice(0, LIMIT)
  save()
}

/** Records a visit to a page, or where it's now left when it's the latest. */
export const visitPage = (visit: PageVisit) => put(visit)

/** Whether the reader has opened any entry or page. */
export const hasRecent = () => keys.value.length > 0

export function useRecent() {
  /** The entries and pages opened lately, most recent first. */
  const recent = computed(() =>
    keys.value.map((k): RecentItem =>
      typeof k === 'string' ? { kind: 'entry', ref: toRef(k)! } : { kind: 'page', ...k },
    ),
  )
  /** Records a visit to `ref`'s page, moving it to the front. */
  const visit = (ref: Ref) => {
    const key = `${ref.kind}:${ref.id}`
    if (keys.value[0] !== key) put(key)
  }
  const clear = () => {
    keys.value = []
    save()
  }
  return { recent, visit, clear }
}
