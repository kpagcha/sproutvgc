<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
import { t } from '@/i18n'

// "How to read this": a link-like toggle opening a page's help (the element `controls` names). In a heading's row
// (`fit`), it takes what the row leaves: its icon always, its words only when they fit beside it, else on a second
// line it hides, so the row never wraps.
const props = defineProps<{ open: boolean; controls: string; fit?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="help-toggle"
    :class="{ fit: props.fit }"
    :aria-expanded="props.open"
    :aria-controls="props.controls"
    :aria-label="props.fit ? t('speed.help') : undefined"
    @click.stop.prevent="emit('toggle')"
    @keydown.enter.stop
    @keydown.space.stop
  >
    <CircleHelp :size="16" aria-hidden="true" /><span>{{ t('speed.help') }}</span>
  </button>
</template>

<style scoped>
.help-toggle {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
}
.help-toggle > span {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.help-toggle:hover > span {
  text-decoration-style: solid;
}
.help-toggle > .lucide {
  color: var(--muted);
}
/* In a heading's row: the body's text, taking what the rest of the row leaves (never what they need), at its end: its
   words when they fit there, else its icon alone, its words then wrapping to a second line it doesn't show. */
.help-toggle.fit {
  flex: 1 1 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 24px;
  height: 24px;
  padding-left: 8px;
  overflow: hidden;
  font-size: 1rem;
  font-weight: normal;
  line-height: 24px;
}
.help-toggle.fit > .lucide {
  height: 24px;
}
.help-toggle.fit > span {
  white-space: nowrap;
}
</style>
