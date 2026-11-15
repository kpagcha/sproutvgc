<script setup lang="ts">
// Native <dialog>: showModal() gives the backdrop, inert page, focus trap, Esc and focus return.
import { nextTick, useTemplateRef, watch } from 'vue'
import { t } from '@/i18n'
import { pending } from '@/composables/useConfirm'

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

watch(pending, async (p) => {
  await nextTick()
  if (p && !dialog.value?.open) dialog.value?.showModal()
})

// Buttons submit a method="dialog" form, which closes the dialog with the button's value; Esc closes with ''.
function onClose() {
  const p = pending.value
  pending.value = null
  p?.resolve(dialog.value?.returnValue === 'confirm')
}

// A click on the backdrop lands on the dialog element itself.
function onClick(e: MouseEvent) {
  if (e.target === dialog.value) dialog.value?.close('cancel')
}
</script>

<template>
  <dialog ref="dialog" class="confirm" @close="onClose" @click="onClick">
    <form v-if="pending" method="dialog" class="panel">
      <p>{{ pending.message }}</p>
      <ul v-if="pending.details?.length" class="details">
        <li v-for="d in pending.details" :key="d">{{ d }}</li>
      </ul>
      <div class="buttons">
        <button value="cancel" class="btn" :autofocus="pending.danger">
          {{ pending.cancel ?? t('confirm.cancel') }}
        </button>
        <button value="confirm" class="btn" :class="pending.danger ? 'danger' : 'primary'" :autofocus="!pending.danger">
          {{ pending.confirm }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.confirm {
  width: min(360px, calc(100vw - 32px));
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
}
.confirm::backdrop {
  background: rgb(0 0 0 / 0.45);
}
.confirm[open] {
  animation: pop 0.16s ease-out;
}
.confirm[open]::backdrop {
  animation: fade 0.16s ease-out;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .confirm[open],
  .confirm[open]::backdrop {
    animation: none;
  }
}

.panel {
  margin: 0;
  padding: 16px;
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.25);
}
p {
  margin-bottom: 16px;
}
/* Its details right under the message, the buttons' room after them. */
p:has(+ .details) {
  margin-bottom: 6px;
}
.details {
  margin: 0 0 16px;
  padding-left: 1.25em;
}
.details li + li {
  margin-top: 2px;
}
/* Two buttons with words of their own may not fit on a line. */
.buttons {
  flex-wrap: wrap;
}
.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  min-height: 32px;
}
/* The ¼× red: a strong red with white text in both themes. */
.btn.danger {
  background: var(--m025-bg);
  border-color: var(--m025-bg);
  color: var(--m025-fg);
}
.btn.danger:hover {
  filter: brightness(1.08);
}
</style>
