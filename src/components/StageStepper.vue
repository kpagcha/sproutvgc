<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'
import { t } from '@/i18n'

// A stat stage, as a chip among the modifiers' ("Stage − +1 +"): its label, the stage, and a step down and up on
// either side of it, each greyed out at its end of the range. Marked as the modifiers on are while it's not 0. Speed's
// unless given another stat (`label`, its name, and `stat`, its name in full for the steps' labels).
// A count rather than a stage (`unsigned`: Spikes' layers) has no sign.
// Compact (`compact`), its label over its stage and steps, narrow enough for a row of five.
const props = defineProps<{
  min: number
  max: number
  label?: string
  stat?: string
  unsigned?: boolean
  compact?: boolean
}>()
const model = defineModel<number>({ required: true })
const text = (n: number) => (props.unsigned ? String(n) : n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
</script>

<template>
  <span
    class="stepper"
    :class="{ on: model !== 0, compact }"
    role="group"
    :aria-label="stat ? t('calc.stageOf', { stat }) : t('speed.stage')"
  >
    <span class="label" aria-hidden="true">{{ label ?? t('speed.stageLabel') }}</span>
    <button
      type="button"
      class="step down"
      :disabled="model <= props.min"
      :aria-label="stat ? t('calc.stageDown', { stat }) : t('speed.stageDown')"
      @click="model = model - 1"
    >
      <Minus :size="14" aria-hidden="true" />
    </button>
    <output class="value" aria-live="polite">{{ text(model) }}</output>
    <button
      type="button"
      class="step up"
      :disabled="model >= props.max"
      :aria-label="stat ? t('calc.stageUp', { stat }) : t('speed.stageUp')"
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
/* Compact: the label across the top, the stage between its steps under it; quieter than the chips' (a thin rule, no
   shadow, the label muted), as one of several set alongside other things. */
.stepper.compact {
  display: inline-grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'label label label' 'down value up';
  min-height: 0;
  min-width: 0;
  font-weight: normal;
  border: 1px solid var(--border);
  box-shadow: none;
}
.stepper.compact.on {
  font-weight: bold;
  border-color: var(--ink);
}
.compact .label {
  grid-area: label;
  justify-content: center;
  padding: 2px 0 0;
  font-size: 0.85em;
  color: var(--muted);
}
.compact.on .label {
  color: var(--text);
}
.compact .down {
  grid-area: down;
}
.compact .up {
  grid-area: up;
}
.compact .value {
  grid-area: value;
  min-width: 0;
}
.compact .step {
  padding: 2px 3px;
}
</style>
