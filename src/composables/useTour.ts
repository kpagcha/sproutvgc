import { nextTick, onBeforeUnmount, onDeactivated, watch, type WatchSource } from 'vue'
import { driver, type Driver, type DriveStep, type Side } from 'driver.js'
import 'driver.js/dist/driver.css'
import { t, type MessageKey } from '@/i18n'

// A page's first-visit tour (driver.js): a few steps, each a popover over a part of the page, dismissable at any time,
// and not shown again once dismissed or finished (saved under `sproutvgc.tour.<page>`): the page's guide to reading it,
// taken again from the icon by its heading (`start`, `TourToggle`). A page that takes some learning can walk through an
// example (`example`): set up on the page before the steps are worked out (so they can point at what it fills in and
// name it), each popover tagged as one, and the reader's own setup put back once the tour ends, however it ends.

export interface TourStep {
  // What the step points at: the first of these selectors with an element on screen (so a step can point at yours'
  // card beside the ladder or at the bar that opens it, whichever the layout has). None: a popover in the middle.
  // Given but none on screen: the step is left out.
  el?: string | string[]
  title: MessageKey
  /** Its text, HTML (ours, so not escaped): paragraphs, the page's labels in `<strong>`, a choice's options in `<em>` (a `<ul>` of them where there are several to tell apart),
   * keys in `<kbd>`, a formula in `<p class="tour-formula">`. */
  text: MessageKey
  /** The text's placeholders. */
  params?: Record<string, string | number>
  side?: Side
  /** Pointed at as the step shows rather than as the tour starts, for a part that comes in on its own a moment later
   * (what's worked out of the example): the first of `el` on screen then, its last always there, the step left out
   * only when that one isn't. */
  late?: boolean
}

/** A tour's example: `enter` sets it up on the page (false when there's none to set up, the tour going on without it),
 * `leave` puts back what was there. */
export interface TourExample {
  enter: () => boolean | Promise<boolean>
  leave: () => void
}

const KEY = 'sproutvgc.tour.'

function seen(page: string): boolean {
  try {
    return localStorage.getItem(KEY + page) === '1'
  } catch {
    return false
  }
}

function markSeen(page: string) {
  try {
    localStorage.setItem(KEY + page, '1')
  } catch {
    // Not saved: it shows again next time.
  }
}

function shown(sel: string | string[]): Element | undefined {
  for (const s of Array.isArray(sel) ? sel : [sel]) {
    const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length > 0)
    if (el) return el
  }
}

// The page enters with a transition: started once it's done, so the highlight lands where the part ends up.
const SETTLE = 450

const frame = () => new Promise((r) => requestAnimationFrame(r))

export function useTour(
  page: string,
  steps: () => TourStep[],
  ready: WatchSource<boolean> = () => true,
  example?: TourExample,
) {
  let tour: Driver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  // Closed by the page going away rather than by the reader: not counted as dismissed.
  let leaving = false
  // The example on the page, to put back once the tour ends.
  let inExample = false
  // A start superseded by another (or by the page going away) while its example was being set up.
  let run = 0

  function leaveExample() {
    if (!inExample) return
    inExample = false
    example!.leave()
  }

  async function start() {
    stop()
    const id = ++run
    if (example && (await example.enter())) {
      inExample = true
      // Drawn, and laid out, before the steps look for their parts.
      await nextTick()
      await frame()
      await frame()
      if (id !== run) return leaveExample()
    }
    const tag = inExample ? `<p class="tour-tag">${t('tour.example')}</p>` : ''
    const list: DriveStep[] = []
    for (const s of steps()) {
      const sels = s.el ? (Array.isArray(s.el) ? s.el : [s.el]) : []
      const element = sels.length ? shown(s.late ? sels.at(-1)! : sels) : undefined
      if (sels.length && !element) continue
      list.push({
        element: s.late ? () => shown(sels) ?? shown(sels.at(-1)!) ?? element! : element,
        popover: { title: t(s.title), description: tag + t(s.text, s.params), side: s.side, align: 'start' },
      })
    }
    if (!list.length) return leaveExample()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    tour = driver({
      steps: list,
      animate: !reduced,
      // Scrolled to at once: scrolled smoothly, the popover is placed mid-scroll and then chases its part as it moves.
      smoothScroll: false,
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 0,
      popoverClass: 'tour',
      progressText: t('tour.progress', { current: '{{current}}', total: '{{total}}' }),
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      onDestroyed: () => {
        if (!leaving) markSeen(page)
        tour = undefined
        leaveExample()
      },
    })
    tour.drive()
  }

  function stop() {
    clearTimeout(timer)
    run++
    if (!tour) return leaveExample()
    leaving = true
    tour.destroy()
    leaving = false
  }

  // Once the page is ready (its data in), the first visit: the tour, after the page has settled.
  let armed = !seen(page)
  watch(
    ready,
    (r) => {
      if (!r || !armed) return
      armed = false
      timer = setTimeout(() => void start(), SETTLE)
    },
    { immediate: true },
  )

  onDeactivated(stop)
  onBeforeUnmount(stop)

  return { start: () => void start() }
}
