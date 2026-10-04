import { onBeforeUnmount, watch, type ShallowRef } from 'vue'

// A dex table's columns for its rows (see `.dex-table` in main.css): the header row sizes its own (from `--cols`, to
// fit its labels), and the rows take the widths it resolves to, as `--row-cols` on the table. Each row is then a grid
// of fixed columns, laid out on its own, which lets the browser skip the rows off screen. They follow the header as it
// changes size (resizing, the language), and take its widths as soon as it's there: rows laid out without them would
// size their columns each to their own content, and going back to the page, the scroll position would be restored
// over rows about to change height.
export function useRowColumns(head: Readonly<ShallowRef<HTMLElement | null>>) {
  let observer: ResizeObserver | undefined
  const update = (el: HTMLElement) =>
    el.parentElement?.style.setProperty('--row-cols', getComputedStyle(el).gridTemplateColumns)
  watch(
    head,
    (el) => {
      observer?.disconnect()
      if (!el) return
      update(el)
      observer = new ResizeObserver(() => update(el))
      observer.observe(el)
      for (const cell of el.children) observer.observe(cell)
    },
    { flush: 'post' },
  )
  onBeforeUnmount(() => observer?.disconnect())
}
