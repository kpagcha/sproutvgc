<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { CircleHelp } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { BENCHMARKS, type Benchmark } from '@/lib/stats'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// Every Pokémon by Speed, for the speed tiers' every-Pokémon view: a row per base Speed (those sharing one have the
// same Speeds whatever their build), its Pokémon by their icons (named on hover, and read out), and a bar on a Speed
// axis shared by every row from its slowest (Min−) to its fastest (Max+), a tick at each benchmark with its Speed under
// it. With yours, its Speed is a line down the bars, and each part of a bar and each Speed is colored by who moves
// first: yours (the accent) or them (the opponents' red); under Trick Room, the other way round. In the heads, a "?"
// with how to read them in its tooltip. The rows go from those moving first.
export interface RangeRow {
  /** Its base Speed, and whether it's of those whose item is fixed while an item is on everyone (`itemBound`). */
  key: string
  base: number
  /** Its Speed at each benchmark, with the modifiers. */
  speeds: Record<Benchmark, number>
  mons: { id: PokemonId; species: string; forme?: string; hit: boolean; mine: boolean }[]
}
const props = defineProps<{
  rows: RangeRow[]
  /** Yours' Speed in battle, when there's yours. */
  mine: number | null
  trickRoom: boolean
  /** A Pokémon found: its row marked, the others faded. */
  finding: boolean
  /** The Pokémon yours is measured against: its chip in the opponents' red. */
  versus: PokemonId | null
}>()
const emit = defineEmits<{ chip: [event: MouseEvent, id: PokemonId] }>()

/** The benchmarks as the bars run, slowest first. */
const ALONG = [...BENCHMARKS].reverse()

/** The axis: from the slowest Speed shown to the fastest, yours included, room at either end for their numbers. */
const axis = computed(() => {
  const all = props.rows.flatMap((r) => [r.speeds.min, r.speeds.max])
  if (props.mine !== null) all.push(props.mine)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(2, (hi - lo) * 0.04)
  return { lo: lo - pad, span: hi - lo + 2 * pad }
})
const at = (speed: number) => `${((speed - axis.value.lo) / axis.value.span) * 100}%`

/** Who moves first at a Speed of theirs: yours, them, or a tie (a coin flip). */
function verdict(speed: number): 'yours' | 'theirs' | 'tie' | undefined {
  if (props.mine === null) return undefined
  if (speed === props.mine) return 'tie'
  return speed < props.mine !== props.trickRoom ? 'yours' : 'theirs'
}
/** A row's bar: where it starts and how wide it is, and, with yours inside it, where its colors change. */
function bar(r: RangeRow) {
  const lo = r.speeds.min
  const hi = r.speeds.max
  const style: Record<string, string> = { left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }
  if (props.mine === null) return { style, kind: 'plain' }
  // Yours at or past an end: the whole bar as its other end is (at the end itself, only that Speed ties).
  if (props.mine <= lo) return { style, kind: verdict(hi) }
  if (props.mine >= hi) return { style, kind: verdict(lo) }
  // Split at yours: the part under it, then the part over it.
  const split = `${((props.mine - lo) / (hi - lo)) * 100}%`
  const under = props.trickRoom ? 'var(--range-theirs)' : 'var(--range-yours)'
  const over = props.trickRoom ? 'var(--range-yours)' : 'var(--range-theirs)'
  style.background = `linear-gradient(to right, ${under} ${split}, ${over} ${split})`
  return { style, kind: 'split' }
}
const benchLabel = (b: Benchmark) => t(`stat.bench.${b}`)
/** A row's Speeds read out, as the bar only shows them. */
const spoken = (r: RangeRow) => ALONG.map((b) => `${benchLabel(b)} ${r.speeds[b]}`).join(', ')
const canHover = window.matchMedia('(hover: hover)').matches
// Each Speed under its tick, unless it would touch the next one's: then those that would are pushed apart, in their
// order, just enough to clear each other, as a group centered where they'd be (and kept within the bar's room). In
// pixels, so from the bars' width (the same for every row: the heads' track's) and a digit's (from samples drawn as the
// numbers are); until those are measured, each at its tick.
const headTrack = useTemplateRef<HTMLElement>('headTrack')
const sample1 = useTemplateRef<HTMLElement>('sample1')
const sample3 = useTemplateRef<HTMLElement>('sample3')
const room = shallowRef<{ width: number; digit: number; pad: number } | null>(null)
function measure() {
  const w = headTrack.value?.clientWidth
  const w1 = sample1.value?.offsetWidth
  const w3 = sample3.value?.offsetWidth
  if (!w || !w1 || !w3) return
  const digit = (w3 - w1) / 2
  room.value = { width: w, digit, pad: w1 - digit }
}
let resize: ResizeObserver | undefined
watch(
  headTrack,
  (el) => {
    resize?.disconnect()
    if (!el) return
    resize = new ResizeObserver(measure)
    resize.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => resize?.disconnect())
/** The gap kept between two numbers. */
const GAP = 3
/** Where each of a row's numbers goes, by benchmark: its center, in pixels from the track's start. */
function placed(r: RangeRow): Partial<Record<Benchmark, number>> {
  const m = room.value
  if (!m) return {}
  const items = ALONG.map((b) => ({
    b,
    x: ((r.speeds[b] - axis.value.lo) / axis.value.span) * m.width,
    w: String(r.speeds[b]).length * m.digit + m.pad,
  }))
  // Groups of numbers that would touch, each laid out from its first's center (`at`), the rest after it by their
  // widths; a group centered on where its numbers would be, merged with the one before while they'd touch.
  type Group = { items: typeof items; offsets: number[]; at: number }
  const groups: Group[] = []
  const lay = (g: Group) => {
    g.offsets = [0]
    for (let i = 1; i < g.items.length; i++)
      g.offsets.push(g.offsets[i - 1]! + (g.items[i - 1]!.w + g.items[i]!.w) / 2 + GAP)
    g.at = g.items.reduce((n, it, i) => n + it.x - g.offsets[i]!, 0) / g.items.length
  }
  const left = (g: Group) => g.at - g.items[0]!.w / 2
  const right = (g: Group) => g.at + g.offsets.at(-1)! + g.items.at(-1)!.w / 2
  for (const it of items) {
    const g: Group = { items: [it], offsets: [0], at: it.x }
    groups.push(g)
    while (groups.length > 1 && right(groups.at(-2)!) + GAP > left(groups.at(-1)!)) {
      const last = groups.pop()!
      const prev = groups.at(-1)!
      prev.items.push(...last.items)
      lay(prev)
    }
  }
  const out: Partial<Record<Benchmark, number>> = {}
  for (const g of groups) {
    // Kept within the track, a little past its ends at most.
    const shift = Math.max(0, -4 - left(g)) - Math.max(0, right(g) - (m.width + 4))
    g.items.forEach((it, i) => (out[it.b] = g.at + shift + g.offsets[i]!))
  }
  return out
}
const spots = computed(() => Object.fromEntries(props.rows.map((r) => [r.key, placed(r)])))
const valueLeft = (r: RangeRow, b: Benchmark, spots: Partial<Record<Benchmark, number>>) =>
  spots[b] !== undefined ? `${spots[b]}px` : at(r.speeds[b])
const name = (m: RangeRow['mons'][number]) => [m.species, m.forme].filter(Boolean).join(' ')
</script>

<template>
  <div class="ranges" :class="{ finding }">
    <!-- The heads: the base, how to read the bars (a "?", its tooltip), and the axis's ends, yours on it. -->
    <div class="head">
      <span class="base" aria-hidden="true">{{ t('speed.base') }}</span>
      <span class="head-help">
        <span v-tip="t('speed.rangesNote')" class="help" tabindex="0" role="img" :aria-label="t('speed.help')">
          <CircleHelp :size="14" aria-hidden="true" />
        </span>
      </span>
      <span ref="headTrack" class="track" aria-hidden="true">
        <!-- Samples of the numbers under the bars, for their widths. -->
        <span ref="sample1" class="value num sample">8</span>
        <span ref="sample3" class="value num sample">888</span>
        <span class="end">{{ Math.round(axis.lo) }}</span>
        <span v-if="mine !== null" class="mine-label" :style="{ left: at(mine) }">{{
          t('speed.yoursAt', { speed: mine })
        }}</span>
        <span class="end">{{ Math.round(axis.lo + axis.span) }}</span>
      </span>
    </div>
    <ol class="rows">
      <li
        v-for="r in rows"
        :key="r.key"
        class="row tier"
        :class="{ hit: r.mons.some((m) => m.hit), 'has-mine': r.mons.some((m) => m.mine) }"
        :data-base="r.base"
      >
        <span class="base num">{{ r.base }}</span>
        <span class="mons">
          <AppLink
            v-for="m in r.mons"
            :key="m.id"
            v-tip="canHover && name(m)"
            :to="{ name: 'usagePokemon', params: { id: m.id } }"
            class="mon"
            :class="{ hit: m.hit, mine: m.mine, versus: m.id === versus }"
            :aria-label="name(m)"
            @click.capture="emit('chip', $event, m.id)"
          >
            <PokemonIcon :id="m.id" />
          </AppLink>
        </span>
        <span class="track">
          <span class="visually-hidden">{{ spoken(r) }}</span>
          <span class="bar" :class="bar(r).kind" :style="bar(r).style" aria-hidden="true"></span>
          <template v-for="b in ALONG" :key="b">
            <span class="tick" :style="{ left: at(r.speeds[b]) }" aria-hidden="true"></span>
            <span
              class="value num"
              :class="verdict(r.speeds[b])"
              :style="{ left: valueLeft(r, b, spots[r.key]!) }"
              aria-hidden="true"
              >{{ r.speeds[b] }}</span
            >
          </template>
          <span v-if="mine !== null" class="line" :style="{ left: at(mine) }" aria-hidden="true"></span>
        </span>
        <!-- On phones, where the bar's under the rest of the row and as wide as it: yours' line down the whole row. -->
        <span v-if="mine !== null" class="line row-line" :style="{ left: at(mine) }" aria-hidden="true"></span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* A row: the base, its Pokémon (taking what's left), and the bar with its Speeds; on phones, the base and the Pokémon
   on a line, the bar under them. */
.ranges {
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 35%, var(--panel));
  --cols: 2.6em minmax(0, 1fr) minmax(12em, 1fr);
}
/* The benchmarks, in the bars' order, each with how yours does at it. */
/* How to read the bars: a "?" in the heads, over the Pokémon, what it opens under them. */
.head-help {
  grid-area: mons;
}
.help {
  display: inline-flex;
  padding: 0;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.help:hover,
.help:focus-visible {
  color: var(--text);
}
.head,
.row {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'base mons track';
  align-items: center;
  gap: 4px 10px;
}
.head {
  padding: 2px 0 4px;
  font-weight: bold;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
/* Smaller, its cells rather than the row: the columns' widths are in ems, and must be the rows' own. */
.head > * {
  font-size: 0.8em;
}
.head .track {
  display: flex;
  justify-content: space-between;
  min-height: 0;
}
.base {
  grid-area: base;
}
.mons {
  grid-area: mons;
}
.track {
  grid-area: track;
  position: relative;
  /* The bar, and its Speeds under it: the two centered in the row together. */
  min-height: 34px;
  --bar-y: calc(50% - 6px);
}
/* In a row, as tall as it, so yours' line runs down the rows unbroken (over their padding and rule too). */
.row .track {
  align-self: stretch;
}
.mine-label {
  position: absolute;
  top: 0;
  translate: -50% 0;
  padding: 0 4px;
  color: var(--accent-text);
  white-space: nowrap;
  background: var(--accent);
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  position: relative;
  padding: 2px 0;
  border-bottom: 1px solid var(--border);
}
.row-line {
  display: none;
}
.row.has-mine {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
/* The one found: a neutral gray, darker than the panel, as the rest fade around it. */
.row.hit {
  background: var(--found);
}
/* Finding a Pokémon: the other rows faded. */
.finding .row:not(.hit, .has-mine) {
  opacity: 0.45;
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
/* Its Pokémon by their icons; the one found marked, yours outlined, the one yours is measured against in the
   opponents' red. */
.mons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
/* Their marks drawn inside them, so two marked side by side (yours, the one it's measured against) don't overlap. */
.mon {
  display: inline-flex;
  border-radius: 2px;
}
.mon:hover {
  background: var(--hover);
}
.mon.hit {
  background: var(--sel);
  box-shadow: inset 0 0 0 2px var(--ink);
}
.mon.mine {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.mon.versus {
  background: var(--opponent);
  box-shadow: inset 0 0 0 2px var(--ink);
}
/* The bar, on a thin rule standing for the axis; its benchmarks' ticks over it, each with its Speed; yours, a line
   through. */
.track::before {
  content: '';
  position: absolute;
  inset: var(--bar-y) 0 auto;
  border-top: 1px dashed var(--border);
}
.head .track::before {
  display: none;
}
.bar {
  position: absolute;
  top: var(--bar-y);
  height: 8px;
  translate: 0 -50%;
  background: var(--range-plain);
  border: 1px solid var(--ink);
}
.bar.yours {
  background: var(--range-yours);
}
.bar.theirs {
  background: var(--range-theirs);
}
.tick {
  position: absolute;
  top: var(--bar-y);
  width: 2px;
  height: 12px;
  translate: -50% -50%;
  background: var(--ink);
}
/* Each Speed under its tick, in the color of who moves first at it. */
.value {
  position: absolute;
  z-index: 1;
  top: calc(var(--bar-y) + 8px);
  translate: -50% 0;
  padding: 0 2px;
  font-size: 0.72em;
  line-height: 1.3;
  white-space: nowrap;
}
/* The samples measured: drawn as the numbers are (the heads' smaller text undone), unseen. */
.value.sample {
  font-size: 0.9em;
  visibility: hidden;
  pointer-events: none;
}
.value.yours {
  color: var(--accent-text);
  background: var(--range-yours);
}
.value.theirs {
  color: var(--opponent-text);
  background: var(--range-theirs);
}
/* A tie, at yours' line: over it, on the panel's color, outlined. */
.value.tie {
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.line {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  translate: -50% 0;
  background: var(--accent);
}
/* Read out, not shown. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 720px) {
  /* Yours' line down the whole row, the bar's own left out (it would stop at the bar). */
  .row .track > .line {
    display: none;
  }
  .row-line {
    display: block;
    top: -1px;
    bottom: -1px;
  }
  /* Behind the Pokémon. */
  .row .mons {
    position: relative;
    z-index: 1;
  }
  .ranges {
    --cols: 2.2em minmax(0, 1fr);
  }
  .head,
  .row {
    grid-template-areas:
      'base mons'
      'track track';
  }
  .head {
    grid-template-areas:
      'base mons'
      'track track';
  }
  .head .base {
    display: none;
  }
}
</style>
