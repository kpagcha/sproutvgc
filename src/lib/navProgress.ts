import { shallowRef } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'

// Whether a page change is under way and slow enough to say so (`NavProgress`, a bar at the top of the window): from
// the click to the page being shown, while its code and the data it waits for load. Only past `DELAY`, so a page
// already loaded never flashes it.

/** How long a page change takes before the bar shows. */
const DELAY = 120

export const navPending = shallowRef(false)
let timer: ReturnType<typeof setTimeout> | undefined
/** The page change under way: one superseded by another ends with the other, not on its own. */
let current: RouteLocationNormalized | undefined

/** The router: a page change has started. */
export function navStarted(to: RouteLocationNormalized) {
  current = to
  clearTimeout(timer)
  timer = setTimeout(() => (navPending.value = true), DELAY)
}

/** The router: a page change has ended (shown, cancelled or failed); `to` unknown on an error. */
export function navEnded(to?: RouteLocationNormalized) {
  if (to && to !== current) return
  current = undefined
  clearTimeout(timer)
  navPending.value = false
}
