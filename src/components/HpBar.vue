<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { t } from '@/i18n'
import { hpShown } from '@/lib/damage'

// A Pokémon's HP left, kept in percent (`hp`, not rounded: a whole number of its HP points out of `max`), as a slider
// drawn as the damage calculator's bars of HP are (`DamageRow`): what's left in the HP colors (green over half, yellow
// over a fifth, red under), what's lost dark, ink-outlined, with a mark at half, where Sitrus Berry and the like kick
// in. Taller than those, to be held, its percent on it. It works as the stat points' bar (`PointsBar`), by HP points:
// dragged or clicked along (on a touch screen only dragged, sliding sideways, a tap setting nothing; up and down still
// scroll the page), or with the keys
// (arrows by one point, with Shift or Page Up/Down by a tenth of its HP, Home and End to 1 and full), and stepped by
// one point with the buttons beside it; under a mouse, where it would go shows faded before it's pressed.
const props = defineProps<{
  label: string
  max: number
  /** Smaller, for a row with more on it (the inverse calc's hits): lower, its steps narrower. */
  compact?: boolean
}>()
const hp = defineModel<number>({ required: true })

/** Its HP points left, from 1 to `max`. */
const points = computed(() => Math.max(1, Math.min(props.max, Math.round((props.max * hp.value) / 100))))
/** Its percent as the bar says it: whole, not full until it is (`hpShown`). */
const shown = hpShown
const clampPoints = (n: number) => Math.max(1, Math.min(props.max, Math.round(n)))
/** Its HP set to `n` points: in percent, exactly (full as 100). */
const setPoints = (n: number) => {
  const p = clampPoints(n)
  hp.value = p >= props.max ? 100 : (p / props.max) * 100
}

const bar = useTemplateRef<HTMLElement>('bar')
const dragging = shallowRef(false)
const hover = shallowRef<number | null>(null)
/** The HP points under the pointer. */
function at(e: PointerEvent): number {
  const r = bar.value!.getBoundingClientRect()
  return clampPoints(((e.clientX - r.left) / r.width) * props.max)
}
/** Where a touch went down, until it has slid far enough sideways to be a drag: a tap alone sets nothing, as it's
 *  easily one made scrolling the page. */
let touchFrom: number | null = null
/** How far a touch slides sideways, in pixels, before it drags. */
const SLOP = 6
function down(e: PointerEvent) {
  if (e.button !== 0) return
  bar.value!.setPointerCapture(e.pointerId)
  hover.value = null
  if (e.pointerType !== 'mouse') {
    touchFrom = e.clientX
    return
  }
  dragging.value = true
  setPoints(at(e))
}
function move(e: PointerEvent) {
  if (touchFrom !== null && Math.abs(e.clientX - touchFrom) >= SLOP) {
    touchFrom = null
    dragging.value = true
  }
  if (dragging.value) setPoints(at(e))
  else if (e.pointerType === 'mouse') hover.value = at(e)
}
const up = () => {
  touchFrom = null
  dragging.value = false
}
function key(e: KeyboardEvent) {
  const tenth = Math.max(1, Math.round(props.max / 10))
  const step = e.shiftKey ? tenth : 1
  const by: Record<string, number> = {
    ArrowRight: step,
    ArrowUp: step,
    ArrowLeft: -step,
    ArrowDown: -step,
    PageUp: tenth,
    PageDown: -tenth,
  }
  if (e.key in by) setPoints(points.value + by[e.key]!)
  else if (e.key === 'Home') setPoints(1)
  else if (e.key === 'End') setPoints(props.max)
  else return
  e.preventDefault()
}

/** Where it would go, in percent, under a mouse. */
const preview = computed(() =>
  hover.value !== null && hover.value !== points.value ? (hover.value / props.max) * 100 : null,
)
const color = (p: number) => (p > 50 ? 'var(--hp-high)' : p > 20 ? 'var(--hp-mid)' : 'var(--hp-low)')
</script>

<template>
  <div class="hp-bar" :class="{ compact }">
    <div
      ref="bar"
      class="track"
      :class="{ dragging }"
      role="slider"
      tabindex="0"
      :aria-label="props.label"
      aria-valuemin="1"
      :aria-valuemax="props.max"
      :aria-valuenow="points"
      :aria-valuetext="`${points} / ${props.max} (${shown(hp)}%)`"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @pointerleave="hover = null"
      @keydown="key"
    >
      <span class="left" :style="{ width: `${hp}%`, background: color(hp) }"></span>
      <span v-if="preview !== null" class="ghost" :style="{ left: `${preview}%` }" aria-hidden="true"></span>
      <span class="half" aria-hidden="true"></span>
      <span class="pct" :class="{ preview: preview !== null }" aria-hidden="true">{{ shown(preview ?? hp) }}%</span>
    </div>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="points <= 1"
      :aria-label="t('calc.hpLess')"
      @click="setPoints(points - 1)"
    >
      −
    </button>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="points >= props.max"
      :aria-label="t('calc.hpMore')"
      @click="setPoints(points + 1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.hp-bar {
  --hp-high: #3fae49;
  --hp-mid: #e3b023;
  --hp-low: #d9452f;
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
/* The bar, as the damage rows' HP: ink-outlined, what's lost dark. */
.track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 22px;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 55%, var(--panel));
  border: 1px solid var(--ink);
  cursor: ew-resize;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.track:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.left {
  position: absolute;
  inset: 0 auto 0 0;
  transition:
    width 0.12s ease-out,
    background-color 0.12s;
}
.track.dragging .left {
  transition: none;
}
/* Where it would go, under the pointer, before it's pressed: a line. */
.ghost {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ink);
  opacity: 0.5;
}
/* Half its HP: notches at its top and bottom edges, a faint line between. */
.half {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--ink) 45%, transparent);
}
.half::before,
.half::after {
  content: '';
  position: absolute;
  left: -4px;
  border-inline: 4px solid transparent;
}
.half::before {
  top: 0;
  border-top: 5px solid var(--ink);
}
.half::after {
  bottom: 0;
  border-bottom: 5px solid var(--ink);
}
.pct {
  position: absolute;
  top: 50%;
  left: 6px;
  font-size: 0.85em;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  color: #fff;
  text-shadow:
    0 0 2px #000,
    0 0 2px #000;
  transform: translateY(-50%);
  pointer-events: none;
}
.pct.preview {
  opacity: 0.7;
}
/* Stepping by one, square and small, as the stat points' bar's. */
.step {
  flex: none;
  width: 22px;
  height: 22px;
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
@media (pointer: coarse) {
  .track,
  .step {
    height: 30px;
  }
  .step {
    width: 28px;
  }
}
.compact .track,
.compact .step {
  height: 18px;
}
.compact .step {
  width: 18px;
  font-size: 0.85em;
}
.compact .pct {
  font-size: 0.75em;
}
@media (pointer: coarse) {
  .compact .track,
  .compact .step {
    height: 24px;
  }
  .compact .step {
    width: 24px;
  }
}
</style>
