<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import tippy, { type Instance } from 'tippy.js'
import { CircleHelp } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { Benchmark } from '@/lib/stats'
import { useOpenState } from '@/composables/useOpenState'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// The speed tiers' ranges at the sets players run: a row per Pokémon, a mark at each Speed its sets run on an axis
// shared by every row (taller the more of its sets run it), a thin line from its slowest to its fastest, and its most
// common Speed under its mark. With yours, its Speed is a line down the rows, each mark colored by who moves first at
// it (yours the accent, them the opponents' red; under Trick Room the other way round), and at the row's end the share
// of its sets yours moves first against (and ties with). A Pokémon with no sets in the snapshot (every Pokémon shown)
// has its benchmarks' range instead, marked as such. The rows from those moving first, by their most common Speed.
export interface OddsRow {
  id: PokemonId
  species: string
  forme?: string
  /** Its sets' Speeds in battle (with the modifiers), each with its share of them, the most common first. */
  builds: { speed: number; share: number }[]
  /** With no sets: its Speed at each benchmark. */
  fallback?: Record<Benchmark, number>
  /** Shown though the view leaves it out (found or kept), or with no sets: not counted as the rest. */
  extra: boolean
  hit: boolean
  mine: boolean
}
const props = defineProps<{
  rows: OddsRow[]
  mine: number | null
  trickRoom: boolean
  finding: boolean
  versus: PokemonId | null
}>()
const emit = defineEmits<{ chip: [event: MouseEvent, id: PokemonId] }>()

const speedsOf = (r: OddsRow) => (r.fallback ? [r.fallback.min, r.fallback.max] : r.builds.map((b) => b.speed))
const axis = computed(() => {
  const all = props.rows.flatMap(speedsOf)
  if (props.mine !== null) all.push(props.mine)
  if (!all.length) return { lo: 0, span: 1 }
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(2, (hi - lo) * 0.04)
  return { lo: lo - pad, span: hi - lo + 2 * pad }
})
const at = (speed: number) => `${((speed - axis.value.lo) / axis.value.span) * 100}%`

function verdict(speed: number): 'yours' | 'theirs' | 'tie' | undefined {
  if (props.mine === null) return undefined
  if (speed === props.mine) return 'tie'
  return speed < props.mine !== props.trickRoom ? 'yours' : 'theirs'
}
/** A row's marks: each Speed's height by its share, against the row's most common (the height itself is the CSS's). */
function marks(r: RangeLike) {
  const top = Math.max(...r.builds.map((b) => b.share), 0.0001)
  return r.builds.map((b) => ({ ...b, tall: b.share / top, kind: verdict(b.speed) }))
}
type RangeLike = Pick<OddsRow, 'builds'>
function span(r: OddsRow) {
  const s = speedsOf(r)
  const lo = Math.min(...s)
  const hi = Math.max(...s)
  return { left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }
}
/** Against how many of its sets yours moves first, and ties with. */
function odds(r: OddsRow) {
  if (props.mine === null || r.fallback || !r.builds.length) return null
  const total = r.builds.reduce((n, b) => n + b.share, 0)
  if (!total) return null
  let first = 0
  let ties = 0
  for (const b of r.builds) {
    const v = verdict(b.speed)
    if (v === 'yours') first += b.share
    else if (v === 'tie') ties += b.share
  }
  return { first: first / total, ties: ties / total }
}
const name = (r: OddsRow) => [r.species, r.forme].filter(Boolean).join(' ')
const canHover = window.matchMedia('(hover: hover)').matches
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.speedTiers.rangesHelp', false)

// The marks' tooltip: one for the whole chart, rather than one per mark (there can be thousands), moved to the mark
// nearest the pointer on a row's bar, so a 5px mark needn't be hit exactly. With a mouse, it shows after a moment over
// a bar (so sweeping across the list doesn't fire it), or at once on a click, then follows the pointer from mark to
// mark; leaving the bars hides it. With a finger, a tap shows it, and dragging along the bar moves it (the bars leave
// the browser only vertical pans, so scrolling the page still works); a tap elsewhere or a scroll hides it.
const SHOW_DELAY = 80
const REACH = { mouse: 12, touch: 24 }
const list = useTemplateRef<HTMLElement>('list')
const active = ref<{ id: PokemonId; speed: number } | null>(null)
let tip: Instance | undefined
let pending: ReturnType<typeof setTimeout> | undefined
let markEl: HTMLElement | undefined

/** The mark nearest `x` on the bar under the event, within reach. */
function nearest(e: PointerEvent) {
  const track = (e.target as Element).closest<HTMLElement>('.row .track')
  const row = track && props.rows.find((r) => r.id === track.parentElement!.dataset.id)
  if (!track || !row || row.fallback) return null
  const box = track.getBoundingClientRect()
  const x = (speed: number) => box.left + ((speed - axis.value.lo) / axis.value.span) * box.width
  let best = -1
  let gap = e.pointerType === 'mouse' ? REACH.mouse : REACH.touch
  row.builds.forEach((b, i) => {
    const d = Math.abs(x(b.speed) - e.clientX)
    if (d <= gap) [best, gap] = [i, d]
  })
  if (best < 0) return null
  return { row, build: row.builds[best]!, el: track.querySelectorAll<HTMLElement>('.mark')[best]! }
}
function point(hit: NonNullable<ReturnType<typeof nearest>>) {
  active.value = { id: hit.row.id, speed: hit.build.speed }
  markEl = hit.el
  tip?.setContent(`${hit.build.speed} · ${percent(hit.build.share)}`)
}
function show(hit: NonNullable<ReturnType<typeof nearest>>) {
  clearTimeout(pending)
  point(hit)
  if (tip?.state.isVisible) tip.popperInstance?.update()
  else tip?.show()
}
function hide() {
  clearTimeout(pending)
  pending = undefined
  active.value = null
  tip?.hide()
}
function onMove(e: PointerEvent) {
  const hit = nearest(e)
  if (!hit) {
    if (e.pointerType === 'mouse') hide()
    return
  }
  if (tip?.state.isVisible) show(hit)
  else if (e.pointerType === 'mouse') {
    point(hit)
    if (pending === undefined) pending = setTimeout(() => show(nearest(e) ?? hit), SHOW_DELAY)
  } else if (e.buttons) show(hit)
}
function onDown(e: PointerEvent) {
  const hit = nearest(e)
  if (hit) show(hit)
  else hide()
}
function onOutside(e: PointerEvent) {
  if (!list.value?.contains(e.target as Node)) hide()
}
onMounted(() => {
  tip = tippy(list.value!, {
    trigger: 'manual',
    hideOnClick: false,
    placement: 'top',
    getReferenceClientRect: () => markEl?.getBoundingClientRect() ?? list.value!.getBoundingClientRect(),
  })
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('scroll', hide, { passive: true, capture: true })
})
onBeforeUnmount(() => {
  clearTimeout(pending)
  tip?.destroy()
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('scroll', hide, { capture: true })
})
</script>

<template>
  <div class="odds" :class="{ finding, mined: mine !== null }">
    <!-- The heads: how to read the rows (a "?", opening it under them), the axis's ends with yours on it, and, with
         yours, what the rows' ends say. -->
    <div class="head">
      <span class="who">
        <button
          v-tip="canHover && t('speed.help')"
          type="button"
          class="help"
          :aria-expanded="helpOpen"
          aria-controls="odds-help"
          :aria-label="t('speed.help')"
          @click="toggleHelp"
        >
          <CircleHelp :size="16" aria-hidden="true" />
        </button>
      </span>
      <span class="track" aria-hidden="true">
        <span class="end">{{ Math.round(axis.lo) }}</span>
        <span v-if="mine !== null" class="mine-label" :style="{ left: at(mine) }">{{
          t('speed.yoursAt', { speed: mine })
        }}</span>
        <span class="end">{{ Math.round(axis.lo + axis.span) }}</span>
      </span>
      <span v-if="mine !== null" class="odds-cell">{{ t('speed.oddsHead') }}</span>
    </div>
    <p v-if="helpOpen" id="odds-help" class="odds-help panel sunken muted small">{{ t('speed.oddsNote') }}</p>
    <ol
      ref="list"
      class="rows"
      @pointermove="onMove"
      @pointerdown="onDown"
      @pointerleave="(e: PointerEvent) => e.pointerType === 'mouse' && hide()"
      @pointercancel="hide"
    >
      <li
        v-for="r in rows"
        :key="r.id"
        class="row tier"
        :class="{ hit: r.hit, 'has-mine': r.mine, extra: r.extra }"
        :data-id="r.id"
      >
        <AppLink
          :to="{ name: 'pokemon', params: { id: r.id } }"
          class="who mon"
          :class="{ hit: r.hit, mine: r.mine, versus: r.id === versus }"
          @click.capture="emit('chip', $event, r.id)"
        >
          <PokemonIcon :id="r.id" /><span class="name">{{ r.species }}</span
          ><span v-if="r.forme" class="forme">{{ r.forme }}</span>
        </AppLink>
        <span class="track">
          <span class="visually-hidden">{{
            r.fallback
              ? t('speed.oddsNoSets', { name: name(r) })
              : r.builds.map((b) => `${b.speed} ${percent(b.share)}`).join(', ')
          }}</span>
          <span class="span" :class="{ fallback: !!r.fallback }" :style="span(r)" aria-hidden="true"></span>
          <template v-if="!r.fallback">
            <span
              v-for="(b, i) in marks(r)"
              :key="i"
              class="mark"
              :class="[b.kind, { active: active?.id === r.id && active.speed === b.speed }]"
              :style="{ left: at(b.speed), '--tall': b.tall }"
              aria-hidden="true"
            ></span>
            <span class="value num" :class="verdict(r.builds[0]!.speed)" :style="{ left: at(r.builds[0]!.speed) }">{{
              r.builds[0]!.speed
            }}</span>
          </template>
          <span v-else class="value num no-sets" :style="{ left: at((r.fallback.min + r.fallback.max) / 2) }">{{
            t('speed.noSets')
          }}</span>
          <span v-if="mine !== null" class="line" :style="{ left: at(mine) }" aria-hidden="true"></span>
        </span>
        <!-- On phones, where the bar's under the rest of the row and as wide as it: yours' line down the whole row. -->
        <span v-if="mine !== null" class="line row-line" :style="{ left: at(mine) }" aria-hidden="true"></span>
        <span v-if="mine !== null" class="odds-cell num">
          <template v-if="odds(r)">
            <span class="first">{{ percent(odds(r)!.first) }}</span>
            <span v-if="odds(r)!.ties" class="ties">{{ t('speed.oddsTies', { pct: percent(odds(r)!.ties) }) }}</span>
          </template>
          <span v-else class="muted">—</span>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* A row: the Pokémon, its Speeds on the axis, and, with yours, how yours does against its sets; on phones, the
   Pokémon and how yours does on a line, the Speeds under them. */
.odds {
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 45%, var(--panel));
  --cols: minmax(8em, 13em) minmax(10em, 1fr);
}
.odds.mined {
  --cols: minmax(8em, 13em) minmax(10em, 1fr) 6.5em;
}
.head,
.row {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'who track odds';
  align-items: center;
  gap: 4px 10px;
}
.head {
  padding: 2px 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
.head .track {
  display: flex;
  justify-content: space-between;
  min-height: 0;
}
.who {
  grid-area: who;
}
.track {
  grid-area: track;
  position: relative;
  min-height: 40px;
  /* The baseline: low in the row, the marks rising from it and the most common Speed under it. */
  --bar-y: calc(100% - 15px);
  --mark-w: 5px;
  --mark-max: 19px;
}
.row .track {
  align-self: stretch;
  /* Dragging along it moves the tooltip; up and down still scroll the page. */
  touch-action: pan-y pinch-zoom;
}
.odds-cell {
  grid-area: odds;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
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
.help[aria-expanded='true'] {
  color: var(--text);
}
.odds-help {
  margin: 8px 0;
  padding: 8px 10px;
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
.row.hit {
  background: var(--sel);
}
.finding .row:not(.hit, .has-mine) {
  opacity: 0.45;
}
/* Shown though the view leaves it out, or with no sets: dotted under, as the ladder's chips are. */
.row.extra {
  border-bottom-style: dotted;
}
/* The Pokémon: its icon and name; yours outlined, the one yours is measured against in the opponents' red. */
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
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forme {
  font-size: 0.85em;
  color: var(--muted);
  white-space: nowrap;
}
.mon.mine {
  font-weight: bold;
  box-shadow: inset 0 0 0 2px var(--accent);
}
.mon.versus {
  color: var(--opponent-text);
  background: var(--opponent);
}
.mon.versus .forme {
  color: inherit;
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
/* The axis's rule, the range its sets span as a baseline on it, a mark rising from it at each Speed (as tall as it's
   common, a hairline of the panel between marks side by side), yours a line through. */
.track::before {
  content: '';
  position: absolute;
  inset: var(--bar-y) 0 auto;
  border-top: 1px dashed var(--border);
}
.head .track::before {
  display: none;
}
.span {
  position: absolute;
  top: var(--bar-y);
  height: 2px;
  translate: 0 -50%;
  background: var(--range-plain);
}
.span.fallback {
  height: 8px;
  translate: 0 -100%;
  background: none;
  border: 1px dotted var(--border-strong);
}
.mark {
  position: absolute;
  top: var(--bar-y);
  width: var(--mark-w);
  height: calc(3px + var(--tall) * var(--mark-max));
  translate: -50% -100%;
  background: var(--range-plain);
  box-shadow: 0 0 0 1px var(--panel);
}
/* The one the tooltip is on: outlined, over its neighbours (whoever moves first). */
.track .mark.active {
  z-index: 2;
  box-shadow:
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
}
.mark.yours {
  background: var(--range-yours);
}
.mark.theirs {
  background: var(--range-theirs);
}
.mark.tie {
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel);
}
/* Its most common Speed under the baseline, in its mark's color. */
.value {
  position: absolute;
  z-index: 1;
  top: calc(var(--bar-y) + 2px);
  translate: -50% 0;
  padding: 0 2px;
  font-size: 0.75em;
  line-height: 1.3;
  white-space: nowrap;
}
.value.yours {
  color: var(--accent);
}
.value.theirs {
  color: var(--opponent);
}
.value.no-sets {
  top: calc(var(--bar-y) + 2px);
  font-weight: normal;
  color: var(--muted);
}
.line {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  translate: -50% 0;
  background: var(--accent);
}
.first {
  color: var(--accent);
}
.ties {
  font-size: 0.75em;
  font-weight: normal;
  color: var(--muted);
}
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
  /* The marks taller, as the bar has the row's whole width. */
  .row .track {
    min-height: 44px;
    --mark-max: 24px;
  }
  /* Behind the Pokémon. */
  .row .who {
    position: relative;
    z-index: 1;
  }
  .odds,
  .odds.mined {
    --cols: minmax(0, 1fr) auto;
  }
  .head,
  .row {
    grid-template-areas:
      'who odds'
      'track track';
  }
  .odds-cell {
    flex-direction: row;
    align-items: baseline;
    gap: 6px;
  }
}
</style>
