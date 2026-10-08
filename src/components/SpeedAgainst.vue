<script setup lang="ts">
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { t } from '@/i18n'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { pointsText, type toMoveFirst } from '@/lib/speedBuild'

// What it takes a Pokémon to move before another, at each nature effect, under its heading: each a row (in a narrow
// card, its answer under its name), its answer in a pill colored by how it goes (any points, some, only a tie, none), the nature its build has marked. The
// comparison's: in each side's panel, and on phones together under the two, where its heading is a band of its side's
// color (`banded`, the color from `--side` and `--side-text`).
defineProps<{
  title: string
  rows: NonNullable<ReturnType<typeof toMoveFirst>>
  /** The nature effect its build has. */
  current?: NatureEffect
  banded?: boolean
}>()

type Row = NonNullable<ReturnType<typeof toMoveFirst>>[number]
/** How an answer goes: whatever the points, with some, only to a tie, or not at all. */
function kind(r: Row['result']): 'any' | 'some' | 'tie' | 'never' {
  if (!r) return 'never'
  if ('ties' in r) return 'tie'
  return ('from' in r && r.from === 0) || ('upTo' in r && r.upTo === MAX_POINTS) ? 'any' : 'some'
}

const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const canHover = window.matchMedia('(hover: hover)').matches
</script>

<template>
  <strong class="small title" :class="{ band: banded }">{{ title }}</strong>
  <dl class="versus small" :class="{ padded: banded }">
    <div v-for="v in rows" :key="v.effect" class="row" :class="{ current: v.effect === current }">
      <dt v-tip="canHover && !!EFFECT_ICONS[v.effect] && t(`speed.effect.${v.effect}`)" class="effect">
        <template v-if="EFFECT_ICONS[v.effect]"
          ><component :is="EFFECT_ICONS[v.effect]" :size="14" aria-hidden="true" /><span aria-hidden="true">{{
            t('stat.spe')
          }}</span
          ><span class="visually-hidden">{{ t(`speed.effect.${v.effect}`) }}</span></template
        >
        <template v-else>{{ t(`speed.effect.${v.effect}`) }}</template>
      </dt>
      <dd>
        <span class="answer" :class="kind(v.result)">{{ pointsText(v.result) }}</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
/* As a band: across the top of its card, in its side's color. */
.title.band {
  display: block;
  padding: 6px 8px;
  line-height: 1.3;
  color: var(--side-text);
  background: var(--side);
  border-bottom: 2px solid var(--ink);
}
.versus {
  display: grid;
  grid-template-columns: max-content max-content;
  column-gap: 10px;
  margin: 0;
}
/* In a card of its own, narrow: each answer under its nature's name. */
.versus.padded {
  grid-template-columns: minmax(0, 1fr);
  padding: 2px 8px 6px;
}
.padded .row {
  row-gap: 3px;
}
/* Each nature a row, its name and its answer in the list's columns; a thin line between them. */
.row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding: 5px 0;
}
.row + .row {
  border-top: 1px solid var(--border);
}
.row dd {
  margin: 0;
}
.effect {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
}
/* The nature its build has: its row tinted with its side's color, out to the card's edges, its name in full ink. */
.row.current {
  margin-inline: -8px;
  padding-inline: 8px;
  background: color-mix(in srgb, var(--side, var(--accent)) 22%, transparent);
}
.row.current .effect {
  font-weight: bold;
  color: var(--text);
}
.answer {
  display: inline-block;
  padding: 1px 6px;
  font-weight: bold;
  border: 1px solid var(--ink);
}
.answer.any {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.answer.some {
  color: var(--text);
  background: var(--sel);
}
.answer.tie {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
.answer.never {
  color: var(--m0-fg);
  background: var(--m0-bg);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
