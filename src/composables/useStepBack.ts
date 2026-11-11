import { computed, shallowRef, watch, type ShallowRef } from 'vue'

/**
 * The way back through a drawer's steps (`state`, the step shown, `null` closed): each step it moves on from is kept,
 * and `back` shows the one before again. Opened afresh, or on another subject (`subject`: the slot or side picked
 * for), it starts over; closed, its last step is kept for `reopen`,
 * which shows it again with the steps before it (a flow going on past it in the same drawer coming back to it).
 */
export function useStepBack<T extends object>(state: ShallowRef<T | null>, subject: (s: T) => unknown = () => null) {
  const stack = shallowRef<T[]>([])
  let last: T | null = null
  let restoring = false
  watch(state, (now, before) => {
    if (restoring) return void (restoring = false)
    if (!now) return void (last = before)
    stack.value = before && subject(before) === subject(now) ? [...stack.value, before] : []
  })
  const canBack = computed(() => stack.value.length > 0)
  function back() {
    const prev = stack.value.at(-1)
    if (!prev) return
    restoring = true
    stack.value = stack.value.slice(0, -1)
    state.value = prev
  }
  const canReopen = () => !!last
  function reopen() {
    if (!last) return
    restoring = true
    state.value = last
  }
  return { canBack, back, canReopen, reopen }
}
