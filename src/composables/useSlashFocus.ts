import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'

// "/" focuses the page's search, as on sites with one: `focus` does it, returning false when there's none to focus
// (then the key goes on as typed). Not while typing elsewhere, with a modifier, nor with a dialog over the page. Listens
// only while the page is shown: a page kept when left (`KeepAlive`) stops while it's away.
export function useSlashFocus(focus: () => boolean | void) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
    const el = document.activeElement
    if (el instanceof HTMLElement && (el.isContentEditable || el.closest('input, textarea, select'))) return
    if (document.documentElement.classList.contains('dialog-open')) return
    if (focus() === false) return
    e.preventDefault()
  }
  const on = () => window.addEventListener('keydown', onKey)
  const off = () => window.removeEventListener('keydown', onKey)
  onMounted(on)
  onActivated(on)
  onDeactivated(off)
  onBeforeUnmount(off)
}
