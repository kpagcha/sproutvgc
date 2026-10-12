<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import tippy, { type Instance } from 'tippy.js'
import { CircleHelp } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { Benchmark, NatureEffect } from '@/lib/stats'
import { MARK_SHARE } from '@/lib/speed'
import { useOpenState } from '@/composables/useOpenState'
import AppLink from '@/components/AppLink'
import EffectTag from '@/components/EffectTag'
import PokemonIcon from '@/components/PokemonIcon'

// The speed tiers' ladder at the sets players run: a row per Pokémon (or per build of it, or per item or ability its
// sets run that changes Speed), placed by the Speed in the column at its left, the rows at one Speed under one number.
// On an axis shared by every row, a mark at each Speed its sets run (taller the more of its sets run it), a thin line
// from its slowest to its fastest, over a fainter stretch of what it could reach (Min− to Max+); a row of one build has
// its own mark solid, the rest faint. With yours, its Speed is a line down the rows, each mark colored by who moves first
// at it (yours the accent, them the opponents' red; under Trick Room the other way round), and at the row's end the
// share of its sets yours moves first against (and ties with); yours is a row of its own, at its Speed. A Pokémon with
// no sets in the snapshot (every Pokémon shown) has that stretch with its four benchmarks on it, hollow and alike (how
// common each is unknown), and, rather than a share, whether yours moves first against all of it, none of it or part of
// it. A Speed of the column, hovered or picked, is a line down the rows too, the marks at it outlined.
export interface OddsRow {
  /** The row's own key: its Pokémon, and the build or boost it's of. */
  key: string
  id: PokemonId
  species: string
  forme?: string
  /** The Speed it's placed at, in the column at the left. */
  speed: number
  /** Its sets' Speeds in battle (with the modifiers, and its boost), each with its share of them and the builds
   * reaching it (nature effect and points), the most common first. */
  builds: { speed: number; share: number; sets: { effect: NatureEffect; points: number; share: number }[] }[]
  /** Its Speeds at its slowest and fastest builds (Min− and Max+) in battle: what it could reach. */
  reach: { min: number; max: number }
  /** Its Speed at each benchmark in battle: what a row with no sets shows. */
  bench: Record<Benchmark, number>
  /** A row of one of its builds: that build's Speed, its mark solid and the others faint. */
  own?: number
  /** No sets in the snapshot: its reach alone. */
  noSets: boolean
  /** Shown though the view leaves it out (found or kept), or with no sets, or what its sets run under the least share:
   * not counted as the rest. */
  extra: boolean
  /** A row of an item or ability its sets run that changes Speed, as what could be (not the field's own). */
  boost?: boolean
  hit: boolean
  /** Yours. */
  mine: boolean
  /** The one yours is measured against, and the same Pokémon's other rows. */
  versus: boolean
  rival: boolean
}
const props = defineProps<{
  rows: OddsRow[]
  mine: number | null
  trickRoom: boolean
  finding: boolean
  /** The Speed yours is measured against, marked on the row it's on. */
  versusSpeed: number | null
  /** The Speed picked (`?at=`), and the one whose link was just copied. */
  pickedSpeed: number | null
  copied: number | null
  rowHref: (speed: number) => string
  /** Whether the axis takes in the boosts' rows (sorting by what they could reach), rather than leaving them past its
   * ends. */
  axisReach: boolean
}>()
const emit = defineEmits<{
  chip: [event: MouseEvent, key: string]
  mark: [key: string, speed: number]
  share: [speed: number]
}>()
defineSlots<{ tags?: (props: { row: OddsRow }) => unknown }>()

/** The Speeds drawn: those on at least `MARK_SHARE` of its sets (the rest count in its odds, undrawn). */
const drawn = (r: RangeLike) => r.builds.filter((b) => b.share >= MARK_SHARE)
type RangeLike = Pick<OddsRow, 'builds'>
/** The axis: what the rows could reach and every Speed drawn, and yours; but for the boosts' rows (unless sorting by
 * what they could reach), so a boost doubling a few doesn't squeeze the rest: their Speeds past its ends are said at
 * them rather than drawn. */
const axis = computed(() => {
  const plain = props.axisReach ? props.rows : props.rows.filter((r) => !r.boost)
  const all = (plain.length ? plain : props.rows).flatMap((r) => [
    r.reach.min,
    r.reach.max,
    ...drawn(r).map((b) => b.speed),
  ])
  if (props.mine !== null) all.push(props.mine)
  if (!all.length) return { lo: 0, span: 1 }
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(2, (hi - lo) * 0.04)
  return { lo: lo - pad, span: hi - lo + 2 * pad }
})
/** Whether a Speed is on the axis, rather than past its ends. */
const inside = (speed: number) => speed >= axis.value.lo && speed <= axis.value.lo + axis.value.span
/**
 * A row's Speeds past the axis's ends (a boost's), below it and above it: said as a tag at that end rather than drawn,
 * as marks piled at the end would say nothing; the Speed, or the slowest and fastest of them, in the color of who moves
 * first at all of them.
 */
function past(r: OddsRow) {
  const s = r.noSets ? Object.values(r.bench) : drawn(r).map((b) => b.speed)
  const tag = (list: number[]) => {
    if (!list.length) return null
    const [lo, hi] = [Math.min(...list), Math.max(...list)]
    const kinds = new Set(list.map(verdict))
    return { text: lo === hi ? String(lo) : `${lo}–${hi}`, kind: kinds.size === 1 ? [...kinds][0] : undefined }
  }
  return { lo: tag(s.filter((x) => x < axis.value.lo)), hi: tag(s.filter((x) => !inside(x) && x > axis.value.lo)) }
}
const pct = (speed: number) => Math.min(100, Math.max(0, ((speed - axis.value.lo) / axis.value.span) * 100))
const at = (speed: number) => `${pct(speed)}%`

function verdict(speed: number): 'yours' | 'theirs' | 'tie' | undefined {
  if (props.mine === null) return undefined
  if (speed === props.mine) return 'tie'
  return speed < props.mine !== props.trickRoom ? 'yours' : 'theirs'
}
/** A row's marks: each Speed's height by its share, against the row's most common (the height itself is the CSS's). */
function marks(r: OddsRow) {
  const top = Math.max(...r.builds.map((b) => b.share), 0.0001)
  return drawn(r)
    .filter((b) => inside(b.speed))
    .map((b) => ({ ...b, tall: b.share / top, kind: verdict(b.speed) }))
}
const between = (lo: number, hi: number) => ({ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` })
/** The range its sets span, on the axis. */
function span(r: OddsRow) {
  const s = drawn(r).map((b) => b.speed)
  return between(Math.min(...s), Math.max(...s))
}
/** The Speed said under its mark: its own build's, or its most common; not when the column says it already, nor
 * when it's past the axis. */
function label(r: OddsRow) {
  const s = r.own ?? r.builds[0]?.speed
  return s === undefined || s === r.speed || !inside(s) ? null : s
}
/** The benchmarks as the bar runs, slowest first: a row with no sets' marks. */
const ALONG: readonly Benchmark[] = ['min', 'none', 'maxNeutral', 'max']
const benchMarks = (r: OddsRow) =>
  ALONG.filter((b) => inside(r.bench[b])).map((b) => ({ bench: b, speed: r.bench[b], kind: verdict(r.bench[b]) }))
const benchLabel = (b: Benchmark) => t(`stat.bench.${b}`)
/** With no sets: whether yours moves first against the whole of what it could reach, none of it, or part of it. */
function reachVerdict(r: OddsRow): 'always' | 'never' | 'depends' | null {
  if (props.mine === null) return null
  const ends = [verdict(r.reach.min), verdict(r.reach.max)]
  if (ends.every((v) => v === 'yours')) return 'always'
  if (ends.every((v) => v === 'theirs')) return 'never'
  return 'depends'
}
/** Against how many of its sets yours moves first, and ties with. */
function odds(r: OddsRow) {
  if (props.mine === null || r.noSets || !r.builds.length) return null
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
/** The rows starting a Speed: each Speed's number on its first row alone, the rest under it. */
const firsts = computed(() => props.rows.map((r, i) => i === 0 || props.rows[i - 1]!.speed !== r.speed))
const name = (r: OddsRow) => [r.species, r.forme].filter(Boolean).join(' ')
const canHover = window.matchMedia('(hover: hover)').matches
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.speedTiers.rangesHelp', false)

// A Speed of the column, hovered (or focused), or picked: a line down the rows at it, the marks on it outlined, to see
// what's at it beyond the rows placed there.
const hovered = shallowRef<number | null>(null)
const probe = computed(() => hovered.value ?? props.pickedSpeed)

// The marks' tooltip: one for the whole chart, rather than one per mark (there can be thousands), moved to the mark
// nearest the pointer on a row's bar, so a 5px mark needn't be hit exactly. With a mouse, it shows after a moment over
// a bar (so sweeping across the list doesn't fire it), or at once on a click, then follows the pointer from mark to
// mark; leaving the bars hides it. With a finger, a tap shows it, and dragging along the bar moves it (the bars leave
// the browser only vertical pans, so scrolling the page still works); a tap elsewhere or a scroll hides it. A mark
// clicked or tapped is measured against, with yours.
const SHOW_DELAY = 80
const REACH = { mouse: 12, touch: 24 }
const list = useTemplateRef<HTMLElement>('list')
const active = ref<{ key: string; speed: number } | null>(null)
/** What the tooltip says: the Speed, its share, and the builds reaching it, as the ladder's tags have them; or, on a
 * row with no sets, the benchmark it is. */
const pointed = ref<OddsRow['builds'][number] | { speed: number; bench: Benchmark } | null>(null)
const tipBody = useTemplateRef<HTMLElement>('tipBody')
let tip: Instance | undefined
let pending: ReturnType<typeof setTimeout> | undefined
let markEl: HTMLElement | undefined

/** The mark nearest `x` on the bar under the event, within reach. */
function nearest(e: PointerEvent) {
  const track = (e.target as Element).closest<HTMLElement>('.row .track')
  const row = track && props.rows.find((r) => r.key === track.parentElement!.dataset.key)
  if (!track || !row) return null
  const box = track.getBoundingClientRect()
  const x = (speed: number) => box.left + (pct(speed) / 100) * box.width
  let best = -1
  let gap = e.pointerType === 'mouse' ? REACH.mouse : REACH.touch
  const shown = row.noSets ? benchMarks(row) : marks(row)
  shown.forEach((b, i) => {
    const d = Math.abs(x(b.speed) - e.clientX)
    if (d <= gap) [best, gap] = [i, d]
  })
  if (best < 0) return null
  return { row, build: shown[best]!, el: track.querySelectorAll<HTMLElement>('.mark')[best]! }
}
function point(hit: NonNullable<ReturnType<typeof nearest>>) {
  active.value = { key: hit.row.key, speed: hit.build.speed }
  markEl = hit.el
  pointed.value = hit.build
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
function onClick(e: MouseEvent) {
  const hit = e instanceof PointerEvent ? nearest(e) : null
  if (hit && !hit.row.mine) emit('mark', hit.row.key, hit.build.speed)
}
function onOutside(e: PointerEvent) {
  if (!list.value?.contains(e.target as Node)) hide()
}
onMounted(() => {
  tip = tippy(list.value!, {
    trigger: 'manual',
    hideOnClick: false,
    placement: 'top',
    content: tipBody.value!,
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
    <!-- The heads: the Speed's column, how to read the rows (a "?", opening it under them), the axis's ends with yours
         on it, and, with yours, what the rows' ends say. -->
    <div class="head">
      <span class="speed" aria-hidden="true">{{ t('stat.spe') }}</span>
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
      @click="onClick"
      @pointerleave="(e: PointerEvent) => e.pointerType === 'mouse' && hide()"
      @pointercancel="hide"
    >
      <li
        v-for="(r, i) in rows"
        :key="r.key"
        class="row tier"
        :class="{
          starts: firsts[i],
          hit: r.hit,
          'has-mine': r.mine,
          versus: r.versus,
          rival: r.rival,
          extra: r.extra,
          boost: r.boost,
          at: r.speed === pickedSpeed,
        }"
        :data-key="r.key"
        :data-speed="firsts[i] ? r.speed : undefined"
      >
        <!-- Its Speed, on the first row at it: a link to the page with it picked, copied when clicked. -->
        <a
          v-if="firsts[i]"
          v-tip="canHover && t('speed.rowLink')"
          :href="rowHref(r.speed)"
          class="speed num"
          :aria-current="r.speed === pickedSpeed ? 'true' : undefined"
          @click.prevent="emit('share', r.speed)"
          @pointerenter="hovered = r.speed"
          @pointerleave="hovered = null"
          @focus="hovered = r.speed"
          @blur="hovered = null"
          >{{ r.speed }}<span v-if="copied === r.speed" class="copied" role="status">{{ t('speed.copied') }}</span></a
        >
        <span v-else class="speed" aria-hidden="true"></span>
        <AppLink
          :to="{ name: 'pokemon', params: { id: r.id } }"
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
          <span class="visually-hidden">{{
            r.noSets
              ? t('speed.oddsNoSets', {
                  name: name(r),
                  list: ALONG.map((b) => `${benchLabel(b)} ${r.bench[b]}`).join(', '),
                })
              : drawn(r)
                  .map((b) => `${b.speed} ${percent(b.share)}`)
                  .join(', ')
          }}</span>
          <span class="reach" :style="between(r.reach.min, r.reach.max)" aria-hidden="true"></span>
          <template v-if="!r.noSets">
            <span class="span" :style="span(r)" aria-hidden="true"></span>
            <span
              v-for="b in marks(r)"
              :key="b.speed"
              class="mark"
              :class="[
                r.mine ? 'own-mine' : b.kind,
                {
                  active: active?.key === r.key && active.speed === b.speed,
                  faint: r.own !== undefined && b.speed !== r.own,
                  picked: r.versus && b.speed === versusSpeed,
                  probed: b.speed === probe,
                },
              ]"
              :style="{ left: at(b.speed), '--tall': b.tall }"
              aria-hidden="true"
            ></span>
            <span
              v-if="label(r) !== null"
              class="value num"
              :class="verdict(label(r)!)"
              :style="{ left: at(label(r)!) }"
              aria-hidden="true"
              >{{ label(r) }}</span
            >
          </template>
          <template v-else>
            <span
              v-for="b in benchMarks(r)"
              :key="b.bench"
              class="mark bench"
              :class="[
                b.kind,
                {
                  active: active?.key === r.key && active.speed === b.speed,
                  own: b.speed === r.own,
                  picked: r.versus && b.speed === versusSpeed,
                  probed: b.speed === probe,
                },
              ]"
              :style="{ left: at(b.speed) }"
              aria-hidden="true"
            ></span>
            <span class="value num no-sets" :style="{ left: at((r.reach.min + r.reach.max) / 2) }">{{
              t('speed.noSets')
            }}</span>
          </template>
          <span v-if="past(r).lo" class="past lo num" :class="past(r).lo!.kind" aria-hidden="true"
            >◂ {{ past(r).lo!.text }}</span
          >
          <span v-if="past(r).hi" class="past hi num" :class="past(r).hi!.kind" aria-hidden="true"
            >{{ past(r).hi!.text }} ▸</span
          >
          <span v-if="probe !== null" class="probe" :style="{ left: at(probe) }" aria-hidden="true"></span>
          <span v-if="mine !== null" class="line" :style="{ left: at(mine) }" aria-hidden="true"></span>
        </span>
        <!-- On phones, where the bar's under the rest of the row: yours' line down the whole of it. -->
        <span v-if="mine !== null" class="row-line" aria-hidden="true"
          ><span class="line" :style="{ left: at(mine) }"></span
        ></span>
        <span v-if="mine !== null" class="odds-cell num">
          <template v-if="r.mine"></template>
          <span v-else-if="r.noSets && reachVerdict(r)" class="reach-verdict" :class="reachVerdict(r)">{{
            t(`speed.oddsReach.${reachVerdict(r)!}`)
          }}</span>
          <template v-else-if="odds(r)">
            <span class="first">{{ percent(odds(r)!.first) }}</span>
            <span v-if="odds(r)!.ties" class="ties">{{ t('speed.oddsTies', { pct: percent(odds(r)!.ties) }) }}</span>
          </template>
          <span v-else class="muted">—</span>
        </span>
      </li>
    </ol>
    <!-- The tooltip's content, moved into it by tippy. -->
    <div ref="tipBody" class="tip-body">
      <template v-if="pointed && 'bench' in pointed">
        <div class="tip-head num">{{ pointed.speed }} · {{ benchLabel(pointed.bench) }}</div>
        <div>{{ t(`speed.benchTip.${pointed.bench}`) }}</div>
      </template>
      <template v-else-if="pointed">
        <div class="tip-head num">{{ pointed.speed }} · {{ percent(pointed.share) }}</div>
        <div v-for="b in pointed.sets" :key="`${b.effect}:${b.points}`" class="tip-build">
          <EffectTag :effect="b.effect" /><span>{{ t('speed.points', { n: b.points }) }}</span
          ><span v-if="pointed.sets.length > 1" class="tip-share">{{ percent(b.share) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* A row: its Speed (on the first row at it), the Pokémon, its Speeds on the axis, and, with yours, how yours does
   against its sets; on phones, the Speed beside the Pokémon and how yours does on a line, the Speeds under them. */
.odds {
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 45%, var(--panel));
  --cols: 2.4em minmax(8em, 20em) minmax(10em, 1fr);
}
.odds.mined {
  --cols: 2.4em minmax(8em, 20em) minmax(10em, 1fr) 6.5em;
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
/* Smaller, its cells rather than the row: the columns' widths are in ems, and must be the rows' own. */
.head > * {
  font-size: 0.8em;
}
.head .track {
  display: flex;
  justify-content: space-between;
  min-height: 0;
}
.speed {
  grid-area: speed;
  position: relative;
  align-self: start;
  padding-top: 6px;
  text-align: right;
}
.head .speed {
  align-self: center;
  padding: 0;
}
/* In the text's color, as a number rather than a link (retro.css colors links). */
:root:root a.speed {
  color: var(--text);
  text-decoration: none;
}
:root:root a.speed:hover {
  text-decoration: underline;
}
.who {
  grid-area: who;
}
.track {
  grid-area: track;
  position: relative;
  min-height: 40px;
  /* The baseline: low in the row, the marks rising from it and a Speed under it. */
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
/* The rows at one Speed together: a rule over the first, a fainter one between the rest. */
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
.row-line {
  display: none;
}
.row.has-mine {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
/* The one found: a light wash of the selection's color, as the rest fade around it. */
.row.hit {
  background: color-mix(in srgb, var(--sel) 35%, transparent);
}
/* The Speed picked by its link. */
.row.at {
  background: var(--sel);
  box-shadow: inset 3px 0 var(--accent);
}
/* The one yours is measured against: tinted the opponents' red, as yours is its color, rather than marked found too;
   the same Pokémon's other rows in a faint wash of it. */
.row.versus {
  background: color-mix(in srgb, var(--opponent) 14%, transparent);
}
.row.rival {
  background: color-mix(in srgb, var(--opponent) 6%, transparent);
}
.finding .row:not(.hit, .has-mine) {
  opacity: 0.45;
}
/* The row found from the comparison's card: a ring in the opponents' red pulsing twice, softly. */
.row.flash {
  animation: row-flash 0.6s ease-out 2;
}
@keyframes row-flash {
  40% {
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--opponent) 45%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .row.flash {
    animation: none;
  }
}
/* Shown though the view leaves it out, with no sets, or under the least share: a dotted rule over it. */
.row.extra {
  border-top-style: dotted;
}
/* An item or ability its sets run, as what could be: dashed around its name, as the ladder's chips were. */
.row.boost .mon {
  outline: 1px dashed var(--muted);
  outline-offset: -1px;
}
/* The Pokémon: its icon and name; yours outlined (the one yours is measured against is its row's tint). */
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
/* On a tinted row, a deeper tint of its own color rather than the hover's yellow. */
.row.versus .mon:hover {
  background: color-mix(in srgb, var(--opponent) 28%, transparent);
}
.row.has-mine .mon:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
/* The name, and its forme and what the row is of (its build, its boost) on a line under it, smaller, wrapping. */
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
.mon.mine {
  font-weight: bold;
  box-shadow: inset 0 0 0 2px var(--accent);
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.copied {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 3;
  padding: 1px 6px;
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border-strong);
}
/* The axis as a faint groove (a track, not a rule that would read as a second divider), the range it could reach a
   deeper stretch of it, the range its sets span as a baseline on it, a mark rising from it at each Speed (as tall as
   it's common, a hairline of the panel between marks side by side), yours a line through. */
.track::before {
  content: '';
  position: absolute;
  inset: var(--bar-y) 0 auto;
  height: 4px;
  translate: 0 -50%;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
}
.head .track::before {
  display: none;
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
/* A row with no sets' benchmarks: hollow and all alike, as how common each is isn't known, outlined in the color of
   who moves first at it; the row's own, filled. */
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
.mark.bench.tie {
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel);
}
.mark.bench.own {
  background: var(--range-plain);
}
.mark.bench.own.yours {
  background: var(--range-yours);
}
.mark.bench.own.theirs {
  background: var(--range-theirs);
}
.track .mark.bench.active {
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
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
/* A row of one build: the others faint. */
.mark.faint {
  opacity: 0.35;
}
/* The tooltip: the Speed and its share, then a line per build reaching it. */
.tip-head {
  font-weight: bold;
}
.tip-build {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.tip-share {
  margin-left: auto;
  padding-left: 8px;
  opacity: 0.75;
}
/* The one the tooltip is on, the one yours is measured against, and those at the Speed probed: outlined, over their
   neighbours (whoever moves first). */
.track .mark:is(.active, .picked, .probed) {
  z-index: 2;
  opacity: 1;
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
/* Yours' own row: its Speed, in its color, full height. */
.mark.own-mine {
  background: var(--accent);
}
/* A Speed under its mark (the most common, sorting by another), in its mark's color. */
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
/* Speeds past the axis's ends (a boost's): a tag at that end, over the baseline, in the color of who moves first. */
.past {
  position: absolute;
  z-index: 1;
  top: var(--bar-y);
  translate: 0 calc(-100% - 2px);
  padding: 0 3px;
  font-size: 0.75em;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--muted);
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--border);
}
.past.lo {
  left: 0;
}
.past.hi {
  right: 0;
}
.past.yours {
  color: var(--accent);
}
.past.theirs {
  color: var(--opponent);
}
/* The Speed probed: a dashed line in ink, under yours'. */
.probe {
  position: absolute;
  top: -3px;
  bottom: -3px;
  translate: -50% 0;
  border-left: 1px dashed var(--ink);
  pointer-events: none;
}
.first {
  color: var(--accent);
}
/* With no sets, a word rather than a share, in the color of who moves first. */
.reach-verdict.always {
  color: var(--accent);
}
.reach-verdict.never {
  color: var(--opponent);
}
.reach-verdict.depends {
  color: var(--muted);
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
  /* Over the Pokémon and its bar, beside the Speed's column, as wide as the bar. */
  .row-line {
    display: block;
    grid-column: 2 / -1;
    grid-row: 1 / span 2;
    position: relative;
    align-self: stretch;
    margin-block: -2px;
    pointer-events: none;
  }
  .row-line > .line {
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
    --cols: 2.2em minmax(0, 1fr) auto;
  }
  .head,
  .row {
    gap: 2px 8px;
    grid-template-areas:
      'speed who odds'
      'speed track track';
  }
  .head .speed {
    display: none;
  }
  /* How yours does, its ties under it, so the Pokémon and what its row is of have the line's room; over yours' line. */
  .odds-cell {
    position: relative;
    z-index: 1;
    align-self: start;
    padding-top: 2px;
    line-height: 1.15;
  }
}
</style>
