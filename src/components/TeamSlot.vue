<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, ChevronUp, X } from '@lucide/vue'
import { ability, item, move, pokemon } from '@/data/dex'
import type { Spread } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureName } from '@/data/natures'
import { POKEMON, spriteUrl } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { pointsLeft, shownAs, type Field, type Member, type Points } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PointsEditor from '@/components/PointsEditor.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'
import { natureTip } from '@/components/natureTip'

// One slot of a team in the builder, laid out as a tournament team's set (`TeamSets`): its sprite, name and types in a
// band with its item, then its ability and nature, then its four moves two by two. Every part is a button opening its
// picker (`field`), a part not picked yet a placeholder saying what goes there; the one being picked marked
// (`active`). Under them its stats and stat points (`PointsEditor`), folded at first; folded, a line saying how many
// points are left to spend, while any are. An empty slot is the same card, all
// placeholders, each opening the Pokémon's picker: the rest needs a Pokémon first.
const props = defineProps<{ member: Member; active: Field | null; spreads: readonly Spread[] }>()
const emit = defineEmits<{ field: [field: Field]; clear: []; change: [patch: Partial<Member>] }>()
const open = defineModel<boolean>('open', { default: false })

const shown = computed(() => shownAs(props.member))
/** Opens a part's picker: the Pokémon's, until there's one. */
const go = (f: Field) => emit('field', shown.value ? f : 'pokemon')
const left = computed(() => pointsLeft(props.member))
const points = computed({
  get: () => props.member.points,
  set: (p: Points) => emit('change', { points: p }),
})
const preset = (s: Spread) => emit('change', { points: [...s.points], nature: s.nature })
</script>

<template>
  <li class="set" :class="{ empty: !shown }">
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
          type="button"
          class="slot-btn set-name"
          :class="{ active: active === 'pokemon', placeholder: !shown }"
          @click="emit('field', 'pokemon')"
        >
          {{ shown ? refName(pokemon(shown)) : t('builder.pokemon') }}
        </button>
        <span class="set-types">
          <template v-if="shown"><TypeIcon v-for="ty in POKEMON[shown]?.types ?? []" :key="ty" :type="ty" /></template>
          <span v-else class="type-blank" aria-hidden="true"></span>
          <button
            type="button"
            class="slot-btn set-item"
            :class="{ active: active === 'item', placeholder: !member.item }"
            @click="go('item')"
          >
            <template v-if="member.item"><ItemIcon :id="member.item" />{{ refName(item(member.item)) }}</template>
            <template v-else>{{ t('builder.item') }}</template>
          </button>
        </span>
      </span>
      <button
        v-if="shown"
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
        type="button"
        class="slot-btn"
        :class="{ active: active === 'ability', placeholder: !member.ability }"
        @click="go('ability')"
      >
        {{ member.ability ? refName(ability(member.ability)) : t('builder.ability') }}
      </button>
      <span class="muted" aria-hidden="true">·</span>
      <button
        v-tip="member.nature ? natureTip(member.nature) : undefined"
        type="button"
        class="slot-btn nature"
        :class="{ active: active === 'nature', placeholder: !member.nature }"
        @click="go('nature')"
      >
        {{ member.nature ? natureName(member.nature) : t('builder.nature') }}
      </button>
    </div>
    <ul class="set-moves">
      <li v-for="(mv, i) in member.moves" :key="i">
        <button
          type="button"
          class="slot-btn set-move"
          :class="{ active: active === i, placeholder: !mv }"
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
      <button type="button" class="stats-toggle" :aria-expanded="open" @click="open = !open">
        <span class="toggle-line">
          <span class="toggle-label">
            <span v-if="open || left === 0" class="muted">{{ t('builder.points') }}</span>
            <span v-if="left !== 0" class="warn" :class="{ over: left < 0 }" aria-live="polite">{{
              left > 0
                ? left === 1
                  ? t('builder.pointLeft')
                  : t('builder.pointsLeft', { n: left })
                : left === -1
                  ? t('builder.pointOver')
                  : t('builder.pointsOver', { n: -left })
            }}</span>
          </span>
          <component :is="open ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />
        </span>
      </button>
      <PointsEditor
        v-if="open"
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
      <span class="toggle-line">{{ t('builder.points') }}<ChevronDown :size="14" /></span>
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
/* The part being picked. */
.slot-btn.active {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.sprite-btn {
  flex: none;
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
.stats-toggle {
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
.toggle-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 0.85em;
}
.toggle-label {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
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
.editor {
  padding: 0 8px 8px;
}
/* Two cards to a row (narrow, `TeamBuilderView`'s), their moves one under another; one to a row, two by two again. */
@media (max-width: 900px) and (min-width: 521px) {
  .set-moves {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
