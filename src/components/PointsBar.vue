<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { t } from '@/i18n'
import { MAX_POINTS, pointGains, statValue, type NatureEffect } from '@/lib/stats'

// One stat's points as a slider drawn as the meta page's spread card draws them (`MetaPokemonView`'s `.invest`): a bar
// filled by its points out of `MAX_POINTS`, its points at its left and the stat they give at its right, in the good
// color when the nature raises it, outlined in the bad when it lowers it. Dragged or tapped along (sliding sideways on a
// touch screen; up and down still scrolls the page), or with the keys (arrows by one, with Shift or Page Up/Down by
// four, Home and End to none and as many as it can take), and stepped by one with the buttons beside it. Past what the
// points left allow (`limit`), hatched: out of reach. Under a mouse, where it would go shows faded before it's pressed.
// A nature's rounding marked on it (`pointGains`): a point that adds 2 (the raised stat's every tenth) a notch on its
// top edge, one that adds nothing (the lowered stat's) a notch in the bad color; points ending on one that adds
// nothing say so, the one under it giving the same stat. Its points settled (let go, stepped or keyed) also come out as
// `change`, as a native slider's, for a page that follows a drag only as a draft. Alone (`raised`, the speed pages'),
// ink-outlined on a hard shadow, as the controls around it; the team builder's six stacked flat.
const props = defineProps<{
  base: number
  effect: NatureEffect
  hp?: boolean
  limit: number
  label: string
  raised?: boolean
}>()
const points = defineModel<number>({ required: true })
const emit = defineEmits<{ change: [points: number] }>()

const gains = computed(() => pointGains(props.base, props.effect, props.hp))
const value = (p: number) => statValue(props.base, p, props.effect, props.hp)
/** The points that don't add 1, where each is along the bar. */
const marks = computed(() =>
  gains.value.flatMap((g, i) =>
    g === 1 ? [] : [{ at: (i + 0.5) / MAX_POINTS, bonus: g > 1, filled: i < points.value }],
  ),
)
/** Its last point adds nothing: one fewer gives the same stat. */
const wasted = computed(() => points.value > 0 && gains.value[points.value - 1] === 0)
const next = computed(() => (points.value < props.limit ? gains.value[points.value] : undefined))

const clamp = (p: number) => Math.max(0, Math.min(props.limit, Math.round(p)))
const set = (p: number) => (points.value = clamp(p))
/** Set and settled: stepped or keyed. Its new points, not `points`, which a parent's prop doesn't change until it's
 * drawn again. */
function settle(p: number) {
  set(p)
  emit('change', clamp(p))
}

const bar = useTemplateRef<HTMLElement>('bar')
const dragging = shallowRef(false)
/** Where the pointer would set it, under a mouse, before it's pressed. */
const hover = shallowRef<number | null>(null)
function at(e: PointerEvent): number {
  const r = bar.value!.getBoundingClientRect()
  return Math.max(0, Math.min(props.limit, Math.round(((e.clientX - r.left) / r.width) * MAX_POINTS)))
}
/** Where the drag last set it, settled when let go. */
let dragged = 0
function down(e: PointerEvent) {
  if (e.button !== 0) return
  bar.value!.setPointerCapture(e.pointerId)
  dragging.value = true
  hover.value = null
  set((dragged = at(e)))
}
function move(e: PointerEvent) {
  if (dragging.value) set((dragged = at(e)))
  else if (e.pointerType === 'mouse') hover.value = at(e)
}
function up() {
  if (dragging.value) emit('change', dragged)
  dragging.value = false
}
function key(e: KeyboardEvent) {
  const step = e.shiftKey ? 4 : 1
  const by: Record<string, number> = {
    ArrowRight: step,
    ArrowUp: step,
    ArrowLeft: -step,
    ArrowDown: -step,
    PageUp: 4,
    PageDown: -4,
  }
  if (e.key in by) settle(points.value + by[e.key]!)
  else if (e.key === 'Home') settle(0)
  else if (e.key === 'End') settle(props.limit)
  else return
  e.preventDefault()
}

const preview = computed(() => (hover.value !== null && hover.value !== points.value ? hover.value : null))
const tip = computed(() =>
  wasted.value
    ? t('builder.lastWasted', { n: points.value - 1 })
    : next.value === 2
      ? t('builder.nextBonus')
      : next.value === 0
        ? t('builder.nextWasted')
        : undefined,
)
</script>

<template>
  <div class="points-bar" :class="{ raised }">
    <div
      ref="bar"
      v-tip="tip"
      class="invest"
      :class="[effect, { dragging, wasted }]"
      role="slider"
      tabindex="0"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="MAX_POINTS"
      :aria-valuenow="points"
      :aria-valuetext="t('builder.valueText', { n: points, value: value(points) })"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @pointerleave="hover = null"
      @keydown="key"
    >
      <span
        v-if="limit < MAX_POINTS"
        class="reach"
        :style="{ left: `${(limit / MAX_POINTS) * 100}%` }"
        aria-hidden="true"
      ></span>
      <span v-if="preview !== null" class="ghost" :style="{ '--share': preview / MAX_POINTS }"></span>
      <span class="invest-bar" :style="{ '--share': points / MAX_POINTS }"></span>
      <span
        v-for="m in marks"
        :key="m.at"
        class="mark"
        :class="{ bonus: m.bonus, filled: m.filled }"
        :style="{ left: `${m.at * 100}%` }"
        aria-hidden="true"
      ></span>
      <span class="grip" :style="{ left: `${(points / MAX_POINTS) * 100}%` }" aria-hidden="true"></span>
      <span class="invest-text" aria-hidden="true">
        <span class="invest-pts" :class="{ none: !points && preview === null, preview: preview !== null }"
          >{{ preview ?? points }}<span v-if="wasted && preview === null" class="waste">!</span></span
        >
        <span class="invest-val" :class="{ preview: preview !== null }"
          ><component
            :is="effect === 'up' ? ChevronsUp : ChevronsDown"
            v-if="effect !== 'neutral'"
            :size="12"
            :stroke-width="3"
          />{{ value(preview ?? points) }}</span
        >
      </span>
    </div>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="points <= 0"
      :aria-label="t('builder.less', { stat: label })"
      @click="settle(points - 1)"
    >
      −
    </button>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="points >= limit"
      :aria-label="t('builder.more', { stat: label })"
      @click="settle(points + 1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.points-bar {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
/* The bar, as the spread card's. */
.invest {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  height: 24px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border) 40%, transparent);
  cursor: ew-resize;
  /* Sideways is the slider's; up and down still scroll the page. */
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.invest:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.invest-bar,
.ghost {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--share, 0));
}
.invest-bar {
  background: color-mix(in srgb, var(--accent) 45%, transparent);
  transition: width 0.12s ease-out;
}
.invest.dragging .invest-bar {
  transition: none;
}
.invest.up .invest-bar {
  background: color-mix(in srgb, var(--good) 55%, transparent);
}
.invest.down {
  box-shadow: inset 0 0 0 1px var(--bad);
}
/* Where it would go, under the pointer, before it's pressed. */
.ghost {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
.invest.up .ghost {
  background: color-mix(in srgb, var(--good) 25%, transparent);
}
/* Out of reach with the points left: hatched. */
.reach {
  position: absolute;
  inset: 0 0 0 auto;
  background: repeating-linear-gradient(
    -45deg,
    transparent 0 3px,
    color-mix(in srgb, var(--muted) 30%, transparent) 3px 4px
  );
}
/* Its end, a thin ink line, stronger while it's held or focused. */
.grip {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ink);
  opacity: 0;
  transition:
    left 0.12s ease-out,
    opacity 0.12s;
}
.invest.dragging .grip {
  transition: opacity 0.12s;
}
.invest:hover .grip,
.invest:focus-visible .grip,
.invest.dragging .grip {
  opacity: 0.8;
}
/* A point that adds 2: a notch down from its top edge; one that adds nothing, in the bad color. Faint past its
   points, plain within them. */
.mark {
  position: absolute;
  top: 0;
  width: 0;
  height: 0;
  margin-left: -4px;
  border-inline: 4px solid transparent;
  border-top: 5px solid var(--bad);
  opacity: 0.45;
}
.mark.bonus {
  border-top-color: var(--ink);
}
.mark.filled {
  opacity: 1;
}
.invest-text {
  position: relative;
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0 5px;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.invest-pts {
  font-weight: 500;
}
.invest-pts.none {
  font-weight: normal;
  color: var(--muted);
  opacity: 0.5;
}
.preview {
  opacity: 0.6;
}
.waste {
  margin-left: 2px;
  font-weight: bold;
  color: var(--bad);
}
.invest-val {
  display: inline-flex;
  align-items: center;
  font-weight: bold;
}
.invest.down .invest-val {
  color: var(--bad);
}
/* Stepping by one, square and small. */
.step {
  flex: none;
  width: 22px;
  height: 24px;
  padding: 0;
  font: inherit;
  font-weight: bold;
  line-height: 1;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.step:disabled {
  opacity: 0.35;
  cursor: default;
}
/* Raised: the bar and its steps ink-outlined on a hard shadow, spaced for it; a nature lowering it still outlined
   in the bad within. */
.raised {
  gap: 6px;
}
.raised .invest,
.raised .step {
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.raised .invest.down {
  box-shadow:
    inset 0 0 0 1px var(--bad),
    var(--hard-sm);
}
.raised .step:disabled {
  opacity: 1;
  color: color-mix(in srgb, var(--text) 35%, transparent);
}
/* Fingers: taller, easier to hold. */
@media (pointer: coarse) {
  .invest,
  .step {
    height: 30px;
  }
  .step {
    width: 28px;
  }
}
</style>
