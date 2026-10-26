<script setup lang="ts">
import { computed, h, render, shallowRef, type VNodeChild } from 'vue'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { move, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { t, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { defenseOf, offenseOf } from '@/lib/teamCoverage'
import type { Member } from '@/lib/team'
import { formatMult, multClass } from '@/lib/typecalc'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// The team builder's type coverage, two charts over the 18 types on a line: defending, a block per Pokémon above the
// line for each type it resists (½×, ¼×, immune) and below it for each it's weak to (2×, 4×), colored as the type
// chart's cells but from the defender's side (resisting green, weak red); attacking, a block above for each Pokémon
// with a super effective move against the type, marked when it's STAB, and below for each whose every move it resists
// or is immune to. Each block holds its Pokémon's icon: the one by the line whole, the rest slivers behind it, so a
// bar still grows with its count, until its column is hovered (tapped, where nothing hovers), when they open out
// whole, an accordion. Narrow, the line stands up: the types down the side, what's good to their right. A block's
// tooltip names its Pokémon with its types, defending, or its moves with theirs, attacking.
const props = defineProps<{ members: readonly Member[] }>()

interface Block {
  key: string
  pokemon: PokemonId
  cls: string
  tip: Element
  stab?: boolean
}
interface Column {
  type: TypeId
  up: Block[]
  down: Block[]
}
interface Chart {
  id: 'def' | 'atk'
  title: string
  cols: Column[]
  /** The most blocks a side can have: the line stays put as the team's sets change. */
  most: number
  legend: { up: { m: number; label: string }[]; down: { m: number; label: string }[] }
}

// Defending, the chart's colors read from the defender's side: resisting is good (green), being weak bad (red).
const DEF_CLASS: Record<number, number> = { 0.5: 2, 0.25: 4, 2: 0.5, 4: 0.25 }
const defClass = (m: number) => multClass(DEF_CLASS[m] ?? m)

const name = (id: PokemonId) => refName(pokemon(id))

// A block's tooltip: lines of text and type badges (small, whatever the screen), drawn once per content (`key`), the
// blocks sharing it.
const tips = new Map<string, Element>()
const line = (...parts: VNodeChild[]) =>
  h('span', { style: 'display: flex; align-items: center; gap: 4px; margin: 2px 0' }, parts)
const badges = (types: readonly TypeId[]) => types.map((type) => h(TypeIcon, { type }))
function tipOf(key: string, lines: () => VNodeChild[]): Element {
  let el = tips.get(key)
  if (!el) {
    const tip = (el = document.createElement('span'))
    // Drawn once the render asking for it is done (as `natureTip`).
    queueMicrotask(() => render(h('span', { style: 'display: block; --icon-scale: 0.75' }, lines()), tip))
    tips.set(key, el)
  }
  return el
}
const defTip = (p: PokemonId, mult: number) =>
  tipOf(`def:${p}:${mult}`, () => [
    line(h('b', name(p)), ...badges(POKEMON[p].types)),
    line(t('builder.coverage.takes', { mult: formatMult(mult) })),
  ])
const atkTip = (p: PokemonId, mult: number, moves: { id: Parameters<typeof move>[0]; type: TypeId }[], stab: boolean) =>
  tipOf(`atk:${p}:${mult}:${stab}:${moves.map((m) => `${m.id}.${m.type}`).join()}`, () => [
    line(h('b', name(p))),
    ...moves.map((m) => line(h(TypeIcon, { type: m.type }), refName(move(m.id)))),
    line(
      t(mult < 1 ? 'builder.coverage.atBest' : stab ? 'builder.coverage.hitsStab' : 'builder.coverage.hits', {
        mult: formatMult(mult),
      }),
    ),
  ])

const defense = computed<Chart>(() => {
  const by = defenseOf(props.members)
  const cols = TYPES.map((type) => {
    const all = by[type]
    const block = (i: number) => {
      const { pokemon: p, mult } = all[i]!
      return {
        key: `${i}`,
        pokemon: p,
        cls: defClass(mult),
        tip: defTip(p, mult),
      }
    }
    const idx = all.map((_, i) => i)
    return {
      type,
      up: idx
        .filter((i) => all[i]!.mult < 1)
        .sort((a, b) => all[b]!.mult - all[a]!.mult)
        .map(block),
      down: idx
        .filter((i) => all[i]!.mult > 1)
        .sort((a, b) => all[a]!.mult - all[b]!.mult)
        .map(block),
    }
  })
  return {
    id: 'def',
    title: t('builder.coverage.defense'),
    cols,
    most: props.members.filter((m) => m.pokemon).length,
    legend: {
      up: [0.5, 0.25, 0].map((m) => ({ m, label: '' })).concat({ m: -1, label: t('builder.coverage.resists') }),
      down: [2, 4].map((m) => ({ m, label: '' })).concat({ m: -1, label: t('builder.coverage.weak') }),
    },
  }
})

const offense = computed<Chart>(() => {
  const by = offenseOf(props.members)
  const cols = TYPES.map((type) => {
    const all = by[type]
    const block = (i: number) => {
      const { pokemon: p, mult, moves, stab } = all[i]!
      const shown = mult > 1 && stab
      return { key: `${i}`, pokemon: p, cls: multClass(mult), tip: atkTip(p, mult, moves, shown), stab: shown }
    }
    const idx = all.map((_, i) => i)
    return {
      type,
      // STAB nearest the line.
      up: idx
        .filter((i) => all[i]!.mult > 1)
        .sort((a, b) => all[a]!.mult - all[b]!.mult || Number(all[b]!.stab) - Number(all[a]!.stab))
        .map(block),
      down: idx
        .filter((i) => all[i]!.mult < 1)
        .sort((a, b) => all[b]!.mult - all[a]!.mult)
        .map(block),
    }
  })
  return {
    id: 'atk',
    title: t('builder.coverage.offense'),
    cols,
    most: Object.values(by)[0]!.length,
    legend: {
      up: [{ m: 2, label: t('builder.coverage.superEffective') }],
      down: [0.5, 0].map((m) => ({ m, label: '' })).concat({ m: -1, label: t('builder.coverage.resisted') }),
    },
  }
})

const charts = computed(() => [defense.value, offense.value])

// The column opened out: the one hovered with a mouse, or tapped on a touch screen (where it stays open as its blocks
// and type are tapped for their tooltips, until it's tapped elsewhere, or another column, or anywhere but a column).
// The rest of the panel dims while one is, so it stands out.
const opened = shallowRef<string | null>(null)
// On wide screens with a mouse, a block's and a type's tooltips go to their left, clear of the bar opened out, one
// tooltip gliding between them; elsewhere each has its own, so tapping another in the column opened shows its tooltip
// at once (a shared one would only hide on that tap). A directive's placement and group are fixed when it's set up:
// each drawn either way.
const wide = useMediaQuery('(min-width: 721px) and (any-hover: hover)')
let touch = false
const down = (e: PointerEvent) => (touch = e.pointerType !== 'mouse')
const enter = (e: PointerEvent, key: string) => {
  if (e.pointerType === 'mouse') opened.value = key
}
const leave = (e: PointerEvent, key: string) => {
  if (e.pointerType === 'mouse' && opened.value === key) opened.value = null
}
const tap = (e: MouseEvent, key: string) => {
  if (!touch) return
  const onPart = (e.target as Element).closest('.block, .axis')
  opened.value = opened.value === key && !onPart ? null : key
}
useEventListener(document, 'pointerdown', (e: PointerEvent) => {
  if (e.pointerType !== 'mouse' && !(e.target as Element | null)?.closest?.('.coverage .col, [data-tippy-root]'))
    opened.value = null
})
const colLabel = (c: Chart, col: Column) =>
  t(c.id === 'def' ? 'builder.coverage.colDef' : 'builder.coverage.colAtk', {
    type: typeName(col.type),
    up: col.up.length,
    down: col.down.length,
  })
</script>

<template>
  <section class="panel coverage" :class="{ focused: !!opened }">
    <div v-for="c in charts" :key="c.id" class="chart" :style="{ '--most': Math.max(c.most, 1) }">
      <h2>{{ c.title }}</h2>
      <p v-if="!c.most" class="muted empty">{{ t('builder.coverage.noMoves') }}</p>
      <template v-else>
        <div class="cols">
          <div
            v-for="col in c.cols"
            :key="col.type"
            class="col"
            :class="{ open: opened === `${c.id}:${col.type}` }"
            role="img"
            :aria-label="colLabel(c, col)"
            @pointerdown="down"
            @pointerenter="enter($event, `${c.id}:${col.type}`)"
            @pointerleave="leave($event, `${c.id}:${col.type}`)"
            @click="tap($event, `${c.id}:${col.type}`)"
          >
            <span class="side up" :style="{ '--n': col.up.length }" aria-hidden="true"
              ><template v-for="b in col.up" :key="b.key"
                ><span v-if="wide" v-tip:group.left="b.tip" class="block" :class="[b.cls, { stab: b.stab }]"
                  ><PokemonIcon :id="b.pokemon" :scale="0.75" /></span
                ><span v-else v-tip="b.tip" class="block" :class="[b.cls, { stab: b.stab }]"
                  ><PokemonIcon :id="b.pokemon" :scale="0.75" /></span></template
            ></span>
            <span v-if="wide" v-tip:group.left="typeName(col.type)" class="axis" aria-hidden="true"
              ><TypeIcon :type="col.type"
            /></span>
            <span v-else v-tip="typeName(col.type)" class="axis" aria-hidden="true"><TypeIcon :type="col.type" /></span>
            <span class="side down" :style="{ '--n': col.down.length }" aria-hidden="true"
              ><template v-for="b in col.down" :key="b.key"
                ><span v-if="wide" v-tip:group.left="b.tip" class="block" :class="b.cls"
                  ><PokemonIcon :id="b.pokemon" :scale="0.75" /></span
                ><span v-else v-tip="b.tip" class="block" :class="b.cls"
                  ><PokemonIcon :id="b.pokemon" :scale="0.75" /></span></template
            ></span>
          </div>
        </div>
        <p class="legend muted">
          <span v-for="(side, s) in [c.legend.up, c.legend.down]" :key="s" class="legend-side">
            <span class="arrow across" aria-hidden="true">{{ s ? '▼' : '▲' }}</span
            ><span class="arrow down-the-side" aria-hidden="true">{{ s ? '◀' : '▶' }}</span>
            <template v-for="l in side" :key="l.m">
              <span v-if="l.m >= 0" class="mult-tag" :class="c.id === 'def' ? defClass(l.m) : multClass(l.m)">{{
                formatMult(l.m)
              }}</span>
              <span v-if="l.label">{{ l.label }}</span>
            </template>
          </span>
          <span v-if="c.id === 'atk'" class="legend-side"
            ><span class="swatch stab m-2" aria-hidden="true"></span>{{ t('builder.coverage.stab') }}</span
          >
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.coverage {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr));
  gap: 16px 24px;
}
.chart {
  /* A block whole (an icon's size, at three quarters), and the sliver of each behind it. */
  --icon-w: 30px;
  --whole: 23px;
  --peek: 7px;
  --side: calc(var(--whole) + (var(--most) - 1) * var(--peek));
  --axis: 24px;
  container-type: inline-size;
  min-width: 0;
}
.chart h2 {
  margin: 0 0 10px;
}
.empty {
  margin: 0;
}
.cols {
  position: relative;
  display: flex;
  gap: 3px;
}
.col {
  flex: 1;
  display: grid;
  grid-template-rows: var(--side) var(--axis) var(--side);
  grid-template-areas: 'up' 'axis' 'down';
  justify-items: center;
  position: relative;
}
/* The rest of the panel dimmed while a column is opened out, to set it apart. */
.coverage :is(h2, .legend, .col) {
  transition: opacity 0.18s ease;
}
.focused :is(h2, .legend, .col:not(.open)) {
  opacity: 0.3;
}
/* Opened out over what's around it. */
.col.open {
  z-index: 2;
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
}
.side {
  display: flex;
  /* As wide as an icon, or the column where it's narrower (the icon cropped to its middle). */
  width: min(var(--icon-w), 100%);
}
.up {
  grid-area: up;
  flex-direction: column-reverse;
}
.down {
  grid-area: down;
  flex-direction: column;
}
.axis {
  grid-area: axis;
  justify-self: stretch;
  justify-content: center;
  /* Small badges whatever the screen, so the 18 fit across. */
  --icon-scale: 1;
  position: relative;
  display: flex;
  align-items: center;
}
/* The line the bars stand on, a stretch per column behind its badge (and across the gap to the next), so a column
   dimmed dims its stretch with it, and its badge, though faint, still hides it. */
.axis::before {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: calc(50% - 1px);
  height: 2px;
  background: var(--ink);
}
.axis :deep(.type-icon) {
  position: relative;
}
.block {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  height: var(--peek);
  border: 1px solid var(--ink);
  transition:
    height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
    width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.block:first-child,
.open .block {
  height: var(--whole);
}
.block :deep(.sheet-icon) {
  transition: opacity 0.18s ease;
}
/* The slivers' icons shown only opened out. */
.col:not(.open) .block:not(:first-child) :deep(.sheet-icon) {
  opacity: 0;
}
.up .block + .block {
  margin-bottom: -1px;
}
.down .block + .block {
  margin-top: -1px;
}
.open .side {
  filter: drop-shadow(2px 2px 0 var(--ink));
}
/* STAB: a dot in the block's corner, clear of its icon. */
:is(.block, .swatch).stab {
  background-image: radial-gradient(circle at right 4px top 3px, var(--m2-fg) 0 2px, transparent 2.5px);
}
@media (prefers-reduced-motion: reduce) {
  .block,
  .block :deep(.sheet-icon),
  .coverage :is(h2, .legend, .col) {
    transition: none;
  }
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 10px 0 0;
  font-size: 0.85em;
}
.legend-side {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend .mult-tag {
  min-width: 2.2em;
}
.legend .swatch {
  display: inline-block;
  width: 18px;
  height: 14px;
  border: 1px solid var(--ink);
}
.arrow {
  font-size: 0.8em;
}
/* Which way each side lies: up and down, or, the line standing up, right and left. */
.down-the-side {
  display: none;
}

/* Narrow, the line stands up: a row per type, what's good (the upper side) to the right. */
@container (max-width: 520px) {
  .chart {
    --peek: 8px;
  }
  .cols {
    flex-direction: column;
    gap: 3px;
    /* The badge as large as the page's elsewhere. */
    --badge: calc(26px * var(--icon-scale, 1));
    /* The room each side has: a bar opened out shares it. */
    --room: calc((100cqi - var(--badge) - 8px) / 2);
  }
  .col {
    grid-template-rows: none;
    grid-template-columns: minmax(0, 1fr) calc(var(--badge) + 8px) minmax(0, 1fr);
    grid-template-areas: 'down axis up';
    align-items: center;
  }
  .axis {
    align-self: stretch;
    justify-content: center;
    /* A badge's own scale: the axis' is pinned to 1 when the line lies down. */
    --icon-scale: inherit;
  }
  /* The line standing up, row by row. */
  .axis::before {
    top: -2px;
    bottom: -2px;
    left: calc(50% - 1px);
    right: auto;
    width: 2px;
    height: auto;
  }
  .side {
    width: auto;
    /* As tall as the type badge beside it. */
    height: calc(20px * var(--icon-scale, 1));
  }
  .up {
    flex-direction: row;
    justify-self: start;
  }
  .down {
    flex-direction: row-reverse;
    justify-self: end;
  }
  .block,
  .block:first-child,
  .open .block {
    height: auto;
  }
  .block {
    width: var(--peek);
  }
  .block:first-child {
    width: var(--icon-w);
  }
  /* Opened out, the icons whole while they fit the side's room, else sharing it (cropped to their middles). */
  .open .block {
    width: min(var(--icon-w), var(--room) / var(--n));
  }
  .up .block + .block {
    margin: 0 0 0 -1px;
  }
  .down .block + .block {
    margin: 0 -1px 0 0;
  }
  .across {
    display: none;
  }
  .down-the-side {
    display: inline;
  }
}
</style>
