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
// screen leaves (a list to scroll); else it's as tall as what's in it, scrolling past that. It fits the window, the
// keyboard coming up over it as over the page, rather than following it (which had it chase the keyboard as it slid
// in). Its card fades in rising a little, and out sinking back (`@starting-style`, where the browser has it).
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
// A tap on the dimmed page around its card (the dialog's own box, which only holds the card) closes it.
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
/* Over the window, pinned to its edges, with no look of its own: it centers its card, an even gap all round (and the
   screen's safe area, by a notch or round corners), the card no wider than reads well. */
.modal-dialog {
  position: fixed;
  inset: 0;
  width: auto;
  max-width: none;
  height: auto;
  max-height: none;
  margin: 0;
  /* The same gap on every side to the card's edge; right and bottom also hold its 4px shadow. */
  padding: max(16px, env(safe-area-inset-top)) calc(max(16px, env(safe-area-inset-right)) + 4px)
    calc(max(16px, env(safe-area-inset-bottom)) + 4px) max(16px, env(safe-area-inset-left));
  overflow: visible;
  color: var(--text);
  background: none;
  border: none;
  overscroll-behavior: contain;
}
.modal-dialog[open] {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.modal-dialog > :slotted(*) {
  width: 100%;
  max-width: 560px;
  max-height: 100%;
  min-height: 0;
  margin: 0;
}
.modal-dialog.fill > :slotted(*) {
  height: 100%;
}
.modal-dialog::backdrop {
  background: color-mix(in srgb, var(--ink) 45%, transparent);
}
/* Opening, the page dims and the card fades in rising a little; closing, the other way, a touch quicker. The dialog
   stays shown (`display`) and over everything (`overlay`) until its card is out. */
.modal-dialog,
.modal-dialog::backdrop,
.modal-dialog > :slotted(*) {
  transition:
    opacity 0.16s ease-in,
    transform 0.16s ease-in,
    display 0.16s allow-discrete,
    overlay 0.16s allow-discrete;
}
.modal-dialog[open],
.modal-dialog[open]::backdrop,
.modal-dialog[open] > :slotted(*) {
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}
.modal-dialog:not([open])::backdrop {
  opacity: 0;
}
.modal-dialog:not([open]) > :slotted(*) {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
@starting-style {
  .modal-dialog[open]::backdrop {
    opacity: 0;
  }
  .modal-dialog[open] > :slotted(*) {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
@media (prefers-reduced-motion: reduce) {
  .modal-dialog,
  .modal-dialog::backdrop,
  .modal-dialog > :slotted(*) {
    transition: none;
  }
}
</style>
