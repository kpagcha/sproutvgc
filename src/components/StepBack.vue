<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { t } from '@/i18n'

// The way back to a drawer's step before (the pickers', the inverse calc's): an arrow at the start of its heading's row,
// before the step's title.
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <button type="button" class="step-back" :aria-label="t('picker.back')" @click="emit('back')">
    <ArrowLeft :size="18" aria-hidden="true" />
  </button>
</template>

<style scoped>
.step-back {
  display: inline-flex;
  flex: none;
  margin: 0 4px 0 -2px;
  padding: 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.step-back:hover {
  color: var(--accent);
}
</style>
