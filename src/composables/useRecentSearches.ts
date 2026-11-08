import { shallowRef, watch } from 'vue'

// The site's search's last searches (the home page's), the latest first, at most `MAX`, offered as its box is focused
// empty. A search counts once followed: a result opened from it, or Enter. The same words searched again move to the
// front rather than showing twice.
const KEY = 'sproutvgc.search.recent.v1'
const MAX = 10

function saved(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}
const searches = shallowRef<string[]>(saved())
watch(searches, (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable: they last until the page reloads.
  }
})

export function useRecentSearches() {
  function record(q: string) {
    const text = q.trim().replace(/\s+/g, ' ')
    if (!text) return
    const key = text.toLowerCase()
    searches.value = [text, ...searches.value.filter((x) => x.toLowerCase() !== key)].slice(0, MAX)
  }
  function remove(q: string) {
    searches.value = searches.value.filter((x) => x !== q)
  }
  function clear() {
    searches.value = []
  }
  return { searches, record, remove, clear }
}
