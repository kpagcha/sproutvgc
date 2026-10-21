<script lang="ts">
import { h, render } from 'vue'
import EffectTag from '@/components/EffectTag'
import { natureEffects } from '@/data/natures'
import { t } from '@/i18n'

// A nature says what it does on hover, or tapped, as on a Pokémon's meta page: the stat it raises and the one it
// lowers, each with its chevron. Drawn once per nature, the tooltips sharing it.
const natureTips = new Map<string, Element>()
function natureTip(id: string) {
  const e = natureEffects(id)
  if (!e) return t('usageMon.natureNeutral')
  let el = natureTips.get(id)
  if (!el) {
    el = document.createElement('span')
    render(
      h('span', [h(EffectTag, { effect: 'up', stat: e.plus }), ' ', h(EffectTag, { effect: 'down', stat: e.minus })]),
      el,
    )
    natureTips.set(id, el)
  }
  return el
}
</script>

<script setup lang="ts">
import { ability, item, move, pokemon } from '@/data/dex'
import { MOVES } from '@/data/moves'
import { natureName } from '@/data/natures'
import { POKEMON, spriteUrl } from '@/data/pokemon'
import { listed, type Slot } from '@/data/tournaments'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// A tournament team's whole sets, a card each, each entry leading to its meta page: its sprite and types in a band,
// its item after the types, then its ability and nature (the stats it raises and lowers on hover) on a line, and its
// moves two by two (on phones, one under another), each with its type's badge. A Pokémon whose team list isn't there
// is the Pokémon alone. On a tournament's standings, a player's row unfolded, and on a player's page; there, the sets
// the standings are filtered to marked (`marked`: a Pokémon narrowed to a build).
defineProps<{ team: Slot[]; marked?: (slot: Slot) => boolean }>()
</script>

<template>
  <ul class="sets">
    <li
      v-for="([mon, it, ab, nature, moves], i) in team"
      :key="i"
      class="set"
      :class="{ marked: marked?.([mon, it, ab, nature, moves]) }"
    >
      <div class="set-head">
        <img
          v-if="!POKEMON[mon]?.noSprite"
          class="pixel set-sprite"
          :src="spriteUrl(mon)"
          alt=""
          width="96"
          height="96"
          loading="lazy"
          draggable="false"
        />
        <span v-else class="set-sprite icon-sprite"><PokemonIcon :id="mon" /></span>
        <span class="set-who">
          <DexRef :to="pokemon(mon)" meta class="set-name" />
          <span class="set-types">
            <TypeIcon v-for="ty in POKEMON[mon]?.types ?? []" :key="ty" :type="ty" />
            <span v-if="listed([mon, it, ab, nature, moves])" class="set-item">
              <template v-if="it"><ItemIcon :id="it" /><DexRef :to="item(it)" meta /></template>
              <span v-else class="muted">{{ t('usageMon.noItem') }}</span>
            </span>
          </span>
        </span>
      </div>
      <p v-if="!listed([mon, it, ab, nature, moves])" class="muted small no-list">
        {{ t('tournaments.noList') }}
      </p>
      <div v-else-if="ab || nature" class="set-facts">
        <DexRef v-if="ab" :to="ability(ab)" meta />
        <span v-if="ab && nature" class="muted" aria-hidden="true">·</span>
        <span v-if="nature" v-tip:group="natureTip(nature)" class="muted">{{ natureName(nature) }}</span>
      </div>
      <ul v-if="moves.length" class="set-moves">
        <li v-for="mv in moves" :key="mv" class="set-move">
          <TypeIcon v-if="MOVES[mv]" :type="MOVES[mv].type" /><DexRef :to="move(mv)" meta />
        </li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.no-list {
  margin: 0;
  padding: 8px 10px;
}
/* Its whole sets, a card each: three to a row, a team in two even rows; two, then one, on narrower screens. */
.sets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 4px 4px 12px;
  list-style: none;
}
/* A set: an ink-framed card with a hard shadow. */
.set {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--ink);
  box-shadow: var(--hard-sm);
}
/* A set the standings are filtered to: framed in the accent. */
.set.marked {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    var(--hard-sm);
}
/* Its head: a band in the panel's other shade, the sprite at the left wholly inside it, its name and types beside
   it. */
.set-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 10px 2px 6px;
  background: var(--panel-alt);
  border-bottom: 1px solid var(--ink);
}
.set-sprite {
  flex: none;
  /* Half its size: an even scale, so its pixels stay even. */
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.set-who {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.set-name {
  font-size: 1.05em;
  font-weight: bold;
}
.set-types {
  /* Type badges at their desktop size on phones too, as small as the text. */
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
/* Its item after the type badges, at their height, a little apart from them. */
.set-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-left: 6px;
  font-size: 0.92em;
  font-weight: bold;
}
.set-item :deep(a) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Its ability and, muted, its nature, on one line. */
.set-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  padding: 8px 10px 4px;
  font-weight: bold;
}
/* Its moves, two by two: each a chip, its type's badge and its name. */
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
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 3px 5px 3px 3px;
  font-size: 0.9em;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.set-move :deep(a) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .sets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* Its moves one under another, the cards being narrow. */
  .set-moves {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 420px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
