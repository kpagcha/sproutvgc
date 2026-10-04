<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AnimatePresence, motion } from 'motion-v'
import { ChevronDown } from '@lucide/vue'
import { FADE, SPRING } from '@/lib/motion'
import { t, type MessageKey } from '@/i18n'

// The header's dex sections folded into one dropdown, for screens too narrow for a link each. The button is named
// after the section the current page belongs to, and carries the header's sliding highlight while it's in one.
const props = defineProps<{ items: { to: string; section: string; label: MessageKey }[]; section: string | null }>()

const current = computed(() => props.items.find((i) => i.section === props.section))
const open = ref(false)
const root = useTemplateRef('root')
const button = useTemplateRef('button')

// Picking a section (or going anywhere else) closes the menu; so does a press outside it, or Esc.
const route = useRoute()
watch(
  () => route.fullPath,
  () => (open.value = false),
)
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  open.value = false
  button.value?.focus()
}
function listen(on: boolean) {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
  }
}
watch(open, listen)
onBeforeUnmount(() => listen(false))
</script>

<template>
  <div ref="root" class="section-menu">
    <button
      ref="button"
      type="button"
      class="toggle"
      :class="{ active: current }"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="open = !open"
    >
      <motion.span v-if="current" layout-id="nav-pill" class="pill" :transition="SPRING" />
      <span class="label">{{ t(current?.label ?? 'nav.browse') }}</span>
      <ChevronDown class="label chevron" :class="{ open }" :size="14" :stroke-width="2.5" aria-hidden="true" />
    </button>
    <AnimatePresence>
      <motion.div
        v-if="open"
        class="menu panel"
        :initial="{ opacity: 0, y: -4 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -4 }"
        :transition="FADE"
      >
        <RouterLink v-for="i in items" :key="i.to" :to="i.to" :class="{ active: i.section === section }">
          {{ t(i.label) }}
        </RouterLink>
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<style scoped>
.section-menu {
  position: relative;
}
.toggle {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font: inherit;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
@media (hover: hover) {
  .toggle:hover {
    background: var(--hover);
  }
}
.pill {
  position: absolute;
  inset: 0;
  background: var(--sel);
  border-radius: 3px;
}
.label {
  position: relative;
}
.chevron {
  transition: transform 0.16s ease-out;
}
.chevron.open {
  transform: rotate(180deg);
}

.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  margin: 0;
  padding: 4px;
}
.menu a {
  padding: 6px 10px;
  border-radius: 3px;
  color: var(--text);
  white-space: nowrap;
}
.menu a:hover {
  background: var(--hover);
  text-decoration: none;
}
.menu a.active {
  background: var(--sel);
}
</style>
