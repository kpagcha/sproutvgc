import { animate } from 'motion-v'
import { SCROLL } from '@/lib/motion'

/** Space kept between the revealed content and the screen's edge. */
const MARGIN = 12

let running: { stop(): void } | null = null

/**
 * The room bars stuck to the top of the screen take (the speed tiers' bar of yours): what's brought into view goes
 * under them, not behind. A page marks such a bar with `data-top-bar` (sticky, or in something sticky); one hidden
 * takes none.
 */
function topInset(): number {
  let inset = 0
  for (const el of document.querySelectorAll<HTMLElement>('[data-top-bar]')) {
    if (!el.offsetParent) continue
    // Where it sticks: its own `top`, or that of what it's in that sticks (a bar under another).
    let at = 0
    for (let s: HTMLElement | null = el; s && s !== document.body; s = s.parentElement) {
      const style = getComputedStyle(s)
      if (style.position === 'sticky') {
        at = parseFloat(style.top) || 0
        break
      }
    }
    inset = Math.max(inset, at + el.offsetHeight)
  }
  return inset
}

function stop() {
  running?.stop()
  running = null
}

/**
 * Smoothly scrolls the page by the least amount that brings `from`'s top through `to`'s bottom into view. When
 * that's taller than the screen, the top wins. Does nothing if it's already in view; the user scrolling or touching
 * the screen takes over.
 */
export function reveal(from: Element | null | undefined, to: Element | null | undefined = from) {
  if (!from || !to) return
  const top = from.getBoundingClientRect().top
  const bottom = to.getBoundingClientRect().bottom
  const vh = window.innerHeight
  const edge = MARGIN + topInset()
  let delta = 0
  if (top < edge) delta = top - edge
  else if (bottom > vh - MARGIN) delta = Math.min(bottom - vh + MARGIN, top - edge)
  scrollToY(window.scrollY + delta)
}

/**
 * Smoothly scrolls the page by the least amount that brings `el` into view under `edge` (how far down the screen what's
 * stuck over it reaches); when it's taller than the room, its top wins. The user scrolling or touching the screen
 * takes over.
 */
export function revealBelow(el: Element | null | undefined, edge: number) {
  if (!el) return
  const r = el.getBoundingClientRect()
  let delta = 0
  if (r.top < edge) delta = r.top - edge
  else if (r.bottom > window.innerHeight - MARGIN)
    delta = Math.min(r.bottom - window.innerHeight + MARGIN, r.top - edge)
  scrollToY(window.scrollY + delta)
}

/** Smoothly scrolls the page to bring `el` to the middle of the screen (under any bar stuck to its top); the user
 * scrolling or touching it takes over. */
export function center(el: Element | null | undefined) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const inset = topInset()
  scrollToY(window.scrollY + r.top + r.height / 2 - (inset + (window.innerHeight - inset) / 2))
}

/** Smoothly scrolls the page to bring `el`'s top to the top of the screen (under any bar stuck to it); the user
 * scrolling or touching it takes over. */
export function toTopOf(el: Element | null | undefined) {
  if (!el) return
  const top = el.getBoundingClientRect().top - topInset()
  if (Math.abs(top - MARGIN) > 8) scrollToY(window.scrollY + top - MARGIN)
}

/** Smoothly scrolls to the top of the page; the user scrolling or touching the screen takes over. */
export function toTop() {
  scrollToY(0)
}

function scrollToY(y: number) {
  const start = window.scrollY
  const max = document.documentElement.scrollHeight - window.innerHeight
  const target = Math.max(0, Math.min(max, y))
  if (Math.abs(target - start) < 1) return

  stop()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, target)
    return
  }
  running = animate(start, target, { ...SCROLL, onUpdate: (y) => window.scrollTo(0, y) })
  const opts = { passive: true, once: true }
  window.addEventListener('wheel', stop, opts)
  window.addEventListener('touchstart', stop, opts)
}

let holding = 0
let held = 0
/**
 * Keeps the page where it is while a list unfolds under what's on screen (`MoreToggle`): the browser's scroll anchoring
 * off until the page stops growing (it may draw the rows a chunk a frame, `useGradualRows`). Otherwise, with the toggle
 * the first thing on screen, the browser keeps the toggle where it was, scrolling the page down by all it unfolded.
 */
export function holdScroll() {
  const root = document.documentElement
  root.style.overflowAnchor = 'none'
  cancelAnimationFrame(holding)
  let height = -1
  held = 0
  const check = () => {
    const now = root.scrollHeight
    held = now === height ? held + 1 : 0
    height = now
    if (held < 3) holding = requestAnimationFrame(check)
    else root.style.overflowAnchor = ''
  }
  holding = requestAnimationFrame(check)
}
