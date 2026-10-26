<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

// A drawer over the page from one side of the window, over a backdrop dimming it but for a hole where `anchor` is (the
// element it's for, which stays as it is to work on: `clip-path`, which lets the pointer through there too), followed
// as the page scrolls or the anchor changes size. It comes from the side the anchor leaves free, chosen as it opens
// (the right without one), sliding in from that edge and back out to it. The backdrop's click and Escape close it. With
// `defer`, its content is built once it's slid in, placeholder rows until then: a long list built as it slides would
// hold it up.
const props = defineProps<{ open: boolean; anchor?: HTMLElement | null; label: string; defer?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const WIDTH = 480
const PAD = 6
const side = shallowRef<'left' | 'right'>('right')
const hole = shallowRef<{ x: number; y: number; w: number; h: number } | null>(null)
/** It's in (its slide over): deferred content can be built. */
const ready = shallowRef(false)
const box = shallowRef<HTMLElement | null>(null)
defineExpose({ el: box })

// Once a frame at most, however many scroll events come in it.
let frame = 0
function measureSoon() {
  if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()))
}
function measure() {
  const el = props.open ? props.anchor : null
  if (!el) return void (hole.value = null)
  const r = el.getBoundingClientRect()
  hole.value = { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD }
}
const clip = computed(() => {
  const h = hole.value
  if (!h) return undefined
  const W = window.innerWidth
  const H = window.innerHeight
  return `path(evenodd, "M0 0H${W}V${H}H0Z M${h.x} ${h.y}H${h.x + h.w}V${h.y + h.h}H${h.x}Z")`
})

let observer: ResizeObserver | undefined
watch(
  () => (props.open ? (props.anchor ?? false) : null),
  async (el) => {
    observer?.disconnect()
    hole.value = null
    if (!el) return
    // Its side chosen before it's drawn (the watcher runs before the render), so it slides in from that edge, not from
    // the last one's.
    const r = el.getBoundingClientRect()
    side.value = r.right > window.innerWidth - Math.min(WIDTH, window.innerWidth * 0.46) - 16 ? 'left' : 'right'
    await nextTick()
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    measure()
    observer = new ResizeObserver(measureSoon)
    observer.observe(el)
  },
  { immediate: true },
)

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => {
  window.addEventListener('scroll', measureSoon, { passive: true })
  window.addEventListener('resize', measureSoon)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', measureSoon)
  window.removeEventListener('resize', measureSoon)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <!-- In the body, out of the page's transform, so fixed to the window; over the header. -->
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="backdrop" :style="{ clipPath: clip }" aria-hidden="true" @click="emit('close')"></div>
    </Transition>
    <Transition name="drawer" @after-enter="ready = true" @after-leave="ready = false">
      <aside v-if="open" ref="box" class="panel drawer" :class="side" :aria-label="label">
        <div v-if="defer && !ready" class="skeleton" aria-hidden="true">
          <span class="sk sk-title"></span>
          <span class="sk sk-search"></span>
          <span v-for="n in 12" :key="n" class="sk sk-row"></span>
        </div>
        <slot v-else />
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: color-mix(in srgb, #000 45%, transparent);
}
.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 91;
  width: min(480px, 46vw);
  margin: 0;
  overflow: auto;
  overscroll-behavior: contain;
  /* Its slide on a layer of its own, so the page under it isn't painted again as it goes. */
  will-change: transform;
}
.drawer.right {
  right: 0;
  border-right: 0;
}
.drawer.left {
  left: 0;
  border-left: 0;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sk {
  display: block;
  background: color-mix(in srgb, var(--border) 45%, transparent);
}
.sk-title {
  width: 40%;
  height: 1.4em;
}
.sk-search {
  height: 34px;
  margin-bottom: 6px;
}
.sk-row {
  height: 2.6em;
}
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.18s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
/* In from its own edge and back out to it, by its side's class (not the transition's name, which the next drawer's
   side would change under one leaving). */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.drawer.right:is(.drawer-enter-from, .drawer-leave-to) {
  transform: translateX(100%);
}
.drawer.left:is(.drawer-enter-from, .drawer-leave-to) {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active,
  .drawer-fade-enter-active,
  .drawer-fade-leave-active {
    transition: none;
  }
}
</style>
