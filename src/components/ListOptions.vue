<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Settings2 } from '@lucide/vue'
import { t } from '@/i18n'
import { useListOptions } from '@/composables/useListOptions'

// At the top right of a meta list's panel, a quiet button opening a drop-down of how the lists show
// (`useListOptions`): for now, whether the short descriptions do. Closed by a press outside it or Escape.
const { descriptions } = useListOptions()

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
  <div ref="root" class="list-options">
    <button
      v-tip="t('listOptions.title')"
      type="button"
      class="toggle"
      :class="{ open }"
      :aria-expanded="open"
      :aria-label="t('listOptions.title')"
      @click="open = !open"
    >
      <Settings2 :size="16" aria-hidden="true" />
    </button>
    <div v-if="open" class="pop panel">
      <label class="check">
        <input v-model="descriptions" type="checkbox" />
        {{ t('listOptions.descriptions') }}
      </label>
    </div>
  </div>
</template>

<style scoped>
.list-options {
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
/* Under the button, from its right edge, over the page. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: max-content;
  font-weight: normal;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  cursor: pointer;
}
</style>
