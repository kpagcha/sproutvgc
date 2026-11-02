<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import type { SpeedBuildShare } from '@/lib/speed'
import { MAX_POINTS } from '@/lib/stats'
import { POINTS, reverse, type Fit, type PointsRange } from '@/lib/speedReverse'
import PokemonIcon from '@/components/PokemonIcon'

// The comparison read backwards ("Who moved first"): the two picked with their natures and modifiers, and which of
// them was seen moving first; what their Speed points could then be. Each one's points as a range, the spreads it most
// likely was (weighed by the meta's sets at those natures), and a grid of every pair of points, those that fit filled.
type Side = 'a' | 'b'
const props = defineProps<{
  sides: readonly { s: Side; id: PokemonId | null; name: string | null; build: SpeedBuild; builds: SpeedBuildShare[] }[]
  first: Side | null
  trickRoom: boolean
}>()
const emit = defineEmits<{ first: [s: Side] }>()

const [sideA, sideB] = [computed(() => props.sides[0]!), computed(() => props.sides[1]!)]
const ready = computed(() => !!sideA.value.id && !!sideB.value.id)
const result = computed(() =>
  ready.value && props.first
    ? reverse(
        { id: sideA.value.id!, build: sideA.value.build, builds: sideA.value.builds },
        { id: sideB.value.id!, build: sideB.value.build, builds: sideB.value.builds },
        props.first,
        props.trickRoom,
      )
    : null,
)
const nameOf = (s: Side) => (s === 'a' ? sideA.value.name : sideB.value.name)!

/** A side's points in words: any, a stretch, one number. */
function rangeText(r: PointsRange) {
  if (r.from === 0 && r.to === MAX_POINTS) return t('reverse.anyPoints')
  const speed = r.speeds[0] === r.speeds[1] ? String(r.speeds[0]) : `${r.speeds[0]}–${r.speeds[1]}`
  if (r.from === r.to) return t('reverse.exactly', { n: r.from, speed })
  if (r.from === 0) return t('reverse.atMost', { n: r.to, speed: r.speeds[1] })
  if (r.to === MAX_POINTS) return t('reverse.atLeast', { n: r.from, speed: r.speeds[0] })
  return t('reverse.between', { from: r.from, to: r.to, speed })
}
const lines = computed(() => {
  const r = result.value
  if (!r) return []
  return (['a', 'b'] as const).map((s) => {
    const range = s === 'a' ? r.rangeA : r.rangeB
    const likely = (s === 'a' ? r.likelyA : r.likelyB).filter((x) => x.share >= 0.01).slice(0, 3)
    return { s, id: s === 'a' ? sideA.value.id! : sideB.value.id!, range, likely, known: r.known[s] }
  })
})
/**
 * What one's points say of the other's, the two being tied together: at each side's builds most run at its nature (on
 * 10% of those sets or more, up to 2), or without sets, at none and all of its points. Those that can't fit left out but
 * for one with sets (its most run build ruled out says as much).
 */
const ifLines = computed(() => {
  const r = result.value
  if (!r?.rangeA) return []
  return (['a', 'b'] as const).flatMap((s) => {
    const speeds = s === 'a' ? r.speedsA : r.speedsB
    const likely = r.known[s] ? priorPoints(s) : [0, MAX_POINTS]
    const o = s === 'a' ? 'b' : 'a'
    return likely.map((n) => {
      const g = r.given(s, n)
      return {
        key: `${s}${n}`,
        s,
        text: t('reverse.if', { name: nameOf(s), n, speed: speeds[n]! }),
        then: g ? `${nameOf(o)}: ${rangeText(g)}` : t('reverse.ruledOut'),
        out: !g,
      }
    })
  })
})
/** A side's points most run at its nature, before what was seen: on 10% of those sets or more, up to 2. */
function priorPoints(s: Side) {
  const side = s === 'a' ? sideA.value : sideB.value
  const at = side.builds.filter((b) => b.effect === side.build.effect)
  const total = at.reduce((n, b) => n + b.share, 0)
  return at
    .filter((b) => b.share / total >= 0.1)
    .slice(0, 2)
    .map((b) => b.points)
}

// The grid: a cell per pair of points, the first side's along, the second's up; the meta's builds as dots, as big as
// they're common. What's under the pointer (or the finger) said under it.
const CELL = 8
const SIZE = CELL * POINTS.length
const PAD = { left: 22, bottom: 18, top: 4, right: 4 }
const TICKS = [0, 8, 16, 24, 32]
const x = (pa: number) => PAD.left + pa * CELL
const y = (pb: number) => PAD.top + (MAX_POINTS - pb) * CELL
const dots = computed(() => {
  const r = result.value
  if (!r?.prior) return []
  const max = Math.max(...r.prior.flat())
  return POINTS.flatMap((pa) =>
    POINTS.flatMap((pb) => {
      const w = r.prior![pa]![pb]! / max
      return w < 0.02 ? [] : [{ pa, pb, r: 1 + 2.6 * Math.sqrt(w), fit: r.grid[pa]![pb]! }]
    }),
  )
})
/** The cells that fit, and the ties, each as one path (a thousand rects drawn again on every hover otherwise). */
const cells = computed(() => {
  const out = { fits: '', tie: '' }
  const r = result.value
  if (!r) return out
  for (const pa of POINTS)
    for (const pb of POINTS) {
      const f = r.grid[pa]![pb]!
      if (f !== 'no') out[f] += `M${x(pa)} ${y(pb)}h${CELL}v${CELL}h-${CELL}z`
    }
  return out
})
const hover = ref<{ pa: number; pb: number } | null>(null)
function onPointer(e: PointerEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const box = svg.getBoundingClientRect()
  const scale = box.width / (PAD.left + SIZE + PAD.right)
  const pa = Math.floor(((e.clientX - box.left) / scale - PAD.left) / CELL)
  const pb = MAX_POINTS - Math.floor(((e.clientY - box.top) / scale - PAD.top) / CELL)
  hover.value = pa >= 0 && pa <= MAX_POINTS && pb >= 0 && pb <= MAX_POINTS ? { pa, pb } : null
}
const readout = computed(() => {
  const r = result.value
  const h = hover.value ?? (r?.top[0] ? { pa: r.top[0].a, pb: r.top[0].b } : null)
  if (!r || !h) return null
  const fit = r.grid[h.pa]![h.pb]!
  return {
    a: t('reverse.at', { name: nameOf('a'), n: h.pa, speed: r.speedsA[h.pa]! }),
    b: t('reverse.at', { name: nameOf('b'), n: h.pb, speed: r.speedsB[h.pb]! }),
    fit,
    hovered: !!hover.value,
  }
})
const FIT_TEXT = {
  fits: 'reverse.fit.fits',
  tie: 'reverse.fit.tie',
  no: 'reverse.fit.no',
} as const satisfies Record<Fit, string>
const chartLabel = computed(() => t('reverse.chartLabel', { a: sideA.value.name ?? '', b: sideB.value.name ?? '' }))
</script>

<template>
  <section class="panel reverse" :aria-label="t('reverse.title')">
    <h2 class="heading">{{ t('reverse.question') }}</h2>
    <p v-if="!ready" class="muted small">{{ t('reverse.pickBoth') }}</p>
    <template v-else>
      <!-- The order seen: which of the two moved first. -->
      <div class="choices" role="radiogroup" :aria-label="t('reverse.question')">
        <button
          v-for="side in props.sides"
          :key="side.s"
          type="button"
          role="radio"
          class="btn choice"
          :class="[side.s === 'a' ? 'yours' : 'opponent', { on: props.first === side.s }]"
          :aria-checked="props.first === side.s"
          @click="emit('first', side.s)"
        >
          <PokemonIcon :id="side.id!" />{{ side.name }}
        </button>
      </div>
      <p v-if="!props.first" class="muted small">{{ t('reverse.pickFirst') }}</p>

      <template v-else-if="result">
        <!-- It can't have happened: no points of either do it. -->
        <p v-if="!result.rangeA" class="warn" role="status">{{ t('reverse.impossible') }}</p>
        <template v-else>
          <!-- What each one's points can be, and the spreads most likely at its nature. -->
          <ul class="lines" role="status">
            <li v-for="l in lines" :key="l.s" class="line" :class="l.s === 'a' ? 'yours' : 'opponent'">
              <span class="who"><PokemonIcon :id="l.id" />{{ nameOf(l.s) }}</span>
              <span class="range">{{ rangeText(l.range!) }}</span>
              <span v-if="l.known && l.likely.length" class="likely">
                <span class="muted small">{{ t('reverse.likely') }}</span>
                <span v-for="x in l.likely" :key="x.points" class="pill"
                  >{{ t('speed.points', { n: x.points }) }} <span class="muted">{{ percent(x.share) }}</span></span
                >
              </span>
              <span v-else-if="!l.known" class="muted small">{{ t('reverse.noSets') }}</span>
            </li>
          </ul>
          <!-- One's points tie the other's: at each one's common builds, what the other's then are. -->
          <ul v-if="ifLines.length" class="ifs small">
            <li v-for="l in ifLines" :key="l.key" :class="{ out: l.out }">
              <span class="muted">{{ l.text }}</span> {{ l.then }}
            </li>
          </ul>
          <p v-if="result.known.a || result.known.b" class="muted small chance">
            {{
              t('reverse.chance', {
                name: nameOf(props.first),
                other: nameOf(props.first === 'a' ? 'b' : 'a'),
                pct: percent(result.chance),
              })
            }}
          </p>
        </template>

        <!-- Every pair of points: the first's along, the second's up, those that fit filled, ties striped; the meta's
             builds as dots. -->
        <figure class="grid-fig">
          <svg
            class="grid"
            :viewBox="`0 0 ${PAD.left + SIZE + PAD.right} ${PAD.top + SIZE + PAD.bottom}`"
            role="img"
            :aria-label="chartLabel"
            @pointermove="onPointer"
            @pointerdown="onPointer"
            @pointerleave="hover = null"
          >
            <defs>
              <pattern
                id="reverse-tie"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="4" height="4" class="cell-tie-bg" />
                <line x1="0" y1="0" x2="0" y2="4" class="cell-tie-line" />
              </pattern>
            </defs>
            <rect :x="PAD.left" :y="PAD.top" :width="SIZE" :height="SIZE" class="cell-no" />
            <path :d="cells.fits" class="cell-fits" />
            <path :d="cells.tie" class="cell-tie" />
            <circle
              v-for="d in dots"
              :key="`${d.pa}:${d.pb}`"
              :cx="x(d.pa) + CELL / 2"
              :cy="y(d.pb) + CELL / 2"
              :r="d.r"
              class="dot"
              :class="{ out: d.fit === 'no' }"
            />
            <rect v-if="hover" :x="x(hover.pa)" :y="y(hover.pb)" :width="CELL" :height="CELL" class="cell-hover" />
            <rect :x="PAD.left" :y="PAD.top" :width="SIZE" :height="SIZE" class="frame" />
            <text
              v-for="n in TICKS"
              :key="`x${n}`"
              :x="x(n) + CELL / 2"
              :y="PAD.top + SIZE + 12"
              class="tick"
              text-anchor="middle"
            >
              {{ n }}
            </text>
            <text
              v-for="n in TICKS"
              :key="`y${n}`"
              :x="PAD.left - 4"
              :y="y(n) + CELL / 2 + 3"
              class="tick"
              text-anchor="end"
            >
              {{ n }}
            </text>
          </svg>
          <figcaption class="muted small axes">
            {{ t('reverse.axes', { a: nameOf('a'), b: nameOf('b') }) }}
          </figcaption>
        </figure>
        <p v-if="readout" class="readout small">
          <span class="muted">{{ readout.hovered ? '' : t('reverse.mostLikely') }}</span>
          {{ readout.a }} · {{ readout.b }}
          <span class="fit" :class="readout.fit">{{ t(FIT_TEXT[readout.fit]) }}</span>
        </p>
        <p class="muted small">{{ t('reverse.note') }}</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.reverse {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reverse > p {
  margin: 0;
}
.heading {
  margin: 0;
  font-size: 1.125em;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.choice {
  gap: 6px;
}
.choice.on.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.choice.on.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.warn {
  color: var(--bad);
  font-weight: bold;
}
.lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding-left: 8px;
  border-left: 4px solid var(--accent);
}
.line.opponent {
  border-left-color: var(--opponent);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.range {
  font-weight: bold;
}
.likely {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.pill {
  padding: 1px 6px;
  font-size: 0.875em;
  border: 1px solid var(--border);
}
.ifs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ifs .out {
  color: var(--bad);
}
.grid-fig {
  margin: 0;
}
.grid {
  display: block;
  width: 100%;
  max-width: 340px;
  touch-action: none;
}
.cell-no {
  fill: var(--panel-alt);
}
.cell-fits {
  fill: var(--m2-bg);
}
.cell-tie {
  fill: url(#reverse-tie);
}
.cell-tie-bg {
  fill: var(--m2-bg);
  opacity: 0.45;
}
.cell-tie-line {
  stroke: var(--m2-fg);
  stroke-width: 1.5;
  opacity: 0.5;
}
.cell-hover {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
}
.frame {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1;
}
.dot {
  fill: var(--ink);
}
.dot.out {
  fill: var(--panel);
  stroke: var(--muted);
  stroke-width: 1;
}
.tick {
  font-size: 8px;
  fill: var(--muted);
}
.axes {
  margin-top: 4px;
}
.readout {
  margin: 0;
}
.fit {
  margin-left: 4px;
  padding: 0 6px;
  font-weight: bold;
  border: 1px solid var(--ink);
}
.fit.fits {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.fit.tie {
  color: var(--text);
  background: var(--panel-alt);
}
.fit.no {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
</style>
