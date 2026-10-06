import { computed, ref } from 'vue'
import type { Kind, Ref } from '@/data/dex'

// The entries the reader has starred, saved in this browser. Kept as `refKey`s (`move:protect`), in the order they
// were starred. Entries the regulation no longer has stay saved, and show again if it brings them back. Imports
// nothing from the dex's data, so the router can check for favorites without loading it.

const KEY = 'sproutvgc.favorites.v1'

/** The categories that can be starred: those with an entry page of their own. */
const KINDS: readonly Kind[] = ['pokemon', 'move', 'ability', 'item', 'condition']

function parse(raw: string | null): string[] {
  try {
    const keys: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string' && toRef(k) !== null) : []
  } catch {
    return []
  }
}

function read(): string[] {
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return [] // Storage unavailable.
  }
}

const keys = ref<string[]>(read())

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
  const set = computed(() => new Set(keys.value))
  /** The starred entries, in the order they were starred. */
  const favorites = computed(() => keys.value.map((k) => toRef(k)!))
  const isFavorite = (ref: Ref) => set.value.has(keyOf(ref))
  const toggle = (ref: Ref) => {
    const key = keyOf(ref)
    keys.value = set.value.has(key) ? keys.value.filter((k) => k !== key) : [...keys.value, key]
    save()
  }
  /** Unstars everything, the entries the regulation doesn't have included. */
  const clear = () => {
    keys.value = []
    save()
  }
  return { favorites, isFavorite, toggle, clear }
}
