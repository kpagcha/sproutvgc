// Long work done a slice at a time, the page given a frame back between slices: the threats, and the damage calc read
// backwards.

/** How long a slice of the work runs before giving the page a frame back, in ms. */
const SLICE_MS = 6

/**
 * Runs a generator a slice at a time, each of its yields a step of `total`, `onProgress` told how far it's got (0 to 1)
 * and `onDone` given what it returns; the function it returns stops it (the inputs changed, or the page left), nothing
 * called after.
 */
export function runSliced<T>(
  steps: Generator<unknown, T>,
  total: number,
  onProgress: (done: number) => void,
  onDone: (result: T) => void,
): () => void {
  let done = 0
  let stopped = false
  const slice = () => {
    if (stopped) return
    const until = performance.now() + SLICE_MS
    while (performance.now() < until) {
      const next = steps.next()
      if (next.done) {
        channel.port1.close()
        return onDone(next.value)
      }
      done++
    }
    onProgress(Math.min(1, done / Math.max(1, total)))
    channel.port2.postMessage(0)
  }
  // The next slice as the next task, the page's input and drawing let in between: a message, not a timer, which the
  // browser holds back 4ms at a time once timers nest.
  const channel = new MessageChannel()
  channel.port1.onmessage = slice
  channel.port2.postMessage(0)
  return () => {
    stopped = true
    channel.port1.close()
  }
}
