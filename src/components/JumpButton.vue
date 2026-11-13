<script setup lang="ts">
import { ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { reveal, toTopAt, toTopOf } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'

// A floating button at the bottom of the screen jumping to what a page works out (`target`) while it's below the
// screen: starting low on it (below 40%) and running off its bottom edge. The type matchups' results, the speed
// comparison's Who moves first, the team builder's slot just pinned beside its charts. `dismissible`: gone for good
// (until `target` is set again) once tapped or once the reader scrolls by hand (wheel, touch, keys; not its own
// scrolling there), a nudge rather than a way there. `top`: tapped, its target's top brought to the screen's top (under
// any bar stuck there; a sticky one where it sticks, its own `top`, so what's beside it starts there too) rather than
// the least scroll that shows it, which would leave it at the screen's bottom.
const props = defineProps<{
  target: HTMLElement | null | undefined
  label: string
  dismissible?: boolean
  top?: boolean
}>()

const below = ref(false)
const dismissed = ref(false)
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '])
watch(
  () => props.target,
  (el, _, onCleanup) => {
    below.value = false
    dismissed.value = false
    if (!el) return
    if (props.dismissible) {
      const dismiss = () => (dismissed.value = true)
      const onKey = (e: KeyboardEvent) => SCROLL_KEYS.has(e.key) && dismiss()
      window.addEventListener('wheel', dismiss, { passive: true })
      window.addEventListener('touchmove', dismiss, { passive: true })
      window.addEventListener('keydown', onKey)
      onCleanup(() => {
        window.removeEventListener('wheel', dismiss)
        window.removeEventListener('touchmove', dismiss)
        window.removeEventListener('keydown', onKey)
      })
    }
    const check = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      below.value = r.top > vh * 0.4 && r.bottom > vh
    }
    // Scrolling, resizing, and what it's on changing size can all change the answer.
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    onCleanup(() => {
      ro.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    })
  },
  { immediate: true },
)

function go() {
  const el = props.target
  const stuck = el && getComputedStyle(el).position === 'sticky' ? parseFloat(getComputedStyle(el).top) : NaN
  if (props.top && !Number.isNaN(stuck)) toTopAt(el, stuck)
  else if (props.top) toTopOf(el)
  else reveal(props.target)
  if (props.dismissible) dismissed.value = true
}
</script>

<template>
  <!-- Outside the page so the page transition's transform can't move it. -->
  <Teleport to="body">
    <AnimatePresence>
      <motion.button
        v-if="below && !dismissed"
        type="button"
        class="btn primary jump"
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 8 }"
        :transition="FADE"
        :while-press="PRESS"
        @click="go"
      >
        {{ props.label }} ↓
      </motion.button>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.jump {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 10;
  translate: -50% 0;
  min-height: 40px;
  padding: 6px 16px;
  font-weight: bold;
}
</style>
