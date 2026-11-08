<script setup lang="ts">
import { computed, shallowRef, useId, watch, type ComponentPublicInstance } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { ChevronDown, Eraser, Plus, SlidersHorizontal } from '@lucide/vue'
import { ability, condition, pokemon, type MoveId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import type { MetaData } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  abilityOf,
  battlerOf,
  BOOSTED,
  pooledView,
  CONDITIONAL_ABILITIES,
  FIELD_MOVES,
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
import CalcCounter from '@/components/CalcCounter.vue'
import DamageRow from '@/components/DamageRow.vue'
import PokemonIcon from '@/components/PokemonIcon'
import HpBar from '@/components/HpBar.vue'
import StageStepper from '@/components/StageStepper.vue'
import TeamSlot from '@/components/TeamSlot.vue'

// One side of the damage calculator (with no Pokémon yet, one button picking it), a panel in five parts, each on a row the other side's shares on wide screens (so
// both sides' parts line up whatever each holds): its heading (whose it is, by its color, opening its Pokémon's picker;
// what loads a set), its set as a team builder's slot (`TeamSlot`, every part a button opening its picker) but its
// moves, which are its rows of damage against the other side (`DamageRow`, a row each, a status move's dimmed, its name
// picking another), and what the
// battle adds to it: its HP left, its status, its stat stages, whether its ability's condition is met (for one that
// waits on it), its allies fainted (Supreme Overlord, Last Respects), the times it's been hit (Rage Fist), and last
// what's on its side, a box folding (`sideOpen`, both sides' together; how many are on counted on In battle's heading):
// folded, what's on; open, its conditions to set (`CalcConditions`).
// `theirs`: the opponent's side, its knockouts bad news.
const props = defineProps<{
  fighter: Fighter
  other: Fighter
  field: Battlefield
  theirs?: boolean
  label: string
  active: Field | null
  data: MetaData | null | undefined
  sideOpen: boolean
  /** Its moves folded away, its heading alone. */
  movesFolded: boolean
  /** What the battle adds to it folded away, its heading alone. */
  battleFolded: boolean
}>()
const emit = defineEmits<{
  'update:fighter': [f: Fighter]
  field: [f: Field]
  clear: []
  sideOpen: [open: boolean]
  /** The whole field's weather or terrain set from a move's row. */
  battlefield: [f: Battlefield]
  movesFolded: [folded: boolean]
  battleFolded: [folded: boolean]
  /** Its moves' options as set on their rows, for what else counts them (the threats). */
  opts: [opts: Partial<Record<MoveId, HitOptions>>]
}>()
defineSlots<{ actions(): unknown }>()

const uid = useId()
const [DefineFainted, ReuseFainted] = createReusableTemplate()
const [DefineAttacked, ReuseAttacked] = createReusableTemplate()
const set = (patch: Partial<Fighter>) => emit('update:fighter', { ...props.fighter, ...patch })
// Its nature or points set, it's at its own rather than at every set.
const change = (patch: Partial<Member>) =>
  set({
    member: { ...props.fighter.member, ...patch },
    ...(('nature' in patch || 'points' in patch) && { sets: false }),
  })

/** The slot's card, which the picker's drawer leaves clear. */
const card = shallowRef<HTMLElement | null>(null)
const setCard = (el: Element | ComponentPublicInstance | null) =>
  (card.value = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null))
defineExpose({ card })

// Each move's crit and hits, and which rows are unfolded, by the move: a move picked again finds them as left.
const opts = shallowRef<Partial<Record<MoveId, HitOptions>>>({})
const setOpt = (mv: MoveId, patch: HitOptions) =>
  (opts.value = { ...opts.value, [mv]: { ...opts.value[mv], ...patch } })
watch(opts, (o) => emit('opts', o))
const unfolded = shallowRef<Partial<Record<MoveId, boolean>>>({})
watch(
  () => props.fighter.member.pokemon,
  () => {
    opts.value = {}
    unfolded.value = {}
  },
)

const otherId = computed(() => battlerOf(props.other))
const otherName = computed(() => (otherId.value ? refName(pokemon(otherId.value)) : null))
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
/** At every set, its pooled points and the stats they give, for its compact row to show. */
const pooled = computed(() => pooledView(props.fighter, props.data))

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
  set({ hp: Math.min(100, Math.max(1, Math.round((points / stats.value.hp) * 100))) })
}
</script>

<template>
  <section class="side panel" :class="{ theirs }">
    <!-- Its counts of the battle (allies fainted, times hit), in In battle and in the row of the move each changes. -->
    <DefineFainted>
      <CalcCounter
        :model-value="fighter.fainted"
        :label="t('calc.fainted')"
        :max="5"
        :down="t('calc.faintedDown')"
        :up="t('calc.faintedUp')"
        @update:model-value="set({ fainted: $event })"
      />
    </DefineFainted>
    <DefineAttacked>
      <CalcCounter
        :model-value="fighter.attacked"
        :label="t('calc.attacked')"
        :max="MAX_ATTACKED"
        :down="t('calc.attackedDown')"
        :up="t('calc.attackedUp')"
        @update:model-value="set({ attacked: $event })"
      />
    </DefineAttacked>
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
          :evolved="fighter.mega"
          no-moves
          flat
          :at-sets="fighter.sets && !!fighter.pooled"
          :pooled
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
        <!-- Its heading, "Moves against" and the other's icon (its name read out), a band across the panel, the whole
             of it folding them, its arrow at the end. -->
        <h3 class="part-head">
          <button
            type="button"
            class="part-toggle"
            :aria-expanded="!movesFolded"
            @click="emit('movesFolded', !movesFolded)"
          >
            <span class="part-title">
              <template v-if="otherId"
                >{{ t('calc.against') }}<PokemonIcon :id="otherId" class="against-icon" /><span class="sr-only">{{
                  otherName
                }}</span></template
              >
              <template v-else>{{ t('calc.movesHead') }}</template>
            </span>
            <ChevronDown :size="16" class="fold-chev" :class="{ open: !movesFolded }" aria-hidden="true" />
          </button>
        </h3>
        <p v-if="!otherName && !movesFolded" class="muted hint">{{ t('calc.pickOther') }}</p>
        <ul v-show="!movesFolded" class="damages">
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
          >
            <!-- The side's count or the field's weather or terrain its damage hangs on, the same as where it's kept. -->
            <template v-if="h.mv && (usesFainted(h.mv) || usesAttacked(h.mv) || FIELD_MOVES[h.mv])" #extra>
              <ReuseFainted v-if="usesFainted(h.mv)" />
              <ReuseAttacked v-if="usesAttacked(h.mv)" />
              <CalcConditions
                v-if="FIELD_MOVES[h.mv]"
                :field
                :data
                :only="FIELD_MOVES[h.mv]"
                @field="emit('battlefield', $event)"
              />
            </template>
          </DamageRow>
        </ul>
      </template>
    </div>

    <!-- What the battle adds to it. -->
    <div class="battle">
      <template v-if="shown && stats">
        <h3 class="part-head">
          <button
            type="button"
            class="part-toggle"
            :aria-expanded="!battleFolded"
            @click="emit('battleFolded', !battleFolded)"
          >
            <span class="part-title"
              >{{ t('calc.battle')
              }}<span v-if="onSide.length" class="on-count" :aria-label="t('calc.sideOn', { n: onSide.length })">{{
                onSide.length
              }}</span></span
            >
            <ChevronDown :size="16" class="fold-chev" :class="{ open: !battleFolded }" aria-hidden="true" />
          </button>
        </h3>
        <div v-show="!battleFolded" class="battle-body">
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
              class="btn quiet mod"
              :class="{ on: fighter.abilityOn }"
              :aria-pressed="fighter.abilityOn"
              @click="set({ abilityOn: !fighter.abilityOn })"
            >
              {{ t('calc.abilityOn', { ability: refName(ability(conditional)) }) }}
            </button>
            <ReuseFainted v-if="overlord" />
            <ReuseAttacked v-if="rageFist" />
          </div>
          <!-- What's on its side, last: its toggle, as the field's Battle conditions, folding its box; those on
               counted on the heading too. -->
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
              <!-- Unfolded, its Clear on its row, as the field's: beside it (on phones at the row's end). -->
              <button
                v-else
                type="button"
                class="btn quiet small side-clear"
                :disabled="!onSide.length"
                @click="emit('update:fighter', { ...fighter, side: [], spikes: 0 })"
              >
                <Eraser :size="14" aria-hidden="true" />{{ t('calc.clearConditions') }}
              </button>
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
/* Whose it is, a band of its side's color across the panel's top, as the phones' tabs are. */
.side-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 8px;
  margin: calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad)) 0;
  padding: 6px var(--panel-pad);
  color: var(--accent-text);
  background: var(--side);
  border-bottom: 2px solid var(--ink);
}
.side.theirs .side-head {
  color: var(--opponent-text);
}
.side-head h2 {
  margin: 0;
  font-size: 1em;
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
  text-decoration: underline;
}
/* Its set, set apart from what follows: on the panel's grey across it, right under the band, a rule under it. */
.body {
  margin: -28px calc(-1 * var(--panel-pad)) 0;
  padding: 14px var(--panel-pad);
  background: var(--panel-alt);
  border-bottom: 1px solid var(--border);
}
/* On phones, its tab over it names it: no band, its menu at the top right of its set (kept clear of it). */
@media (max-width: 899px) {
  /* Its parts closer on phones, where the page is short of room. */
  .side {
    position: relative;
    gap: 16px;
  }
  .side-head {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    margin: 0;
    padding: 0;
    color: inherit;
    background: none;
    border: 0;
  }
  .side.theirs .side-head {
    color: inherit;
  }
  .side-head h2 {
    display: none;
  }
  .body {
    margin: calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad)) 0;
    padding-right: 48px;
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
/* Its moves' and its battle's headings: a band across the panel on a flat grey (the set's), rules over and under it,
   the whole of it folding its part, its arrow at the end. */
.part-head {
  margin: 0 calc(-1 * var(--panel-pad));
  font-size: 1em;
}
.part-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 4px var(--panel-pad);
  font: inherit;
  font-size: 0.8em;
  font-weight: bold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: left;
  background: var(--panel-alt);
  border: 0;
  border-block: 1px solid var(--border);
  cursor: pointer;
}
.part-toggle:hover,
.part-toggle:focus-visible {
  color: var(--text);
}
.part-title {
  display: flex;
  align-items: center;
  min-width: 0;
}
/* The other side's icon in the heading, standing for its name. */
.against-icon {
  margin: -6px 0 -6px 2px;
}
.part-head + .damages,
.part-head + .hint {
  margin-top: 4px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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
.battle,
.battle-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* With no Pokémon, its moves' and battle's parts have nothing: no room kept for them. */
.results:empty,
.battle:empty {
  display: none;
}
/* No wider than the side's column, whatever's in them (a move's weather or terrain row slides sideways instead). */
.results,
.battle,
.damages {
  min-width: 0;
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
/* Quiet, flat and muted until it's on: then in full, a wash under it (the quiet button's). */
.mod.on {
  font-weight: bold;
}
/* What's on its side: a part as the others, its heading folding it. */
.side-box {
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
.side-clear {
  flex: none;
}
@media (max-width: 899px) {
  .side-clear {
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
