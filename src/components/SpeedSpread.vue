<script setup lang="ts">
import { computed, ref } from 'vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { NatureEffect } from '@/lib/stats'
import { odds, type SpreadPoint } from '@/lib/speedLineup'
import EffectTag from '@/components/EffectTag'

// One of the comparison's Pokémon at its sets, against another: every Speed its sets reach, in the order they move,
// each with its share of the sets (a bar, as long as it's common), the builds reaching it and how it does against the
// other. The other, at one build, is a row of its own among them, where it moves; at its sets too, each row says the
// share of the other's sets it moves first against. A row tapped (`pickable`) sets the Pokémon to its most common
// build there. In a side's panel, and on phones under the two, where its heading is a band of its side's color
// (`banded`). Folded, as it starts, its most common Speeds alone (`FOLDED`), the most common first, and a button
// showing them all, in the order they move with the other among them, and folding them back.
const props = defineProps<{
  title: string
  spread: readonly SpreadPoint[]
  /** Its side, for its color; the other's is the other's. */
  tone: 'yours' | 'opponent'
  other: { name: string; spread: readonly SpreadPoint[]; sets: boolean } | null
  trickRoom: boolean
  banded?: boolean
  pickable?: boolean
}>()
const emit = defineEmits<{ pick: [b: { effect: NatureEffect; points: number }] }>()

const topShare = computed(() => Math.max(...props.spread.map((s) => s.share), 0.0001))
/** How a Speed does against the other: who moves first, and the share of its sets when it's at them. */
function vs(speed: number) {
  if (!props.other) return null
  const o = odds([{ speed, share: 1, builds: [] }], props.other.spread, props.trickRoom)
  const kind = o.first > 0.5 ? 'first' : o.after > 0.5 ? 'after' : 'tie'
  return { kind, text: props.other.sets ? percent(o.first) : t(`compare.cell.${kind}`) }
}
/** The other at one build: its Speed, among the rows where it moves (before the first it moves before or ties). */
const otherAt = computed(() => (props.other && !props.other.sets ? props.other.spread[0]!.speed : null))
/** The most common Speeds shown folded. */
const FOLDED = 3
const all = ref(false)
const foldable = computed(() => props.spread.length > FOLDED)
type Row = { other: true; speed: number } | ({ other?: false } & SpreadPoint)
const rows = computed((): Row[] => {
  if (foldable.value && !all.value)
    return [...props.spread]
      .sort((a, b) => b.share - a.share)
      .slice(0, FOLDED)
      .map((s) => ({ ...s, other: false as const }))
  const list: Row[] = [...props.spread]
    .sort((a, b) => (props.trickRoom ? a.speed - b.speed : b.speed - a.speed))
    .map((s) => ({ ...s, other: false as const }))
  const at = otherAt.value
  if (at !== null) {
    const i = list.findIndex((r) => (props.trickRoom ? at <= r.speed : at >= r.speed))
    list.splice(i < 0 ? list.length : i, 0, { other: true, speed: at })
  }
  return list
})
const topBuild = (s: SpreadPoint) => s.builds.reduce((a, b) => (b.share > a.share ? b : a))
</script>

<template>
  <div class="spread-part" :class="tone">
    <strong class="small title" :class="{ band: banded }">{{ title }}</strong>
    <div class="spread small" :class="{ padded: banded }" role="table">
      <template v-for="r in rows" :key="r.other ? 'other' : r.speed">
        <div v-if="r.other" class="srow other-row" role="row">
          <span class="c-speed" role="cell">{{ r.speed }}</span>
          <span class="c-rest" role="cell">{{ other!.name }}</span>
        </div>
        <component
          :is="pickable ? 'button' : 'div'"
          v-else
          :type="pickable ? 'button' : undefined"
          class="srow"
          :class="{ pick: pickable }"
          role="row"
          @click="pickable && emit('pick', topBuild(r))"
        >
          <span class="c-speed" role="cell" :class="vs(r.speed)?.kind">{{ r.speed }}</span>
          <span class="c-share" role="cell">
            <span class="bar" aria-hidden="true"
              ><span :class="vs(r.speed)?.kind" :style="{ width: `${(r.share / topShare) * 100}%` }"></span></span
            ><span class="pct">{{ percent(r.share) }}</span>
          </span>
          <span class="c-builds muted" role="cell">
            <span v-for="b in r.builds" :key="`${b.effect}:${b.points}`" class="build">
              <EffectTag :effect="b.effect" /><span>{{ t('speed.points', { n: b.points }) }}</span>
            </span>
          </span>
          <span v-if="vs(r.speed)" class="c-vs" role="cell" :class="vs(r.speed)!.kind">{{ vs(r.speed)!.text }}</span>
        </component>
      </template>
    </div>
    <button v-if="foldable" type="button" class="btn quiet more small" :class="{ padded: banded }" @click="all = !all">
      {{ all ? t('compare.showFewerSets') : t('compare.showAllSets', { n: spread.length }) }}
    </button>
  </div>
</template>

<style scoped>
.spread-part {
  --mine: var(--accent);
  --theirs: var(--opponent);
  display: flex;
  flex-direction: column;
  align-self: stretch;
  gap: 6px;
}
.spread-part.opponent {
  --mine: var(--opponent);
  --theirs: var(--accent);
}
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
.spread.padded {
  padding: 0 8px 6px;
}
.more {
  align-self: flex-start;
}
.more.padded {
  margin: 0 8px 8px;
}
/* A row per Speed: the Speed, its share, how it does; the builds reaching it on a line under them. */
.srow {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr) auto;
  grid-template-areas:
    'speed share vs'
    '. builds builds';
  align-items: center;
  gap: 2px 10px;
  width: 100%;
  padding: 4px 0;
  font: inherit;
  text-align: left;
  color: var(--text);
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
}
.srow.pick {
  cursor: pointer;
}
.srow.pick:hover {
  background: var(--hover, var(--sel));
}
.c-speed {
  grid-area: speed;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.c-share {
  grid-area: share;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.c-builds {
  grid-area: builds;
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
}
.c-builds:empty {
  display: none;
}
.c-vs {
  grid-area: vs;
  font-weight: bold;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.first {
  color: var(--mine);
}
.after {
  color: var(--theirs);
}
.bar {
  flex: 1;
  height: 10px;
  min-width: 3em;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
}
.bar > span {
  display: block;
  height: 100%;
  background: color-mix(in srgb, var(--text) 45%, var(--panel));
}
.bar > .first {
  background: var(--mine);
}
.bar > .after {
  background: var(--theirs);
}
.bar > .tie {
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.pct {
  min-width: 3.4em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.build {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
/* The other, where it moves among them: a row in its color. */
.other-row {
  grid-template-areas: 'speed rest rest';
  font-weight: bold;
  color: var(--theirs);
  background: color-mix(in srgb, var(--theirs) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--theirs);
}
.other-row .c-speed {
  padding-left: 6px;
}
.c-rest {
  grid-area: rest;
}
</style>
