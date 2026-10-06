import { ref } from 'vue'

/**
 * A section's open state, remembered under `key` (`initially` until the reader opens or closes it; open by default):
 * for a <details>, bind `open` and `@toggle="onToggle"`; for a button, call `toggle`.
 */
export function useOpenState(key: string, initially = true) {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(key)
  } catch {
    // Storage unavailable: open.
  }
  const open = ref(saved === null ? initially : saved !== '0')
  function set(value: boolean) {
    open.value = value
    try {
      localStorage.setItem(key, value ? '1' : '0')
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  }
  function onToggle(e: Event) {
    set((e.target as HTMLDetailsElement).open)
  }
  function toggle() {
    set(!open.value)
  }
  return { open, onToggle, toggle }
}
