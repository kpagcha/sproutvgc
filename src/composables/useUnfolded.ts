import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'

// The folded lists the reader has unfolded (those showing their first few until asked for the rest: `MoreToggle`'s, a
// meta page's movepool, a tournament's Day 1), by a key naming the list and what it's of. Kept for the visit alone, in
// memory, not saved: a list unfolded is still unfolded coming back to its page (following a link from it and going
// back), but not after a reload.
const unfolded = reactive(new Set<string>())

/** Whether the list `key` names is unfolded, written to fold or unfold it. */
export function useUnfolded(key: MaybeRefOrGetter<string>) {
  return computed({
    get: () => unfolded.has(toValue(key)),
    set: (on: boolean) => void (on ? unfolded.add(toValue(key)) : unfolded.delete(toValue(key))),
  })
}
