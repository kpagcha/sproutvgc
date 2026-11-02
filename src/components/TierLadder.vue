<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onDeactivated,
  shallowReactive,
  useTemplateRef,
  type ComponentPublicInstance,
} from 'vue'
import tippy, { type Instance } from 'tippy.js'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import type { StatId } from '@/data/pokemon'
import { t } from '@/i18n'
import type { NatureEffect } from '@/lib/stats'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'
import TierMarkTip, { type TierPointed } from '@/components/TierMarkTip.vue'

// The bulk and power tiers' ladder (`BalanceTiersView`), after the speed tiers' (`SpeedOdds`, `SpeedOddsRow`): a row
// per Pokémon (or per build of it, or per item or ability that multiplies the stat), placed by the value in the column
// at its left, the rows at one value under one number. On an axis shared by every row, a mark at each value its sets
// run (taller the more of its sets run it), a thin line from its lowest to its highest, over a fainter stretch of what
// it could reach; the mark at the value it's placed at solid, the rest faint. A Pokémon with no sets has that stretch
// with its four benchmarks on it, hollow and alike. With yours, its value is a line down the rows, each mark colored by
// whether yours is above it (the accent) or not (the opponents' red), and at the row's end the share of its sets yours
// is above. Tapping a row's Pokémon with yours picked measures yours against it (`chip`), the link still opening in a
// new tab. Pointing along a row's bar names the mark nearest the pointer in one tooltip for the whole ladder, as the
// speed tiers' does (`TierMarkTip`): its value and share and the builds reaching it, or the benchmark it is.
/** A build reaching a mark: its nature's effect on the stat, its points, its HP points (bulk), its share of the mark. */
export interface TierSet {
  effect: NatureEffect
  points: number
  hp: number
  share: number
}
export interface TierRow {
  key: string
  id: PokemonId
  species: string
  forme?: string
  /** The value it's placed at, and as the column writes it. */
  value: number
  label: string
  /** Its sets' values, each with its share of them and the builds reaching it, the most common first. */
  marks: { value: number; share: number; sets: TierSet[] }[]
  reach: { min: number; max: number }
  /** No sets: its benchmarks alone. */
  bench?: number[]
  /** The value of its marks it's placed at: solid, the rest faint. */
  own?: number
  noSets: boolean
  /** Shown though the view leaves it out (found), or a boost: a dotted rule over it. */
  extra: boolean
  boost?: boolean
  hit: boolean
  mine: boolean
  versus: boolean
  /** Yours against it: the share of its sets yours is above. */
  above?: number
}
const props = defineProps<{
  rows: TierRow[]
  /** Yours' value, a line down the rows. */
  mine: number | null
  /** Pokémon are being found: the rest fade. */
  finding: boolean
  /** The value column's heading and what it is. */
  head: string
  headTip: string
  /** What the axis' ends say. */
  ends: [string, string]
  /** How a value is written, for the marks' tooltip. */
  format: (v: number) => string
  /** The stat the measure is of, and whether HP counts (bulk): what the tooltip's builds say. */
  stat: StatId
  hp: boolean
  /** The median of those shown, a dashed line down the rows. */
  median: number | null
}>()
const emit = defineEmits<{ chip: [e: MouseEvent, key: string] }>()

// One axis for every row: from the lowest any could reach to the highest.
const axis = computed(() => {
  const lo = Math.min(...props.rows.map((r) => r.reach.min), props.mine ?? Infinity)
  const hi = Math.max(...props.rows.map((r) => r.reach.max), props.mine ?? -Infinity)
  const span = hi - lo || 1
  return { lo: lo - span * 0.01, span: span * 1.02 }
})
const at = (v: number) => `${(((v - axis.value.lo) / axis.value.span) * 100).toFixed(2)}%`
/** Each row's whether it starts the rows at its value. */
const firsts = computed(() => props.rows.map((r, i) => i === 0 || props.rows[i - 1]!.label !== r.label))
/** A mark's side of yours: above it (yours'), level, or not. */
const sideOf = (v: number) =>
  props.mine === null ? '' : props.mine > v ? 'yours' : props.mine === v ? 'tie' : 'theirs'
const marksOf = (r: TierRow) => {
  const top = Math.max(...r.marks.map((m) => m.share), 0.0001)
  const vals = r.marks.map((m) => m.value)
  return {
    marks: r.marks.map((m) => ({
      ...m,
      left: at(m.value),
      tall: m.share / top,
      cls: [sideOf(m.value), { own: m.value === r.own }],
    })),
    span: vals.length
      ? { left: at(Math.min(...vals)), width: `calc(${at(Math.max(...vals))} - ${at(Math.min(...vals))})` }
      : null,
  }
}
const drawn = computed(() => props.rows.map((r) => ({ r, ...marksOf(r) })))

// The marks' tooltip: one for the ladder, placed by hand on the mark nearest the pointer along the row's bar (within
// reach, a finger's wider), what it says drawn by `TierMarkTip`.
const BENCH = ['min', 'none', 'maxNeutral', 'max'] as const
const REACH = { mouse: 12, touch: 24 }
const byKey = computed(() => new Map(props.rows.map((r) => [r.key, r])))
const tipState = shallowReactive<{ pointed: TierPointed | null }>({ pointed: null })
const tipBody = useTemplateRef<ComponentPublicInstance>('tipBody')
let tip: Instance | undefined
let markEl: HTMLElement | undefined
function nearest(e: PointerEvent) {
  const track = (e.target as Element).closest<HTMLElement>('.row .track')
  const row = track && byKey.value.get(track.parentElement!.dataset.key!)
  if (!track || !row) return null
  let best: HTMLElement | undefined
  let gap = e.pointerType === 'mouse' ? REACH.mouse : REACH.touch
  for (const el of track.querySelectorAll<HTMLElement>('.mark')) {
    const box = el.getBoundingClientRect()
    const d = Math.abs(box.left + box.width / 2 - e.clientX)
    if (d <= gap) [best, gap] = [el, d]
  }
  if (!best) return null
  const i = Number(best.dataset.i)
  if (row.noSets) {
    const value = row.bench![i]!
    return { el: best, pointed: { label: props.format(value), bench: BENCH[i]! } }
  }
  const m = row.marks[i]!
  return { el: best, pointed: { label: props.format(m.value), share: m.share, sets: m.sets } }
}
function onMove(e: PointerEvent) {
  const hit = nearest(e)
  if (!hit) return hide()
  markEl?.classList.remove('active')
  markEl = hit.el
  markEl.classList.add('active')
  tipState.pointed = hit.pointed
  if (!tip) {
    const body = tipBody.value?.$el as HTMLElement | undefined
    if (!body) return
    tip = tippy(document.body, {
      content: body,
      trigger: 'manual',
      placement: 'top',
      appendTo: () => document.body,
      getReferenceClientRect: () => (markEl ?? document.body).getBoundingClientRect(),
    })
  }
  if (tip.state.isVisible) void tip.popperInstance?.update()
  else tip.show()
}
function hide() {
  markEl?.classList.remove('active')
  markEl = undefined
  tip?.hide()
}
onDeactivated(hide)
onBeforeUnmount(() => tip?.destroy())
</script>

<template>
  <div class="odds" :class="{ finding, mined: mine !== null }">
    <div class="head">
      <span class="speed"
        ><span v-tip="headTip" class="note" tabindex="0">{{ head }}</span></span
      >
      <span class="who"></span>
      <span class="track" aria-hidden="true">
        <span class="end">{{ ends[0] }}</span>
        <span v-if="mine !== null" class="mine-label" :style="{ left: at(mine) }">{{
          t('tiers.yoursAt', { value: format(mine) })
        }}</span>
        <span class="end">{{ ends[1] }}</span>
      </span>
      <span v-if="mine !== null" class="odds-cell"
        ><span v-tip="t('tiers.aboveTip')" class="note" tabindex="0">{{ t('tiers.aboveHead') }}</span></span
      >
    </div>
    <div class="rows-box">
      <ol class="rows" @pointermove="onMove" @pointerdown="onMove" @pointerleave="hide" @pointercancel="hide">
        <li
          v-for="({ r, marks, span }, i) in drawn"
          :key="r.key"
          class="row tier"
          :class="{
            starts: firsts[i],
            hit: r.hit,
            'has-mine': r.mine,
            versus: r.versus,
            extra: r.extra,
            boost: r.boost,
          }"
          :data-key="r.key"
        >
          <span class="speed num">{{ firsts[i] ? r.label : '' }}</span>
          <AppLink
            :to="{ name: 'metaPokemon', params: { id: r.id } }"
            class="who mon"
            :class="{ hit: r.hit, mine: r.mine }"
            @click.capture="emit('chip', $event, r.key)"
          >
            <PokemonIcon :id="r.id" /><span class="names"
              ><span class="name">{{ r.species }}</span
              ><span class="sub"
                ><span v-if="r.forme" class="forme">{{ r.forme }}</span
                ><slot name="tags" :row="r" /></span
            ></span>
          </AppLink>
          <span class="track">
            <span
              class="reach"
              :style="{ left: at(r.reach.min), width: `calc(${at(r.reach.max)} - ${at(r.reach.min)})` }"
              aria-hidden="true"
            ></span>
            <template v-if="r.noSets">
              <span
                v-for="(b, j) in r.bench"
                :key="j"
                :data-i="j"
                class="mark bench"
                :class="sideOf(b)"
                :style="{ left: at(b) }"
              ></span>
            </template>
            <template v-else>
              <span v-if="span" class="span" :style="span" aria-hidden="true"></span>
              <span
                v-for="(m, j) in marks"
                :key="m.value"
                :data-i="j"
                class="mark"
                :class="m.cls"
                :style="{ left: m.left, '--tall': m.tall }"
              ></span>
            </template>
          </span>
          <span v-if="mine !== null" class="odds-cell num">{{
            r.mine || r.above === undefined ? '' : percent(r.above)
          }}</span>
        </li>
      </ol>
      <!-- The median and yours, a line each down the whole list, in the axis' column. -->
      <div v-if="median !== null || mine !== null" class="lines" aria-hidden="true">
        <span class="lane">
          <span v-if="median !== null" class="median-line" :style="{ left: at(median) }"></span>
          <span v-if="mine !== null" class="mine-line" :style="{ left: at(mine) }"></span>
        </span>
      </div>
    </div>
    <!-- The marks' tooltip's content, moved into it by tippy. -->
    <div hidden>
      <TierMarkTip ref="tipBody" :state="tipState" :stat :hp />
    </div>
  </div>
</template>

<style scoped>
/* The heads over the rows, in their columns: the value, the Pokémon, the axis and, with yours, how yours does; on
   phones, the value beside the Pokémon and how yours does, the axis under them (as the speed tiers' ladder). */
.odds {
  position: relative;
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 45%, var(--panel));
  --cols: 3em minmax(8em, 20em) minmax(10em, 1fr);
}
.odds.mined {
  --cols: 3em minmax(8em, 20em) minmax(10em, 1fr) 4.5em;
}
.head,
.row {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'speed who track odds';
  align-items: center;
  gap: 4px 10px;
}
.head {
  padding: 2px 0 4px;
  font-weight: bold;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
.head > * {
  font-size: 0.8em;
}
.head .track {
  grid-area: track;
  display: flex;
  justify-content: space-between;
  min-height: 0;
}
.head .track::before {
  display: none;
}
.head .speed {
  grid-area: speed;
  text-align: right;
}
.head .who {
  grid-area: who;
}
.note {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
/* The list and, over it, its lines: the same columns as its rows, the lines in the axis'. */
.rows-box {
  position: relative;
}
.lines {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'speed who track odds';
  column-gap: 10px;
  pointer-events: none;
}
.lines > .lane {
  grid-area: track;
  position: relative;
}
/* Yours' value over its line, as the speed tiers' header has it. */
.head .track {
  position: relative;
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
  border-top: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
}
.row.starts {
  border-top-color: var(--border);
}
.row:first-child {
  border-top: none;
}
.speed {
  grid-area: speed;
  align-self: start;
  padding-top: 6px;
  text-align: right;
}
.who {
  grid-area: who;
}
.track {
  grid-area: track;
  position: relative;
  min-height: 40px;
  --bar-y: calc(100% - 15px);
  --mark-w: 5px;
  --mark-max: 19px;
  align-self: stretch;
  isolation: isolate;
}
.odds-cell {
  grid-area: odds;
  text-align: right;
}
.row.has-mine {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.row.hit {
  background: var(--found);
}
.row.versus {
  background: color-mix(in srgb, var(--opponent) 14%, transparent);
}
/* Shown though the view leaves it out: a dotted rule over it. */
.row.extra {
  border-top-style: dotted;
}
/* An item or ability that multiplies it, as what could be: dashed around its name, as the speed tiers' boosts. */
.row.boost .mon {
  outline: 1px dashed var(--muted);
  outline-offset: -1px;
}
/* Finding Pokémon: the rest faded. */
.finding .row:not(.hit):not(.has-mine) {
  opacity: 0.4;
}
.mon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-right: 4px;
  color: var(--text);
  border-radius: 2px;
}
.mon:hover {
  text-decoration: none;
  background: var(--hover);
}
.mon.mine {
  font-weight: bold;
  box-shadow: inset 0 0 0 2px var(--accent);
}
.names {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  font-size: 0.8em;
  color: var(--muted);
}
.sub:empty {
  display: none;
}
.forme {
  white-space: nowrap;
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
/* The axis as a faint groove, what it could reach a deeper stretch of it, what its sets span a baseline on it, a mark
   rising from it at each value (as tall as it's common), yours a line through. */
.track::before {
  content: '';
  position: absolute;
  inset: var(--bar-y) 0 auto;
  height: 4px;
  translate: 0 -50%;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
}
.reach {
  position: absolute;
  top: var(--bar-y);
  height: 4px;
  translate: 0 -50%;
  background: color-mix(in srgb, var(--text) 16%, var(--panel));
}
.span {
  position: absolute;
  top: var(--bar-y);
  height: 2px;
  translate: 0 -50%;
  background: var(--range-plain);
}
.mark {
  position: absolute;
  top: var(--bar-y);
  width: var(--mark-w);
  height: calc(3px + var(--tall) * var(--mark-max));
  translate: -50% -100%;
  background: color-mix(in srgb, var(--range-plain) 45%, var(--panel));
  box-shadow: 0 0 0 1px var(--panel);
}
.mark.yours {
  background: color-mix(in srgb, var(--range-yours) 45%, var(--panel));
}
.mark.theirs {
  background: color-mix(in srgb, var(--range-theirs) 45%, var(--panel));
}
.mark.own {
  z-index: 1;
  background: var(--range-plain);
}
.mark.own.yours {
  background: var(--range-yours);
}
.mark.own.theirs {
  background: var(--range-theirs);
}
/* The mark the tooltip is on: ringed in ink. */
.track .mark.active {
  box-shadow:
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
}
.mark.tie {
  background: var(--ink);
}
/* No sets: its benchmarks, hollow and alike. */
.mark.bench {
  height: 11px;
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--range-plain),
    0 0 0 1px var(--panel);
}
.mark.bench.yours {
  box-shadow:
    inset 0 0 0 1px var(--range-yours),
    0 0 0 1px var(--panel);
}
.mark.bench.theirs {
  box-shadow:
    inset 0 0 0 1px var(--range-theirs),
    0 0 0 1px var(--panel);
}
/* The median of those shown: a faint dashed line down the rows. */
.median-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--text) 22%, transparent);
}
.mine-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--accent);
}
/* Phones: the value beside the Pokémon and how yours does, the axis under them. */
@media (max-width: 720px) {
  .odds,
  .odds.mined {
    --cols: 2.6em minmax(0, 1fr) auto;
  }
  .head,
  .row {
    grid-template-areas:
      'speed who odds'
      'speed track track';
  }
  .lines {
    grid-template-areas: 'speed track track';
  }
  .head .track {
    display: none;
  }
  .track {
    min-height: 30px;
  }
}
</style>
