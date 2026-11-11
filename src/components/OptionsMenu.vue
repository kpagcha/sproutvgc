<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch, type Component } from 'vue'
import { Settings2 } from '@lucide/vue'

// At the top right of a panel, a quiet button opening a drop-down of how the panel shows: the options are its slot.
// Closed by a press outside it or Escape, or by what's in it (its slot's `close`: a pick that's done with it). Its icon
// a gear unless given (`icon`); or a button of the page's own, its `button` slot (given `open` and `toggle`), for a
// drop-down of something else: the team builder's saved teams. Whether it's open can be the page's too (`v-model:open`).
// It drops from its button as it opens, and goes back up to it.
defineProps<{
  /** What the options are of, the button's tooltip and label. */
  title: string
  /** No tooltip, the label alone: a button plain enough without one (a slot's "⋮"). */
  noTip?: boolean
  icon?: Component
  /** Shown beside the icon: a small quiet button rather than the icon alone (`btn quiet small`). */
  label?: string
  /** The drop-down from the button's left edge rather than its right. */
  align?: 'left' | 'right'
  /** On a panel's band: its button as the band's are (`btn on-band`). */
  onBand?: boolean
}>()

// Its tooltip only where there's hovering: a tap opens the drop-down, its label saying the same.
const canHover = window.matchMedia('(hover: hover)').matches
const open = defineModel<boolean>('open', { default: false })
const root = useTemplateRef<HTMLElement>('root')
const pop = useTemplateRef<HTMLElement>('pop')
// No taller than the screen leaves under it: a long one scrolls within itself rather than the page.
const maxHeight = ref<string | undefined>()
const GAP = 12
// Nor past the screen's sides: from a button mid-line (a phone's), slid back in by what it'd stick out.
const shift = ref(0)
const SIDE = 8
async function fitPop() {
  shift.value = 0
  await nextTick()
  const el = pop.value
  const parent = el?.offsetParent
  if (!el || !parent) return
  // Where it's laid out, from the box it's placed in (its button's, unless the page says another): its own is of it
  // mid-way in, smaller and higher.
  const from = parent.getBoundingClientRect()
  const left = from.left + parent.clientLeft + el.offsetLeft
  const top = from.top + parent.clientTop + el.offsetTop
  maxHeight.value = `${Math.max(160, window.innerHeight - top - GAP)}px`
  const width = document.documentElement.clientWidth
  let dx = Math.min(0, width - SIDE - left - el.offsetWidth)
  if (left + dx < SIDE) dx = SIDE - left
  shift.value = Math.round(dx)
}
function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch(open, (on) => {
  if (on) {
    void fitPop()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
  } else unlisten()
})
function unlisten() {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
}
// Taken out while open (the saved teams', once they fit their row again): its listeners with it, there being no
// later for the watcher above.
onBeforeUnmount(() => {
  unlisten()
  open.value = false
})
</script>

<template>
  <div ref="root" class="options-menu">
    <slot v-if="$slots.button" name="button" :open :toggle="() => (open = !open)" />
    <button
      v-else
      v-tip="canHover && !label && !noTip && title"
      type="button"
      :class="
        onBand
          ? ['btn', 'on-band', { on: open }]
          : label
            ? ['btn', 'quiet', 'small', { on: open }]
            : ['toggle', { open }]
      "
      :aria-expanded="open"
      :aria-label="title"
      @click="open = !open"
    >
      <component :is="icon ?? Settings2" :size="label ? 14 : 16" aria-hidden="true" />
      <span v-if="label">{{ label }}</span>
    </button>
    <Transition name="drop">
      <div
        v-if="open"
        ref="pop"
        class="pop panel"
        :class="{ left: align === 'left' }"
        :style="{ maxHeight, '--shift': `${shift}px` }"
      >
        <slot :close="() => (open = false)" />
      </div>
    </Transition>
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
  max-width: calc(100vw - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  font-weight: normal;
  transform: translateX(var(--shift, 0px));
  transform-origin: top right;
}
/* From the button's left edge. */
.pop.left {
  right: auto;
  left: 0;
  transform-origin: top left;
}
/* Dropping from its button, a touch smaller at first, and back up to it, quicker, as it goes (as the dialogs' cards
   rise and sink); hardly a fade: solid almost at once, the drop what's seen. */
.drop-enter-active {
  transition:
    opacity 0.07s linear,
    transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.drop-leave-active {
  pointer-events: none;
  transition:
    opacity 0.1s linear,
    transform 0.1s ease-in;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translate(var(--shift, 0px), -6px) scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .drop-enter-active,
  .drop-leave-active {
    transition: none;
  }
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
/* Something to do rather than an option (`menu-item`, a button or a link): a line of text, its icon before it, in the
   accent when pointed at (`danger`, one that undoes, in the warning's). */
.pop :slotted(.menu-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  font: inherit;
  color: var(--text);
  white-space: nowrap;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.pop :slotted(.menu-item:hover) {
  color: var(--accent);
  text-decoration: none;
}
.pop :slotted(.menu-item.danger:hover) {
  color: var(--bad);
}
.pop :slotted(.menu-item:disabled) {
  color: var(--muted);
  opacity: 0.6;
  cursor: default;
}
</style>
