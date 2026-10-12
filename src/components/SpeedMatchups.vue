<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import { pointsText, toMoveFirst } from '@/lib/speedBuild'
import { movesBefore, odds } from '@/lib/speedLineup'
import PokemonIcon from '@/components/PokemonIcon'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import SpeedSetsDetail from '@/components/SpeedSetsDetail.vue'
import SpeedShare from '@/components/SpeedShare.vue'
import SpeedVersus, { type VersusMon } from '@/components/SpeedVersus.vue'

// Past a pair, how yours do against the opponents: a grid of every one of yours against every opponent, each cell
// saying which moves first (and by how much Speed), with how many your side wins in all; a cell tapped, the two alone
// (`pair`): which moves first, and what each takes to move before the other. Against two opponents, what each of yours
// takes to move before both: before the one that moves first of them. One at its sets is at every one of them: a cell
// says the share of their matchups yours moves first in, colored by who moves first in most; the two alone, the chart of
// the one at its sets and the opponent's common Speeds (`SpeedSetsDetail`); and to move before both, for each of yours,
// how often it does (its chances against each, multiplied) and the points it needs at its nature to move before both
// opponents' most common Speeds.
interface Mon extends VersusMon {
  key: string
  id: PokemonId
  /** At its sets, its Speeds from the slowest to the fastest. */
  range: readonly [number, number] | null
}
const props = defineProps<{
  yours: readonly Mon[]
  opponents: readonly Mon[]
  trickRoom: boolean
  /** The two tapped, by their keys: yours, then the opponent. */
  pair: readonly [string, string] | null
}>()
const emit = defineEmits<{ pair: [pair: [string, string] | null] }>()

// Who moves first, on a cell's hover; on touch screens a tap shows the two alone instead.
const canHover = window.matchMedia('(hover: hover)').matches
/** Either at its sets: the shares of their matchups, else none. */
const shares = (y: Mon, o: Mon) => (y.sets || o.sets ? odds(y.spread, o.spread, props.trickRoom) : null)
/** Who moves first: at one build each, by their Speeds; else who does in most of their matchups. */
function outcome(y: Mon, o: Mon): 1 | 0 | -1 {
  const s = shares(y, o)
  if (!s) return movesBefore(y.speed, o.speed, props.trickRoom)
  return s.first > 0.5 ? 1 : s.after > 0.5 ? -1 : 0
}
const KIND = { 1: 'first', 0: 'tie', [-1]: 'after' } as const
const cellText = (y: Mon, o: Mon) => {
  const s = shares(y, o)
  return s ? percent(s.first) : t(`compare.cell.${KIND[outcome(y, o)]}`)
}
/** The one at one build moving first against the other's sets, or both at theirs, in words. */
function setsText(y: Mon, o: Mon) {
  const s = shares(y, o)!
  if (y.sets && o.sets) return t('compare.setsVsSets', { name: y.name, pct: percent(s.first), other: o.name })
  return y.sets
    ? t('compare.vsSets', { name: o.name, pct: percent(s.after), other: y.name })
    : t('compare.vsSets', { name: y.name, pct: percent(s.first), other: o.name })
}
const cellTip = (y: Mon, o: Mon) => {
  if (shares(y, o)) return setsText(y, o)
  const r = outcome(y, o)
  return r === 0 ? t('compare.tie') : t('compare.first', { name: r > 0 ? y.name : o.name })
}
const diff = (y: Mon, o: Mon) => {
  if (y.sets || o.sets) return t(`compare.cell.${KIND[outcome(y, o)]}`)
  const d = y.speed - o.speed
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'
}
/** Its Speed in a header: at its sets, their range. */
const speedLabel = (m: Mon) =>
  !m.range ? m.speed : m.range[0] === m.range[1] ? m.range[0] : `${m.range[0]}–${m.range[1]}`
const won = computed(() => props.yours.flatMap((y) => props.opponents.filter((o) => outcome(y, o) > 0)).length)

const picked = computed(() => {
  if (!props.pair) return null
  const y = props.yours.find((m) => m.key === props.pair![0])
  const o = props.opponents.find((m) => m.key === props.pair![1])
  return y && o ? { y, o, r: outcome(y, o), shares: shares(y, o) } : null
})
const isPicked = (y: Mon, o: Mon) => picked.value?.y === y && picked.value.o === o
const tap = (y: Mon, o: Mon) => emit('pair', isPicked(y, o) ? null : [y.key, o.key])

/** Against two opponents at one build each, the one to beat to move before both: the one that moves first. */
const toBeat = computed(() =>
  props.opponents.length < 2
    ? null
    : props.opponents.reduce((a, b) => (movesBefore(b.speed, a.speed, props.trickRoom) > 0 ? b : a)),
)
/** Either opponent at its sets: for each of yours, how often it moves before both and what it takes. */
const bySets = computed(() => props.opponents.some((o) => o.sets))
function beforeBoth(y: Mon) {
  const chance = props.opponents.reduce((n, o) => n * odds(y.spread, o.spread, props.trickRoom).first, 1)
  const speeds = props.opponents.map((o) => o.speed)
  const target = speeds.reduce((a, b) => (movesBefore(b, a, props.trickRoom) > 0 ? b : a))
  const r = y.sets ? null : against(y, target).find((x) => x.effect === y.build.effect)!.result
  return {
    chance: t('compare.bothChance', { name: y.name, pct: percent(chance) }),
    common: y.sets ? null : t('compare.bothCommon', { speeds: speeds.join(', '), points: pointsText(r) }),
  }
}
const against = (me: Mon, speed: number) => toMoveFirst(me.id, me.build, speed, props.trickRoom)
</script>

<template>
  <section class="panel matchups">
    <h2 class="heading">
      {{ t('compare.matchups') }}
      <span class="muted won">{{ t('compare.won', { n: won, total: yours.length * opponents.length }) }}</span>
    </h2>
    <div class="grid" :style="{ '--cols': opponents.length }" role="grid">
      <span class="corner" aria-hidden="true" />
      <span v-for="o in opponents" :key="o.key" class="head opponent" role="columnheader"
        ><PokemonIcon :id="o.id" /><span class="visually-hidden">{{ o.name }}</span
        >{{ speedLabel(o) }}</span
      >
      <template v-for="y in yours" :key="y.key">
        <span class="head yours" role="rowheader"
          ><PokemonIcon :id="y.id" /><span class="visually-hidden">{{ y.name }}</span
          >{{ speedLabel(y) }}</span
        >
        <button
          v-for="o in opponents"
          :key="o.key"
          v-tip="canHover && cellTip(y, o)"
          type="button"
          class="cell"
          :class="[KIND[outcome(y, o)], { on: isPicked(y, o) }]"
          :aria-pressed="isPicked(y, o)"
          :aria-label="`${y.name} vs ${o.name}: ${cellTip(y, o)}`"
          @click="tap(y, o)"
        >
          {{ cellText(y, o) }}<span class="diff">{{ diff(y, o) }}</span>
        </button>
      </template>
    </div>

    <!-- The two tapped, alone. -->
    <div v-if="picked" class="pair">
      <div class="verdict" :class="KIND[picked.r]">
        <PokemonIcon v-if="picked.r" :id="picked.r > 0 ? picked.y.id : picked.o.id" />
        <span class="verdict-text">{{
          picked.shares
            ? setsText(picked.y, picked.o)
            : picked.r === 0
              ? t('compare.tie')
              : t('compare.first', { name: picked.r > 0 ? picked.y.name : picked.o.name })
        }}</span>
        <span class="verdict-speeds"
          >{{ speedLabel(picked.y) }} <span class="muted">vs</span> {{ speedLabel(picked.o) }}</span
        >
        <SpeedShare
          v-if="picked.shares"
          class="verdict-share"
          :odds="picked.shares"
          :name="picked.y.name"
          :other="picked.o.name"
          tone="yours"
        />
      </div>
      <!-- Either at its sets: the chart and the opponent's common Speeds. -->
      <SpeedSetsDetail v-if="picked.shares" :yours="picked.y" :opponent="picked.o" :trick-room="trickRoom" />
      <div v-else class="cards">
        <section class="card yours">
          <SpeedVersus :me="picked.y" :them="picked.o" tone="yours" :trick-room="trickRoom" banded />
        </section>
        <section class="card opponent">
          <SpeedVersus :me="picked.o" :them="picked.y" tone="opponent" :trick-room="trickRoom" banded />
        </section>
      </div>
    </div>
    <p v-else class="muted small hint">{{ t('compare.pairHint') }}</p>
  </section>

  <!-- Against two opponents, what each of yours takes to move before both. -->
  <section v-if="toBeat" class="panel both">
    <h2 class="heading">{{ t('compare.both') }}</h2>
    <!-- Either at its sets: a line per one of yours, how often it moves before both, and what it takes. -->
    <ul v-if="bySets" class="both-list">
      <li v-for="y in yours" :key="y.key">
        <PokemonIcon :id="y.id" />
        <span class="both-text">
          <strong>{{ beforeBoth(y).chance }}</strong>
          <span v-if="beforeBoth(y).common" class="muted small">{{ beforeBoth(y).common }}</span>
        </span>
      </li>
    </ul>
    <div v-else class="cards">
      <section v-for="y in yours" :key="y.key" class="card yours">
        <SpeedAgainst
          :title="t('compare.bothOf', { name: y.name, other: toBeat.name, speed: toBeat.speed })"
          :id="y.id"
          :build="y.build"
          :target="toBeat.speed"
          :trick-room="trickRoom"
          banded
        />
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  margin-bottom: 12px;
}
.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0 0 10px;
  font-size: 1.1em;
}
.won {
  font-size: 0.8em;
  font-weight: normal;
}
/* Yours down its side, the opponents across its top, each cell one against the other. */
.grid {
  display: grid;
  grid-template-columns: max-content repeat(var(--cols), minmax(0, 1fr));
  gap: 4px;
  max-width: 520px;
}
/* Each one's icon whole inside its header. */
.head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 40px;
  padding: 2px 8px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  border: 2px solid var(--ink);
}
.head.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.head.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 2px 4px;
  font: inherit;
  font-weight: bold;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  cursor: pointer;
  touch-action: manipulation;
}
.cell.first {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.cell.after {
  color: var(--m0-fg);
  background: var(--m0-bg);
}
.cell.tie {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
.cell.on {
  outline: 3px solid var(--ink);
  outline-offset: 1px;
  box-shadow: none;
  transform: translate(2px, 2px);
}
.diff {
  font-size: 0.8em;
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}
.pair {
  margin-top: 14px;
}
.verdict {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  padding: 6px 10px;
  font-weight: bold;
  border: 2px solid var(--ink);
}
.verdict {
  flex-wrap: wrap;
}
.verdict-share {
  flex: 1 0 100%;
  font-weight: normal;
}
.verdict-text {
  flex: 1;
  min-width: 0;
}
.verdict-speeds {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.verdict.first {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.verdict.after {
  outline: 3px solid var(--opponent);
  outline-offset: 2px;
}
.verdict.tie {
  outline: 3px solid var(--muted);
  outline-offset: 2px;
}
/* At sets, to move before both: a line per one of yours, its icon, how often, and what it takes under it. */
.both-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.both-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.both-list li + li {
  border-top: 1px solid var(--border);
}
.both-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* What each takes, side by side, under a band of its team's color. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 8px;
}
@media (min-width: 721px) {
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    max-width: 720px;
  }
  .verdict {
    max-width: 720px;
  }
}
.card {
  --side: var(--accent);
  --side-text: var(--accent-text);
  display: flex;
  flex-direction: column;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.card.opponent {
  --side: var(--opponent);
  --side-text: var(--opponent-text);
}
.hint {
  margin: 10px 0 0;
}
.small {
  font-size: 0.875em;
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
