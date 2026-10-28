<script setup lang="ts">
import { computed, shallowRef, useId, watch, type ComponentPublicInstance } from 'vue'
import { ChevronDown, Minus, Plus } from '@lucide/vue'
import { ability, condition, pokemon, type MoveId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import type { MetaData, Spread } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  abilityOf,
  battlerOf,
  BOOSTED,
  CONDITIONAL_ABILITIES,
  hit,
  STAGE_MAX,
  STAGE_MIN,
  statsOf,
  STATUSES,
  type Battlefield,
  type Fighter,
  type HitOptions,
  type Status,
} from '@/lib/damage'
import type { Field, Member } from '@/lib/team'
import { conditionName, sideOf, SPIKES } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import DamageRow from '@/components/DamageRow.vue'
import HpBar from '@/components/HpBar.vue'
import StageStepper from '@/components/StageStepper.vue'
import TeamSlot from '@/components/TeamSlot.vue'

// One side of the damage calculator, a panel in five parts, each on a row the other side's shares on wide screens (so
// both sides' parts line up whatever each holds): its heading (whose it is, by its color, opening its Pokémon's picker;
// what loads a set), its set as a team builder's slot (`TeamSlot`, every part a button opening its picker, its
// Pokémon's glowing while yours has none), its moves' damage against the other side (`DamageRow`, a row each, a status move's dimmed), and what the
// battle adds to it: its HP left, its status, its stat stages, whether its ability's condition is met (for one that
// waits on it), Supreme Overlord's fainted allies; and last, what's on its side, a box of its own folding (`sideOpen`,
// both sides' together): folded, what's on; open, its conditions to set (`CalcConditions`).
// `theirs`: the opponent's side, its knockouts bad news.
const props = defineProps<{
  fighter: Fighter
  other: Fighter
  field: Battlefield
  theirs?: boolean
  label: string
  active: Field | null
  spreads: readonly Spread[]
  data: MetaData | null | undefined
  sideOpen: boolean
}>()
const emit = defineEmits<{
  'update:fighter': [f: Fighter]
  field: [f: Field]
  clear: []
  sideOpen: [open: boolean]
}>()
defineSlots<{ actions(): unknown }>()

const uid = useId()
const set = (patch: Partial<Fighter>) => emit('update:fighter', { ...props.fighter, ...patch })
const change = (patch: Partial<Member>) => set({ member: { ...props.fighter.member, ...patch } })

/** The slot's card, which the picker's drawer leaves clear. */
const card = shallowRef<HTMLElement | null>(null)
const setCard = (el: Element | ComponentPublicInstance | null) =>
  (card.value = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null))
defineExpose({ card })

// Each move's crit and hits, and which rows are unfolded, by the move: a move picked again finds them as left.
const opts = shallowRef<Partial<Record<MoveId, HitOptions>>>({})
const setOpt = (mv: MoveId, patch: HitOptions) =>
  (opts.value = { ...opts.value, [mv]: { ...opts.value[mv], ...patch } })
const unfolded = shallowRef<Partial<Record<MoveId, boolean>>>({})
watch(
  () => props.fighter.member.pokemon,
  () => {
    opts.value = {}
    unfolded.value = {}
  },
)

const moves = computed(() => props.fighter.member.moves.filter((x): x is MoveId => !!x))
// Each move a row, in its place; a status move's as the rest's, dimmed, with no damage.
const hits = computed(() =>
  moves.value.map((mv) => ({
    mv,
    hit: MOVES[mv]?.category === 'status' ? null : hit(props.fighter, props.other, mv, props.field, opts.value[mv]),
  })),
)
const otherName = computed(() => {
  const id = battlerOf(props.other)
  return id ? refName(pokemon(id)) : null
})

const shown = computed(() => battlerOf(props.fighter))

// The battle's part.
const stats = computed(() => statsOf(props.fighter))
const conditional = computed(() => {
  const a = abilityOf(props.fighter)
  return a && CONDITIONAL_ABILITIES.includes(a) ? a : null
})
const overlord = computed(() => abilityOf(props.fighter) === 'supremeoverlord')
/** What's on its side, named on a line while its box is folded. */
const onSide = computed(() => [
  ...props.fighter.side.flatMap((s) => {
    const c = sideOf(s)
    return c ? [{ key: s, icon: c.icon, name: conditionName(c) }] : []
  }),
  ...(props.fighter.spikes && SPIKES.ref
    ? [{ key: 'spikes', icon: SPIKES.icon, name: `${refName(SPIKES.ref)} ×${props.fighter.spikes}` }]
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
  set({ hp: Math.min(100, Math.max(1, Math.round((points / stats.value.hp) * 100))) })
}
</script>

<template>
  <section class="side panel" :class="{ theirs }">
    <div class="side-head">
      <h2>
        <button type="button" class="side-title" @click="emit('field', 'pokemon')">{{ label }}</button>
      </h2>
      <span class="side-actions"><slot name="actions" /></span>
    </div>

    <div class="body">
      <ul class="slot">
        <TeamSlot
          :ref="setCard"
          :member="fighter.member"
          :active
          :spreads
          :evolved="fighter.mega"
          :hint="!theirs && !fighter.member.pokemon"
          @mega="set({ mega: !fighter.mega })"
          @field="emit('field', $event)"
          @change="change"
          @clear="emit('clear')"
        />
      </ul>
    </div>

    <!-- Its moves against the other side. -->
    <div class="results">
      <template v-if="shown">
        <h3 class="sub">
          {{ otherName ? t('calc.against', { name: otherName }) : t('calc.movesHead') }}
        </h3>
        <p v-if="!otherName" class="muted hint">{{ t('calc.pickOther') }}</p>
        <p v-else-if="!moves.length" class="muted hint">{{ t('calc.pickMoves') }}</p>
        <ul v-else class="damages">
          <DamageRow
            v-for="h in hits"
            :key="h.mv"
            :id="h.mv"
            :hit="h.hit"
            :theirs
            :crit="!!opts[h.mv]?.crit"
            :hits="opts[h.mv]?.hits"
            :single="!!opts[h.mv]?.single"
            :open="!!unfolded[h.mv]"
            @update:open="unfolded = { ...unfolded, [h.mv]: $event }"
            @crit="setOpt(h.mv, { crit: $event })"
            @hits="setOpt(h.mv, { hits: $event })"
            @single="setOpt(h.mv, { single: $event })"
          />
        </ul>
      </template>
    </div>

    <!-- What the battle adds to it. -->
    <div class="battle">
      <template v-if="shown && stats">
        <h3 class="sub">{{ t('calc.battle') }}</h3>
        <!-- Its HP left: the bar, and its HP exactly, typed. -->
        <div class="row hp-row">
          <span class="muted row-label">{{ t('stat.hp') }}</span>
          <HpBar
            :model-value="fighter.hp"
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
        <div v-if="conditional || overlord" class="mods">
          <button
            v-if="conditional"
            type="button"
            class="btn mod"
            :class="{ on: fighter.abilityOn }"
            :aria-pressed="fighter.abilityOn"
            @click="set({ abilityOn: !fighter.abilityOn })"
          >
            {{ t('calc.abilityOn', { ability: refName(ability(conditional)) }) }}
          </button>
          <span v-if="overlord" class="btn mod fainted" :class="{ on: fighter.fainted }">
            {{ t('calc.fainted') }}
            <button
              type="button"
              :disabled="fighter.fainted <= 0"
              :aria-label="t('calc.faintedDown')"
              @click="set({ fainted: fighter.fainted - 1 })"
            >
              <Minus :size="12" aria-hidden="true" />
            </button>
            <output>{{ fighter.fainted }}</output>
            <button
              type="button"
              :disabled="fighter.fainted >= 5"
              :aria-label="t('calc.faintedUp')"
              @click="set({ fainted: fighter.fainted + 1 })"
            >
              <Plus :size="12" aria-hidden="true" />
            </button>
          </span>
        </div>
      </template>
    </div>

    <!-- What's on its side, a box of its own on a row of its own (level with the other side's), folding. -->
    <div class="side-row">
      <template v-if="shown && stats">
        <div class="side-box" :class="{ empty: !onSide.length }">
          <button type="button" class="side-box-head" :aria-expanded="sideOpen" @click="emit('sideOpen', !sideOpen)">
            <span class="side-box-title">
              {{ t('calc.sideLabel')
              }}<span class="on-count" :class="{ none: !onSide.length }">{{ onSide.length }}</span>
            </span>
            <ChevronDown :size="16" class="fold-chev" :class="{ open: sideOpen }" aria-hidden="true" />
          </button>
          <CalcConditions
            v-if="sideOpen"
            :field
            :side="{ key: theirs ? 'b' : 'a', fighter }"
            :data
            @side="(_k, f) => emit('update:fighter', f)"
          />
          <ul v-else-if="onSide.length" class="side-list">
            <li v-for="c in onSide" :key="c.key" class="side-item">
              <component :is="c.icon" v-if="c.icon" :size="14" aria-hidden="true" />{{ c.name }}
            </li>
          </ul>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.side {
  --side: var(--accent);
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  margin: 0;
}
.side.theirs {
  --side: var(--opponent);
}
.side-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 8px;
}
.side-head h2 {
  margin: 0;
  font-size: 1.1em;
}
/* Whose it is, a button opening its Pokémon's picker, as the slot's name does. */
.side-title {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.side-title:hover {
  color: var(--accent);
}
/* Whose it is, by its side's color along its heading. */
.side-head h2::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  background: var(--side);
  border: 1px solid var(--ink);
}
/* On phones, its tab over it names it. */
@media (max-width: 899px) {
  .side-head {
    justify-content: flex-end;
  }
  .side-head h2 {
    display: none;
  }
}
.side-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.slot {
  margin: 0;
  padding: 0;
  list-style: none;
}
.sub {
  margin: 0 0 8px;
  font-size: 0.95em;
}
.hint {
  margin: 0;
  font-size: 0.9em;
}
.damages {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}
/* The rows' rules between them, not under the last: the battle's part has its own over it. */
.damages > :last-child {
  border-bottom: none;
}
.battle {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* With no Pokémon, its moves' and battle's parts have nothing: no room kept for them. */
.results:empty,
.battle:empty,
.side-row:empty {
  display: none;
}
.battle:not(:empty) {
  padding-top: 14px;
  border-top: 1px solid var(--border);
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
.hp-row {
  flex-wrap: nowrap;
}
.hp-bar {
  flex: 1;
}
.hp-nums {
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
.mod.on {
  background: var(--sel);
}
.fainted {
  cursor: default;
}
.fainted button {
  display: flex;
  padding: 1px 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.fainted button:disabled {
  opacity: 0.35;
  cursor: default;
}
/* What's on its side: a box of its own, outlined in its side's color once there's something, dashed while there's
   nothing, so it's seen either way. */
.side-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--panel-alt);
  border: 2px solid var(--ink);
  border-left: 6px solid var(--side);
}
.side-box.empty {
  border: 2px dashed var(--border);
  border-left: 6px solid color-mix(in srgb, var(--side) 45%, var(--border));
}
.side-box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.fold-chev {
  flex: none;
  transition: transform 0.15s;
}
.fold-chev.open {
  transform: rotate(180deg);
}
.side-box-title {
  font-weight: bold;
}
.side-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.side-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-size: 0.9em;
  font-weight: bold;
  background: var(--sel);
  border: 1px solid var(--ink);
}
</style>
