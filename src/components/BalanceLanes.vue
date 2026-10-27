<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Info } from '@lucide/vue'
import { t } from '@/i18n'
import type { Plotted, Shape, Side } from '@/lib/teamBalance'
import CategoryIcon from '@/components/CategoryIcon'
import PokemonIcon from '@/components/PokemonIcon'

// The team builder's Defense or Offense chart (`TeamBalance`'s chart card): a lane per side, physical and special,
// each labeled by its category's badge and drawn in its color, along one axis of the value they share (an attacking
// stat, or bulk), weaker to the left. In each, the meta's values as a soft ridge (how many of the meta are at each
// value), the middle half of it a band and its median a line, and over them the team's Pokémon at their own values,
// stacked a row up where they'd overlap (up to `ROWS`, the plots' height fixed, so every panel's look alike), a
// diamond on the line at their average. Narrow, each lane's label over its plot. What each mark is in a tooltip
// (`tip`, `meanTip`); the legend an icon's tooltip at the first plot's top right (tapped on phones). While the meta's
// side is worked out (`state` 'pending') the plots are placeholders, and with no meta (`state` 'none') they say so.
export interface LaneView {
  side: Side
  label: string
  /** A caption under its name, if any. */
  sub?: string
  /** What its name says on hover, if anything (its name then underlined, dotted). */
  tip?: string
  shape: Shape | null
  points: Plotted[]
  mean: number | null
}
const props = defineProps<{
  lanes: LaneView[]
  /** The axis' ends: the weaker side's, then the stronger's. */
  ends: [string, string]
  tip: (p: Plotted, side: Side) => string
  meanTip: (lane: LaneView) => string
  state?: 'pending' | 'none'
}>()

// One axis for both lanes: the meta's range on either (its rare extremes left out) and the team's values, a little
// room each side.
const domain = computed(() => {
  const values = props.lanes.flatMap((l) => [
    ...(l.shape ? [l.shape.lo, l.shape.hi] : []),
    ...l.points.map((p) => p.value),
  ])
  if (!values.length) return { lo: 0, hi: 1 }
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.04
  return { lo: lo - pad, hi: hi + pad }
})
const at = (v: number) => (v - domain.value.lo) / (domain.value.hi - domain.value.lo)
const pct = (x: number) => `${(x * 100).toFixed(2)}%`

/** A lane's ridge, as an area path in a 1000 × 100 box (stretched to the plot): its height the share at each value. */
function ridge(s: Shape): string {
  const step = (s.hi - s.lo) / s.bins.length
  const pts = s.bins.map((b, i) => `L${(at(s.lo + (i + 0.5) * step) * 1000).toFixed(1)} ${(100 - b * 88).toFixed(1)}`)
  return `M${(at(s.lo) * 1000).toFixed(1)} 100${pts.join('')}L${(at(s.hi) * 1000).toFixed(1)} 100Z`
}

// The plot's width, to stack the icons that would overlap: each a row up from the first that has room, up to `ROWS`
// (past them, on the row whose last is farthest back).
const plots = useTemplateRef<HTMLElement[]>('plots')
const { width } = useElementSize(() => plots.value?.[0])
const ROOM = 28
const ROWS = 3
const legendBody = useTemplateRef<HTMLElement>('legendBody')
const placed = computed(() =>
  props.lanes.map((l) => {
    const ends: number[] = []
    return [...l.points]
      .sort((a, b) => a.value - b.value)
      .map((p) => {
        const x = at(p.value) * (width.value || 1)
        let row = ends.findIndex((end) => x - end >= ROOM)
        if (row < 0) row = ends.length < ROWS ? ends.length : ends.indexOf(Math.min(...ends))
        ends[row] = x
        return { p, row }
      })
  }),
)
</script>

<template>
  <div class="lanes" :style="{ '--rows': ROWS }">
    <template v-for="(l, i) in lanes" :key="l.side">
      <div class="lane-label" :data-side="l.side">
        <CategoryIcon :category="l.side" :tip="false" />
        <span class="lane-text">
          <span v-tip="l.tip" class="lane-name" :class="{ tipped: l.tip }" :tabindex="l.tip ? 0 : undefined">{{
            l.label
          }}</span>
          <span v-if="l.sub" class="lane-sub">{{ l.sub }}</span>
        </span>
      </div>
      <div v-if="state" class="plot" :class="state" :data-side="l.side">
        <span v-if="state === 'none' && !i" class="plot-note muted">{{ t('builder.balance.noMeta') }}</span>
      </div>
      <div v-else ref="plots" class="plot" :data-side="l.side">
        <svg v-if="l.shape" class="meta" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <rect
            class="band"
            :x="at(l.shape.q1) * 1000"
            y="0"
            :width="(at(l.shape.q3) - at(l.shape.q1)) * 1000"
            height="100"
          />
          <path class="ridge" :d="ridge(l.shape)" />
        </svg>
        <span v-if="l.shape" class="median" :style="{ left: pct(at(l.shape.median)) }" aria-hidden="true"></span>
        <span
          v-for="{ p, row } in placed[i]"
          :key="p.pokemon"
          v-tip:group="tip(p, l.side)"
          class="mon"
          :class="{ mixed: p.mixed }"
          :style="{ left: `clamp(20px, ${pct(at(p.value))}, calc(100% - 20px))`, '--row': row }"
          :aria-label="tip(p, l.side)"
          ><PokemonIcon :id="p.pokemon"
        /></span>
        <span
          v-if="l.mean !== null"
          v-tip:group="meanTip(l)"
          class="mean"
          :style="{ left: pct(at(l.mean)) }"
          :aria-label="meanTip(l)"
        ></span>
        <span
          v-if="!i"
          v-tip="legendBody"
          class="info"
          tabindex="0"
          role="img"
          :aria-label="legendBody?.textContent ?? undefined"
        >
          <Info :size="14" aria-hidden="true" />
        </span>
      </div>
    </template>
    <div v-if="!state" class="axis" aria-hidden="true">
      <span>← {{ ends[0] }}</span>
      <span>{{ ends[1] }} →</span>
    </div>
    <div hidden>
      <div ref="legendBody" class="legend">
        <span
          ><svg class="key key-ridge" viewBox="0 0 20 12" aria-hidden="true">
            <path d="M0 12C4 12 6 2 10 2S16 12 20 12Z" /></svg
          >{{ t('builder.balance.legendMeta') }}</span
        >
        <span><span class="key key-band"></span>{{ t('builder.balance.legendBand') }}</span>
        <span><span class="key key-median"></span>{{ t('builder.balance.legendMedian') }}</span>
        <span v-if="lanes.some((l) => l.mean !== null)"
          ><span class="key key-mean"></span>{{ t('builder.balance.legendMean') }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Label, plot. */
.lanes {
  --row-h: 30px;
  container-type: inline-size;
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  align-items: end;
  gap: 10px 14px;
}
[data-side='physical'] {
  --c: var(--physical);
}
[data-side='special'] {
  --c: var(--special);
}
.lane-label {
  --icon-scale: 1.2;
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
}
.lane-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.lane-name {
  font-weight: bold;
}
/* A name with more to it on hover. */
.lane-name.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
/* Its caption wraps within the cell: it never runs under the plot. */
.lane-sub {
  font-size: 0.78em;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.plot {
  grid-column: 2;
  position: relative;
  /* The same in every panel: room for its rows of icons, and a little over them for the ridge's peak. */
  height: calc(var(--rows) * var(--row-h) + 14px);
  background: color-mix(in srgb, var(--c) 5%, transparent);
  border-bottom: 2px solid var(--c);
}
/* Placeholders while the meta's side is worked out; with no meta, a word in the first. */
.plot.pending {
  background: var(--border);
  opacity: 0.4;
  animation: pulse 1.2s ease-in-out infinite alternate;
}
@keyframes pulse {
  to {
    opacity: 0.2;
  }
}
.plot.none {
  display: flex;
  align-items: center;
  justify-content: center;
}
.plot-note {
  font-size: 0.9em;
}
.meta {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ridge {
  fill: color-mix(in srgb, var(--c) 22%, transparent);
  stroke: var(--c);
  stroke-width: 2px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.band {
  fill: color-mix(in srgb, var(--ink) 9%, transparent);
}
.median {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--c);
}
.mon {
  position: absolute;
  bottom: calc(var(--row) * var(--row-h) + 2px);
  transform: translateX(-50%);
  line-height: 0;
  transition: transform 0.12s ease;
}
.mon:hover {
  z-index: 2;
  transform: translateX(-50%) translateY(-2px);
}
/* An attacker on both sides: a dot under it, on both lanes. */
.mon.mixed::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -1px;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  background: var(--text);
  border: 2px solid var(--panel);
  border-radius: 50%;
}
/* The team's average: a diamond on the line, ringed in the panel's color. */
.mean {
  position: absolute;
  bottom: -8px;
  z-index: 3;
  width: 13px;
  height: 13px;
  margin-left: -6.5px;
  background: var(--text);
  border: 2px solid var(--panel);
  transform: rotate(45deg);
}
/* The legend's icon, at the first plot's top right, over the ridge. */
.info {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 4;
  display: inline-flex;
  color: var(--muted);
  cursor: help;
}
.info:hover,
.info:focus-visible {
  color: var(--text);
}
.axis {
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
  font-size: 0.8em;
  color: var(--muted);
}
/* The legend, in the icon's tooltip: a key per line, two columns, each figure centered in the first and its text
   lined up in the second. */
.legend {
  display: grid;
  grid-template-columns: 20px auto;
  align-items: center;
  gap: 5px 8px;
}
.legend > span {
  display: contents;
}
.legend .key {
  justify-self: center;
}
.key {
  display: inline-block;
  width: 14px;
  height: 10px;
}
/* The ridge's own shape, small: a hump. */
.key-ridge {
  width: 20px;
  height: 12px;
}
.key-ridge path {
  fill: color-mix(in srgb, var(--muted) 30%, transparent);
  stroke: var(--muted);
  stroke-width: 1.5px;
}
.key-band {
  background: color-mix(in srgb, var(--text) 25%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 40%, transparent);
}
.key-median {
  width: 2px;
  height: 12px;
  background: var(--muted);
}
.key-mean {
  width: 8px;
  height: 8px;
  background: var(--text);
  transform: rotate(45deg);
}
/* Narrow: each lane's label over its plot. */
@container (max-width: 480px) {
  .lanes {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .lane-label,
  .plot,
  .axis {
    grid-column: 1;
  }
  .lane-label {
    padding: 8px 0 0;
  }
  .lane-text {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
  }
}
</style>
