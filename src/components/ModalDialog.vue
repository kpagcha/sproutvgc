<script lang="ts">
// How many are open, as one can open over another (a picker's over yours' card): the page stays locked until the last
// one closes.
let openCount = 0
</script>

<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'

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

// It covers what's on the screen, its card centered there. Pinned to the window's edges, it follows the address bar
// showing and hiding on its own, and (with `interactive-widget=resizes-content`, index.html) Chrome's keyboard. Where
// what's on the screen is less than the window all the same (an iPhone's keyboard, which only shrinks the visual
// viewport; a pinch zoom), it's placed over that instead.
const area = shallowRef<{ top: number; height: number } | null>(null)
function follow() {
  const vv = window.visualViewport
  area.value =
    vv && (vv.offsetTop > 0.5 || window.innerHeight - vv.height > 0.5) ? { top: vv.offsetTop, height: vv.height } : null
}
function following(on: boolean) {
  const vv = window.visualViewport
  if (!vv) return
  if (on) {
    follow()
    vv.addEventListener('resize', follow)
    vv.addEventListener('scroll', follow)
  } else {
    vv.removeEventListener('resize', follow)
    vv.removeEventListener('scroll', follow)
  }
}
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
      following(true)
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
  following(false)
  lock(false)
  open.value = false
  before?.focus({ preventScroll: true })
  before = null
}
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
  following(false)
  lock(false)
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="modal-dialog"
      :class="{ fill }"
      :style="area ? { top: `${area.top}px`, bottom: 'auto', height: `${area.height}px` } : undefined"
      :aria-label="label"
      @close="onClose"
      @click="onClick"
    >
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
/* Over what's on the screen, pinned to the window's edges (or placed over the visual viewport, above), with no look of
   its own: it centers its card, an even gap all round (and the screen's safe area, by a notch or round corners), the
   card no wider than reads well. */
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
</style>
