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
  MAX_ATTACKED,
  STAGE_MAX,
  STAGE_MIN,
  statsOf,
  STATUSES,
  type Battlefield,
  type Fighter,
  type HitOptions,
  type Status,
  usesAttacked,
  usesFainted,
} from '@/lib/damage'
import type { Field, Member } from '@/lib/team'
import { conditionName, sideOf, SPIKES } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import DamageRow from '@/components/DamageRow.vue'
import HpBar from '@/components/HpBar.vue'
import StageStepper from '@/components/StageStepper.vue'
import TeamSlot from '@/components/TeamSlot.vue'

// One side of the damage calculator (with no Pokémon yet, one button picking it), a panel in five parts, each on a row the other side's shares on wide screens (so
// both sides' parts line up whatever each holds): its heading (whose it is, by its color, opening its Pokémon's picker;
// what loads a set), its set as a team builder's slot (`TeamSlot`, every part a button opening its picker) but its
// moves, which are its rows of damage against the other side (`DamageRow`, a row each, a status move's dimmed, its name
// picking another), and what the
// battle adds to it: its HP left, its status, its stat stages, whether its ability's condition is met (for one that
// waits on it), its allies fainted (Supreme Overlord, Last Respects), the times it's been hit (Rage Fist); and last, what's on its side, a box of its own folding (`sideOpen`,
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

const otherName = computed(() => {
  const id = battlerOf(props.other)
  return id ? refName(pokemon(id)) : null
})
// Each of its four moves a row, in its place (the set's card leaving them out): a status move's as the rest's, dimmed,
// with no damage; one not picked yet a placeholder picking it; with no other side, their names alone.
const hits = computed(() =>
  props.fighter.member.moves.map((mv, i) => ({
    i: i as Field,
    mv,
    hit:
      !mv || !otherName.value || MOVES[mv]?.category === 'status'
        ? null
        : hit(props.fighter, props.other, mv, props.field, opts.value[mv]),
  })),
)

const shown = computed(() => battlerOf(props.fighter))

// The battle's part.
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
      <ul v-if="fighter.member.pokemon" class="slot">
        <TeamSlot
          :ref="setCard"
          :member="fighter.member"
          :active
          :spreads
          :evolved="fighter.mega"
          no-moves
          @mega="set({ mega: !fighter.mega })"
          @field="emit('field', $event)"
          @change="change"
          @clear="emit('clear')"
        />
      </ul>
      <!-- With none yet, one button picking it, glowing for yours until its picker opens. -->
      <button
        v-else
        :ref="setCard"
        type="button"
        class="pick-mon"
        :class="{ active: active === 'pokemon', beckon: !theirs && !active }"
        @click="emit('field', 'pokemon')"
      >
        <Plus :size="18" aria-hidden="true" />{{ t(theirs ? 'compare.pickOpponent' : 'compare.pickYours') }}
      </button>
    </div>

    <!-- Its moves against the other side. -->
    <div class="results">
      <template v-if="shown">
        <h3 class="sub">
          {{ otherName ? t('calc.against', { name: otherName }) : t('calc.movesHead') }}
        </h3>
        <p v-if="!otherName" class="muted hint">{{ t('calc.pickOther') }}</p>
        <ul class="damages">
          <DamageRow
            v-for="h in hits"
            :key="h.i"
            :id="h.mv"
            :hit="h.hit"
            :idle="!otherName"
            :active="active === h.i"
            :theirs
            :crit="!!(h.mv && opts[h.mv]?.crit)"
            :hits="h.mv ? opts[h.mv]?.hits : undefined"
            :single="!!(h.mv && opts[h.mv]?.single)"
            :doubled="!!(h.mv && opts[h.mv]?.doubled)"
            :stockpile="h.mv ? opts[h.mv]?.stockpile : undefined"
            :open="!!h.mv && !!unfolded[h.mv]"
            @update:open="h.mv && (unfolded = { ...unfolded, [h.mv]: $event })"
            @pick="emit('field', h.i)"
            @crit="h.mv && setOpt(h.mv, { crit: $event })"
            @hits="h.mv && setOpt(h.mv, { hits: $event })"
            @single="h.mv && setOpt(h.mv, { single: $event })"
            @doubled="h.mv && setOpt(h.mv, { doubled: $event })"
            @stockpile="h.mv && setOpt(h.mv, { stockpile: $event })"
          />
        </ul>
      </template>
    </div>

    <!-- What the battle adds to it. -->
    <div class="battle">
      <template v-if="shown && stats">
        <h3 class="sub">{{ t('calc.battle') }}</h3>
        <!-- Its HP left: the bar, and its HP exactly, typed. -->
        <div class="hp-row">
          <span class="muted row-label hp-label">{{ t('stat.hp') }}</span>
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
        <div v-if="conditional || overlord || rageFist" class="mods">
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
          <span v-if="overlord" class="btn mod counter" :class="{ on: fighter.fainted }">
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
          <span v-if="rageFist" class="btn mod counter" :class="{ on: fighter.attacked }">
            {{ t('calc.attacked') }}
            <button
              type="button"
              :disabled="fighter.attacked <= 0"
              :aria-label="t('calc.attackedDown')"
              @click="set({ attacked: fighter.attacked - 1 })"
            >
              <Minus :size="12" aria-hidden="true" />
            </button>
            <output>{{ fighter.attacked }}</output>
            <button
              type="button"
              :disabled="fighter.attacked >= MAX_ATTACKED"
              :aria-label="t('calc.attackedUp')"
              @click="set({ attacked: fighter.attacked + 1 })"
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
  gap: 28px;
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
/* On phones, its tab over it names it: its menu beside its set, rather than on a row of its own. */
@media (max-width: 899px) {
  .side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 8px;
  }
  .side > * {
    grid-column: 1 / -1;
  }
  .side > .side-head {
    grid-row: 1;
    grid-column: 2;
    align-self: start;
  }
  .side > .body {
    grid-row: 1;
    grid-column: 1;
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
/* With no Pokémon yet, one button picking it, as a picker's box; for yours, glowing in the accent and back until it's
   tapped (the team builder's first step's). */
.pick-mon {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 8px 14px;
  font: inherit;
  font-weight: bold;
  color: var(--muted);
  text-align: left;
  background: var(--panel);
  border: 2px dashed var(--border);
  cursor: pointer;
}
.pick-mon:hover {
  color: var(--link);
  border-color: var(--link);
}
.pick-mon.active {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.pick-mon.beckon {
  animation: beckon 2.4s ease-in-out infinite;
}
@keyframes beckon {
  0%,
  100% {
    color: var(--muted);
    border-color: var(--border);
  }
  50% {
    color: var(--accent);
    border-color: var(--accent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pick-mon.beckon {
    animation: none;
    color: var(--accent);
    border-color: var(--accent);
  }
}
/* Each part's heading, quiet: the room around it, not a rule, sets the parts apart. */
.sub {
  margin: 0 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
.hint {
  margin: 0;
  font-size: 0.9em;
}
.damages {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hint + .damages {
  margin-top: 8px;
}
.battle {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* With no Pokémon, its moves' and battle's parts have nothing: no room kept for them. */
.results:empty,
.battle:empty,
.side-row:empty {
  display: none;
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
.counter {
  cursor: default;
}
.counter button {
  display: flex;
  padding: 1px 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.counter button:disabled {
  opacity: 0.35;
  cursor: default;
}
/* What's on its side: a part as the others, its heading folding it. */
.side-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8em;
  font-weight: bold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
.side-box-head:hover .side-box-title {
  color: var(--text);
}
.side-box-head .fold-chev {
  color: var(--muted);
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
