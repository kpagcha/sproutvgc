import type { RouteLocationNormalizedLoaded } from 'vue-router'

// Where the page transition (App.vue) and the router's scrolling meet. On desktop the leaving page goes before the next
// one mounts (at once, with no fade of its own, so the next one isn't kept waiting), and scrolling waits for it: a saved
// position (going back) can't be restored on a page that isn't there yet. On phones the two pages slide side by side,
// the next one mounted from the start, so nothing waits.

let waits = false
let exited: (() => void) | undefined

/** App.vue: whether page changes wait for the leaving page to go. */
export function setPageWaits(value: boolean) {
  waits = value
}

/** App.vue: the leaving page is gone. */
export function pageExited() {
  exited?.()
}

/** Resolves once the leaving page is gone (or after a second, should it never say so), or at once when nothing waits. */
export function afterPageExit(): Promise<void> {
  exited?.()
  if (!waits) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      exited = undefined
      resolve()
    }
    const timer = setTimeout(done, 1000)
    exited = done
  })
}

// And the page coming in: pages that are slow to render (the dex tables) show a skeleton until it has, so that their
// rendering doesn't stall the transition, nor the header's nav pill sliding over at the same time.

/** The page a route shows: keyed by its route rather than its URL, so query and param changes don't make a new one. */
export const pageKey = (r: RouteLocationNormalizedLoaded) => r.matched[0]?.path ?? r.path

let entering = false
const entered: (() => void)[] = []

/** App.vue: a new page is on its way in. */
export function pageEntering() {
  entering = true
}

/** App.vue: the new page is in place. */
export function pageEntered() {
  entering = false
  for (const done of entered.splice(0)) done()
}

/** Resolves once the page coming in is in place (or after a second, should it never say so), or at once if none is.
 * On desktop, where it only fades in (`opacity` and `transform`, which the browser animates off the main thread, so a
 * page rendering doesn't stall it), as soon as its first frame (its skeleton) is painted: its fade needn't be waited
 * for. Phones' pages slide a whole screen, and still wait for it. */
export function afterPageEnter(): Promise<void> {
  if (!entering) return Promise.resolve()
  if (waits) return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000)
    entered.push(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}
