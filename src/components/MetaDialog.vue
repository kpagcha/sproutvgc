<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown, Database } from '@lucide/vue'
import { datasetParts, metaLabel, selectedSnapshot, subsetShort } from '@/data/meta'
import { t } from '@/i18n'
import MetaCard from '@/components/MetaCard.vue'
import ModalDialog from '@/components/ModalDialog.vue'

// The meta's data shown, as a button saying it (its dataset, "Showdown ladder · Sep 2026", and its subset in short,
// "1760+") that opens its card (`MetaCard`) to see what it is and pick another: dropping from the button, closed by a
// press outside it or Escape. On phones, the button is its icon alone (what it shows read out, and in the card), as
// the favorites' is, and the card opens in a dialog over the page.
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')

const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)

function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch([open, phone], ([on, p]) => {
  if (on && !p) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => {
  open.value = false
  phoneQuery.removeEventListener('change', onPhone)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
})

const dataset = computed(() => (selectedSnapshot.value ? datasetParts(selectedSnapshot.value).join(' · ') : ''))
const subset = computed(() => (selectedSnapshot.value ? subsetShort(selectedSnapshot.value) : ''))
</script>

<template>
  <div v-if="selectedSnapshot" ref="root" class="meta-dialog">
    <button
      type="button"
      class="btn toggle"
      :aria-expanded="open"
      :aria-haspopup="phone ? 'dialog' : undefined"
      :aria-label="t('meta.pick', { label: metaLabel(selectedSnapshot) })"
      @click="open = !open"
    >
      <Database :size="16" class="icon" aria-hidden="true" />
      <template v-if="!phone">
        <span class="dataset">{{ dataset }}</span>
        <span v-if="subset" class="subset">{{ subset }}</span>
      </template>
      <ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <ModalDialog v-if="phone" v-model:open="open" :label="t('meta.data')">
      <MetaCard @close="open = false" />
    </ModalDialog>
    <div v-else-if="open" class="pop">
      <MetaCard @close="open = false" />
    </div>
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
/* On phones, its icon alone: as compact as the favorites' star. */
@media (max-width: 720px) {
  .toggle {
    gap: 4px;
    min-height: 0;
    padding: 3px 8px;
  }
}
/* Under the button, over the page. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: min(380px, calc(100vw - 32px));
}
</style>
