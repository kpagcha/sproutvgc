import type { Transition } from 'motion-v'

// Shared timings so every animation in the app feels like one system.

/** Things that move or swap places: snappy, no visible bounce. */
const STIFFNESS = 520
const DAMPING = 40
export const SPRING: Transition = { type: 'spring', stiffness: STIFFNESS, damping: DAMPING }

/**
 * `SPRING` for the Web Animations API, for animations that must stay smooth while the page renders (a transform
 * animated by the browser runs off the main thread; motion's springs run on it): its duration, and its curve as a
 * `linear()` easing, from a simulation of the spring (unit mass) until it settles.
 */
export const SPRING_WAAPI: { duration: number; easing: string } = (() => {
  const dt = 1 / 1000
  const points: number[] = []
  let x = 0
  let v = 0
  for (let t = 0; t < 2 && (t < 0.05 || Math.abs(1 - x) > 0.001 || Math.abs(v) > 0.01); t += dt) {
    points.push(x)
    v += (STIFFNESS * (1 - x) - DAMPING * v) * dt
    x += v * dt
  }
  points.push(1)
  const step = Math.ceil(points.length / 40)
  const curve = points.filter((_, i) => i % step === 0 || i === points.length - 1).map((p) => +p.toFixed(4))
  return { duration: points.length, easing: `linear(${curve.join(', ')})` }
})()

/** Things that appear or disappear. */
export const FADE: Transition = { duration: 0.16, ease: 'easeOut' }

/** Page changes: a quick slide that settles gently, with no bounce. */
export const PAGE: Transition = { duration: 0.32, ease: [0.32, 0.72, 0, 1] }

/** Scrolling new content into view: same curve as page changes, a little longer to cover the distance. */
export const SCROLL: Transition = { duration: 0.5, ease: [0.32, 0.72, 0, 1] }

/** Press feedback for tappable items. */
export const PRESS = { scale: 0.95 }
