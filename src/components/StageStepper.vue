<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'
import { t } from '@/i18n'

// A stat stage, as a chip among the modifiers' ("Stage − +1 +"): its label, the stage, and a step down and up on
// either side of it, each greyed out at its end of the range. Marked as the modifiers on are while it's not 0.
const props = defineProps<{ min: number; max: number }>()
const model = defineModel<number>({ required: true })
const text = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
</script>

<template>
  <span class="stepper" :class="{ on: model !== 0 }" role="group" :aria-label="t('speed.stage')">
    <span class="label" aria-hidden="true">{{ t('speed.stageLabel') }}</span>
    <button
      type="button"
      class="step"
      :disabled="model <= props.min"
      :aria-label="t('speed.stageDown')"
      @click="model = model - 1"
    >
      <Minus :size="14" aria-hidden="true" />
    </button>
    <output class="value" aria-live="polite">{{ text(model) }}</output>
    <button
      type="button"
      class="step"
      :disabled="model >= props.max"
      :aria-label="t('speed.stageUp')"
      @click="model = model + 1"
    >
      <Plus :size="14" aria-hidden="true" />
    </button>
  </span>
</template>

<style scoped>
/* Outlined as the modifiers' chips are, as tall as they are on their row, the label then the stage between its steps. */
.stepper {
  display: inline-flex;
  align-self: stretch;
  align-items: stretch;
  min-height: 28px;
  font-weight: bold;
  background: var(--panel-alt);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.stepper.on {
  background: var(--sel);
}
.label {
  display: flex;
  align-items: center;
  padding: 0 4px 0 10px;
}
.step {
  display: flex;
  align-items: center;
  padding: 0 6px;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
}
.step:hover:not(:disabled) {
  background: var(--hover);
}
.step:disabled {
  opacity: 0.35;
  cursor: default;
}
.value {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2em;
  font-variant-numeric: tabular-nums;
}
</style>
