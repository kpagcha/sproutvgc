<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { t } from '@/i18n'
import type { OpponentUnknowns } from '@/lib/damageReverse'

// The damage solver's goal, one choice over What fits: what it works out of each side. Its spread (the opponent's stat
// points), its build (its nature, item and stat points; the default) or what yours needs (your nature and stat points,
// and its build); Custom when what's worked out, part by part from the bands, is none of them. A card each, saying what
// it works out.
const props = defineProps<{
  /** Whether a side's item is fixed (a Mega's stone, Ogerpon's mask), never worked out. */
  fixed: { a: boolean; b: boolean }
}>()
const work = defineModel<OpponentUnknowns>('work', { required: true })
const workYours = defineModel<OpponentUnknowns>('workYours', { required: true })
const emit = defineEmits<{ changed: []; custom: [] }>()

type Part = keyof OpponentUnknowns
type Side = 'a' | 'b'
const PARTS: readonly Part[] = ['nature', 'item', 'points']
const NONE: OpponentUnknowns = { nature: false, item: false, points: false }
const ALL: OpponentUnknowns = { nature: true, item: true, points: true }
const GOALS = {
  spread: { a: NONE, b: { nature: false, item: false, points: true } },
  build: { a: NONE, b: ALL },
  need: { a: { nature: true, item: false, points: true }, b: ALL },
} as const
type Goal = keyof typeof GOALS | 'custom'

// A side's work as it's read: its item not, where it can't be anything else.
const norm = (w: OpponentUnknowns, s: Side): OpponentUnknowns => ({ ...w, item: w.item && !props.fixed[s] })
const same = (x: OpponentUnknowns, y: OpponentUnknowns) => PARTS.every((p) => x[p] === y[p])
const matches = (g: keyof typeof GOALS) =>
  same(norm(workYours.value, 'a'), norm(GOALS[g].a, 'a')) && same(norm(work.value, 'b'), norm(GOALS[g].b, 'b'))
/** Custom picked stays picked, even where what's set is one of the goals. */
const customPicked = shallowRef(false)
const labelId = useId()
const goal = computed<Goal>({
  get: () => (customPicked.value ? 'custom' : ((['spread', 'build', 'need'] as const).find(matches) ?? 'custom')),
  set: (g) => {
    customPicked.value = g === 'custom'
    if (g === 'custom') return void emit('custom')
    workYours.value = { ...GOALS[g].a }
    work.value = { ...GOALS[g].b }
    emit('changed')
  },
})
const OPTIONS = ['spread', 'build', 'need', 'custom'] as const
</script>

<template>
  <div class="goal" role="radiogroup" :aria-labelledby="labelId">
    <span :id="labelId" class="label muted">{{ t('calc.goal.label') }}</span>
    <div class="cards">
      <label v-for="g in OPTIONS" :key="g" class="card" :class="{ on: goal === g }">
        <input v-model="goal" type="radio" :name="labelId" :value="g" class="radio" />
        <span class="title">{{ t(`calc.goal.${g}`) }}</span>
        <span class="about muted">{{ t(`calc.goal.${g}About`) }}</span>
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
.about {
  font-size: 0.8125em;
  line-height: 1.35;
}
</style>
