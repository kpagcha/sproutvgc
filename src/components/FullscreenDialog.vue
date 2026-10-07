<script lang="ts">
// How many are open, as one can open over another (a picker's over yours' card): the page stays locked until the last
// one closes.
let openCount = 0
</script>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'

// A dialog taking the whole screen, for phones: what would drop down over the page (a list to pick from, a card)
// opens on a screen of its own instead, the page under it left where it was and kept from scrolling. A native modal
// <dialog>, so it's over everything, the rest of the page out of reach of taps, keys and screen readers; Escape and
// phones' back gesture close it. Always in the page (closed), so what's moved into it has somewhere to go.
const open = defineModel<boolean>('open', { required: true })
defineProps<{ label: string }>()

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
    <dialog ref="dialog" class="fullscreen-dialog" :aria-label="label" @close="onClose">
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
.fullscreen-dialog {
  width: 100%;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  color: var(--text);
  background: var(--bg);
  border: none;
  overscroll-behavior: contain;
}
.fullscreen-dialog[open] {
  display: flex;
  flex-direction: column;
}
.fullscreen-dialog::backdrop {
  background: var(--bg);
}
</style>
