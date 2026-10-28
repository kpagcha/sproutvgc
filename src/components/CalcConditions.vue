<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { ChevronDown, Circle, Square } from '@lucide/vue'
import type { MetaData } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { MAX_SPIKES, type Battlefield, type FieldEffect, type Fighter, type SideEffect } from '@/lib/damage'
import {
  conditionName,
  fieldEffects,
  isCommon,
  sideGroups,
  SPIKES,
  spikesOn,
  terrains,
  weathers,
  type Condition,
} from '@/components/calcConditions'
import StageStepper from '@/components/StageStepper.vue'

// The damage calculator's battle conditions, in place where they apply: the whole field's (without `side`: the weather
// and the terrain, one of each at a time, a bar of joined choices, each a radio's circle; then what's on the field,
// any together, separate chips, each a checkbox's square), or one side's (`side`: its chips), each filled when on. Of
// the chips, the common ones in the meta shown (`isCommon`) first; the rest under More (a side's grouped: its ally's
// help, the hazards it came in on, what's on the Pokémon itself), as last left, unfolded anyway when one is on.
const props = defineProps<{
  field: Battlefield
  side?: { key: 'a' | 'b'; fighter: Fighter }
  data: MetaData | null | undefined
}>()
const emit = defineEmits<{
  field: [f: Battlefield]
  side: [key: 'a' | 'b', f: Fighter]
}>()

const setField = (patch: Partial<Battlefield>) => emit('field', { ...props.field, ...patch })
const toggleField = (e: FieldEffect) =>
  setField({
    effects: props.field.effects.includes(e) ? props.field.effects.filter((x) => x !== e) : [...props.field.effects, e],
  })
const toggleSide = (s: SideEffect) => {
  const f = props.side!.fighter
  emit('side', props.side!.key, { ...f, side: f.side.includes(s) ? f.side.filter((x) => x !== s) : [...f.side, s] })
}

// Common or not, worked out once per meta.
const common = computed(() => {
  const yes = new Set<string>()
  for (const c of [...fieldEffects, ...sideGroups.flatMap((g) => g.items), SPIKES])
    if (isCommon(c, props.data)) yes.add(c.key)
  return yes
})
const fieldCommon = computed(() => fieldEffects.filter((c) => common.value.has(c.key)))
const fieldRare = computed(() => fieldEffects.filter((c) => !common.value.has(c.key)))
const sideCommon = computed(() => sideGroups.flatMap((g) => g.items.filter((c) => common.value.has(c.key))))
const spikesCommon = computed(() => spikesOn && common.value.has('spikes'))
const sideRare = computed(() =>
  sideGroups
    .map((g) => ({
      group: g.group,
      items: g.items.filter((c) => !common.value.has(c.key)),
      spikes: g.group === 'hazards' && spikesOn && !spikesCommon.value,
    }))
    .filter((g) => g.items.length || g.spikes),
)
const rareCount = computed(() =>
  props.side ? sideRare.value.reduce((n, g) => n + g.items.length + (g.spikes ? 1 : 0), 0) : fieldRare.value.length,
)

// Its More as last left (the field's, each side's), and unfolded anyway when one of what's under it is on.
const MORE_KEY = 'sproutvgc.calc.conditionsMore'
const moreKey = props.side?.key ?? 'field'
function readMore(): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(MORE_KEY) ?? 'null')
    return v && typeof v === 'object' ? (v as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}
const rareOn = () => {
  const f = props.side?.fighter
  return f
    ? sideRare.value.some((g) => g.items.some((c) => f.side.includes(c.key)) || (g.spikes && f.spikes))
    : fieldRare.value.some((c) => props.field.effects.includes(c.key))
}
const moreOpen = shallowRef(!!readMore()[moreKey] || rareOn())
function toggleMore() {
  moreOpen.value = !moreOpen.value
  try {
    localStorage.setItem(MORE_KEY, JSON.stringify({ ...readMore(), [moreKey]: moreOpen.value }))
  } catch {
    // Storage unavailable: folded again next time.
  }
}

const [DefineChip, Chip] = createReusableTemplate<{ c: Condition<string>; on: boolean; toggle: () => void }>()
const [DefineMore, More] = createReusableTemplate()
</script>

<template>
  <!-- A condition that can be on with others: a chip with a checkbox's square. -->
  <DefineChip v-slot="{ c, on, toggle }">
    <button type="button" class="chip no-lift" :class="{ on }" :aria-pressed="on" @click="toggle">
      <span class="mark" aria-hidden="true"><Square :size="14" /></span>
      <component :is="c.icon" v-if="c.icon" :size="16" aria-hidden="true" />{{ conditionName(c) }}
    </button>
  </DefineChip>
  <DefineMore>
    <button v-if="rareCount" type="button" class="more" :aria-expanded="moreOpen" @click="toggleMore">
      {{ t('calc.moreConditions', { n: rareCount })
      }}<ChevronDown :size="14" class="chev" :class="{ open: moreOpen }" aria-hidden="true" />
    </button>
  </DefineMore>

  <!-- One side's. -->
  <div v-if="side" class="conditions">
    <div class="chips" role="group" :aria-label="t('calc.sideLabel')">
      <Chip
        v-for="c in sideCommon"
        :key="c.key"
        :c
        :on="side.fighter.side.includes(c.key)"
        :toggle="() => toggleSide(c.key)"
      />
      <StageStepper
        v-if="spikesCommon"
        :model-value="side.fighter.spikes"
        :min="0"
        :max="MAX_SPIKES"
        :label="refName(SPIKES.ref!)"
        :stat="refName(SPIKES.ref!)"
        unsigned
        class="spikes"
        @update:model-value="emit('side', side.key, { ...side.fighter, spikes: $event })"
      />
      <More />
    </div>
    <div v-if="moreOpen" class="rare">
      <div v-for="g in sideRare" :key="g.group" class="sub">
        <span class="sub-label muted">{{ t(`calc.sideGroup.${g.group}`) }}</span>
        <div class="chips" role="group" :aria-label="t(`calc.sideGroup.${g.group}`)">
          <Chip
            v-for="c in g.items"
            :key="c.key"
            :c
            :on="side.fighter.side.includes(c.key)"
            :toggle="() => toggleSide(c.key)"
          />
          <StageStepper
            v-if="g.spikes"
            :model-value="side.fighter.spikes"
            :min="0"
            :max="MAX_SPIKES"
            :label="refName(SPIKES.ref!)"
            :stat="refName(SPIKES.ref!)"
            unsigned
            class="spikes"
            @update:model-value="emit('side', side.key, { ...side.fighter, spikes: $event })"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- The whole field's. -->
  <div v-else class="conditions">
    <section v-for="kind in ['weather', 'terrain'] as const" :key="kind" class="group">
      <h3>{{ t(`calc.${kind}`) }}</h3>
      <div class="choices" role="radiogroup" :aria-label="t(`calc.${kind}`)">
        <button
          v-for="c in kind === 'weather' ? weathers : terrains"
          :key="c.key"
          type="button"
          role="radio"
          class="choice no-lift"
          :class="{ on: field[kind] === c.key }"
          :aria-checked="field[kind] === c.key"
          @click="setField({ [kind]: c.key })"
        >
          <span class="mark round" aria-hidden="true"><Circle :size="14" /></span>
          <component :is="c.icon" v-if="c.icon" :size="16" aria-hidden="true" />{{ conditionName(c) }}
        </button>
      </div>
    </section>
    <section v-if="fieldEffects.length" class="group">
      <h3>{{ t('calc.fieldLabel') }}</h3>
      <div class="chips" role="group" :aria-label="t('calc.fieldLabel')">
        <Chip
          v-for="c in fieldCommon"
          :key="c.key"
          :c
          :on="field.effects.includes(c.key)"
          :toggle="() => toggleField(c.key)"
        />
        <More />
      </div>
      <div v-if="moreOpen" class="chips rare">
        <Chip
          v-for="c in fieldRare"
          :key="c.key"
          :c
          :on="field.effects.includes(c.key)"
          :toggle="() => toggleField(c.key)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.conditions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.group h3 {
  margin: 0 0 8px;
  font-size: 0.95em;
}
/* The less common ones, under More: set apart by a rule. */
.rare {
  margin-top: -6px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}
.sub + .sub {
  margin-top: 10px;
}
.sub-label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.8em;
}
.mark {
  position: relative;
  display: inline-flex;
  flex: none;
  color: var(--muted);
}
.on .mark {
  color: var(--text);
}
/* On, filled inside its outline, a gap between them, as a checkbox's or a radio's. */
.on .mark::after {
  content: '';
  position: absolute;
  inset: 4px;
  background: currentColor;
}
.on .mark.round::after {
  border-radius: 50%;
}
/* One at a time: joined cells in one outline, wrapping as one block (each cell's outline overlapping its neighbors'). */
.choices {
  display: flex;
  flex-wrap: wrap;
  padding: 2px 0 0 2px;
}
.choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: -2px 0 0 -2px;
  padding: 5px 10px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--text);
  background: var(--panel-alt);
  border: 2px solid var(--ink);
  cursor: pointer;
}
.choice:hover {
  background: var(--hover);
}
.choice.on {
  background: var(--sel);
}
/* Any together: chips apart, each outlined with its shadow, as buttons are. */
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--text);
  background: var(--panel-alt);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  cursor: pointer;
}
.chip:hover {
  background: var(--hover);
}
.chip.on {
  background: var(--sel);
}
.spikes {
  font-size: 0.9em;
}
/* More: a quiet link-like toggle after the chips. */
.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  font: inherit;
  font-size: 0.875em;
  font-weight: bold;
  color: var(--link);
  background: none;
  border: 0;
  cursor: pointer;
}
.more:hover {
  text-decoration: underline;
}
.chev {
  transition: transform 0.15s;
}
.chev.open {
  transform: rotate(180deg);
}
</style>
