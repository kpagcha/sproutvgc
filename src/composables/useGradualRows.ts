import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'

/** Rows added at once: about a screen of them first, then as many a frame. */
const CHUNK = 30

// A long list's rows as they're drawn: when it grows by many at once (its search cleared, a filter taken off), the
// first screen of them now and the rest a chunk a frame, rather than all in one long frame that stalls the typing.
// Shrinking, or growing by a few, is drawn at once. Going back, forward or reloading (as `usePageEntered`'s
// `restoring`), the first rows are drawn in full, for the scroll position the router restores.
export function useGradualRows<T>(list: Readonly<Ref<readonly T[]>>) {
  const limit = shallowRef(Infinity)
  let frame = 0
  let instant = Boolean(window.history.state?.scroll)
  const grow = () => {
    frame = requestAnimationFrame(() => {
      limit.value += CHUNK
      if (limit.value < list.value.length) grow()
      else limit.value = Infinity
    })
  }
  watch(list, (now, before) => {
    cancelAnimationFrame(frame)
    limit.value = Infinity
    if (instant) {
      if (now.length) instant = false
      return
    }
    if (now.length - (before?.length ?? 0) > CHUNK) {
      limit.value = CHUNK
      grow()
    }
  })
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return computed(() => (limit.value < list.value.length ? list.value.slice(0, limit.value) : list.value))
}
