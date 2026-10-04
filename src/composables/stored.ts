import { ref, watch } from 'vue'

// A choice among `values`, saved under `key`.
export function stored<T extends string>(key: string, values: readonly T[]) {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(key)
  } catch {
    // Storage unavailable.
  }
  const choice = ref<T>(values.includes(saved as T) ? (saved as T) : values[0]!)
  watch(choice, (v) => {
    try {
      localStorage.setItem(key, v)
    } catch {
      // Storage unavailable: the choice lasts until the page is closed.
    }
  })
  return choice
}
