import { computed, ref, watch, type Ref } from 'vue'

/** The sort of each table given a `remember` name, kept for the session (until a reload). */
const remembered = new Map<string, { key: string; desc: boolean }>()

/**
 * Sorting a table by a column: `toggle(key)` sorts by it, and again reverses it. `value` reads a row's value for a
 * column; `startsDesc` says which columns sort biggest first (stats, power) rather than A to Z or 1 up. Rows that tie
 * keep their order. A table given `remember` keeps its sort when it's mounted again (phones don't keep pages alive,
 * so leaving one would otherwise reset it).
 */
export function useSort<R, K extends string>(opts: {
  rows: Ref<R[]>
  value: (row: R, key: K) => number | string
  initial: K
  startsDesc: (key: K) => boolean
  locale: Ref<string>
  remember?: string
}) {
  const saved = opts.remember ? remembered.get(opts.remember) : undefined
  const key = ref((saved?.key as K | undefined) ?? opts.initial) as Ref<K>
  const desc = ref(saved ? saved.desc : opts.startsDesc(opts.initial))
  if (opts.remember) {
    const name = opts.remember
    watch([key, desc], ([k, d]) => remembered.set(name, { key: k, desc: d }))
  }

  function toggle(k: K) {
    if (key.value === k) desc.value = !desc.value
    else {
      key.value = k
      desc.value = opts.startsDesc(k)
    }
  }

  const sorted = computed(() => {
    const dir = desc.value ? -1 : 1
    return opts.rows.value
      .map((row, i) => ({ row, i, v: opts.value(row, key.value) }))
      .sort((a, b) => {
        const c =
          typeof a.v === 'number' && typeof b.v === 'number'
            ? a.v - b.v
            : String(a.v).localeCompare(String(b.v), opts.locale.value)
        return c * dir || a.i - b.i
      })
      .map((x) => x.row)
  })

  return { key, desc, toggle, sorted }
}
