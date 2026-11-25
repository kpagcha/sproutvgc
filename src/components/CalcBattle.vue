<script setup lang="ts">
import { computed, useId } from 'vue'
import { ChevronDown, Eraser, SlidersHorizontal } from '@lucide/vue'
import { ability, condition } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  abilityOf,
  BOOSTED,
  CONDITIONAL_ABILITIES,
  MAX_ATTACKED,
  STAGE_MAX,
  STAGE_MIN,
  statsOf,
  STATUSES,
  type Battlefield,
  type Fighter,
  type Status,
  usesAttacked,
  usesFainted,
} from '@/lib/damage'
import { conditionName, sideOf, SPIKES } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import CalcConditionSearch from '@/components/CalcConditionSearch.vue'
import CalcCounter from '@/components/CalcCounter.vue'
import HpBar from '@/components/HpBar.vue'
import StageStepper from '@/components/StageStepper.vue'

// What the battle adds to a Pokémon of the damage calculator: its HP left (not on the solver, where each hit seen has
// its own), its status, its stat stages, whether its ability's condition is met (for one that waits on it), its allies
// fainted (Supreme Overlord, Last Respects), the times it's been hit (Rage Fist), and last what's on its side, a box
// folding (`sideOpen`): folded, what's on; open, its conditions to set (`CalcConditions`). The sides' In battle
// (`CalcSide`), and the solver's partners'.
const props = defineProps<{
  fighter: Fighter
  field: Battlefield
  data: MetaData | null | undefined
  /** On the opponent's side. */
  theirs?: boolean
  /** The solver's: no HP left. */
  inverse?: boolean
  sideOpen: boolean
}>()
const emit = defineEmits<{ 'update:fighter': [f: Fighter]; sideOpen: [open: boolean] }>()

const uid = useId()
const set = (patch: Partial<Fighter>) => emit('update:fighter', { ...props.fighter, ...patch })
const stats = computed(() => statsOf(props.fighter))
const conditional = computed(() => {
  const a = abilityOf(props.fighter)
  return a && CONDITIONAL_ABILITIES.includes(a) ? a : null
})
const overlord = computed(
  () => abilityOf(props.fighter) === 'supremeoverlord' || props.fighter.member.moves.some(usesFainted),
)
const rageFist = computed(() => props.fighter.member.moves.some(usesAttacked))
/** What's on its side, named on a line while its box is folded. */
const onSide = computed(() => [
  ...props.fighter.side.flatMap((s) => {
    const c = sideOf(s)
    return c ? [{ key: s, name: conditionName(c) }] : []
  }),
  ...(props.fighter.spikes && SPIKES.ref
    ? [{ key: 'spikes', name: `${refName(SPIKES.ref)} ×${props.fighter.spikes}` }]
    : []),
])
const statusName = (s: Status) => (s ? refName(condition(s)) : t('calc.healthy'))
const setStage = (i: number, v: number) => {
  const boosts = [...props.fighter.boosts] as Fighter['boosts']
  boosts[i] = v
  set({ boosts })
}
const hpOf = computed(() => (stats.value ? Math.max(1, Math.round((stats.value.hp * props.fighter.hp) / 100)) : 0))
// Typed in, each kept within its bounds, and the box shown the value kept even when it's the one it had.
function setHpPoints(e: Event) {
  const el = e.target as HTMLInputElement
  const v = Number(el.value)
  if (!stats.value) return
  const points = Number.isFinite(v) ? Math.min(stats.value.hp, Math.max(1, Math.round(v))) : hpOf.value
  el.value = String(points)
  // Kept exactly (not as a whole percent, which would round 150 of 207 HP to 72%, 149 HP).
  set({ hp: points >= stats.value.hp ? 100 : (points / stats.value.hp) * 100 })
}
</script>

<template>
  <div v-if="stats" class="battle-body">
    <!-- Its HP left: the bar, and its HP exactly, typed. -->
    <div v-if="!inverse" class="hp-row">
      <span class="muted row-label hp-label">{{ t('stat.hp') }}</span>
      <HpBar
        :model-value="fighter.hp"
        :max="stats.hp"
        :label="t('calc.hpPercent')"
        class="hp-bar"
        @update:model-value="set({ hp: $event })"
      />
      <span class="hp-nums">
        <input
          class="num-in"
          type="number"
          inputmode="numeric"
          min="1"
          :max="stats.hp"
          :value="hpOf"
          :aria-label="t('calc.hpPoints')"
          @change="setHpPoints"
        />
        <span class="muted">/ {{ stats.hp }}</span>
      </span>
    </div>
    <div class="row">
      <label class="muted row-label" :for="`${uid}-status`">{{ t('calc.statusLabel') }}</label>
      <select
        :id="`${uid}-status`"
        class="status"
        :value="fighter.status"
        @change="set({ status: ($event.target as HTMLSelectElement).value as Status })"
      >
        <option v-for="s in STATUSES" :key="s" :value="s">{{ statusName(s) }}</option>
      </select>
    </div>
    <!-- Its stat stages, a stepper each, as the speed pages' Speed stage, the five on one row. -->
    <div class="stages-row">
      <span class="muted">{{ t('calc.stagesShort') }}</span>
      <span class="stages" role="group" :aria-label="t('calc.stages')">
        <StageStepper
          v-for="(s, i) in BOOSTED"
          :key="s"
          :model-value="fighter.boosts[i]!"
          :min="STAGE_MIN"
          :max="STAGE_MAX"
          :label="t(`stat.${s}`)"
          :stat="t(`stat.${s}`)"
          compact
          class="stage"
          @update:model-value="setStage(i, $event)"
        />
      </span>
    </div>
    <div v-if="conditional || overlord || rageFist" class="mods">
      <button
        v-if="conditional"
        type="button"
        class="btn quiet mod"
        :class="{ on: fighter.abilityOn }"
        :aria-pressed="fighter.abilityOn"
        @click="set({ abilityOn: !fighter.abilityOn })"
      >
        {{ t('calc.abilityOn', { ability: refName(ability(conditional)) }) }}
      </button>
      <CalcCounter
        v-if="overlord"
        :model-value="fighter.fainted"
        :label="t('calc.fainted')"
        :max="5"
        :down="t('calc.faintedDown')"
        :up="t('calc.faintedUp')"
        @update:model-value="set({ fainted: $event })"
      />
      <CalcCounter
        v-if="rageFist"
        :model-value="fighter.attacked"
        :label="t('calc.attacked')"
        :max="MAX_ATTACKED"
        :down="t('calc.attackedDown')"
        :up="t('calc.attackedUp')"
        @update:model-value="set({ attacked: $event })"
      />
    </div>
    <!-- What's on its side, last: its toggle, as the field's Battle conditions, folding its box; those on counted on
         the heading too. -->
    <div class="side-box" :class="{ empty: !onSide.length }">
      <!-- Its toggle, as the field's Battle conditions; folded, those on named after it on its row. -->
      <div class="side-box-row">
        <button
          type="button"
          class="btn side-box-head"
          :class="{ on: sideOpen }"
          :aria-expanded="sideOpen"
          @click="emit('sideOpen', !sideOpen)"
        >
          <SlidersHorizontal :size="16" aria-hidden="true" />{{ t('calc.sideLabel')
          }}<span class="on-count" :class="{ none: !onSide.length }">{{ onSide.length }}</span
          ><ChevronDown :size="14" class="fold-chev" :class="{ open: sideOpen }" aria-hidden="true" />
        </button>
        <template v-if="!sideOpen">
          <span v-for="c in onSide" :key="c.key" class="side-item">{{ c.name }}</span>
        </template>
        <!-- Unfolded, its search (its own conditions alone) and Clear on its row, as the field's: beside it (on phones
             at the row's end). -->
        <span v-else class="side-tools">
          <CalcConditionSearch
            :sides="{ [theirs ? 'b' : 'a']: fighter }"
            @side="(_k, f) => emit('update:fighter', f)"
          />
          <button
            type="button"
            class="btn quiet small"
            :disabled="!onSide.length"
            @click="emit('update:fighter', { ...fighter, side: [], spikes: 0 })"
          >
            <Eraser :size="14" aria-hidden="true" />{{ t('calc.clearConditions') }}
          </button>
        </span>
      </div>
      <CalcConditions
        v-if="sideOpen"
        :field
        :side="{ key: theirs ? 'b' : 'a', fighter }"
        :data
        no-clear
        @side="(_k, f) => emit('update:fighter', f)"
      />
    </div>
  </div>
</template>

<style scoped>
.battle-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 0.9em;
}
.row-label {
  min-width: 3.4em;
}
/* Its HP: what it is on a line, the bar under it across the side, so there's room to drag it. */
.hp-row {
  display: grid;
  grid-template-columns: auto auto;
  grid-template-areas: 'label nums' 'bar bar';
  justify-content: space-between;
  align-items: center;
  gap: 6px 12px;
  font-size: 0.9em;
}
.hp-label {
  grid-area: label;
}
.hp-bar {
  grid-area: bar;
}
.hp-nums {
  grid-area: nums;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}
/* Numbers alone, no spinner over them: typed, or the slider dragged. */
.num-in {
  width: 3.6em;
  padding: 2px 6px;
  font: inherit;
  text-align: right;
  appearance: textfield;
  -moz-appearance: textfield;
}
.num-in::-webkit-inner-spin-button,
.num-in::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}
.status {
  padding: 3px 6px;
  font: inherit;
}
.stages-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9em;
}
.stages {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.mods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.mod {
  min-height: 0;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  line-height: inherit;
}
/* Quiet, flat and muted until it's on: then in full, a wash under it (the quiet button's). */
.mod.on {
  font-weight: bold;
}
/* What's on its side: at the foot of In battle. */
.side-box {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* Its toggle and, folded, those on after it, a row wrapping where they don't fit. */
.side-box-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.side-box-head {
  flex: none;
}
.side-tools {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}
@media (max-width: 899px) {
  .side-tools {
    margin-left: auto;
  }
}
.fold-chev {
  flex: none;
  transition: transform 0.15s;
}
.fold-chev.open {
  transform: rotate(180deg);
}
/* What's on, named: bold, as the field's are beside Battle conditions. */
.side-item {
  font-size: 0.9em;
  font-weight: bold;
  white-space: nowrap;
}
</style>
