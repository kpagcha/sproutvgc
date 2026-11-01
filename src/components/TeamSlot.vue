<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChartBar, ChartColumn, ChevronDown, ChevronUp, CircleAlert, Pin, PinOff, X } from '@lucide/vue'
import { ability, item, move, pokemon, type MoveId } from '@/data/dex'
import type { Spread } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureName } from '@/data/natures'
import { POKEMON, spriteUrl } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { pointsLeft, stoneMega, type Field, type Member, type Points } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PointsEditor from '@/components/PointsEditor.vue'
import SpreadPresets from '@/components/SpreadPresets.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'
import { natureTip } from '@/components/natureTip'

// One slot of a team in the builder, laid out as a tournament team's set (`TeamSets`): its sprite, name and types in a
// band with its item, then its ability and nature, then its four moves two by two. Every part is a button opening its
// picker (`field`), a part not picked yet a placeholder saying what goes there; the one being picked marked
// (`active`). Under them its stats and stat points (`PointsEditor`), folded at first; folded, a line saying how many
// points are left to spend, while any are. An empty slot is the same card, all
// placeholders, each opening the Pokémon's picker: the rest needs a Pokémon first. Holding its Mega Stone, a switch at
// the stat points line's end says whether it's the one that Mega Evolves in the team's insights (`evolved`, `mega`);
// while it is, the card shows the Mega (its name, sprite, types and stats, and its ability after the one its sheet
// registers). A part that breaks the team's rules (`clashes`: its Pokémon, item, ability or a move, with why) is
// marked, its tooltip saying why. The first step (`hint`: the team has no Pokémon yet), its Pokémon's placeholders
// glowing in the accent and back, in a loop, until its picker opens. In the team builder (`pinnable`), a pin by its
// clearing pins it beside the team's insights (`pinned`, `pin`), to edit it there as they follow. In the damage
// calculator its moves are left out (`noMoves`): its rows of damage are its moves, each picked from there; and it's
// flat (`flat`): no card of its own, the side's panel being its box, and no clearing, the side's menu clearing it; and
// its stats (`statPicks`) a quiet button folding their editor on one row with the Mega's switch; unfolded, over the
// editor, loading one of its common spreads (`SpreadPresets`) and being at every set (`atSets`, `sets`: its sets
// pooled by usage, where the meta has them, `canPool`), the editor then showing the pooled points and stats locked
// (`pooled`), its own kept for when it's off again, and its nature crossed out, as it isn't what it battles with.
const props = defineProps<{
  member: Member
  active: Field | null
  spreads: readonly Spread[]
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
  /** Its stats as three picks: its stat points, a common spread, or every set (the damage calculator's). */
  statPicks?: boolean
  /** At every set, its sets pooled; and whether the meta has them to be. */
  atSets?: boolean
  canPool?: boolean
  /** At every set, its points and stats pooled, which its editor shows locked. */
  pooled?: { points: readonly number[]; stats: readonly number[] }
}>()
const emit = defineEmits<{
  field: [field: Field]
  clear: []
  change: [patch: Partial<Member>]
  mega: []
  pin: []
  sets: [on: boolean]
}>()
const open = defineModel<boolean>('open', { default: false })

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
const points = computed({
  get: () => props.member.points,
  set: (p: Points) => emit('change', { points: p }),
})
const preset = (s: Spread) => emit('change', { points: [...s.points], nature: s.nature })

// The common sets' dialog, opened from the stat points' editor.
const presetsOpen = shallowRef(false)
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
    <div class="set-facts">
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
      <span class="muted" aria-hidden="true">·</span>
      <button
        v-tip="member.nature ? natureTip(member.nature) : undefined"
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
    <!-- Its stats and stat points, folded under a line saying how many are left (unfolded, beside its name). -->
    <div v-if="shown" class="stats-box">
      <!-- Folding the stats, and beside it, holding its Mega Stone, whether it Mega Evolves: a switch at the line's end,
           where there's always room. -->
      <!-- The damage calculator's: its stat points folding their editor, and the Mega's switch, on one row; unfolded,
           loading a common set or being at every set over the editor. -->
      <div v-if="statPicks" class="stats-line picks">
        <button
          type="button"
          class="btn quiet small"
          :class="{ on: open, callout: !atSets && left !== 0, over: left < 0 }"
          :aria-expanded="open"
          @click="open = !open"
        >
          <component :is="!atSets && left !== 0 ? CircleAlert : ChartBar" :size="14" aria-hidden="true" />
          <span v-if="atSets || left === 0">{{ t('builder.points') }}</span>
          <span v-else aria-live="polite">{{
            left > 0
              ? left === 1
                ? t('builder.pointToSpend')
                : t('builder.pointsToSpend', { n: left })
              : left === -1
                ? t('builder.pointOver')
                : t('builder.pointsOver', { n: -left })
          }}</span>
          <ChevronDown :size="14" class="pick-chev" :class="{ open }" aria-hidden="true" />
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
        <SpreadPresets
          v-model:open="presetsOpen"
          :spreads
          :nature="member.nature"
          :points="member.points"
          @pick="preset"
        />
      </div>
      <div v-else class="stats-line">
        <button type="button" class="stats-toggle" :aria-expanded="open" @click="open = !open">
          <span class="toggle-line" :class="{ callout: left !== 0, over: left < 0 }">
            <span class="toggle-label">
              <component :is="left !== 0 ? CircleAlert : ChartBar" :size="14" class="points-icon" aria-hidden="true" />
              <span v-if="open || left === 0" class="muted">{{ t('builder.points') }}</span>
              <span v-if="left !== 0" class="warn" :class="{ over: left < 0 }" aria-live="polite">{{
                left > 0
                  ? left === 1
                    ? t('builder.pointToSpend')
                    : t('builder.pointsToSpend', { n: left })
                  : left === -1
                    ? t('builder.pointOver')
                    : t('builder.pointsOver', { n: -left })
              }}</span>
            </span>
            <component :is="open ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />
          </span>
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
      <div v-if="open && statPicks" class="editor picks-editor">
        <div v-if="spreads.length || canPool" class="pick-row">
          <button
            v-if="spreads.length"
            type="button"
            class="btn quiet small"
            aria-haspopup="dialog"
            @click="presetsOpen = true"
          >
            <ChartColumn :size="14" aria-hidden="true" />{{ t('calc.loadPresets') }}
          </button>
          <button
            v-if="canPool"
            v-tip="canHover ? t('calc.sets.tip') : undefined"
            type="button"
            class="btn quiet small"
            :class="{ on: atSets }"
            :aria-pressed="!!atSets"
            @click="emit('sets', !atSets)"
          >
            {{ t('calc.sets.toggle') }}
          </button>
        </div>
        <!-- What the sliders are at, both lines stacked in one cell, the one not said hidden: as tall either way, so
             turning Every set on or off doesn't move the sliders. -->
        <p v-if="canPool" class="pooled-note">
          <span :class="{ hidden: atSets && pooled }">{{ t('calc.sets.own') }}</span>
          <span :class="{ hidden: !(atSets && pooled) }">{{ t('calc.sets.note') }}</span>
        </p>
        <PointsEditor
          v-model:points="points"
          :pokemon="shown"
          :nature="member.nature"
          :spreads
          no-presets
          :locked="atSets ? pooled : undefined"
          @preset="preset"
          @confirm="open = false"
        />
      </div>
      <PointsEditor
        v-else-if="open"
        v-model:points="points"
        class="editor"
        :pokemon="shown"
        :nature="member.nature"
        :spreads
        @preset="preset"
        @confirm="open = false"
      />
    </div>
    <div v-else class="stats-box stats-blank" aria-hidden="true">
      <span class="toggle-line"
        ><span class="toggle-label"><ChartBar :size="14" class="points-icon" />{{ t('builder.points') }}</span
        ><ChevronDown :size="14"
      /></span>
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
.stats-blank {
  padding: 6px 8px;
  color: var(--muted);
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
/* The line folding the stats and points under it. */
.stats-box {
  margin-top: auto;
  border-top: 1px solid var(--border);
}
.stats-line {
  display: flex;
  align-items: stretch;
}
.stats-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
/* The arrow right after what it says, not at the line's far end. */
.toggle-line {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
}
.toggle-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
}
/* The stat points' icon, before what the line says of them. */
.points-icon {
  flex: none;
  margin-right: -4px;
  color: var(--muted);
}
.warn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
  color: var(--accent);
}
.warn.over {
  color: var(--bad);
}
/* Points left to spend (or over): the line loud by its color and an alert's icon in place of the chart's, in a warm
   warning (in red, over), so a set not finished shows; all spent, the quiet line. */
.toggle-line.callout {
  color: var(--warn);
}
.toggle-line.callout.over {
  color: var(--bad);
}
.toggle-line.callout .warn {
  color: inherit;
}
.toggle-line.callout .points-icon {
  margin-right: -2px;
  color: inherit;
  /* Centered on the bold text's capitals and figures, not its line box (which leaves room for descenders). */
  transform: translateY(-1px);
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
   takes no height of its own; the stat points' line under them, across, at the panel's edge as the editor it unfolds
   (the head and the stats' box laid out as the slot's own grid, `contents`). */
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
.set.flat .stats-line,
.set.flat .stats-blank {
  grid-column: 1 / -1;
  margin-top: 4px;
}
.set.flat .set-sprite {
  width: 64px;
  height: 64px;
}
.set.flat .set-facts {
  padding: 0;
}
.set.flat .stats-toggle {
  padding: 0;
}
.set.flat .editor {
  grid-column: 1 / -1;
  padding-inline: 0;
}
/* The damage calculator's: the stat points' button and the Mega's switch at the line's end. */
.picks {
  align-items: center;
  gap: 6px;
}
.picks .btn,
.pick-row .btn {
  gap: 4px;
  padding-inline: 6px;
}
/* What it folds, the arrow after the label, flipped while unfolded, as the page's other folding buttons have it. */
.pick-chev {
  flex: none;
  transition: transform 0.15s;
}
.pick-chev.open {
  transform: rotate(180deg);
}
/* Points left to spend or over, loud as the builder's line is (over the quiet button's muted ink). */
:root:root .picks .btn.callout {
  color: var(--warn);
  font-weight: bold;
}
:root:root .picks .btn.callout.over {
  color: var(--bad);
}
.picks .mega-switch {
  align-self: center;
  margin-left: auto;
  padding-right: 0;
  border-left: 0;
}
/* Unfolded: loading a common set and every set over the editor. */
.picks-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pooled-note {
  display: grid;
  margin: 0;
  font-size: 0.8em;
  color: var(--muted);
}
.pooled-note > span {
  grid-area: 1 / 1;
}
.pooled-note > .hidden {
  visibility: hidden;
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
