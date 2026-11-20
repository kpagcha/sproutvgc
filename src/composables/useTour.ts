import { nextTick, onBeforeUnmount, onDeactivated, watch, type WatchSource } from 'vue'
import { driver, type Driver, type DriveStep, type Side } from 'driver.js'
import 'driver.js/dist/driver.css'
import { t, type MessageKey } from '@/i18n'

// A page's first-visit tour (driver.js): a few steps, each a popover over a part of the page, dismissable at any time,
// and not shown again once dismissed or finished (saved under `sproutvgc.tour.<page>`): the page's guide to reading it,
// taken again from the icon by its heading (`start`, `TourToggle`). A page that takes some learning can walk through an
// example (`example`): the page set up as each step says (its `stage`, from the step itself or the nearest before it,
// so Back sets it up again too), before the steps are worked out and as each one shows, each popover tagged as one, and
// the reader's own setup put back once the tour ends, however it ends.

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
  /** In an example: the page as this step and those after it show it, set up before it shows. Its `el` is pointed at
   * once it's there (waited for a moment, for what comes in on its own: what's worked out), else the first of the
   * others there, else nothing (the popover in the middle). */
  stage?: () => void | Promise<void>
}

/** A tour's example: `enter` keeps what's on the page (false when there's no example to show, the tour going on
 * without it: the steps with no stage alone), `leave` puts it back. */
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
// A stage's part, waited for while what's worked out comes in.
const WAIT = 1500
async function waitFor(sel: string, ms: number) {
  const until = performance.now() + ms
  while (!shown(sel) && performance.now() < until) await new Promise((r) => setTimeout(r, 60))
}
const selsOf = (s: TourStep) => (s.el ? (Array.isArray(s.el) ? s.el : [s.el]) : [])

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

  // The part shown, made inert while it is.
  let locked: Element | undefined
  function lock(el: Element | undefined) {
    locked?.removeAttribute('inert')
    locked = el && !el.hasAttribute('inert') ? el : undefined
    locked?.setAttribute('inert', '')
  }

  function leaveExample() {
    if (!inExample) return
    inExample = false
    example!.leave()
  }

  async function start() {
    stop()
    const id = ++run
    if (example && (await example.enter())) inExample = true
    const all = steps()
    const staged = inExample ? all : all.filter((x) => !x.stage)
    // Each step's stage: its own, or the nearest before it.
    const stageOf: number[] = []
    staged.forEach((x, i) => stageOf.push(x.stage ? i : (stageOf[i - 1] ?? -1)))
    let applied = -1
    async function setUp(i: number) {
      const k = stageOf[i]!
      if (k >= 0 && k !== applied) {
        applied = k
        await staged[k]!.stage!()
        // Drawn, and laid out, before the step looks for its part.
        await nextTick()
        await frame()
        await frame()
      }
      // Its part waited for; one of the others there already (the phone's layout has another) is enough.
      const [first, ...rest] = selsOf(staged[i]!)
      if (first && inExample && !rest.some((x) => shown(x))) await waitFor(first, WAIT)
    }
    if (inExample) await setUp(0)
    if (id !== run) return leaveExample()
    const tag = inExample ? `<p class="tour-tag">${t('tour.example')}</p>` : ''
    const list: DriveStep[] = []
    for (const s of staged) {
      const sels = selsOf(s)
      const popover = {
        title: t(s.title),
        description: tag + t(s.text, s.params),
        side: s.side,
        align: 'start' as const,
      }
      // In an example, pointed at as it shows (the page set up for it then); else left out when not on screen.
      if (inExample) {
        list.push({ element: (() => shown(sels)) as () => Element, popover })
        continue
      }
      const element = sels.length ? shown(sels) : undefined
      if (sels.length && !element) continue
      list.push({ element, popover })
    }
    if (!list.length) return leaveExample()
    // Moving between steps, the page set up for the next first.
    // One at a time: Next or Back pressed again while the page is set up for the step is ignored.
    let busy = false
    const go = async (i: number) => {
      if (i < 0 || busy) return
      if (i >= list.length) return tour?.destroy()
      busy = true
      try {
        await setUp(i)
        if (id === run) tour?.moveTo(i)
      } finally {
        busy = false
      }
    }
    const index = () => tour?.getActiveIndex() ?? 0
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
      ...(inExample && {
        onNextClick: () => void go(index() + 1),
        onPrevClick: () => void go(index() - 1),
      }),
      // The page can't be used while the tour is on: the overlay takes the clicks around the part shown, and the part
      // itself is inert (no clicks, no keyboard focus), so nothing opens over or under the tour.
      disableActiveInteraction: true,
      onHighlightStarted: (el) => lock(el),
      onDeselected: () => lock(undefined),
      onDestroyed: () => {
        lock(undefined)
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
