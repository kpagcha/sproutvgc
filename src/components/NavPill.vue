<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { SPRING_WAAPI } from '@/lib/motion'

// The header's active highlight: one element, behind the links, that slides from the link it was on to the new one.
// Not a motion `layout-id`, whose animation runs on the main thread and stalls while the next page renders: this one
// animates a transform with the Web Animations API, which the browser runs on its own. It finds the active link itself
// (`.active`, among the nav's links and the section dropdown's button) whenever `section` changes, and keeps to it as
// the nav's layout changes (resizing, folding up, the language, fonts loading).
const props = defineProps<{ section: string | null; compact: boolean }>()

const pill = useTemplateRef('pill')
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

type Box = { left: number; top: number; width: number; height: number }
const LINKS = ':scope > a.active, :scope > .section-menu > .toggle.active'

// An element's box in the nav's coordinates (the nav scrolls sideways when the links don't fit).
function boxOf(el: Element, nav: HTMLElement): Box {
  const n = nav.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { left: r.left - n.left + nav.scrollLeft, top: r.top - n.top, width: r.width, height: r.height }
}

function place(animate: boolean) {
  const el = pill.value
  const nav = el?.parentElement
  if (!el || !nav) return
  const link = nav.querySelector(LINKS)
  // Where it is now, mid-slide or not, to slide from.
  const from = animate && el.style.display !== 'none' && el.style.width ? boxOf(el, nav) : null
  if (!link) {
    el.style.display = 'none'
    return
  }
  const to = boxOf(link, nav)
  if (!animate && el.getAnimations().length) return
  el.getAnimations().forEach((a) => a.cancel())
  Object.assign(el.style, {
    display: '',
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
  })
  if (!from || reduced.matches) return
  const dx = from.left - to.left
  const dy = from.top - to.top
  const sx = from.width / to.width
  const sy = from.height / to.height
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return
  el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'none' }], SPRING_WAAPI)
}

// Anything that changes the links' layout moves it there at once (unless it's sliding).
let observer: ResizeObserver | undefined
function observe() {
  const nav = pill.value?.parentElement
  if (!nav) return
  observer?.disconnect()
  observer = new ResizeObserver(() => place(false))
  observer.observe(nav)
  for (const child of nav.querySelectorAll(':scope > a, :scope > .section-menu')) observer.observe(child)
}

watch(
  () => props.section,
  () => place(true),
  { flush: 'post' },
)
watch(
  () => props.compact,
  () =>
    void nextTick(() => {
      observe()
      place(false)
    }),
  { flush: 'post' },
)
onMounted(() => {
  observe()
  place(false)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <span ref="pill" class="pill" aria-hidden="true"></span>
</template>

<style scoped>
.pill {
  position: absolute;
  box-sizing: border-box;
  transform-origin: 0 0;
  background: var(--sel);
  border-radius: 3px;
  pointer-events: none;
}
</style>
