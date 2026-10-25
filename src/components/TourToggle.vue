<script setup lang="ts">
import { Footprints } from '@lucide/vue'
import { t } from '@/i18n'

// Taking a page's tour again, its guide to reading it: its icon alone, at the end of the heading's row, its words its
// tooltip.
const emit = defineEmits<{ start: [] }>()
</script>

<template>
  <button
    v-tip="t('tour.start')"
    type="button"
    class="tour-toggle"
    :aria-label="t('tour.start')"
    @click.stop.prevent="emit('start')"
  >
    <Footprints :size="16" aria-hidden="true" />
  </button>
</template>

<style scoped>
.tour-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  align-self: center;
  height: 24px;
  padding: 0;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.tour-toggle:hover {
  color: var(--text);
}
</style>
