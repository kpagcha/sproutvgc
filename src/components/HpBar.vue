<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { t } from '@/i18n'

// A Pokémon's HP left, in percent, as a slider drawn as the damage calculator's bars of HP are (`DamageRow`): what's
// left in the HP colors (green over half, yellow over a fifth, red under), what's lost dark, ink-outlined, with a mark
// at half, where Sitrus Berry and the like kick in. Taller than those, to be held, its percent on it. It works as the
// stat points' bar (`PointsBar`): dragged or tapped along (sliding sideways on a touch screen; up and down still
// scroll the page), or with the keys (arrows by one, with Shift or Page Up/Down by ten, Home and End to 1 and full),
// and stepped by one with the buttons beside it; under a mouse, where it would go shows faded before it's pressed.
const props = defineProps<{ label: string }>()
const hp = defineModel<number>({ required: true })

const clamp = (p: number) => Math.max(1, Math.min(100, Math.round(p)))
const set = (p: number) => (hp.value = clamp(p))

const bar = useTemplateRef<HTMLElement>('bar')
const dragging = shallowRef(false)
const hover = shallowRef<number | null>(null)
function at(e: PointerEvent): number {
  const r = bar.value!.getBoundingClientRect()
  return clamp(((e.clientX - r.left) / r.width) * 100)
}
function down(e: PointerEvent) {
  if (e.button !== 0) return
  bar.value!.setPointerCapture(e.pointerId)
  dragging.value = true
  hover.value = null
  set(at(e))
}
function move(e: PointerEvent) {
  if (dragging.value) set(at(e))
  else if (e.pointerType === 'mouse') hover.value = at(e)
}
const up = () => (dragging.value = false)
function key(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  const by: Record<string, number> = {
    ArrowRight: step,
    ArrowUp: step,
    ArrowLeft: -step,
    ArrowDown: -step,
    PageUp: 10,
    PageDown: -10,
  }
  if (e.key in by) set(hp.value + by[e.key]!)
  else if (e.key === 'Home') set(1)
  else if (e.key === 'End') set(100)
  else return
  e.preventDefault()
}

const preview = computed(() => (hover.value !== null && hover.value !== hp.value ? hover.value : null))
const color = (p: number) => (p > 50 ? 'var(--hp-high)' : p > 20 ? 'var(--hp-mid)' : 'var(--hp-low)')
</script>

<template>
  <div class="hp-bar">
    <div
      ref="bar"
      class="track"
      :class="{ dragging }"
      role="slider"
      tabindex="0"
      :aria-label="props.label"
      aria-valuemin="1"
      aria-valuemax="100"
      :aria-valuenow="hp"
      :aria-valuetext="`${hp}%`"
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
      <span class="pct" :class="{ preview: preview !== null }" aria-hidden="true">{{ preview ?? hp }}%</span>
    </div>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="hp <= 1"
      :aria-label="t('calc.hpLess')"
      @click="set(hp - 1)"
    >
      −
    </button>
    <button
      type="button"
      class="step"
      tabindex="-1"
      :disabled="hp >= 100"
      :aria-label="t('calc.hpMore')"
      @click="set(hp + 1)"
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
</style>
