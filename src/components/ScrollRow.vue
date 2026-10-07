<script setup lang="ts">
import { onBeforeUnmount, onUpdated, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { t } from '@/i18n'

// A row of buttons or chips on one line, scrolling sideways when they don't fit, with no scrollbar: the edge where
// more is cut off fades out, and on screens with a mouse an arrow there brings in the next one cut off, the wheel
// scrolling it too while over it. On touch screens, a swipe. Its children are laid out with a gap of `--gap` (6px).
const props = defineProps<{
  /** On phones (as wide as 720px), its children wrap onto more lines instead. */
  wrapOnPhones?: boolean
}>()

const track = useTemplateRef<HTMLElement>('track')
const canLeft = shallowRef(false)
const canRight = shallowRef(false)
function update() {
  const el = track.value
  if (!el) return
  canLeft.value = el.scrollLeft > 1
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
let observer: ResizeObserver | undefined
watch(
  track,
  (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new ResizeObserver(update)
    observer.observe(el)
    update()
  },
  { flush: 'post' },
)
onUpdated(update)
onBeforeUnmount(() => observer?.disconnect())

/** Brings in the next child cut off on that side, whole. */
function step(dir: -1 | 1) {
  const el = track.value
  if (!el) return
  const kids = [...el.children] as HTMLElement[]
  const left = el.scrollLeft
  const right = left + el.clientWidth
  const target =
    dir > 0
      ? kids.find((c) => c.offsetLeft + c.offsetWidth > right + 1)
      : kids.filter((c) => c.offsetLeft < left - 1).pop()
  if (!target) return
  // Past the edge's fade, so the one brought in shows whole.
  const x = dir > 0 ? target.offsetLeft + target.offsetWidth - el.clientWidth + FADE : target.offsetLeft - FADE
  el.scrollTo({ left: x, behavior: 'smooth' })
}
const FADE = 24

// The wheel scrolls it sideways while there's more that way; at its ends, the page scrolls as usual.
function onWheel(e: WheelEvent) {
  const el = track.value
  if (!el || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  if ((e.deltaY > 0 && !canRight.value) || (e.deltaY < 0 && !canLeft.value)) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}
</script>

<template>
  <div class="scroll-row" :class="{ 'wrap-on-phones': props.wrapOnPhones }">
    <div
      ref="track"
      class="track"
      :class="{ 'fade-left': canLeft, 'fade-right': canRight }"
      @scroll.passive="update"
      @wheel="onWheel"
    >
      <slot />
    </div>
    <button
      v-if="canLeft"
      type="button"
      class="btn arrow left"
      tabindex="-1"
      :aria-label="t('scroll.back')"
      @click.stop.prevent="step(-1)"
    >
      <ChevronLeft :size="16" aria-hidden="true" />
    </button>
    <button
      v-if="canRight"
      type="button"
      class="btn arrow right"
      tabindex="-1"
      :aria-label="t('scroll.more')"
      @click.stop.prevent="step(1)"
    >
      <ChevronRight :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.scroll-row {
  position: relative;
  min-width: 0;
  max-width: 100%;
}
/* Room under and after its children for their shadows, which the scrolling would otherwise cut off. */
.track {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--gap, 6px);
  padding: 0 4px 4px 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.track::-webkit-scrollbar {
  display: none;
}
.track > :slotted(*) {
  flex: none;
}
.track.fade-left {
  mask-image: linear-gradient(to right, transparent, #000 24px);
}
.track.fade-right {
  mask-image: linear-gradient(to left, transparent, #000 24px);
}
.track.fade-left.fade-right {
  mask-image: linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent);
}
/* The arrows, over the faded edges, centered on the children (not their shadows' room). */
.arrow {
  position: absolute;
  top: calc(50% - 2px);
  z-index: 1;
  min-height: 0;
  padding: 2px;
  transform: translateY(-50%);
}
.arrow.left {
  left: 0;
}
.arrow.right {
  right: 0;
}
/* Touch screens swipe it: no arrows. */
@media (hover: none) {
  .arrow {
    display: none;
  }
}
@media (max-width: 720px) {
  .wrap-on-phones > .track {
    flex-wrap: wrap;
    overflow-x: visible;
    mask-image: none;
  }
  .wrap-on-phones > .arrow {
    display: none;
  }
}
</style>
