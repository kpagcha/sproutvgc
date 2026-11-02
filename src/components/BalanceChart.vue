<script setup lang="ts">
import { computed, shallowReactive, useTemplateRef } from 'vue'
import { Info } from '@lucide/vue'
import { move } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { Plotted, Shape, Side } from '@/lib/teamBalance'
import CategoryIcon from '@/components/CategoryIcon'
import PokemonIcon from '@/components/PokemonIcon'

// Bulk or power, physical and special in one chart (a Pokémon's meta page, `MonBalance`): along one axis of the value
// both sides share (bulk, or an attacking stat, alone or times a move's power), weaker to the left, the meta's values on
// each side as a ridge in its color, the two overlapping, each with its median a dashed line; attacking with moves, the
// meta's at its peak a dashed curve. The Pokémon on it each a solid line through the plot at its value in its side's
// color, its icon on the line, the physical side's toward the top and the special side's toward the bottom, so the two
// don't cover each other where they're close; attacking with moves, a line from it to what it hits for at its peak.
// What each mark is, and where it stands, in a tooltip (`tip`); the legend an icon's tooltip at the plot's corner. While the meta's side is worked out (`state`
// 'pending') the plot is a placeholder, and with no meta (`state` 'none') it says so.
export interface SideView {
  side: Side
  shape: Shape | null
  /** Attacking with moves, the meta's values at their peak, a second curve. */
  peakShape?: Shape | null
  points: Plotted[]
}
const props = defineProps<{
  sides: SideView[]
  /** The axis' ends: the weaker side's, then the stronger's. */
  ends: [string, string]
  tip: (p: Plotted, side: Side) => string
  state?: 'pending' | 'none'
}>()

// One axis for both sides: the meta's range on either (its rare extremes left out) and the Pokémon's values.
const domain = computed(() => {
  const values = props.sides.flatMap((l) => [
    ...(l.shape ? [l.shape.lo, l.shape.hi] : []),
    ...(l.peakShape ? [l.peakShape.lo, l.peakShape.hi] : []),
    ...l.points.flatMap((p) => [p.value, p.peak ?? p.value]),
  ])
  if (!values.length) return { lo: 0, hi: 1 }
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.04
  return { lo: lo - pad, hi: hi + pad }
})
const at = (v: number) => (v - domain.value.lo) / (domain.value.hi - domain.value.lo)
const pct = (x: number) => `${(x * 100).toFixed(2)}%`

/** A mark's tooltip: what the page says of it, and, where it hits harder at its peak, how it stands among the meta's
 * at theirs. */
function tipOf(p: Plotted, side: Side): string {
  if (!p.peak) return props.tip(p, side)
  const mv = p.peakMove && refName(move(p.peakMove))
  const phys = side === 'physical'
  let peak: string
  if (p.peakRank != null) {
    const rank = `${Math.round(p.peakRank * 100)}%`
    peak = mv
      ? t(phys ? 'builder.balance.peakPhysMove' : 'builder.balance.peakSpecMove', { pct: rank, move: mv })
      : t(phys ? 'builder.balance.peakPhys' : 'builder.balance.peakSpec', { pct: rank })
  } else {
    const more = `${Math.round((p.peak / p.value - 1) * 100)}%`
    peak = mv ? t('builder.balance.peakTipMove', { pct: more, move: mv }) : t('builder.balance.peakTip', { pct: more })
  }
  return `${props.tip(p, side)} · ${peak}`
}
const hasPeaks = computed(() => props.sides.some((l) => l.points.some((p) => p.peak)))
const hasPeakShapes = computed(() => props.sides.some((l) => l.peakShape))

/** A side's ridge, as an area path in a 1000 × 100 box (stretched to the plot): its height the share at each value;
 * open, its outline alone (the peak's). */
function ridge(s: Shape, open = false): string {
  const step = (s.hi - s.lo) / s.bins.length
  const pts = s.bins.map((b, i) => `L${(at(s.lo + (i + 0.5) * step) * 1000).toFixed(1)} ${(100 - b * 92).toFixed(1)}`)
  return `M${(at(s.lo) * 1000).toFixed(1)} 100${pts.join('')}L${(at(s.hi) * 1000).toFixed(1)} 100${open ? '' : 'Z'}`
}
const legendBody = useTemplateRef<HTMLElement>('legendBody')
// Each mark's tooltip, its side's badge before what it says: an element of its own, drawn hidden, by its side.
const markTips = shallowReactive(new Map<string, HTMLElement>())
function setMarkTip(key: string, el: unknown) {
  if (el instanceof HTMLElement) markTips.set(key, el)
  else markTips.delete(key)
}
</script>

<template>
  <div class="balance-chart">
    <div v-if="state" class="plot" :class="state">
      <span v-if="state === 'none'" class="muted">{{ t('builder.balance.noMeta') }}</span>
    </div>
    <template v-else>
      <div class="plot">
        <span
          v-tip="legendBody"
          class="info"
          tabindex="0"
          role="img"
          :aria-label="legendBody?.textContent ?? undefined"
        >
          <Info :size="14" aria-hidden="true" />
        </span>
        <svg class="meta" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <template v-for="l in sides" :key="l.side">
            <path v-if="l.shape" class="ridge" :data-side="l.side" :d="ridge(l.shape)" />
            <path v-if="l.peakShape" class="ridge-peak" :data-side="l.side" :d="ridge(l.peakShape, true)" />
          </template>
        </svg>
        <template v-for="l in sides" :key="l.side">
          <span
            v-if="l.shape"
            class="median"
            :data-side="l.side"
            :style="{ left: pct(at(l.shape.median)) }"
            aria-hidden="true"
          ></span>
          <template v-for="p in l.points" :key="p.pokemon">
            <span class="line" :data-side="l.side" :style="{ left: pct(at(p.value)) }" aria-hidden="true"></span>
            <span
              v-if="p.peak"
              class="peak"
              :data-side="l.side"
              :style="{ left: pct(at(p.value)), width: pct(at(p.peak) - at(p.value)) }"
              aria-hidden="true"
            ></span>
            <span
              v-tip:group="markTips.get(`${l.side}:${p.pokemon}`)"
              class="mon"
              :data-side="l.side"
              :style="{ left: `clamp(18px, ${pct(at(p.value))}, calc(100% - 18px))` }"
              :aria-label="tipOf(p, l.side)"
              ><PokemonIcon :id="p.pokemon"
            /></span>
          </template>
        </template>
      </div>
      <div class="axis" aria-hidden="true">
        <span>← {{ ends[0] }}</span>
        <span>{{ ends[1] }} →</span>
      </div>
    </template>
    <div hidden>
      <template v-for="l in sides" :key="l.side">
        <div
          v-for="p in l.points"
          :key="p.pokemon"
          :ref="(el) => setMarkTip(`${l.side}:${p.pokemon}`, el)"
          class="mark-tip"
          :data-side="l.side"
        >
          <CategoryIcon :category="l.side" :tip="false" /><span>{{ tipOf(p, l.side) }}</span>
        </div>
      </template>
      <div ref="legendBody" class="legend">
        <span
          ><svg class="key key-ridge" viewBox="0 0 20 12" aria-hidden="true">
            <path d="M0 12C4 12 6 2 10 2S16 12 20 12Z" /></svg
          >{{ t('builder.balance.legendMeta') }}</span
        >
        <span v-if="hasPeakShapes"
          ><svg class="key key-ridge key-ridge-peak" viewBox="0 0 20 12" aria-hidden="true">
            <path d="M0 12C4 12 6 2 10 2S16 12 20 12" /></svg
          >{{ t('builder.balance.legendPeakMeta') }}</span
        >
        <span><span class="key key-median"></span>{{ t('builder.balance.legendMedian') }}</span>
        <span><span class="key key-line"></span>{{ t('overview.legendLine') }}</span>
        <span v-if="hasPeaks"><span class="key key-peak"></span>{{ t('builder.balance.legendPeak') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.balance-chart {
  min-width: 0;
}
[data-side='physical'] {
  --c: var(--physical);
}
[data-side='special'] {
  --c: var(--special);
}
/* The legend's icon, at the plot's top right. */
.info {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  display: inline-flex;
  color: var(--muted);
  cursor: help;
}
/* A mark's tooltip: its side's badge, then what it says. */
.mark-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.info:hover,
.info:focus-visible {
  color: var(--text);
}
/* The plot: room for an icon toward its top and another toward its bottom. */
.plot {
  position: relative;
  height: 76px;
  border-bottom: 2px solid var(--border);
  background: color-mix(in srgb, var(--ink) 3%, transparent);
}
/* Placeholder while the meta's side is worked out; with no meta, a word. */
.plot.pending,
.plot.none {
  display: flex;
  align-items: center;
  justify-content: center;
}
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
.meta {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* The two ridges overlapping: a light wash each, its outline in its color. */
.ridge {
  fill: color-mix(in srgb, var(--c) 16%, transparent);
  stroke: var(--c);
  stroke-width: 2px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.ridge-peak {
  fill: none;
  stroke: var(--c);
  stroke-width: 1.5px;
  stroke-dasharray: 5 4;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.median {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  margin-left: -1px;
  border-left: 2px dashed var(--c);
}
/* Where it falls: a solid line through the plot, its icon on it. */
.line {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 3px;
  margin-left: -1.5px;
  background: var(--c);
}
.mon {
  position: absolute;
  z-index: 2;
  line-height: 0;
  outline: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
  transform: translateX(-50%);
}
.mon[data-side='physical'] {
  top: 3px;
}
.mon[data-side='special'] {
  bottom: 3px;
}
/* Attacking with moves, a line from it to its peak at its icon's middle, a tick at its end. */
.peak {
  position: absolute;
  z-index: 1;
  height: 2px;
  background: color-mix(in srgb, var(--text) 45%, transparent);
}
.peak[data-side='physical'] {
  top: 18px;
}
.peak[data-side='special'] {
  bottom: 18px;
}
.peak::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -4px;
  width: 2px;
  height: 10px;
  background: inherit;
}
.axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.78em;
  color: var(--muted);
}
/* The legend, in the icon's tooltip: a key per line, each figure centered in the first column. */
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
.key-ridge {
  width: 20px;
  height: 12px;
}
.key-ridge path {
  fill: color-mix(in srgb, var(--muted) 30%, transparent);
  stroke: var(--muted);
  stroke-width: 1.5px;
}
.key-ridge-peak path {
  fill: none;
  stroke-dasharray: 3 2;
}
.key-median {
  width: 0;
  height: 12px;
  border-left: 2px dashed var(--muted);
}
.key-line {
  width: 3px;
  height: 12px;
  background: var(--text);
}
.key-peak {
  height: 2px;
  background: color-mix(in srgb, var(--text) 55%, transparent);
  box-shadow: inset -2px 0 0 var(--text);
}
</style>
