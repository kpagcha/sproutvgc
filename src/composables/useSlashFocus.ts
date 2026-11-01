import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'

// "/" focuses a search, as on sites with one: the page's own, where it has one (`useSlashFocus`), else the site's
// (`useSlashSearch`, the fallback `App.vue` gives: the home page's box). Not while typing elsewhere, with a modifier,
// nor with a dialog over the page. A page's listens only while it's shown: a page kept when left (`KeepAlive`) stops
// while it's away.

type Focus = () => boolean | void
/** The pages' searches shown, the latest last: the one "/" focuses. */
const pages: Focus[] = []
let fallback: (() => void) | undefined

function onKey(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
  const el = document.activeElement
  if (el instanceof HTMLElement && (el.isContentEditable || el.closest('input, textarea, select'))) return
  if (document.documentElement.classList.contains('dialog-open')) return
  const page = pages.at(-1)
  // The page's search, unless it has none to focus right now (then the site's).
  if (page && page() !== false) return e.preventDefault()
  if (!fallback) return
  e.preventDefault()
  fallback()
}

/** The site's search, for "/" on a page with none of its own (`App.vue`). */
export function useSlashSearch(open: () => void) {
  onMounted(() => {
    fallback = open
    window.addEventListener('keydown', onKey)
  })
  onBeforeUnmount(() => {
    fallback = undefined
    window.removeEventListener('keydown', onKey)
  })
}

/** The page's search, for "/": `focus` focuses it, returning false when there's none to focus. */
export function useSlashFocus(focus: Focus) {
  const on = () => {
    if (!pages.includes(focus)) pages.push(focus)
  }
  const off = () => {
    const i = pages.indexOf(focus)
    if (i >= 0) pages.splice(i, 1)
  }
  onMounted(on)
  onActivated(on)
  onDeactivated(off)
  onBeforeUnmount(off)
}
