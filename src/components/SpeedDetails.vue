<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import { BENCHMARKS, type Benchmark, type NatureEffect } from '@/lib/stats'
import AppLink from '@/components/AppLink'
import EffectTag from '@/components/EffectTag'
import PokemonIcon from '@/components/PokemonIcon'

// The speed tiers' charts at the sets, the Pokémon found in detail (its "Details" switch, or its row tapped again): its
// chart, larger, with its most common Speed and yours on it; with yours, how yours does against its sets, as a bar
// split by who moves first and in numbers, and how far yours is from its most common Speed; every Speed its sets run
// in the order they move, yours among them, each with the builds that reach it, its share of the sets and who moves
// first; and the Speed items and abilities its sets run, at its most common build. With no sets in the snapshot, its
// benchmarks.
export interface DetailsProps {
  id: PokemonId
  species: string
  forme?: string
  /** Its sets' Speeds in battle (with the modifiers), in the order they move, each with the builds reaching it. */
  spread: { speed: number; share: number; builds: { effect: NatureEffect; points: number; share: number }[] }[]
  /** Its most common build's Speed in battle; none with no sets. */
  common: number | null
  /** With no sets: its Speed at each benchmark. */
  fallback?: Record<Benchmark, number>
  /** The Speed items and abilities its sets run: the share of its sets with each, and its most common build's Speed
   * with it. */
  boosts: { key: string; label: string; when?: string; share: number; speed: number }[]
  /** Yours' Speed (none when it's yours that's found). */
  mine: number | null
  trickRoom: boolean
  /** Its usage rank and share of teams, in the meta's top. */
  usage?: { rank: number; share?: number }
}
const props = defineProps<DetailsProps>()
const emit = defineEmits<{ close: [] }>()

type Verdict = 'yours' | 'theirs' | 'tie'
function verdict(speed: number): Verdict | undefined {
  if (props.mine === null) return undefined
  if (speed === props.mine) return 'tie'
  return speed < props.mine !== props.trickRoom ? 'yours' : 'theirs'
}

const speeds = computed(() =>
  props.fallback ? BENCHMARKS.map((b) => props.fallback![b]) : props.spread.map((s) => s.speed),
)
const lo = computed(() => Math.min(...speeds.value))
const hi = computed(() => Math.max(...speeds.value))
const axis = computed(() => {
  const all = [...speeds.value, ...(props.mine !== null ? [props.mine] : [])]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const pad = Math.max(2, (max - min) * 0.06)
  return { lo: min - pad, span: max - min + 2 * pad }
})
const at = (speed: number) => `${((speed - axis.value.lo) / axis.value.span) * 100}%`
const total = computed(() => props.spread.reduce((n, s) => n + s.share, 0))
const topShare = computed(() => Math.max(...props.spread.map((s) => s.share), 0.0001))
/** Its share of the sets, of those the data has Speeds for. */
const of = (share: number) => (total.value ? share / total.value : 0)

/** How yours does against its sets: the share it moves first against, ties with and moves after. */
const odds = computed(() => {
  if (props.mine === null || !props.spread.length || !total.value) return null
  const tally = { yours: 0, tie: 0, theirs: 0 }
  for (const s of props.spread) tally[verdict(s.speed)!] += s.share
  return { yours: of(tally.yours), tie: of(tally.tie), theirs: of(tally.theirs) }
})
/** How far yours is from its most common Speed. */
const gap = computed(() => {
  if (props.mine === null || props.common === null) return null
  const n = props.mine - props.common
  return n === 0 ? t('speed.detailsGap.equal') : t(`speed.detailsGap.${n > 0 ? 'above' : 'below'}`, { n: Math.abs(n) })
})

/** The spread with yours among it, before the first Speed it moves before or ties with. */
const rows = computed(() => {
  type Row = { mine: true; speed: number } | ({ mine?: false } & DetailsProps['spread'][number])
  const list: Row[] = props.spread.map((s) => ({ ...s, mine: false as const }))
  if (props.mine !== null) {
    const mine = props.mine
    const i = list.findIndex((r) => (props.trickRoom ? mine <= r.speed : mine >= r.speed))
    list.splice(i < 0 ? list.length : i, 0, { mine: true, speed: mine })
  }
  return list
})
/** The benchmarks, in the order they move. */
const benches = computed(() => {
  if (!props.fallback) return []
  const list = BENCHMARKS.map((b) => ({ bench: b, speed: props.fallback![b] }))
  return list.sort((a, b) => (props.trickRoom ? a.speed - b.speed : b.speed - a.speed))
})
const name = computed(() => [props.species, props.forme].filter(Boolean).join(' '))
</script>

<template>
  <section class="details" :aria-label="t('speed.findDetails', { name })">
    <header class="details-head">
      <AppLink :to="{ name: 'pokemon', params: { id } }" class="mon">
        <PokemonIcon :id /><span class="name">{{ species }}</span
        ><span v-if="forme" class="forme">{{ forme }}</span>
      </AppLink>
      <span v-if="usage" class="muted small">{{
        t('speed.detailsUsage', { rank: usage.rank, pct: percent(usage.share ?? 0) })
      }}</span>
      <button type="button" class="btn back" @click="emit('close')">{{ t('speed.detailsBack') }}</button>
    </header>

    <!-- Its chart, larger: a mark at each Speed, as tall as it's common, yours a line through; its ends, its most
         common Speed and yours labeled. -->
    <div class="chart" aria-hidden="true">
      <div class="plot">
        <span v-if="mine !== null" class="mine-label" :style="{ left: at(mine) }">{{
          t('speed.yoursAt', { speed: mine })
        }}</span>
        <span
          v-if="fallback"
          class="span fallback"
          :style="{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }"
        ></span>
        <template v-else>
          <span class="span" :style="{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }"></span>
          <span
            v-for="s in spread"
            :key="s.speed"
            v-tip="`${s.speed} · ${percent(of(s.share))}`"
            class="mark"
            :class="verdict(s.speed)"
            :style="{ left: at(s.speed), '--tall': s.share / topShare }"
          ></span>
        </template>
        <span
          v-for="b in fallback ? BENCHMARKS : []"
          :key="b"
          class="bench"
          :class="verdict(fallback![b])"
          :style="{ left: at(fallback![b]) }"
        ></span>
        <span v-if="mine !== null" class="line" :style="{ left: at(mine) }"></span>
      </div>
      <div class="ticks num">
        <span class="tick" :style="{ left: at(lo) }">{{ lo }}</span>
        <span
          v-if="common !== null && common !== lo && common !== hi"
          class="tick common"
          :style="{ left: at(common) }"
          >{{ common }}</span
        >
        <span v-if="hi !== lo" class="tick" :style="{ left: at(hi) }">{{ hi }}</span>
      </div>
    </div>

    <!-- With yours, how it does against its sets: split by who moves first, then in numbers. -->
    <div v-if="odds" class="odds">
      <div class="split" aria-hidden="true">
        <span v-if="odds.yours" class="yours" :style="{ flexGrow: odds.yours }"></span>
        <span v-if="odds.tie" class="tie" :style="{ flexGrow: odds.tie }"></span>
        <span v-if="odds.theirs" class="theirs" :style="{ flexGrow: odds.theirs }"></span>
      </div>
      <dl class="tiles">
        <div class="tile">
          <dt>{{ t('speed.detailsFirst') }}</dt>
          <dd class="num yours">{{ percent(odds.yours) }}</dd>
          <dd class="muted small">{{ t('speed.detailsOfSets') }}</dd>
        </div>
        <div class="tile">
          <dt>{{ t('speed.detailsTie') }}</dt>
          <dd class="num">{{ percent(odds.tie) }}</dd>
          <dd class="muted small">{{ t('speed.detailsOfSets') }}</dd>
        </div>
        <div class="tile">
          <dt>{{ t('speed.detailsAfter') }}</dt>
          <dd class="num theirs">{{ percent(odds.theirs) }}</dd>
          <dd class="muted small">{{ t('speed.detailsOfSets') }}</dd>
        </div>
      </dl>
    </div>
    <dl class="tiles facts">
      <div v-if="common !== null" class="tile">
        <dt>{{ t('speed.detailsCommon') }}</dt>
        <dd class="num" :class="verdict(common)">{{ common }}</dd>
        <dd class="muted small">{{ percent(of(spread.find((s) => s.speed === common)?.share ?? 0)) }}</dd>
      </div>
      <div class="tile">
        <dt>{{ t('speed.detailsRange') }}</dt>
        <dd class="num">{{ lo === hi ? lo : `${lo}–${hi}` }}</dd>
      </div>
      <div v-if="mine !== null" class="tile">
        <dt>{{ t('speed.detailsYours') }}</dt>
        <dd class="num mine">{{ mine }}</dd>
      </div>
    </dl>
    <p v-if="gap" class="gap">{{ gap }}</p>

    <!-- Every Speed its sets run, in the order they move, yours among them. -->
    <template v-if="!fallback">
      <h3 class="sub">{{ t('speed.detailsSpread') }}</h3>
      <p class="muted small note">{{ t('speed.detailsSpreadNote') }}</p>
      <div class="spread" role="table">
        <div class="srow shead muted small" role="row">
          <span class="c-speed" role="columnheader">{{ t('speed.detailsSpeed') }}</span>
          <span class="c-share" role="columnheader">{{ t('speed.detailsShare') }}</span>
          <span class="c-builds" role="columnheader">{{ t('speed.detailsBuilds') }}</span>
          <span v-if="mine !== null" class="c-vs" role="columnheader">{{ t('speed.detailsVs') }}</span>
        </div>
        <template v-for="r in rows" :key="r.mine ? 'mine' : r.speed">
          <div v-if="r.mine" class="srow yours-row" role="row">
            <span class="c-speed num" role="cell">{{ r.speed }}</span>
            <span class="c-share" role="cell">{{ t('speed.detailsYours') }}</span>
          </div>
          <div v-else class="srow" :class="{ common: r.speed === common }" role="row">
            <span class="c-speed num" role="cell" :class="verdict(r.speed)">{{ r.speed }}</span>
            <span class="c-share" role="cell">
              <span class="bar" aria-hidden="true"
                ><span :class="verdict(r.speed)" :style="{ width: `${(r.share / topShare) * 100}%` }"></span></span
              ><span class="num pct">{{ percent(of(r.share)) }}</span>
            </span>
            <span class="c-builds" role="cell">
              <span v-for="b in r.builds" :key="`${b.effect}:${b.points}`" class="build">
                <EffectTag :effect="b.effect" /><span>{{ t('speed.points', { n: b.points }) }}</span
                ><span v-if="r.builds.length > 1" class="muted">{{ percent(of(b.share)) }}</span>
              </span>
            </span>
            <span v-if="mine !== null" class="c-vs verdict" role="cell" :class="verdict(r.speed)">{{
              t(`speed.detailsVerdict.${verdict(r.speed)!}`)
            }}</span>
          </div>
        </template>
      </div>
    </template>
    <!-- No sets: its benchmarks. -->
    <template v-else>
      <p class="muted small note">{{ t('speed.oddsNoSets', { name }) }}</p>
      <div class="spread" role="table">
        <div class="srow shead muted small" role="row">
          <span class="c-speed" role="columnheader">{{ t('speed.detailsSpeed') }}</span>
          <span class="c-share" role="columnheader">{{ t('speed.detailsBench') }}</span>
          <span v-if="mine !== null" class="c-vs" role="columnheader">{{ t('speed.detailsVs') }}</span>
        </div>
        <div v-for="b in benches" :key="b.bench" class="srow" role="row">
          <span class="c-speed num" role="cell" :class="verdict(b.speed)">{{ b.speed }}</span>
          <span class="c-share" role="cell">{{ t(`stat.bench.${b.bench}`) }}</span>
          <span v-if="mine !== null" class="c-vs verdict" role="cell" :class="verdict(b.speed)">{{
            t(`speed.detailsVerdict.${verdict(b.speed)!}`)
          }}</span>
        </div>
      </div>
    </template>

    <!-- The Speed items and abilities its sets run, at its most common build. -->
    <template v-if="boosts.length">
      <h3 class="sub">{{ t('speed.detailsBoosts') }}</h3>
      <p class="muted small note">{{ t('speed.detailsBoostsNote') }}</p>
      <ul class="boosts">
        <li v-for="b in boosts" :key="b.key" class="srow boost">
          <span class="c-speed num" :class="verdict(b.speed)">{{ b.speed }}</span>
          <span class="c-share">
            <strong>{{ b.label }}</strong>
            <span v-if="b.when" class="when small">{{ b.when }}</span>
          </span>
          <span class="c-builds muted">{{ t('speed.detailsBoostOn', { pct: percent(b.share) }) }}</span>
          <span v-if="mine !== null" class="c-vs verdict" :class="verdict(b.speed)">{{
            t(`speed.detailsVerdict.${verdict(b.speed)!}`)
          }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.details {
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 45%, var(--panel));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 8px;
}
.details-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.mon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 1.15em;
  font-weight: bold;
  color: var(--text);
}
.forme {
  font-size: 0.8em;
  font-weight: normal;
  color: var(--muted);
}
.back {
  margin-left: auto;
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.yours {
  color: var(--accent);
}
.theirs {
  color: var(--opponent);
}

/* The chart: the marks rising from a baseline, as tall as they're common, yours a line through; under it, its ends and
   its most common Speed. */
.chart {
  padding: 24px 0 0;
}
.plot {
  position: relative;
  height: 110px;
  border-bottom: 2px solid color-mix(in srgb, var(--text) 12%, var(--panel));
}
.span {
  position: absolute;
  bottom: -2px;
  height: 2px;
  background: var(--range-plain);
}
.span.fallback {
  height: 12px;
  background: none;
  border: 1px dotted var(--border-strong);
}
.mark {
  position: absolute;
  bottom: 0;
  width: 10px;
  height: calc(4px + var(--tall) * 96px);
  translate: -50% 0;
  background: var(--range-plain);
  box-shadow: 0 0 0 1px var(--panel);
}
.mark.yours,
.bench.yours,
.split .yours,
.bar .yours {
  background: var(--range-yours);
}
.mark.theirs,
.bench.theirs,
.split .theirs,
.bar .theirs {
  background: var(--range-theirs);
}
.mark.tie,
.bench.tie,
.split .tie,
.bar .tie {
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.bench {
  position: absolute;
  bottom: 0;
  width: 10px;
  height: 24px;
  translate: -50% 0;
  background: var(--range-plain);
}
.line {
  position: absolute;
  top: 0;
  bottom: -6px;
  width: 2px;
  translate: -50% 0;
  background: var(--accent);
}
.mine-label {
  position: absolute;
  top: -22px;
  translate: -50% 0;
  padding: 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--accent-text);
  white-space: nowrap;
  background: var(--accent);
}
.ticks {
  position: relative;
  height: 1.4em;
  font-size: 0.85em;
}
.tick {
  position: absolute;
  top: 2px;
  translate: -50% 0;
  white-space: nowrap;
  color: var(--muted);
}
.tick.common {
  color: var(--text);
}

/* How yours does: a bar split by who moves first, and the shares as tiles. */
.split {
  display: flex;
  height: 12px;
  margin-bottom: 8px;
  overflow: hidden;
  border: 1px solid var(--ink);
}
.split > span {
  flex-basis: 0;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}
.tile {
  padding: 6px 10px;
  border: 1px solid var(--border);
}
.tile dt {
  font-size: 0.8em;
  color: var(--muted);
}
.tile dd {
  margin: 0;
}
.tile .num {
  font-size: 1.4em;
}
.tile .mine {
  color: var(--accent);
}
.gap {
  margin: 0;
  font-weight: bold;
}

.sub {
  margin: 8px 0 0;
  font-size: 1em;
}
.note {
  margin: 0;
}
/* The spread: a row per Speed, yours among them; on phones, the builds under the rest. */
.spread,
.boosts {
  margin: 0;
  padding: 0;
  list-style: none;
}
.srow {
  display: grid;
  grid-template-columns: 4em minmax(8em, 1.2fr) minmax(0, 2fr) 6.5em;
  grid-template-areas: 'speed share builds vs';
  align-items: center;
  gap: 4px 10px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
.c-speed {
  grid-area: speed;
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
  gap: 2px 12px;
}
.c-vs {
  grid-area: vs;
  text-align: right;
}
.shead {
  font-weight: bold;
}
.srow.common {
  background: var(--sel);
}
.yours-row {
  font-weight: bold;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--accent);
}
.yours-row .c-speed {
  padding-left: 6px;
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
}
.pct {
  min-width: 3.2em;
  text-align: right;
}
.build {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.verdict {
  font-weight: bold;
}
.when {
  padding: 0 4px;
  border: 1px solid var(--border);
}
@media (max-width: 720px) {
  .srow {
    grid-template-columns: 3.5em minmax(0, 1fr) auto;
    grid-template-areas:
      'speed share vs'
      '. builds builds';
  }
  .shead .c-builds {
    display: none;
  }
  .tile {
    padding: 4px 6px;
  }
  .tile .num {
    font-size: 1.2em;
  }
}
</style>
