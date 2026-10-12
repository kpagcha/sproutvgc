import { onBeforeUnmount, onDeactivated, watch, type WatchSource } from 'vue'
import { driver, type Driver, type DriveStep, type Side } from 'driver.js'
import 'driver.js/dist/driver.css'
import { t, type MessageKey } from '@/i18n'

// A page's first-visit tour (driver.js): a few steps, each a popover over a part of the page, dismissable at any time,
// and not shown again once dismissed or finished (saved under `sproutvgc.tour.<page>`). The page's help can start it
// again (`start`).

export interface TourStep {
  // What the step points at: the first of these selectors with an element on screen (so a step can point at yours'
  // card beside the ladder or at the bar that opens it, whichever the layout has). None: a popover in the middle.
  // Given but none on screen: the step is left out.
  el?: string | string[]
  title: MessageKey
  text: MessageKey
  side?: Side
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

export function useTour(page: string, steps: () => TourStep[], ready: WatchSource<boolean> = () => true) {
  let tour: Driver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  // Closed by the page going away rather than by the reader: not counted as dismissed.
  let leaving = false

  function start() {
    stop()
    const list: DriveStep[] = []
    for (const s of steps()) {
      const element = s.el ? shown(s.el) : undefined
      if (s.el && !element) continue
      list.push({
        element,
        popover: { title: t(s.title), description: t(s.text), side: s.side, align: 'start' },
      })
    }
    if (!list.length) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    tour = driver({
      steps: list,
      animate: !reduced,
      smoothScroll: !reduced,
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
      },
    })
    tour.drive()
  }

  function stop() {
    clearTimeout(timer)
    if (!tour) return
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
      timer = setTimeout(start, SETTLE)
    },
    { immediate: true },
  )

  onDeactivated(stop)
  onBeforeUnmount(stop)

  return { start }
}
