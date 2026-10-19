<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
import { t } from '@/i18n'

// "How to read this": its icon alone, a toggle opening a page's help (the element `controls` names), its words its
// tooltip and name. In a heading's row (`fit`), at the row's end.
const props = defineProps<{ open: boolean; controls: string; fit?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    v-tip="t('speed.help')"
    type="button"
    class="help-toggle"
    :class="{ fit: props.fit }"
    :aria-expanded="props.open"
    :aria-controls="props.controls"
    :aria-label="t('speed.help')"
    @click.stop.prevent="emit('toggle')"
    @keydown.enter.stop
    @keydown.space.stop
  >
    <CircleHelp :size="16" aria-hidden="true" />
  </button>
</template>

<style scoped>
.help-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  align-self: center;
  padding: 0;
  font: inherit;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.help-toggle:hover {
  color: var(--text);
}
/* In a heading's row: at its end, as tall as the row's line. */
.help-toggle.fit {
  height: 24px;
  margin-left: auto;
  padding-left: 8px;
}
</style>
