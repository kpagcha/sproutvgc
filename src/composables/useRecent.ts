import { computed, ref } from 'vue'
import type { Kind, Ref } from '@/data/dex'

// The entries the reader has opened lately, most recent first, saved in this browser (shown on the home page). Kept
// as `refKey`s (`move:protect`), at most `LIMIT` of them. Imports nothing from the dex's data, so the router can check
// for them without loading it.

const KEY = 'sproutvgc.recent.v1'
const LIMIT = 10

/** The categories with an entry page of their own, the only ones visited. */
const KINDS: readonly Kind[] = ['pokemon', 'move', 'ability', 'item', 'condition']

function toRef(key: string): Ref | null {
  const i = key.indexOf(':')
  const kind = key.slice(0, i) as Kind
  return i > 0 && KINDS.includes(kind) ? ({ kind, id: key.slice(i + 1) } as Ref) : null
}

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

/** Whether the reader has opened any entry. */
export const hasRecent = () => keys.value.length > 0

export function useRecent() {
  /** The entries opened lately, most recent first. */
  const recent = computed(() => keys.value.map((k) => toRef(k)!))
  /** Records a visit to `ref`'s page, moving it to the front. */
  const visit = (ref: Ref) => {
    const key = `${ref.kind}:${ref.id}`
    if (keys.value[0] === key) return
    keys.value = [key, ...keys.value.filter((k) => k !== key)].slice(0, LIMIT)
    save()
  }
  const clear = () => {
    keys.value = []
    save()
  }
  return { recent, visit, clear }
}
