<script setup lang="ts">
import { Check } from '@lucide/vue'
import { t } from '@/i18n'

// The damage solver's setup, where it's at: its five steps in a row, those done ticked, the one being read marked;
// a step done, or any once both Pokémon are in, gone back to by a tap (`go`).
const props = defineProps<{ at: number; reach: number }>()
const emit = defineEmits<{ go: [step: number] }>()
const STEPS = ['calc.flow.yours', 'calc.flow.theirs', 'calc.flow.goal', 'calc.flow.known', 'calc.flow.hits'] as const
</script>

<template>
  <ol class="steps" :aria-label="t('calc.flow.steps')">
    <li v-for="(s, i) in STEPS" :key="s" :class="{ done: i < props.at, at: i === props.at }">
      <button
        type="button"
        :disabled="i === props.at || i > props.reach"
        :aria-current="i === props.at ? 'step' : undefined"
        @click="emit('go', i)"
      >
        <span class="dot"
          ><Check v-if="i < props.at" :size="12" aria-hidden="true" /><template v-else>{{ i + 1 }}</template></span
        ><span class="label">{{ t(s) }}</span>
      </button>
    </li>
  </ol>
</template>

<style scoped>
.steps {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin: 0 0 12px;
  padding: 0 0 10px;
  list-style: none;
  min-width: 0;
  border-bottom: 1px solid var(--border);
}
.steps li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.steps li + li::before {
  content: '';
  flex-shrink: 0;
  width: 10px;
  height: 1px;
  background: var(--border);
}
button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  font-size: 0.75em;
  color: var(--muted);
  white-space: nowrap;
  background: none;
  border: 0;
  cursor: pointer;
}
button:disabled {
  cursor: default;
}
button:not(:disabled):hover .label {
  color: var(--text);
  text-decoration: underline;
}
.dot {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 18px;
  height: 18px;
  font-size: 0.875em;
  font-weight: bold;
  border: 1px solid var(--border);
}
.done .dot {
  color: var(--accent-text);
  background: var(--accent);
  border-color: var(--ink);
}
.at button {
  color: var(--text);
  font-weight: bold;
}
.at .dot {
  background: var(--sel);
  border: 2px solid var(--ink);
}
/* Only the step being read named where they don't all fit. */
@media (max-width: 520px) {
  .steps li:not(.at) .label {
    display: none;
  }
}
</style>
