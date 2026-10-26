<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Info } from '@lucide/vue'
import { t } from '@/i18n'
import type { Plotted, Shape, Side } from '@/lib/teamBalance'
import CategoryIcon from '@/components/CategoryIcon'
import PokemonIcon from '@/components/PokemonIcon'

// The team builder's Defense or Offense grid (`TeamBalance`): three columns, a row's label, its chart, and what the
// team has for it; the same in both panels, so they look alike. A lane per side, physical and special, each headed by
// its category's badge and drawn in its color, along one axis of the value they share (an attacking stat, or bulk),
// weaker to the left: the meta's values as a soft ridge (how many of the meta are at each value), the middle half of
// it a band and its median a line, and over them the team's Pokémon at their own values, stacked a row up where
// they'd overlap (up to `ROWS`, the plots' height fixed), a diamond on the line at their average; at its end what the
// team has for that side (`#aside`, a dash with none). A choice of the panel's over the plots (`#head`). Rows of the panel's own come after (`#after`: a label cell and
// a cell across the other two, `.row-label` and `.row-wide`). Narrow, the cells one under another, each lane's label
// over its plot. What each mark is in a tooltip (`tip`, `meanTip`); the legend an icon's tooltip at the
// first plot's top right (tapped on phones). While the meta's side is
// worked out (`state` 'pending') the plots are placeholders, and with no meta (`state` 'none') they say so.
export interface LaneView {
  side: Side
  label: string
  sub: string
  shape: Shape | null
  points: Plotted[]
  mean: number | null
}
const props = defineProps<{
  lanes: LaneView[]
  /** The axis' ends: the weaker side's, then the stronger's. */
  ends: [string, string]
  asideTitle: string
  /** Whether a lane has anything at its end. */
  hasAside: (side: Side) => boolean
  tip: (p: Plotted, side: Side) => string
  meanTip: (lane: LaneView) => string
  state?: 'pending' | 'none'
}>()
defineSlots<{ aside(props: { side: Side }): unknown; after(): unknown; head(): unknown }>()

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
    <div v-if="$slots.head" class="head"><slot name="head" /></div>
    <p class="aside-head" aria-hidden="true">{{ asideTitle }}</p>
    <template v-for="(l, i) in lanes" :key="l.side">
      <div class="lane-label" :data-side="l.side" :style="{ '--o': i * 10 + 1 }">
        <CategoryIcon :category="l.side" :tip="false" />
        <span class="lane-text">
          <span class="lane-name">{{ l.label }}</span>
          <span class="lane-sub">{{ l.sub }}</span>
        </span>
      </div>
      <div v-if="state" class="plot" :class="state" :data-side="l.side" :style="{ '--o': i * 10 + 2 }">
        <span v-if="state === 'none' && !i" class="plot-note muted">{{ t('builder.balance.noMeta') }}</span>
      </div>
      <div v-else ref="plots" class="plot" :data-side="l.side" :style="{ '--o': i * 10 + 2 }">
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
      <div class="aside" :style="{ '--o': i * 10 + 4 }">
        <span class="aside-inline muted">{{ asideTitle }}</span>
        <slot v-if="hasAside(l.side)" name="aside" :side="l.side" />
        <span v-else class="muted" :aria-label="t('builder.balance.none')">—</span>
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
        <span><span class="key key-mean"></span>{{ t('builder.balance.legendMean') }}</span>
      </div>
    </div>
    <slot name="after" />
  </div>
</template>

<style scoped>
/* One grid for the panel: label, chart, what helps. */
.lanes {
  --row-h: 30px;
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) 12rem;
  align-items: end;
  gap: 10px 16px;
}
/* What the chart's head holds (a choice of how it measures), over the plots. */
.head {
  grid-column: 2;
  align-self: end;
  font-size: 0.9em;
}
.aside-head {
  grid-column: 3;
  margin: 0 0 -4px;
  font-size: 0.75em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
[data-side='physical'] {
  --c: var(--physical);
}
[data-side='special'] {
  --c: var(--special);
}
.lane-label {
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
}
/* A row of the panel's own: its label as a lane's text (a name over a caption, `.row-name`, `.row-sub`). */
.lanes > :slotted(.row-label) {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.lanes :slotted(.row-name) {
  font-weight: bold;
}
.lanes :slotted(.row-sub) {
  font-size: 0.78em;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.lane-label {
  --icon-scale: 1.2;
}
.lane-text,
.lanes > :slotted(.row-label) {
  line-height: 1.25;
}
.lane-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.lane-name {
  font-weight: bold;
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
/* What the team has for the lane's side, at its end. */
.aside {
  grid-column: 3;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-end;
  gap: 4px;
  padding-bottom: 4px;
}
.aside-inline {
  display: none;
}
.axis {
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
  font-size: 0.8em;
  color: var(--muted);
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
/* A row of the panel's own: its content across the chart's and the aside's columns, from the plots' left edge. */
.lanes > :slotted(.row-wide) {
  grid-column: 2 / -1;
  min-width: 0;
  margin-top: 14px;
}
.lanes > :slotted(.row-label) {
  align-self: center;
  margin-top: 14px;
}
.lanes > :slotted(.row-label.small) {
  font-size: 0.85em;
}
/* The legend's keys neutral: each lane's color is its side's, named by its badge. */
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
/* Narrow (the panel's body is the container): the cells one under another, each lane's label over its plot, the
   axis right under the last plot, what helps each side under that. */
@container (max-width: 640px) {
  .lanes {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .lanes > * {
    grid-column: 1;
  }
  .lane-label,
  .plot,
  .aside {
    order: var(--o);
  }
  .axis {
    order: 13;
  }
  .lanes > :slotted(*) {
    order: 20;
  }
  .lanes > :slotted(.row-wide) {
    grid-column: 1;
    margin-top: 0;
  }
  .aside-head {
    display: none;
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
  .aside {
    align-items: center;
  }
  .aside-inline {
    display: inline;
    margin-right: 4px;
    font-size: 0.85em;
  }
}
</style>
