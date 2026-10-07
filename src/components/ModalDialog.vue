<script lang="ts">
// How many are open, as one can open over another (a picker's over yours' card): the page stays locked until the last
// one closes.
let openCount = 0
</script>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'

// A dialog over the page, for phones: what would drop down over it (a list to pick from, a card) opens in the middle
// of the screen instead, the page dimmed behind it, still in sight, left where it was and kept from scrolling; a tap on
// it closes the dialog. What's in it draws its own card: the dialog only places it. A native modal <dialog>, so it's
// over everything, the rest of the page out of reach of taps, keys and screen readers; Escape and phones' back gesture
// close it. Always in the page (closed), so what's moved into it has somewhere to go. `fill` makes it as tall as the
// screen leaves (a list to scroll); else it's as tall as what's in it, scrolling past that.
const open = defineModel<boolean>('open', { required: true })
defineProps<{ label: string; fill?: boolean }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// The page under it doesn't scroll while it's open (a dialog's own scroll would otherwise carry on to it), and stays
// where it was once it closes: closing would put the focus back where it was, the browser scrolling to it, so the focus
// is taken from there as it opens and given back here without scrolling.
let before: HTMLElement | null = null
let locked = false
function lock(on: boolean) {
  if (on === locked) return
  locked = on
  openCount += on ? 1 : -1
  document.documentElement.classList.toggle('dialog-open', openCount > 0)
}
watch(
  [open, dialog],
  ([o, el]) => {
    if (!el) return
    if (o && !el.open) {
      before = document.activeElement instanceof HTMLElement ? document.activeElement : null
      before?.blur()
      el.showModal()
      lock(true)
    } else if (!o && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)
// A tap on the dimmed page, outside what's in it (which is all of the dialog's box), closes it.
function onClick(e: MouseEvent) {
  if (e.target === dialog.value) open.value = false
}
// Closed by Escape or the back gesture as by the model.
function onClose() {
  lock(false)
  open.value = false
  before?.focus({ preventScroll: true })
  before = null
}
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
  lock(false)
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="modal-dialog" :class="{ fill }" :aria-label="label" @close="onClose" @click="onClick">
      <slot />
    </dialog>
  </Teleport>
</template>

<style>
/* Global: the page under an open dialog doesn't scroll. */
html.dialog-open {
  overflow: hidden;
}
</style>

<style scoped>
/* Centered, a margin all round; no box of its own, what's in it drawing its card (with room for its shadow). */
.modal-dialog {
  width: calc(100% - 24px);
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  margin: auto;
  padding: 0 4px 4px 0;
  overflow: visible;
  color: var(--text);
  background: none;
  border: none;
  overscroll-behavior: contain;
}
.modal-dialog.fill {
  height: calc(100dvh - 48px);
}
.modal-dialog[open] {
  display: flex;
  flex-direction: column;
}
.modal-dialog > :slotted(*) {
  flex: 1 1 auto;
  min-height: 0;
}
.modal-dialog::backdrop {
  background: color-mix(in srgb, var(--ink) 45%, transparent);
}
</style>
