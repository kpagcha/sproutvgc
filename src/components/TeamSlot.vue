<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { CircleAlert, Pencil, Pin, PinOff, X } from '@lucide/vue'
import { ability, item, move, pokemon, type MoveId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import { natureEffectOn, natureName } from '@/data/natures'
import { statValue } from '@/lib/stats'
import { POKEMON, spriteUrl, STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { pointsLeft, stoneMega, type Field, type Member } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'
import { natureTip } from '@/components/natureTip'

// One slot of a team in the builder, laid out as a tournament team's set (`TeamSets`): its sprite, name and types in a
// band with its item, then its ability and nature, then its four moves two by two. Every part is a button opening its
// picker (`field`), a part not picked yet a placeholder saying what goes there; the one being picked marked
// (`active`). Under them its stat points in a compact row (each stat's shorthand, faint, over its stat, all alike, unoutlined;
// what's left to spend), a button opening their step in the picker, the set's last (`points`). An empty slot is the
// same card, all
// placeholders, each opening the Pokémon's picker: the rest needs a Pokémon first. Holding its Mega Stone, a switch at
// the stat points line's end says whether it's the one that Mega Evolves in the team's insights (`evolved`, `mega`);
// while it is, the card shows the Mega (its name, sprite, types and stats, and its ability after the one its sheet
// registers). A part that breaks the team's rules (`clashes`: its Pokémon, item, ability or a move, with why) is
// marked, its tooltip saying why. The first step (`hint`: the team has no Pokémon yet), its Pokémon's placeholders
// glowing in the accent and back, in a loop, until its picker opens. In the team builder (`pinnable`), a pin by its
// clearing pins it beside the team's insights (`pinned`, `pin`), to edit it there as they follow. In the damage
// calculator its moves are left out (`noMoves`): its rows of damage are its moves, each picked from there; and it's
// flat (`flat`): no card of its own, the side's panel being its box, and no clearing, the side's menu clearing it; at
// every set (`atSets`), its compact row showing its sets' pooled points (`pooled`), dimmed, and its nature crossed out,
// as it isn't what it battles with.
const props = defineProps<{
  member: Member
  active: Field | null
  clashes?: { pokemon?: string; item?: string; ability?: string; moves: Partial<Record<MoveId, string>> }
  /** It's the one that Mega Evolves in the team's insights. */
  evolved?: boolean
  /** The first step: its Pokémon's placeholders glow in a loop. */
  hint?: boolean
  /** It has a pin, there being the team's insights to pin it beside (the team builder's, not the damage calculator's). */
  pinnable?: boolean
  /** It's pinned beside the team's insights (`pin` toggling it). */
  pinned?: boolean
  /** Its moves left out, shown where they're used instead (the damage calculator's rows of damage). */
  noMoves?: boolean
  /** No card of its own nor clearing: the top of a panel that's its box (the damage calculator's side). */
  flat?: boolean
  /** At every set, its sets pooled (the damage calculator's). */
  atSets?: boolean
  /** At every set, its points and stats pooled, which its editor shows locked. */
  pooled?: { points: readonly number[]; stats: readonly number[] }
}>()
const emit = defineEmits<{
  field: [field: Field]
  clear: []
  change: [patch: Partial<Member>]
  mega: []
  pin: []
}>()

// The dot between the ability and the nature hidden once the nature wraps to a line of its own, rather than left
// trailing at the line's end (hidden, not taken out, so the line breaks where it did).
const facts = useTemplateRef<HTMLElement>('facts')
const dot = useTemplateRef<HTMLElement>('dot')
const natureBtn = useTemplateRef<HTMLElement>('natureBtn')
const wrapped = shallowRef(false)
const measure = () => {
  if (dot.value && natureBtn.value) wrapped.value = natureBtn.value.offsetTop > dot.value.offsetTop + 4
}
useResizeObserver([facts, natureBtn], measure)

// The pin's tooltip only where there's hover: tapped, it'd stay behind as the slot's pinned or unpinned.
const canHover = window.matchMedia('(hover: hover)').matches
const mega = computed(() => stoneMega(props.member))
/** The Pokémon the card shows: its Mega while it's the one that Mega Evolves, else itself. */
const shown = computed(() => (props.evolved && mega.value) || props.member.pokemon)
/** Its Mega's ability, shown after its sheet's while it Mega Evolves. */
const megaAbility = computed(() => (props.evolved && mega.value ? (POKEMON[mega.value]?.abilities[0] ?? null) : null))
/** Opens a part's picker: the Pokémon's, until there's one. */
const go = (f: Field) => emit('field', shown.value ? f : 'pokemon')
const left = computed(() => pointsLeft(props.member))

/** Each stat's points as the compact row shows them: at every set, the pooled ones, rounded. */
const cells = computed(() =>
  STATS.map((stat, i) => {
    const effect = props.member.nature && !props.atSets ? natureEffectOn(props.member.nature, stat) : 'neutral'
    const pooled = props.atSets ? props.pooled : undefined
    const points = pooled ? Math.round(pooled.points[i]!) : props.member.points[i]!
    const base = shown.value ? POKEMON[shown.value]!.stats[i]! : 0
    const value = pooled ? pooled.stats[i]! : statValue(base, points, effect, i === 0)
    return { stat, effect, points, value }
  }),
)
/** How many points are left to spend, or over, said in full; none when all are spent or at every set. */
const leftText = computed(() => {
  const n = left.value
  if (!n || props.atSets) return ''
  if (n > 0) return n === 1 ? t('builder.pointToSpend') : t('builder.pointsToSpend', { n })
  return n === -1 ? t('builder.pointOver') : t('builder.pointsOver', { n: -n })
})
const chipText = computed(() =>
  [cells.value.map((c) => `${t(`stat.${c.stat}`)} ${c.value} (${c.points})`).join(', '), leftText.value]
    .filter(Boolean)
    .join('. '),
)
</script>

<template>
  <li class="set" :class="{ empty: !shown, beckon: hint && !active, flat }">
    <div class="set-head">
      <button
        type="button"
        class="slot-btn sprite-btn"
        :class="{ active: active === 'pokemon' }"
        :aria-label="shown ? refName(pokemon(shown)) : t('builder.pickPokemon')"
        @click="emit('field', 'pokemon')"
      >
        <img
          v-if="shown && !POKEMON[shown]?.noSprite"
          class="pixel set-sprite"
          :src="spriteUrl(shown)"
          alt=""
          width="96"
          height="96"
          draggable="false"
        />
        <span v-else-if="shown" class="set-sprite icon-sprite"><PokemonIcon :id="shown" /></span>
        <span v-else class="set-sprite blank" aria-hidden="true">?</span>
      </button>
      <span class="set-who">
        <button
          v-tip="clashes?.pokemon"
          type="button"
          class="slot-btn set-name"
          :class="{ active: active === 'pokemon', placeholder: !shown, clash: clashes?.pokemon }"
          @click="emit('field', 'pokemon')"
        >
          {{ shown ? refName(pokemon(shown)) : t('builder.pokemon') }}
        </button>
        <span class="set-types">
          <template v-if="shown"><TypeIcon v-for="ty in POKEMON[shown]?.types ?? []" :key="ty" :type="ty" /></template>
          <span v-else class="type-blank" aria-hidden="true"></span>
          <button
            v-tip="clashes?.item"
            type="button"
            class="slot-btn set-item"
            :class="{ active: active === 'item', placeholder: !member.item, clash: clashes?.item }"
            @click="go('item')"
          >
            <template v-if="member.item"><ItemIcon :id="member.item" />{{ refName(item(member.item)) }}</template>
            <template v-else>{{ t('builder.item') }}</template>
          </button>
        </span>
      </span>
      <button
        v-if="shown && pinnable"
        v-tip="canHover ? t(pinned ? 'builder.unpin' : 'builder.pin') : undefined"
        type="button"
        class="clear pin"
        :class="{ on: pinned }"
        :aria-pressed="!!pinned"
        :aria-label="t(pinned ? 'builder.unpin' : 'builder.pin')"
        @click="emit('pin')"
      >
        <component :is="pinned ? PinOff : Pin" :size="14" aria-hidden="true" />
      </button>
      <button
        v-if="shown && !flat"
        v-tip="t('builder.clearSlot')"
        type="button"
        class="clear"
        :aria-label="t('builder.clearSlot')"
        @click="emit('clear')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </div>
    <div ref="facts" class="set-facts">
      <button
        v-tip="clashes?.ability"
        type="button"
        class="slot-btn"
        :class="{ active: active === 'ability', placeholder: !member.ability, clash: clashes?.ability }"
        @click="go('ability')"
      >
        {{ member.ability ? refName(ability(member.ability)) : t('builder.ability') }}
      </button>
      <span v-if="megaAbility" v-tip="t('builder.megaAbility')" class="mega-ability muted"
        >→ {{ refName(ability(megaAbility)) }}</span
      >
      <span ref="dot" class="muted" :class="{ wrapped }" aria-hidden="true">·</span>
      <button
        ref="natureBtn"
        v-tip="member.nature && !flat ? natureTip(member.nature) : undefined"
        type="button"
        class="slot-btn nature"
        :class="{ active: active === 'nature', placeholder: !member.nature, struck: atSets }"
        @click="go('nature')"
      >
        {{ member.nature ? natureName(member.nature) : t('builder.nature') }}
      </button>
    </div>
    <ul v-if="!noMoves" class="set-moves">
      <li v-for="(mv, i) in member.moves" :key="i">
        <button
          v-tip="mv ? clashes?.moves[mv] : undefined"
          type="button"
          class="slot-btn set-move"
          :class="{ active: active === i, placeholder: !mv, clash: mv && clashes?.moves[mv] }"
          @click="go(i as Field)"
        >
          <template v-if="mv"
            ><TypeIcon v-if="MOVES[mv]" :type="MOVES[mv].type" /><span class="move-name">{{
              refName(move(mv))
            }}</span></template
          >
          <template v-else>{{ t('builder.move') }}</template>
        </button>
      </li>
    </ul>
    <!-- Its stat points in a compact row, a button opening their step in the picker: each stat's shorthand over the stat it gives (its base, points and nature), all alike;
         while any are left to spend (or over), an alert's icon and how many; and holding its Mega Stone, whether it Mega
         Evolves, a switch at the row's end. -->
    <div v-if="shown" class="stats-box">
      <div class="stats-line">
        <button
          type="button"
          class="stats-chip"
          :class="{ active: active === 'points', derived: atSets && pooled }"
          :aria-label="`${t('builder.editPoints')}: ${chipText}`"
          @click="go('points')"
        >
          <span class="cells">
            <span v-for="c in cells" :key="c.stat" class="cell" aria-hidden="true">
              <span class="cell-label">{{ t(`stat.${c.stat}`) }}</span>
              <span class="cell-num">{{ c.value }}</span>
            </span>
          </span>
          <span v-if="leftText" v-tip="leftText" class="chip-left" :class="{ over: left < 0 }" aria-hidden="true"
            ><CircleAlert :size="14" />{{ Math.abs(left) }}</span
          >
          <Pencil :size="14" class="chip-edit" aria-hidden="true" />
        </button>
        <button
          v-if="mega"
          type="button"
          role="switch"
          class="mega-switch"
          :class="{ on: evolved }"
          :aria-checked="!!evolved"
          @click="emit('mega')"
        >
          <span class="switch-label">{{ t('builder.mega') }}</span>
          <span class="track" aria-hidden="true"><span class="knob"></span></span>
        </button>
      </div>
    </div>
    <div v-else class="stats-box stats-blank" aria-hidden="true">
      <div class="stats-line">
        <span class="stats-chip">
          <span class="cells">
            <span v-for="stat in STATS" :key="stat" class="cell">
              <span class="cell-label">{{ t(`stat.${stat}`) }}</span>
              <span class="cell-num">–</span>
            </span>
          </span>
          <Pencil :size="14" class="chip-edit" />
        </span>
      </div>
    </div>
  </li>
</template>

<style scoped>
/* As a tournament team's set (`TeamSets`), every part a button. */
.set {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.set.empty {
  border-style: dashed;
  box-shadow: none;
}
.set-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px 2px 6px;
  background: var(--panel-alt);
  border-bottom: 1px solid var(--ink);
}
/* An empty slot's placeholders, but the Pokémon's, faded: they need a Pokémon first. */
.set.empty .set-facts,
.set.empty .set-moves,
.set.empty .set-item,
.stats-blank {
  opacity: 0.55;
}
.type-blank {
  width: 26px;
  height: 22px;
  border: 1px dashed var(--border);
}
.slot-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-weight: bold;
  color: var(--link);
  text-align: left;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
.slot-btn:hover {
  text-decoration: underline;
}
/* What's not picked yet: a dashed box saying what goes there. */
.slot-btn.placeholder {
  padding: 0 6px;
  font-weight: normal;
  color: var(--muted);
  border: 1px dashed var(--border);
}
/* A part breaking the team's rules: in red, a wavy underline under it, its tooltip saying why. */
.slot-btn.clash {
  color: var(--bad);
  text-decoration: underline wavy var(--bad);
  text-underline-offset: 3px;
}
/* The part being picked. */
.slot-btn.active {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.sprite-btn {
  flex: none;
}
/* The first step: the Pokémon's placeholders glowing in the accent and back, slowly; held lit with reduced motion. */
.beckon .blank,
.beckon .set-name.placeholder {
  animation: hint 2.4s ease-in-out infinite;
}
@keyframes hint {
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
  .beckon .blank,
  .beckon .set-name.placeholder {
    animation: none;
    color: var(--accent);
    border-color: var(--accent);
  }
}
.set-sprite {
  flex: none;
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
}
.icon-sprite,
.blank {
  display: flex;
  align-items: center;
  justify-content: center;
}
.blank {
  font-size: 1.4em;
  color: var(--muted);
}
.set-who {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.set-name {
  font-size: 1.05em;
  align-self: flex-start;
}
.set-types {
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.set-item {
  margin-left: 6px;
  font-size: 0.92em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.clear {
  align-self: flex-start;
  margin-top: 4px;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
/* The pin, beside the clearing; in the accent while pinned. */
.pin + .clear {
  margin-left: -6px;
}
.pin.on,
.pin:hover,
.clear:hover {
  color: var(--text);
}
.pin.on {
  color: var(--accent);
}
.set-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  padding: 8px 10px 4px;
}
.nature {
  color: var(--muted);
}
/* Holding its Mega Stone: whether it's the one that Mega Evolves, a switch (a track and its knob, the knob right and
   the track filled when on), quiet until it is. */
.mega-switch {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  font: inherit;
  font-size: 0.78em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: 0;
  border-left: 1px solid var(--border);
  cursor: pointer;
}
.mega-switch:hover,
.mega-switch.on {
  color: var(--text);
}
.track {
  position: relative;
  width: 24px;
  height: 12px;
  background: var(--panel);
  border: 1px solid var(--muted);
  transition: background-color 0.15s ease;
}
.knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 8px;
  height: 8px;
  background: var(--muted);
  transition: transform 0.15s ease;
}
.mega-switch.on .track {
  background: var(--accent);
  border-color: var(--ink);
}
.mega-switch.on .knob {
  background: var(--accent-text);
  transform: translateX(12px);
}
@media (prefers-reduced-motion: reduce) {
  .track,
  .knob {
    transition: none;
  }
}
.mega-ability {
  font-size: 0.9em;
}
.wrapped {
  visibility: hidden;
}
.set-moves {
  --icon-scale: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
  padding: 4px 8px 8px;
  list-style: none;
}
.set-move {
  /* As tall as one with its type's badge, placeholder or not. */
  min-height: 28px;
  width: 100%;
  gap: 5px;
  padding: 3px 5px 3px 3px;
  font-size: 0.9em;
  font-weight: normal;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.set-move.placeholder {
  padding-left: 8px;
  background: none;
}
.move-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* The stat points' row at the card's foot. */
.stats-box {
  margin-top: auto;
  border-top: 1px solid var(--border);
}
.stats-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
/* The compact row: a button, quiet (no outline, no tints) until hovered, when it's lit as the page's quiet ones are;
   each stat's shorthand, faint, over its stat; what's left to spend after them, the pencil at its end. */
.stats-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 3px 5px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
button.stats-chip:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.stats-chip.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
/* The stats three figures wide, a gap between them so they never run together. */
.cells {
  display: inline-flex;
  gap: 5px;
}
.cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.cell-label {
  font-size: 0.62em;
  letter-spacing: 0.02em;
  color: var(--muted);
  opacity: 0.7;
}
.cell-num {
  font-size: 0.85em;
  color: color-mix(in srgb, var(--text) 75%, var(--muted));
}
/* At every set, its sets' pooled points: dimmed, as its locked sliders are. */
.stats-chip.derived .cells {
  opacity: 0.55;
}
/* Points left to spend, or over: an alert's icon and how many, in the warm warning (red, over). */
.chip-left {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.85em;
  font-weight: bold;
  color: var(--warn);
  font-variant-numeric: tabular-nums;
}
.chip-left.over {
  color: var(--bad);
}
.chip-edit {
  flex: none;
  color: var(--muted);
}
button.stats-chip:hover .chip-edit {
  color: var(--text);
}
.stats-line .mega-switch {
  align-self: center;
  margin-left: auto;
  padding-right: 0;
  border-left: 0;
}
.editor {
  padding: 0 8px 8px;
}
/* Flat, the top of the panel it's in: no card, no band, its parts lined up with the panel's other parts. */
.set.flat {
  container: slot / inline-size;
  background: none;
  border: 0;
  box-shadow: none;
}
/* Its sprite beside the set's three lines (the name, its types and item, the ability and nature: as tall as it), so it
   takes no height of its own; the stat points' row under them, across, at the panel's edge. */
.set.flat {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 6px;
  align-items: center;
}
.set.flat .set-head,
.set.flat .stats-box {
  display: contents;
}
.set.flat .sprite-btn {
  grid-row: 1 / span 2;
  grid-column: 1;
}
.set.flat .set-who,
.set.flat .set-facts {
  grid-column: 2;
}
/* The stat points' row under the set's lines, lined up with them (the chip's padding pulled out past their edge). */
.set.flat .stats-line {
  grid-column: 2;
  padding: 0;
}
.set.flat .stats-chip {
  margin-left: -6px;
}
/* Narrow, the Mega's switch under the sprite, in the room the row leaves there. */
@container slot (max-width: 520px) {
  .set.flat .stats-line {
    display: contents;
  }
  .set.flat .stats-chip {
    grid-column: 2;
    justify-self: start;
  }
  .set.flat .mega-switch {
    grid-row: 3;
    grid-column: 1;
    justify-self: center;
    margin: 0;
    padding: 0;
  }
}
.set.flat .set-sprite {
  width: 64px;
  height: 64px;
}
.set.flat .set-facts {
  padding: 0;
}
/* At every set, its nature isn't what it battles with. */
.nature.struck {
  text-decoration: line-through;
}
/* Two cards to a row (narrow, `TeamBuilderView`'s), their moves one under another; one to a row, two by two again. */
@media (max-width: 900px) and (min-width: 521px) {
  .set-moves {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
