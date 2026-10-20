<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { onClickOutside, useElementSize } from '@vueuse/core'
import { pokemon } from '@/data/dex'
import { percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { NamedLocation } from '@/lib/links'
import { chartReach, pinned, strength, WR_STEP, type Day, type PokemonStat } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// A tournament's Pokémon by usage and win rate (`TournamentView`'s Pokémon tab): usage across, on a log scale (most
// are on a few teams, a few on half of them), and win rate up, even (50%) a line across the middle, the half above it
// tinted good and the half under it bad. Each Pokémon its icon, as solid as the matches behind it make it (`strength`),
// leading where its row in the table does, its numbers in the card below. Its win rates reach as far
// from even as those with the day's minimum of matches do (`chartReach`); one with fewer that's farther is pinned to the
// edge it's past, a notch on that side saying so. The table under it is its accessible view.

const props = defineProps<{
  stats: readonly PokemonStat[]
  /** The day they're of, which sets how many matches it takes to set the chart's reach and to be solid. */
  day: Day
  /** Where a Pokémon's icon leads. */
  to: (s: PokemonStat) => NamedLocation
}>()

/** The usages marked across, those within the chart's range. */
const USAGE_TICKS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
/** The marks drawn dashed: the steps of 10% between the round ones, which crowd together towards the right. */
const DASHED = new Set([0.3, 0.4, 0.6, 0.7, 0.8, 0.9])
/** The least room between two marks' labels, in pixels: one closer to the last shown keeps its line but not its label. */
const LABEL_GAP = 34

const xRange = computed(() => {
  const usages = props.stats.map((s) => s.usage)
  // A little room past the ends, so no icon sits on the edge's label; at least one tick's width.
  let lo = Math.log10(Math.min(...usages)) - 0.08
  let hi = Math.log10(Math.min(Math.max(...usages), 1)) + 0.08
  if (hi - lo < 0.5) {
    const mid = (lo + hi) / 2
    lo = mid - 0.25
    hi = mid + 0.25
  }
  return { lo, hi }
})
const reach = computed(() => chartReach(props.stats, props.day))

/** A usage's place across, 0 to 1. */
const xOf = (usage: number) => (Math.log10(usage) - xRange.value.lo) / (xRange.value.hi - xRange.value.lo)
/** A win rate's place up, 0 at the bottom to 1 at the top. */
const yOf = (wr: number) => (wr - 0.5 + reach.value) / (2 * reach.value)

const plot = useTemplateRef<HTMLElement>('plot')
const { width, height } = useElementSize(plot)
/** The room inside the plot's edges the marks keep, in pixels, so the icons at its ends stay within it: less on a
 * narrow chart. Set on the plot as `--pad-x` and `--pad-y` for the CSS that places them. */
const padX = computed(() => (width.value < 560 ? 16 : 22))
const PAD_Y = 16
/** The usages marked across within the chart's range, each labeled unless too close to the last one labeled. */
const xTicks = computed(() => {
  let last = -Infinity
  return USAGE_TICKS.filter((u) => {
    const x = xOf(u)
    return x >= 0 && x <= 1
  }).map((u) => {
    const px = xOf(u) * (width.value - 2 * padX.value)
    const labeled = px - last >= LABEL_GAP
    if (labeled) last = px
    return { u, labeled, dashed: DASHED.has(u) }
  })
})
const yTicks = computed(() => {
  const n = Math.round(reach.value / WR_STEP)
  // Every step while there are few; every other one past 20 points from even.
  const every = n > 4 ? 2 : 1
  return Array.from({ length: 2 * n + 1 }, (_, i) => 0.5 - reach.value + i * WR_STEP).filter(
    (_, i) => (i - n) % every === 0,
  )
})

const points = computed(() =>
  props.stats
    .filter((s) => s.winRate !== null)
    .map((s) => {
      const out = pinned(s, reach.value)
      return {
        s,
        x: xOf(s.usage),
        // Past the reach, at the edge it's past.
        y: Math.min(Math.max(yOf(s.winRate!), 0), 1),
        strength: strength(s, props.day),
        pinned: out ? (s.winRate! > 0.5 ? 'over' : 'under') : null,
      }
    })
    // The most played on top, where icons overlap.
    .sort((a, b) => a.strength - b.strength),
)

// What's under the pointer: the icon nearest it, within `HIT` pixels, so it needn't be landed on exactly, and with it
// every icon within `NEAR` of that one, the ones it covers or is covered by, shown together in one card (`peek`), the
// most used first, each with its numbers. With a mouse, the card follows the pointer, and a click follows the icon's
// link when it's alone, or leaves the card open over several, to pick one from; on a touch screen, a tap leaves the card
// open whatever's there. Its rows are then the links; a click or tap off it puts it away. An icon focused from the keyboard shows its own.
const HIT = 28
const NEAR = 16
/** Each icon's place in the plot, in pixels from its top left. */
const placed = computed(() =>
  points.value.map((p) => ({
    ...p,
    px: padX.value + (width.value - 2 * padX.value) * p.x,
    py: height.value - PAD_Y - (height.value - 2 * PAD_Y) * p.y,
  })),
)
type Placed = (typeof placed.value)[number]
const peek = ref<{ group: Placed[]; at: Placed; stuck: boolean } | null>(null)
const hot = computed(() => new Set(peek.value?.group.map((p) => p.s.id)))

function groupAt(x: number, y: number) {
  let at: Placed | undefined
  let best = HIT
  for (const p of placed.value) {
    const d = Math.hypot(p.px - x, p.py - y)
    if (d <= best) [at, best] = [p, d]
  }
  return at ? groupOf(at) : null
}
function groupOf(at: Placed) {
  const group = placed.value
    .filter((p) => Math.hypot(p.px - at.px, p.py - at.py) <= NEAR)
    .sort((a, b) => b.s.usage - a.s.usage)
  return { group, at }
}
/** Where an event is in the plot, inside its border. */
function local(e: MouseEvent): [number, number] {
  const el = plot.value!
  const r = el.getBoundingClientRect()
  return [e.clientX - r.left - el.clientLeft, e.clientY - r.top - el.clientTop]
}

const router = useRouter()
let mouse = true
function onDown(e: PointerEvent) {
  mouse = e.pointerType === 'mouse'
}
function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || peek.value?.stuck) return
  const g = groupAt(...local(e))
  peek.value = g && { ...g, stuck: false }
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse' && !peek.value?.stuck) peek.value = null
}
function onClick(e: MouseEvent) {
  // A row of the card, a link of its own.
  if ((e.target as Element).closest('.peek')) return
  e.preventDefault()
  // A card left open, put away by a click off it, the pointer's own showing again.
  if (mouse && peek.value?.stuck) {
    const g = groupAt(...local(e))
    peek.value = g && { ...g, stuck: false }
    return
  }
  const g = groupAt(...local(e))
  // One icon there: its link. Several, or a tap: the card left open, to pick from.
  if (mouse && g?.group.length === 1) void router.push(props.to(g.at.s))
  else peek.value = g && { ...g, stuck: true }
}
onClickOutside(plot, () => {
  if (peek.value?.stuck) peek.value = null
})
function onFocus(id: string) {
  const at = placed.value.find((p) => p.s.id === id)
  if (at) peek.value = { ...groupOf(at), stuck: false }
}
function onBlur() {
  if (!peek.value?.stuck) peek.value = null
}
const peekEl = useTemplateRef<HTMLElement>('peekEl')
const { width: peekWidth } = useElementSize(peekEl, undefined, { box: 'border-box' })
/** The card's place: over the icon it's at, or under it when that's in the plot's top half, kept within the plot. */
const peekStyle = computed(() => {
  const at = peek.value?.at
  if (!at) return undefined
  const half = Math.min((peekWidth.value || 180) / 2 + 2, width.value / 2)
  return { left: `${Math.min(Math.max(at.px, half), width.value - half)}px`, top: `${at.py}px` }
})
const peekBelow = computed(() => !!peek.value && peek.value.at.py < height.value * 0.45)

/** A tick's percentage, as short as it is: "80%", "0.5%". */
const tickFormat = computed(() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }))
const tick = (share: number) => tickFormat.value.format(share)

const tipOf = (s: PokemonStat) =>
  t('tournaments.chartTip', {
    name: refName(pokemon(s.id)),
    usage: percent(s.usage),
    winRate: percent(s.winRate ?? 0),
    wins: s.wins,
    losses: s.losses,
  })
</script>

<template>
  <figure class="wr-chart">
    <div
      ref="plot"
      class="plot"
      :style="{ '--pad-x': `${padX}px`, '--pad-y': `${PAD_Y}px` }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerleave="onLeave"
      @click="onClick"
      role="img"
      :aria-label="t('tournaments.chartLabel')"
    >
      <div class="half good" :style="{ '--y': yOf(0.5) }"></div>
      <div class="half bad" :style="{ '--y': yOf(0.5) }"></div>
      <div
        v-for="v in yTicks"
        :key="`y${v}`"
        class="grid-y"
        :class="{ even: Math.abs(v - 0.5) < 1e-9 }"
        :style="{ '--y': yOf(v) }"
      >
        <span class="tick">{{ tick(v) }}</span>
      </div>
      <div
        v-for="x in xTicks"
        :key="`x${x.u}`"
        class="grid-x"
        :class="{ minor: x.dashed }"
        :style="{ '--x': xOf(x.u) }"
      >
        <span v-if="x.labeled" class="tick">{{ tick(x.u) }}</span>
      </div>
      <AppLink
        v-for="p in points"
        :key="p.s.id"
        :to="to(p.s)"
        class="point"
        :class="[p.pinned, { hot: hot.has(p.s.id) }]"
        :style="{ '--x': p.x, '--y': p.y, '--strength': p.strength }"
        @focus="onFocus(p.s.id)"
        @blur="onBlur"
        :aria-label="tipOf(p.s)"
      >
        <PokemonIcon :id="p.s.id" />
      </AppLink>
      <div v-if="peek" ref="peekEl" class="peek" :class="{ below: peekBelow, stuck: peek.stuck }" :style="peekStyle">
        <AppLink v-for="p in peek.group" :key="p.s.id" :to="to(p.s)" class="peek-row" :aria-label="tipOf(p.s)">
          <PokemonIcon :id="p.s.id" />
          <span class="num">{{ percent(p.s.usage) }}</span>
          <span class="num" :class="p.s.winRate! >= 0.5 ? 'up' : 'down'">{{ percent(p.s.winRate!) }}</span>
          <span class="num muted">{{ p.s.wins }}–{{ p.s.losses }}</span>
        </AppLink>
      </div>
    </div>
    <figcaption class="axes">
      <span class="x-name"
        ><span v-tip="t('tournaments.chartXTip')" class="tipped">{{ t('tournaments.chartX') }}</span
        ><span class="arrow" aria-hidden="true">→</span></span
      >
      <span class="y-name"
        ><span class="arrow" aria-hidden="true">↑</span><span>{{ t('tournaments.chartY') }}</span></span
      >
    </figcaption>
  </figure>
</template>

<style scoped>
.wr-chart {
  margin: 4px 0 16px;
}
/* The plot, its marks placed in the room left inside it (`--pad`), so the icons at its ends stay within it; the ticks'
   labels in the gutters left of it and under it. */
.plot {
  position: relative;
  height: clamp(240px, 42vw, 380px);
  margin: 0 0 22px 3rem;
  border-left: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.half,
.grid-y,
.grid-x,
.point {
  position: absolute;
}
.half {
  left: 0;
  right: 0;
}
.half.good {
  top: 0;
  bottom: calc(var(--pad-y) + (100% - 2 * var(--pad-y)) * var(--y));
  background: color-mix(in srgb, var(--good) 6%, transparent);
}
.half.bad {
  bottom: 0;
  height: calc(var(--pad-y) + (100% - 2 * var(--pad-y)) * var(--y));
  background: color-mix(in srgb, var(--bad) 6%, transparent);
}
.grid-y {
  left: 0;
  right: 0;
  bottom: calc(var(--pad-y) + (100% - 2 * var(--pad-y)) * var(--y));
}
/* Win rates have no lines across but even's: their labels alone, at the left. */
.grid-y.even {
  border-top: 1px solid var(--muted);
}
.grid-x {
  top: 0;
  bottom: 0;
  left: calc(var(--pad-x) + (100% - 2 * var(--pad-x)) * var(--x));
  border-left: 1px solid color-mix(in srgb, var(--muted) 32%, transparent);
}
.grid-x.minor {
  border-left: 1px dashed color-mix(in srgb, var(--muted) 37%, transparent);
}
.tick {
  position: absolute;
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.grid-y .tick {
  right: calc(100% + 6px);
  transform: translateY(-50%);
}
.grid-x .tick {
  top: calc(100% + 4px);
  transform: translateX(-50%);
}
.point {
  left: calc(var(--pad-x) + (100% - 2 * var(--pad-x)) * var(--x));
  bottom: calc(var(--pad-y) + (100% - 2 * var(--pad-y)) * var(--y));
  display: block;
  line-height: 0;
  transform: translate(-50%, 50%);
  opacity: calc(0.35 + 0.65 * var(--strength));
  transition: transform 0.12s ease-out;
  /* The plot finds what's under the pointer, the icons only reached from the keyboard. */
  pointer-events: none;
}
/* Pinned to an edge, past it: a notch on that side, pointing off the chart. */
.point.over::after,
.point.under::after {
  content: '';
  position: absolute;
  left: 50%;
  border: 4px solid transparent;
  transform: translateX(-50%);
}
.point.over::after {
  top: -6px;
  border-top: none;
  border-bottom-color: var(--muted);
}
.point.under::after {
  bottom: -6px;
  border-bottom: none;
  border-top-color: var(--muted);
}
.point.hot,
.point:focus-visible {
  z-index: 1;
  opacity: 1;
  transform: translate(-50%, 50%) scale(1.3);
}
.axes {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 12px;
  margin: 0 0 0 3rem;
  font-size: 0.85em;
  color: var(--muted);
}
/* The axes' names: small capitals in the text's color, as labels rather than
   prose. */
.x-name,
.y-name {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
}
.x-name,
.y-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}
/* The arrows centred on the capitals: fonts draw them on the maths axis, a little under the capitals' middle, so they're
   raised to it. */
.arrow {
  line-height: 1;
  font-size: 1.1em;
  transform: translateY(-0.12em);
}
.y-name {
  order: -1;
}
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
/* What's under the pointer, in a card over it (under it in the plot's top half), its numbers lined up in columns. */
.peek {
  position: absolute;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(4, auto);
  column-gap: 10px;
  white-space: nowrap;
  padding: 3px 6px;
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--ink, var(--border-strong));
  box-shadow: var(--hard-sm);
  transform: translate(-50%, calc(-100% - 18px));
  pointer-events: none;
}
.peek.below {
  transform: translate(-50%, 18px);
}
/* Pinned: it takes the pointer, and an inset shadow along its top and left sets it apart from the one following it. */
.peek.stuck {
  pointer-events: auto;
  box-shadow:
    var(--hard-sm),
    inset 2px 2px 0 color-mix(in srgb, var(--ink) 18%, transparent);
}
.peek-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  color: inherit;
  text-decoration: none;
}
/* Pinned, its rows highlighted on hover, the highlight reaching past their ends without the card changing size. */
.peek.stuck .peek-row {
  padding: 0 4px;
  margin: 0 -4px;
}
.peek.stuck .peek-row:hover,
.peek.stuck .peek-row:focus-visible {
  background: var(--hover);
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
.muted {
  color: var(--muted);
}
@media (max-width: 720px) {
  .plot {
    margin-left: 2.5rem;
  }
  .axes {
    margin-left: 2.5rem;
  }
}
</style>
