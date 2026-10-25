<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch, type Component } from 'vue'
import { Settings2 } from '@lucide/vue'

// At the top right of a panel, a quiet button opening a drop-down of how the panel shows: the options are its slot.
// Closed by a press outside it or Escape, or by what's in it (its slot's `close`: a pick that's done with it). Its icon a gear unless given (`icon`).
defineProps<{
  /** What the options are of, the button's tooltip and label. */
  title: string
  icon?: Component
  /** Shown beside the icon: a small quiet button rather than the icon alone (`btn quiet small`). */
  label?: string
  /** The drop-down from the button's left edge rather than its right. */
  align?: 'left' | 'right'
}>()

// Its tooltip only where there's hovering: a tap opens the drop-down, its label saying the same.
const canHover = window.matchMedia('(hover: hover)').matches
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch(open, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => (open.value = false))
</script>

<template>
  <div ref="root" class="options-menu">
    <button
      v-tip="canHover && !label && title"
      type="button"
      :class="label ? ['btn', 'quiet', 'small', { on: open }] : ['toggle', { open }]"
      :aria-expanded="open"
      :aria-label="title"
      @click="open = !open"
    >
      <component :is="icon ?? Settings2" :size="label ? 14 : 16" aria-hidden="true" />
      <span v-if="label">{{ label }}</span>
    </button>
    <div v-if="open" class="pop panel" :class="{ left: align === 'left' }">
      <slot :close="() => (open = false)" />
    </div>
  </div>
</template>

<style scoped>
.options-menu {
  position: relative;
  flex: none;
}
/* Quiet: the icon alone, muted, until pointed at or open. */
.toggle {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}
.toggle:hover,
.toggle.open {
  color: var(--text);
  border-color: var(--border);
}
/* Under the button, from its right edge, over the page; its options one under another. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: max-content;
  font-weight: normal;
}
/* From the button's left edge. */
.pop.left {
  right: auto;
  left: 0;
}
/* A checkbox or radio with its label, and a group of them under a heading of its own. */
.pop :slotted(label) {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  cursor: pointer;
}
.pop :slotted(fieldset) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}
.pop :slotted(legend) {
  margin-bottom: 2px;
  padding: 0;
  color: var(--muted);
  font-size: 0.85em;
}
</style>
