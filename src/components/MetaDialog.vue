<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { ChevronDown, Database } from '@lucide/vue'
import { datasetParts, metaLabel, offLatest, selectedSnapshot, subsetShort } from '@/data/meta'
import { t } from '@/i18n'
import { metaLoading } from '@/composables/useMeta'
import MetaCard from '@/components/MetaCard.vue'
import ModalDialog from '@/components/ModalDialog.vue'

// The meta's data shown, as a button saying it (its dataset, "Showdown ladder · Sep 2026", and its subset in short,
// "1760+") that opens its card (`MetaCard`) to see what it is and pick another, in a dialog over the page, on any
// screen (`ModalDialog`: closed by a press around it or Escape), its card scrolling when it's taller than the screen.
// On phones, the button is its icon alone (what it shows read out, and in the card), as the favorites' is. Its icon
// pulses while the data picked loads, and it's tinted in the accent while the data isn't the latest (another
// regulation or period than the default's), the card then having the way back to it.
const open = ref(false)

const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onBeforeUnmount(() => {
  open.value = false
  phoneQuery.removeEventListener('change', onPhone)
})

const dataset = computed(() => (selectedSnapshot.value ? datasetParts(selectedSnapshot.value).join(' · ') : ''))
const subset = computed(() => (selectedSnapshot.value ? subsetShort(selectedSnapshot.value) : ''))
</script>

<template>
  <div v-if="selectedSnapshot" class="meta-dialog">
    <button
      type="button"
      class="btn toggle"
      :class="{ off: offLatest }"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="
        t('meta.pick', { label: metaLabel(selectedSnapshot) }) + (offLatest ? ` (${t('meta.notLatest')})` : '')
      "
      :aria-busy="metaLoading"
      @click="open = !open"
    >
      <Database :size="16" class="icon" :class="{ 'meta-pulse': metaLoading }" aria-hidden="true" />
      <template v-if="!phone">
        <span class="dataset">{{ dataset }}</span>
        <span v-if="subset" class="subset">{{ subset }}</span>
      </template>
      <ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <ModalDialog v-model:open="open" :label="t('meta.data')">
      <MetaCard class="meta-dialog-card" @close="open = false" />
    </ModalDialog>
  </div>
</template>

<style scoped>
.meta-dialog {
  position: relative;
  display: flex;
  min-width: 0;
}
/* On one line: the icon, the dataset (cut short first when the row's tight), its subset, and the arrow. */
.toggle {
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  font-weight: normal;
}
.icon {
  flex: none;
  color: var(--muted);
}
.dataset {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.subset {
  flex: none;
  font-weight: bold;
}
.chevron {
  flex: none;
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* The data isn't the latest: outlined in the accent, over a wash of it, its icon in it. */
:root:root .toggle.off {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--panel));
}
:root:root .toggle.off:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 24%, var(--panel));
}
.toggle.off .icon {
  color: var(--accent);
}
/* On phones, its icon alone: as compact as the favorites' star. */
@media (max-width: 720px) {
  .toggle {
    gap: 4px;
    min-height: 0;
    padding: 3px 8px;
  }
}
/* The card, no wider than its rows need, in the middle of the screen: over the dialog's own width for what it holds. */
:global(:root:root .modal-dialog > .meta-dialog-card) {
  max-width: 440px;
}
</style>
