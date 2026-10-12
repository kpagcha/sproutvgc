<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import tippy, { type Instance } from 'tippy.js'
import { percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { MARK_SHARE } from '@/lib/speed'
import { odds, type SpreadPoint } from '@/lib/speedLineup'

// One of the comparison's Pokémon at its sets, against another, drawn as the speed tiers' charts draw a row: a mark at
// each Speed its sets reach, rising from the axis as tall as it's common, colored by who moves first at it (its side's
// color, the other's, plain on a tie), over a fainter stretch of what it could reach (Min− to Max+); the other, at one
// build, a line through with its Speed over it (at its sets too, each mark is colored by who moves first against most
// of them). Only the Speeds on at least `MARK_SHARE` of its sets are drawn, though every one counts. Under the axis
// its slowest drawn, most common and fastest Speeds. Each mark says on hover, or a tap, its Speed,
// its share of the sets and the builds reaching it; where there's no hovering, a finger on the chart shows the nearest
// one's, which follows it as it slides along. In a side's panel, and on phones under the two, where its heading
// is a band of its side's color (`banded`).
const props = defineProps<{
  title: string
  spread: readonly SpreadPoint[]
  /** Its side, for its color; the other's is the other's. */
  tone: 'yours' | 'opponent'
  other: { name: string; spread: readonly SpreadPoint[]; sets: boolean } | null
  /** Its Speeds at its slowest and fastest builds (Min− and Max+), with its modifiers. */
  reach: { min: number; max: number }
  trickRoom: boolean
  banded?: boolean
}>()

/** The other at one build: its Speed, a line through the chart. */
const otherAt = computed(() => (props.other && !props.other.sets ? props.other.spread[0]!.speed : null))
const axis = computed(() => {
  const all = [props.reach.min, props.reach.max, ...drawn.value.map((s) => s.speed)]
  if (otherAt.value !== null) all.push(otherAt.value)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(2, (hi - lo) * 0.04)
  return { lo: lo - pad, span: hi - lo + 2 * pad }
})
const at = (speed: number) => `${((speed - axis.value.lo) / axis.value.span) * 100}%`
const between = (lo: number, hi: number) => ({ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` })

/** Who moves first at a Speed against the other: it, the other, or neither (a tie, or at most half of its sets each). */
function kind(speed: number) {
  if (!props.other) return undefined
  const o = odds([{ speed, share: 1, builds: [] }], props.other.spread, props.trickRoom)
  return o.first > 0.5 ? 'first' : o.after > 0.5 ? 'after' : 'tie'
}
const topShare = computed(() => Math.max(...props.spread.map((s) => s.share), 0.0001))
/** The Speeds drawn: those on at least `MARK_SHARE` of its sets (the rarer ones count in the odds, undrawn). */
const drawn = computed(() => {
  const list = props.spread.filter((s) => s.share >= MARK_SHARE)
  return list.length ? list : [common.value]
})
const common = computed(() => props.spread.reduce((a, b) => (b.share > a.share ? b : a)))
/** Whether any of its Speeds is too rare to be drawn, and that least share in words ("1%"). */
const hidden = computed(() => drawn.value.length < props.spread.length)
const markShare = computed(() => MARK_SHARE.toLocaleString(locale.value, { style: 'percent' }))
const lo = computed(() => drawn.value[drawn.value.length - 1]!.speed)
const hi = computed(() => drawn.value[0]!.speed)

const ARROWS = { up: '↑', down: '↓' }
/** A mark's tooltip: its Speed and share, then the builds reaching it, as the speed tiers' chips tag them. */
function tip(s: SpreadPoint) {
  const builds = s.builds.map((b) => {
    const effect = b.effect === 'neutral' ? t('speed.effect.neutral') : `${ARROWS[b.effect]}${t('stat.spe')}`
    const share = s.builds.length > 1 ? ` (${percent(b.share)})` : ''
    return `${effect} ${t('speed.points', { n: b.points })}${share}`
  })
  return `${s.speed} · ${percent(s.share)} · ${builds.join(', ')}`
}

// Where there's no hovering, the marks' tooltips are one of the chart's own: a finger on it shows the nearest mark's,
// following it as it slides along, and it stays once lifted, until a tap elsewhere.
const canHover = window.matchMedia('(hover: hover)').matches
const plot = useTemplateRef<HTMLElement>('plot')
/** The mark whose tooltip is shown, by its place among those drawn. */
const active = shallowRef<number | null>(null)
let dragTip: Instance | undefined
let dragging = false
function point(e: PointerEvent) {
  const marks = [...plot.value!.querySelectorAll<HTMLElement>('.mark')]
  let best = -1
  let gap = Infinity
  marks.forEach((m, i) => {
    const r = m.getBoundingClientRect()
    const d = Math.abs(r.left + r.width / 2 - e.clientX)
    if (d < gap) [best, gap] = [i, d]
  })
  const mark = marks[best]
  const s = drawn.value[best]
  if (!mark || !s) return
  dragTip ??= tippy(plot.value!, {
    trigger: 'manual',
    onHidden: () => {
      active.value = null
    },
  })
  dragTip.setProps({ getReferenceClientRect: () => mark.getBoundingClientRect() })
  dragTip.setContent(tip(s))
  active.value = best
  if (dragTip.state.isVisible) dragTip.popperInstance?.update()
  else dragTip.show()
}
function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  dragging = true
  plot.value!.setPointerCapture(e.pointerId)
  point(e)
}
function onMove(e: PointerEvent) {
  if (dragging) point(e)
}
function onUp() {
  dragging = false
}
function onCancel() {
  dragging = false
  dragTip?.hide()
}
watch(drawn, () => dragTip?.hide())
onBeforeUnmount(() => dragTip?.destroy())
</script>

<template>
  <div class="spread-part" :class="tone">
    <strong class="small title" :class="{ band: banded }">{{ title }}</strong>
    <div class="chart" :class="{ padded: banded }">
      <!-- Read out: every Speed and its share, and the other's Speed. -->
      <span class="visually-hidden">{{
        drawn.map((s) => `${s.speed} ${percent(s.share)}`).join(', ') +
        (otherAt !== null ? ` · ${other!.name} ${otherAt}` : '')
      }}</span>
      <div
        ref="plot"
        class="plot"
        :class="{ touch: !canHover }"
        aria-hidden="true"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
      >
        <span v-if="otherAt !== null" class="other-label" :style="{ left: at(otherAt) }"
          >{{ other!.name }} {{ otherAt }}</span
        >
        <span class="reach" :style="between(reach.min, reach.max)"></span>
        <span class="span" :style="between(lo, hi)"></span>
        <span
          v-for="(s, i) in drawn"
          :key="s.speed"
          v-tip:group="canHover && tip(s)"
          class="mark"
          :class="[kind(s.speed), { active: active === i }]"
          :style="{ left: at(s.speed), '--tall': s.share / topShare }"
        ></span>
        <span v-if="otherAt !== null" class="line" :style="{ left: at(otherAt) }"></span>
      </div>
      <div class="ticks" aria-hidden="true">
        <span class="tick" :style="{ left: at(lo) }">{{ lo }}</span>
        <span
          v-if="common.speed !== lo && common.speed !== hi"
          class="tick common"
          :style="{ left: at(common.speed) }"
          >{{ common.speed }}</span
        >
        <span v-if="hi !== lo" class="tick" :style="{ left: at(hi) }">{{ hi }}</span>
      </div>
      <p class="muted small note">
        {{ t('compare.spreadNote', { speed: common.speed, pct: percent(common.share) }) }}
        <template v-if="hidden">{{ t('compare.hiddenNote', { pct: markShare }) }}</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.spread-part {
  --mine: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --theirs: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --theirs-solid: var(--opponent);
  --theirs-text: var(--opponent-text);
  display: flex;
  flex-direction: column;
  align-self: stretch;
  gap: 6px;
}
.spread-part.opponent {
  --mine: color-mix(in srgb, var(--opponent) 75%, var(--panel));
  --theirs: color-mix(in srgb, var(--accent) 75%, var(--panel));
  --theirs-solid: var(--accent);
  --theirs-text: var(--accent-text);
}
.small {
  font-size: 0.875em;
}
/* As a band: across the top of its card, in its side's color. */
.title.band {
  display: block;
  padding: 6px 8px;
  line-height: 1.3;
  color: var(--side-text);
  background: var(--side);
  border-bottom: 2px solid var(--ink);
}
.chart.padded {
  padding: 0 8px 6px;
}
/* The marks rising from the axis (a faint groove; what it could reach a deeper stretch of it; what its sets span a
   baseline on that), the other's line through, its label over it. */
.plot {
  position: relative;
  height: 64px;
  margin-top: 20px;
}
/* Sliding a finger along it moves the tooltip; up and down still scroll the page. */
.plot.touch {
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.plot::before {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 4px;
  translate: 0 50%;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
}
.reach {
  position: absolute;
  bottom: 0;
  height: 4px;
  translate: 0 50%;
  background: color-mix(in srgb, var(--text) 16%, var(--panel));
}
.span {
  position: absolute;
  bottom: 0;
  height: 2px;
  translate: 0 50%;
  background: color-mix(in srgb, var(--text) 45%, var(--panel));
}
.mark {
  position: absolute;
  bottom: 0;
  width: 8px;
  height: calc(4px + var(--tall) * 56px);
  translate: -50% 0;
  background: color-mix(in srgb, var(--text) 45%, var(--panel));
  box-shadow: 0 0 0 1px var(--panel);
}
/* Easier to point at than its own width. */
.mark::after {
  content: '';
  position: absolute;
  inset: -4px -3px;
}
/* The one whose tooltip a finger shows, outlined. */
.mark.mark.active {
  box-shadow:
    0 0 0 1px var(--panel),
    0 0 0 3px var(--ink);
  z-index: 1;
}
.mark.first {
  background: var(--mine);
}
.mark.after {
  background: var(--theirs);
}
.mark.tie {
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel);
}
.line {
  position: absolute;
  top: -2px;
  bottom: -6px;
  width: 2px;
  translate: -50% 0;
  background: var(--theirs-solid);
}
.other-label {
  position: absolute;
  top: -20px;
  translate: -50% 0;
  padding: 0 4px;
  font-size: 0.75em;
  font-weight: bold;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--theirs-text);
  background: var(--theirs-solid);
}
/* Its slowest, most common and fastest Speeds under the axis. */
.ticks {
  position: relative;
  height: 1.5em;
  font-size: 0.8em;
  font-variant-numeric: tabular-nums;
}
.tick {
  position: absolute;
  top: 4px;
  translate: -50% 0;
  white-space: nowrap;
  color: var(--muted);
}
.tick.common {
  font-weight: bold;
  color: var(--text);
}
.note {
  margin: 4px 0 0;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
