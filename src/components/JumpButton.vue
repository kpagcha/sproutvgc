<script setup lang="ts">
import { ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { reveal } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'

// A floating button at the bottom of the screen jumping to what a page works out (`target`) while it's below the
// screen: starting low on it (below 40%) and running off its bottom edge. The type matchups' results, the speed
// comparison's Who moves first.
const props = defineProps<{ target: HTMLElement | null | undefined; label: string }>()

const below = ref(false)
watch(
  () => props.target,
  (el, _, onCleanup) => {
    below.value = false
    if (!el) return
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
</script>

<template>
  <!-- Outside the page so the page transition's transform can't move it. -->
  <Teleport to="body">
    <AnimatePresence>
      <motion.button
        v-if="below"
        type="button"
        class="btn primary jump"
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 8 }"
        :transition="FADE"
        :while-press="PRESS"
        @click="reveal(props.target)"
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
