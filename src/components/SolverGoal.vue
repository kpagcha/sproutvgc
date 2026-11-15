<script setup lang="ts">
import { useId } from 'vue'
import { t } from '@/i18n'
import type { OpponentUnknowns } from '@/lib/damageReverse'
import { GOAL_OPTIONS, GOALS, type Goal } from '@/lib/solverGoal'

// The damage solver's goal, one choice over What fits: what it works out of each side (`GOALS`), a card each named
// after it. The one picked stays picked as parts are set or worked out from the bands and panels; moving on to what
// fits, the page asks to tidy them up where they're not the goal's.
const goal = defineModel<Goal>('goal', { required: true })
const work = defineModel<OpponentUnknowns>('work', { required: true })
const workYours = defineModel<OpponentUnknowns>('workYours', { required: true })
const emit = defineEmits<{ changed: []; custom: [] }>()

const labelId = useId()
function pick(g: Goal) {
  goal.value = g
  if (g === 'custom') return void emit('custom')
  workYours.value = { ...GOALS[g].a }
  work.value = { ...GOALS[g].b }
  emit('changed')
}
</script>

<template>
  <div class="goal" role="radiogroup" :aria-labelledby="labelId">
    <span :id="labelId" class="label muted">{{ t('calc.goal.label') }}</span>
    <div class="cards">
      <label v-for="g in GOAL_OPTIONS" :key="g" class="card" :class="{ on: goal === g }">
        <input :checked="goal === g" type="radio" :name="labelId" :value="g" class="radio" @change="pick(g)" />
        <span class="title">{{ t(`calc.goal.${g}`) }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.goal {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 0.875em;
}
/* A card each, as the picker's offer of the most common set: a soft box in the accent's outline, the one picked lit. */
.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 699px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.card:hover {
  border-color: var(--accent);
}
.card.on {
  background: var(--sel);
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.card:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.title {
  font-weight: bold;
}
</style>
