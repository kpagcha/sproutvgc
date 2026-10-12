<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowReactive,
  useTemplateRef,
  type ComponentPublicInstance,
} from 'vue'
import tippy, { type Instance } from 'tippy.js'
import { Info } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { Benchmark, NatureEffect } from '@/lib/stats'
import { MARK_SHARE } from '@/lib/speed'
import SpeedOddsRow from '@/components/SpeedOddsRow.vue'
import SpeedOddsTip, { type Pointed } from '@/components/SpeedOddsTip.vue'

// The speed tiers' ladder at the sets players run: a row per Pokémon (or per build of it, or per item or ability its
// sets run that changes Speed), placed by the Speed in the column at its left, the rows at one Speed under one number.
// On an axis shared by every row, a mark at each Speed its sets run (taller the more of its sets run it), a thin line
// from its slowest to its fastest, over a fainter stretch of what it could reach (Min− to Max+); a row of one build has
// its own mark solid, the rest faint. With yours, its Speed is a line down the rows, each mark colored by who moves first
// at it (yours the accent, them the opponents' red; under Trick Room the other way round), and at the row's end the
// share of its sets yours moves first against (and ties with); yours is a row of its own, at its Speed. A Pokémon with
// no sets in the snapshot (every Pokémon shown) has that stretch with its four benchmarks on it, hollow and alike (how
// common each is unknown), and, rather than a share, whether yours moves first against all of it, none of it or part of
// it. A Speed of the column, hovered or picked, is a line down the rows too, the marks at it outlined. Each row is a
// `SpeedOddsRow`, drawn again only when what it shows changes.
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
  /** Whether the view is at what they could reach: the axis takes in the boosts' rows, rather than leaving them past
   * its ends, and every row has its benchmarks ticked on its bar. */
  possible: boolean
  /** Whether there are boosts' rows (boosts shown, or the field's own): what "You first" is of says what it is on them. */
  boosts: boolean
}>()
const emit = defineEmits<{
  chip: [event: MouseEvent, key: string]
  mark: [key: string, speed: number, slid: boolean]
  share: [speed: number]
}>()
defineSlots<{ tags?: (props: { row: OddsRow }) => unknown }>()

/** The axis: what the rows could reach and every Speed drawn, and yours; but for the boosts' rows (unless sorting by
 * what they could reach), so a boost doubling a few doesn't squeeze the rest: their Speeds past its ends are said at
 * them rather than drawn. */
const axis = computed(() => {
  const plain = props.possible ? props.rows : props.rows.filter((r) => !r.boost)
  const all = (plain.length ? plain : props.rows).flatMap((r) => [
    r.reach.min,
    r.reach.max,
    ...r.builds.filter((b) => b.share >= MARK_SHARE).map((b) => b.speed),
  ])
  if (props.mine !== null) all.push(props.mine)
  if (!all.length) return { lo: 0, span: 1 }
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(2, (hi - lo) * 0.04)
  return { lo: lo - pad, span: hi - lo + 2 * pad }
})
const pct = (speed: number) => Math.min(100, Math.max(0, ((speed - axis.value.lo) / axis.value.span) * 100))
const at = (speed: number) => `${pct(speed)}%`

/** The rows starting a Speed: each Speed's number on its first row alone, the rest under it. */
const firsts = computed(() => props.rows.map((r, i) => i === 0 || props.rows[i - 1]!.speed !== r.speed))
const byKey = computed(() => new Map(props.rows.map((r) => [r.key, r])))
/** What "You first" is of, in its icon's tooltip: on a boost's row too, when there are any. */
const oddsInfo = computed(() => t('speed.oddsInfo', { boost: props.boosts ? t('speed.oddsInfoBoost') : '' }))

// Pointing (the marks' tooltip, a Speed of the column hovered) marks the elements themselves rather than drawing the
// rows again: there are hundreds of them, and thousands of marks.
const root = useTemplateRef<HTMLElement>('root')
const list = useTemplateRef<HTMLElement>('list')
const probeLine = useTemplateRef<HTMLElement>('probeLine')

// A Speed of the column, hovered (or focused): a line down the rows at it, the marks on it outlined (`hprobed`), to see
// what's at it beyond the rows placed there; the one picked (`?at=`) gives way to it meanwhile (`hovering`).
let hovered: number | null = null
let probed: Element[] = []
function setHovered(speed: number | null) {
  if (speed === hovered) return
  hovered = speed
  for (const el of probed) el.classList.remove('hprobed')
  probed = []
  list.value?.classList.toggle('hovering', speed !== null)
  const line = probeLine.value
  const track = list.value?.querySelector('.row .track')
  if (!line || !track || !root.value || speed === null) {
    if (line) line.hidden = true
    return
  }
  probed = [...list.value!.querySelectorAll(`.mark[data-s="${speed}"]`)]
  for (const el of probed) el.classList.add('hprobed')
  const box = root.value.getBoundingClientRect()
  const bar = track.getBoundingClientRect()
  const rows = list.value!.getBoundingClientRect()
  Object.assign(line.style, {
    left: `${bar.left - box.left + (pct(speed) / 100) * bar.width}px`,
    top: `${rows.top - box.top}px`,
    height: `${rows.height}px`,
  })
  line.hidden = false
}
/** The Speed of the column whose link is under an event, if any. */
function speedOf(e: Event) {
  const a = (e.target as Element).closest('a.speed')
  return a ? { a, speed: Number(a.closest<HTMLElement>('.row')!.dataset.speed) } : null
}
function onOver(e: Event) {
  const s = speedOf(e)
  if (s) setHovered(s.speed)
}
function onOut(e: PointerEvent | FocusEvent) {
  const s = speedOf(e)
  if (s && !s.a.contains(e.relatedTarget as Node | null)) setHovered(null)
}

// The marks' tooltip: one for the whole chart, rather than one per mark (there can be thousands), moved to the mark
// nearest the pointer on a row's bar, so a 5px mark needn't be hit exactly. With a mouse, it shows after a moment over
// a bar (so sweeping across the list doesn't fire it), or at once on a click, then follows the pointer from mark to
// mark; leaving the bars hides it. With a finger, a tap shows it, and dragging along the bar moves it (the bars leave
// the browser only vertical pans, so scrolling the page still works), a slider: the mark it's let go on is picked; a
// tap elsewhere or a scroll hides it. A mark clicked, tapped or slid to is measured against, with yours (until yours
// is first slid along a row, the tooltip says it can be, on a finger). The mark it's on is marked `active`, and what it
// says is drawn by `SpeedOddsTip` alone.
const SHOW_DELAY = 80
const REACH = { mouse: 12, touch: 24 }
const SLID_KEY = 'sproutvgc.speedTiers.slid'
function savedSlid() {
  try {
    return localStorage.getItem(SLID_KEY) === '1'
  } catch {
    return false
  }
}
/** Whether the reader has slid to a mark already: the tooltip no longer says they can. */
let slidOnce = savedSlid()
const tipState = shallowReactive<{ pointed: Pointed | null; hint: boolean }>({ pointed: null, hint: false })
const tipBody = useTemplateRef<ComponentPublicInstance>('tipBody')
let tip: Instance | undefined
// How to read the rows, in the "?"'s tooltip: a line per part of them, its name in bold before what it is (the text a
// line each, "Marks: the Speeds…", split at its first colon). Hovered, or tapped (it takes the focus).
const noteLines = computed(() =>
  t('speed.oddsNote')
    .split('\n')
    .map((line) => {
      const i = line.indexOf(': ')
      return i < 0 ? { term: '', text: line } : { term: line.slice(0, i + 1), text: line.slice(i + 2) }
    }),
)
const noteHelp = useTemplateRef<HTMLElement>('noteHelp')
const noteBody = useTemplateRef<HTMLElement>('noteBody')
let noteTip: Instance | undefined
let pending: ReturnType<typeof setTimeout> | undefined
/** The mark the tooltip is placed at, and the one marked as pointed at (none once it hides). */
let markEl: HTMLElement | undefined
let activeEl: HTMLElement | undefined
/** A finger's drag along a bar: the mark it started on, the one it's on, and whether it has left the first; and the
 * click that may follow letting go, already taken as the pick. */
let startEl: HTMLElement | undefined
let slideHit: Hit | undefined
let slid = false
let skipClick = false

/** The mark (or benchmark's tick) nearest the pointer on the bar under the event, within reach, and what it is. */
function nearest(e: PointerEvent) {
  const track = (e.target as Element).closest<HTMLElement>('.row .track')
  const row = track && byKey.value.get(track.parentElement!.dataset.key!)
  if (!track || !row) return null
  let best: HTMLElement | undefined
  let gap = e.pointerType === 'mouse' ? REACH.mouse : REACH.touch
  for (const el of track.querySelectorAll<HTMLElement>('[data-s]')) {
    const box = el.getBoundingClientRect()
    const d = Math.abs(box.left + box.width / 2 - e.clientX)
    if (d <= gap) [best, gap] = [el, d]
  }
  if (!best) return null
  const speed = Number(best.dataset.s)
  const bench = best.dataset.bench as Benchmark | undefined
  const pointed: Pointed | undefined = bench ? { speed, bench } : row.builds.find((b) => b.speed === speed)
  return pointed ? { row, speed, pointed, el: best } : null
}
type Hit = NonNullable<ReturnType<typeof nearest>>
function point(hit: Hit) {
  markEl = hit.el
  if (activeEl === hit.el) return
  activeEl?.classList.remove('active')
  activeEl = hit.el
  activeEl.classList.add('active')
  tipState.pointed = hit.pointed
}
function show(hit: Hit) {
  clearTimeout(pending)
  point(hit)
  if (tip?.state.isVisible) tip.popperInstance?.update()
  else tip?.show()
}
function hide() {
  slideHit = startEl = undefined
  tipState.hint = false
  clearTimeout(pending)
  pending = undefined
  activeEl?.classList.remove('active')
  activeEl = undefined
  tip?.hide()
}
function onMove(e: PointerEvent) {
  const hit = nearest(e)
  if (!hit) {
    if (e.pointerType === 'mouse') hide()
    return
  }
  // A finger's drag from a mark: the slider.
  if (startEl && e.buttons) {
    slideHit = hit
    if (hit.el !== startEl) slid = true
  }
  if (tip?.state.isVisible) show(hit)
  else if (e.pointerType === 'mouse') {
    point(hit)
    if (pending === undefined) pending = setTimeout(() => show(nearest(e) ?? hit), SHOW_DELAY)
  } else if (e.buttons) show(hit)
}
function onDown(e: PointerEvent) {
  const hit = nearest(e)
  const finger = e.pointerType !== 'mouse'
  skipClick = false
  slid = false
  startEl = finger ? hit?.el : undefined
  slideHit = finger ? (hit ?? undefined) : undefined
  tipState.hint = finger && !slidOnce && props.mine !== null && !!hit && !hit.row.mine
  if (hit) show(hit)
  else hide()
}
/** A finger let go after sliding to another mark: that one picked. */
function onUp(e: PointerEvent) {
  const hit = slideHit
  slideHit = startEl = undefined
  if (e.pointerType === 'mouse' || !slid || !hit || hit.row.mine) return
  slid = false
  skipClick = true
  emit('mark', hit.row.key, hit.speed, true)
  if (props.mine === null || slidOnce) return
  slidOnce = true
  tipState.hint = false
  try {
    localStorage.setItem(SLID_KEY, '1')
  } catch {
    // Not remembered: the hint shows again next time.
  }
}
function onClick(e: MouseEvent) {
  if (skipClick) return void (skipClick = false)
  const hit = e instanceof PointerEvent ? nearest(e) : null
  if (hit && !hit.row.mine) emit('mark', hit.row.key, hit.speed, false)
}
function onOutside(e: PointerEvent) {
  if (!list.value?.contains(e.target as Node)) hide()
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') hide()
  setHovered(null)
}
onMounted(() => {
  tip = tippy(list.value!, {
    trigger: 'manual',
    hideOnClick: false,
    placement: 'top',
    content: tipBody.value!.$el as HTMLElement,
    getReferenceClientRect: () => markEl?.getBoundingClientRect() ?? list.value!.getBoundingClientRect(),
  })
  noteTip = tippy(noteHelp.value!, { content: noteBody.value!, placement: 'bottom-start', maxWidth: 380 })
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('scroll', hide, { passive: true, capture: true })
})
onBeforeUnmount(() => {
  clearTimeout(pending)
  tip?.destroy()
  noteTip?.destroy()
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('scroll', hide, { capture: true })
})
</script>

<template>
  <div ref="root" class="odds" :class="{ finding, mined: mine !== null }">
    <!-- The heads: the Speed's column, how to read the rows (its tooltip), the axis's ends with yours
         on it, and, with yours, what the rows' ends say. -->
    <div class="head">
      <span class="speed"
        ><span ref="noteHelp" class="note" tabindex="0" role="img" :aria-label="t('speed.help')">{{
          t('stat.spe')
        }}</span></span
      >
      <span class="who"></span>
      <span class="track" aria-hidden="true">
        <span class="end">{{ Math.round(axis.lo) }}</span>
        <span v-if="mine !== null" class="mine-label" :style="{ left: at(mine) }">{{
          t('speed.yoursAt', { speed: mine })
        }}</span>
        <span class="end">{{ Math.round(axis.lo + axis.span) }}</span>
      </span>
      <span v-if="mine !== null" class="odds-cell odds-head"
        >{{ t('speed.oddsHead')
        }}<span v-tip="oddsInfo" class="help" tabindex="0" role="img" :aria-label="oddsInfo">
          <Info :size="14" aria-hidden="true" /></span
      ></span>
    </div>
    <ol
      ref="list"
      class="rows"
      @pointermove="onMove"
      @pointerdown="onDown"
      @pointerup="onUp"
      @click="onClick"
      @pointerleave="onLeave"
      @pointercancel="hide"
      @pointerover="onOver"
      @pointerout="onOut"
      @focusin="onOver"
      @focusout="onOut"
    >
      <SpeedOddsRow
        v-for="(r, i) in rows"
        :key="r.key"
        :row="r"
        :lo="axis.lo"
        :span="axis.span"
        :mine
        :trick-room
        :possible
        :first="firsts[i]!"
        :href="firsts[i] ? rowHref(r.speed) : ''"
        :probe="pickedSpeed"
        :versus-speed="r.versus ? versusSpeed : null"
        :copied="firsts[i]! && copied === r.speed"
        @chip="(e: MouseEvent) => emit('chip', e, r.key)"
        @share="emit('share', r.speed)"
      >
        <template #tags="p"><slot name="tags" v-bind="p" /></template>
      </SpeedOddsRow>
    </ol>
    <!-- A Speed of the column hovered: a line down the rows at it. -->
    <span ref="probeLine" class="probe-line" hidden aria-hidden="true"></span>
    <!-- How to read the rows, the "?"'s tooltip's content, moved into it by tippy. -->
    <div ref="noteBody" class="note-body">
      <p v-for="(l, i) in noteLines" :key="i" class="note-line">
        <strong v-if="l.term">{{ l.term }}</strong> {{ l.text }}
      </p>
    </div>
    <!-- The marks' tooltip's content, moved into it by tippy. -->
    <SpeedOddsTip ref="tipBody" :state="tipState" />
  </div>
</template>

<style scoped>
/* The heads over the rows (`SpeedOddsRow`), in their columns: the Speed, the Pokémon, the axis and, with yours, how
   yours does; on phones, the Speed beside the Pokémon and how yours does, the axis under them. */
.odds {
  position: relative;
  --range-yours: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --range-theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --range-plain: color-mix(in srgb, var(--text) 45%, var(--panel));
  --cols: 2.4em minmax(8em, 20em) minmax(10em, 1fr);
}
.odds.mined {
  --cols: 2.4em minmax(8em, 20em) minmax(10em, 1fr) 6.5em;
}
.head {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'speed who track odds';
  align-items: center;
  gap: 4px 10px;
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
  grid-area: track;
  position: relative;
  display: flex;
  justify-content: space-between;
}
.head .speed {
  grid-area: speed;
  text-align: right;
}
.head .who {
  grid-area: who;
}
/* "Spe", how to read the rows in its tooltip, hovered or tapped: underlined dotted, as text with more to it. */
.head .note {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  cursor: help;
}
.head .note:hover,
.head .note:focus-visible {
  color: var(--text);
}
.odds-cell {
  grid-area: odds;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
/* "You first", its info icon after it: what it is of in a tooltip, hovered or tapped. */
.odds-head {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
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
.finding .row:not(.hit, .has-mine) {
  opacity: 0.45;
}
/* A Speed of the column hovered: a dashed line in ink down the rows, as the one picked has on each row. */
.probe-line {
  position: absolute;
  translate: -50% 0;
  border-left: 1px dashed var(--ink);
  pointer-events: none;
}
.probe-line[hidden] {
  display: none;
}
/* How to read the rows: a line per part, its name in bold, a little apart. */
.note-line {
  margin: 0;
}
.note-line + .note-line {
  margin-top: 3px;
}
@media (max-width: 720px) {
  .odds,
  .odds.mined {
    --cols: 2.2em minmax(0, 1fr) auto;
  }
  .head {
    gap: 2px 8px;
    grid-template-areas:
      'speed who odds'
      'speed track track';
  }
}
</style>
