import { ref } from 'vue'

/**
 * A <details>' open state, remembered under `key` (open unless closed): bind `open` and `@toggle="onToggle"`.
 */
export function useOpenState(key: string) {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(key)
  } catch {
    // Storage unavailable: open.
  }
  const open = ref(saved !== '0')
  function onToggle(e: Event) {
    open.value = (e.target as HTMLDetailsElement).open
    try {
      localStorage.setItem(key, open.value ? '1' : '0')
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  }
  return { open, onToggle }
}
