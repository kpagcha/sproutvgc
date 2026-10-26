<script setup lang="ts">
import { computed, h, render, type VNodeChild } from 'vue'
import { move, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { t, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { defenseOf, offenseOf } from '@/lib/teamCoverage'
import type { Member } from '@/lib/team'
import { formatMult, multClass } from '@/lib/typecalc'
import TypeIcon from '@/components/TypeIcon'

// The team builder's type coverage, two charts over the 18 types on a line: defending, a block per Pokémon above the
// line for each type it resists (½×, ¼×, immune) and below it for each it's weak to (2×, 4×), colored as the type
// chart's cells but from the defender's side (resisting green, weak red); attacking, a block above for each Pokémon
// with a super effective move against the type, marked when it's STAB, and below for each whose every move it resists
// or is immune to. Narrow, the line stands up: the types down the side, what's good to their right. A block's tooltip
// names its Pokémon with its types, defending, or its moves with theirs, attacking.
const props = defineProps<{ members: readonly Member[] }>()

interface Block {
  key: string
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
  about: string
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
    about: t('builder.coverage.defenseAbout'),
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
      return { key: `${i}`, cls: multClass(mult), tip: atkTip(p, mult, moves, shown), stab: shown }
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
    about: t('builder.coverage.offenseAbout'),
    cols,
    most: Object.values(by)[0]!.length,
    legend: {
      up: [{ m: 2, label: t('builder.coverage.superEffective') }],
      down: [0.5, 0].map((m) => ({ m, label: '' })).concat({ m: -1, label: t('builder.coverage.resisted') }),
    },
  }
})

const charts = computed(() => [defense.value, offense.value])
const colLabel = (c: Chart, col: Column) =>
  t(c.id === 'def' ? 'builder.coverage.colDef' : 'builder.coverage.colAtk', {
    type: typeName(col.type),
    up: col.up.length,
    down: col.down.length,
  })
</script>

<template>
  <section class="panel coverage">
    <div v-for="c in charts" :key="c.id" class="chart" :style="{ '--most': Math.max(c.most, 1) }">
      <h2>{{ c.title }}</h2>
      <p class="muted about">{{ c.about }}</p>
      <p v-if="!c.most" class="muted empty">{{ t('builder.coverage.noMoves') }}</p>
      <template v-else>
        <div class="cols">
          <div v-for="col in c.cols" :key="col.type" class="col" role="img" :aria-label="colLabel(c, col)">
            <span class="side up" aria-hidden="true"
              ><span
                v-for="b in col.up"
                :key="b.key"
                v-tip:group="b.tip"
                class="block"
                :class="[b.cls, { stab: b.stab }]"
              ></span
            ></span>
            <span v-tip:group="typeName(col.type)" class="axis" aria-hidden="true"><TypeIcon :type="col.type" /></span>
            <span class="side down" aria-hidden="true"
              ><span v-for="b in col.down" :key="b.key" v-tip:group="b.tip" class="block" :class="b.cls"></span
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
            ><span class="block stab m-2 swatch" aria-hidden="true"></span>{{ t('builder.coverage.stab') }}</span
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
  --u: 13px;
  --axis: 24px;
  container-type: inline-size;
  min-width: 0;
}
.chart h2 {
  margin: 0;
}
.about {
  margin: 4px 0 10px;
  font-size: 0.9em;
}
.empty {
  margin: 0;
}
.cols {
  position: relative;
  display: flex;
  gap: 3px;
}
/* The line the bars stand on, through the types' badges. */
.cols::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--most) * var(--u) + var(--axis) / 2 - 1px);
  height: 2px;
  background: var(--ink);
}
.col {
  flex: 1;
  display: grid;
  grid-template-rows: calc(var(--most) * var(--u)) var(--axis) calc(var(--most) * var(--u));
  grid-template-areas: 'up' 'axis' 'down';
  justify-items: center;
  position: relative;
  /* Faint lines a block apart on either side, to count them by. */
  --grid: color-mix(in srgb, var(--border) 45%, transparent);
  background:
    repeating-linear-gradient(to top, var(--grid) 0 1px, transparent 1px var(--u)) 0 0 / 100%
      calc(var(--most) * var(--u)) no-repeat,
    repeating-linear-gradient(to bottom, var(--grid) 0 1px, transparent 1px var(--u)) 0 100% / 100%
      calc(var(--most) * var(--u)) no-repeat;
}
.col:hover {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
}
.side {
  display: flex;
  width: 18px;
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
  /* Small badges whatever the screen, so the 18 fit across. */
  --icon-scale: 1;
  position: relative;
  display: flex;
  align-items: center;
}
.block {
  flex: none;
  height: var(--u);
  border: 1px solid var(--ink);
}
.up .block + .block {
  margin-bottom: -1px;
}
.down .block + .block {
  margin-top: -1px;
}
/* STAB: a dot of ink in the block. */
.block.stab {
  background-image: radial-gradient(circle, var(--m2-fg) 0 2px, transparent 2.5px);
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
  .cols {
    flex-direction: column;
    gap: 3px;
    /* The badge as large as the page's elsewhere, the blocks as wide as fills the rest, up to a square-ish cap. */
    --badge: calc(26px * var(--icon-scale, 1));
    --u: clamp(12px, (100cqi - var(--badge) - 8px) / (2 * var(--most)), 28px);
  }
  /* The line drawn row by row, through each badge (the rows centered, so no one offset places it). */
  .cols::before {
    content: none;
  }
  .col {
    grid-template-rows: none;
    grid-template-columns: calc(var(--most) * var(--u)) calc(var(--badge) + 8px) calc(var(--most) * var(--u));
    grid-template-areas: 'down axis up';
    justify-content: center;
    align-items: center;
    /* The rows as wide as the container (100cqi), its three columns centered in it. */
    --side: calc(var(--most) * var(--u));
    --start: calc((100cqi - 2 * var(--side) - var(--badge) - 8px) / 2);
    background:
      repeating-linear-gradient(to left, var(--grid) 0 1px, transparent 1px var(--u)) var(--start) 0 / var(--side) 100%
        no-repeat,
      repeating-linear-gradient(to right, var(--grid) 0 1px, transparent 1px var(--u))
        calc(var(--start) + var(--side) + var(--badge) + 8px) 0 / var(--side) 100% no-repeat;
  }
  .axis {
    align-self: stretch;
    justify-content: center;
    /* A badge's own scale: the axis' is pinned to 1 when the line lies down. */
    --icon-scale: inherit;
  }
  .axis::before {
    content: '';
    position: absolute;
    top: -2px;
    bottom: -2px;
    left: calc(50% - 1px);
    width: 2px;
    background: var(--ink);
  }
  .axis :deep(.type-icon) {
    position: relative;
  }
  .side {
    width: auto;
    height: 20px;
  }
  .up {
    flex-direction: row;
    justify-self: start;
  }
  .down {
    flex-direction: row-reverse;
    justify-self: end;
  }
  .block {
    width: var(--u);
    height: auto;
  }
  .across {
    display: none;
  }
  .down-the-side {
    display: inline;
  }
  .up .block + .block {
    margin: 0 0 0 -1px;
  }
  .down .block + .block {
    margin: 0 -1px 0 0;
  }
}
</style>
