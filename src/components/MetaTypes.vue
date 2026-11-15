<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { TYPES, type TypeId } from '@/data/types'
import { t, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { pokemon } from '@/data/dex'
import { points, STEADY } from '@/lib/entryUsage'
import { metaTypes, type Pressure, type TypeShare } from '@/lib/metaTypes'
import { useUnfolded } from '@/composables/useUnfolded'
import MoreToggle from '@/components/MoreToggle.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeGlyph from '@/components/TypeGlyph'
import TypeIcon from '@/components/TypeIcon'

// The rankings' Types panel: how the meta leans by type, every number weighted by usage, a Mega counting apart from the
// Pokémon it changes from (`src/lib/metaTypes.ts`). Two cards: the meta's Pokémon, by their types (each type alone,
// a dual type counting for both), by their combinations (a chart of every pair, the most common listed under it), or by
// what they're weak to; and its attacks, by their types or against each defending type. Each choice remembered.
const props = defineProps<{ data: MetaData; prevData?: MetaData | null; since?: string }>()

type MonMode = 'single' | 'dual' | 'weak'
type AtkMode = 'types' | 'against'
const MON_KEY = 'sproutvgc.usage.typesMode'
const ATK_KEY = 'sproutvgc.usage.attacksMode'
function saved<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return values.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function remember(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}
const monMode = shallowRef<MonMode>(saved(MON_KEY, ['single', 'dual', 'weak'] as const, 'single'))
const atkMode = shallowRef<AtkMode>(saved(ATK_KEY, ['types', 'against'] as const, 'types'))
watch(monMode, (v) => remember(MON_KEY, v))
watch(atkMode, (v) => remember(ATK_KEY, v))
const monModes = computed(() => [
  { value: 'single' as const, label: t('metaTypes.single') },
  { value: 'dual' as const, label: t('metaTypes.dual') },
  { value: 'weak' as const, label: t('metaTypes.weakTo') },
])
const atkModes = computed(() => [
  { value: 'types' as const, label: t('metaTypes.attackTypes') },
  { value: 'against' as const, label: t('metaTypes.against') },
])

/** What each card's numbers are, for the choice shown: its heading's tooltip. */
const monAbout = computed(() =>
  t(
    monMode.value === 'single'
      ? 'metaTypes.singleAbout'
      : monMode.value === 'dual'
        ? 'metaTypes.dualAbout'
        : 'metaTypes.weakAbout',
  ),
)
const atkAbout = computed(() => t(atkMode.value === 'types' ? 'metaTypes.attacksAbout' : 'metaTypes.againstAbout'))

const types = computed(() => metaTypes(props.data, props.prevData))
const hasChange = computed(() => !!props.prevData)

/** Each list's first rows until unfolded, remembered for the visit. */
const FOLDED = 10
const monAll = useUnfolded('rankings:types:pokemon')
const atkAll = useUnfolded('rankings:types:attacks')
const fold = <T,>(list: readonly T[], all: boolean) => (all ? list : list.slice(0, FOLDED))

/** The longest bar of a list, the full width. */
const most = (list: readonly { share: number }[]) => Math.max(1e-9, ...list.map((x) => x.share))
const name = (id: PokemonId) => refName(pokemon(id))
const comboName = (ts: readonly TypeId[]) => ts.map(typeName).join('/')
const changeClass = (c?: number) => (c === undefined || Math.abs(c) < STEADY ? '' : c > 0 ? 'up' : 'down')

// The combinations' chart: a row per first type and a column per second, in `TYPES` order, the diagonal those of
// that type alone; only its lower half, each pair once. A cell's shade grows with its share (by its square root, so
// the rarer pairs still show against the most common).
const dualBy = computed(() => new Map(types.value.dual.map((x) => [x.key, x])))
const dualMost = computed(() => most(types.value.dual))
const cell = (i: number, j: number) => dualBy.value.get(i === j ? TYPES[i]! : `${TYPES[j]}/${TYPES[i]}`)
const shade = (x?: TypeShare<string>) => (x ? Math.sqrt(x.share / dualMost.value) : 0)
const cellTip = (x: TypeShare<string> | undefined, i: number, j: number) => {
  const ts = i === j ? [TYPES[i]!] : [TYPES[j]!, TYPES[i]!]
  if (!x) return t('metaTypes.cellNone', { types: comboName(ts) })
  return t('metaTypes.cellTip', {
    types: comboName(ts),
    share: percent(x.share),
    mons: x.top.map(name).join(', '),
  })
}
const DUAL_LISTED = 8

const pressureMost = (list: readonly Pressure[]) => Math.max(1e-9, ...list.map((p) => Math.max(p.weak, p.resisted)))
</script>

<template>
  <section class="panel banded meta-types">
    <h2 class="band">{{ t('metaTypes.title') }}</h2>
    <div class="cards">
      <!-- The meta's Pokémon by their types. -->
      <section class="card">
        <header class="card-head">
          <h3 v-tip="monAbout" class="tipped" tabindex="0">{{ t('metaTypes.pokemon') }}</h3>
          <SegmentedControl v-model="monMode" class="soft mode" :label="t('metaTypes.show')" :options="monModes" />
        </header>
        <template v-if="monMode === 'single'">
          <ol class="bars">
            <li v-for="x in fold(types.single, monAll)" :key="x.key" class="bar-row">
              <span class="badges"><TypeIcon :type="x.key" /></span>
              <span class="track"
                ><span class="fill" :data-type="x.key" :style="{ '--w': x.share / most(types.single) }"></span
              ></span>
              <span class="num pct">{{ percent(x.share) }}</span>
              <span class="num change" :class="changeClass(x.change)">{{
                hasChange ? points(x.change ?? 0) : ''
              }}</span>
              <span class="tops"
                ><PokemonIcon v-for="p in x.top" :id="p" :key="p" v-tip:group="name(p)" :scale="0.75"
              /></span>
            </li>
          </ol>
          <MoreToggle v-model:all="monAll" :n="types.single.length" :top="FOLDED" />
        </template>
        <template v-else-if="monMode === 'dual'">
          <div class="grid-scroll">
            <div class="grid" role="table" :aria-label="t('metaTypes.dual')">
              <div class="row" role="row">
                <span class="corner" role="columnheader"></span>
                <span
                  v-for="ty in TYPES"
                  :key="ty"
                  class="hd colh"
                  :data-type="ty"
                  role="columnheader"
                  :aria-label="typeName(ty)"
                  ><TypeGlyph :type="ty"
                /></span>
              </div>
              <div v-for="(ty, i) in TYPES" :key="ty" class="row" role="row">
                <span class="hd rowh" :data-type="ty" role="rowheader" :aria-label="typeName(ty)"
                  ><TypeGlyph :type="ty"
                /></span>
                <template v-for="(_, j) in TYPES" :key="j">
                  <span
                    v-if="j <= i"
                    v-tip:group="cellTip(cell(i, j), i, j)"
                    class="cell"
                    :class="{ mono: i === j, empty: !cell(i, j), strong: shade(cell(i, j)) > 0.6 }"
                    :style="{ '--v': shade(cell(i, j)) }"
                    role="cell"
                    ><span v-if="cell(i, j) && cell(i, j)!.share >= 0.005" class="cell-num">{{
                      Math.round(cell(i, j)!.share * 100)
                    }}</span></span
                  >
                  <span v-else class="blank" role="cell"></span>
                </template>
              </div>
            </div>
          </div>
          <p class="fine">{{ t('metaTypes.dualKey') }}</p>
          <h4 class="sub">{{ t('metaTypes.dualTop') }}</h4>
          <ol class="bars pairs">
            <li v-for="x in types.dual.slice(0, DUAL_LISTED)" :key="x.key" class="bar-row">
              <span class="badges"><TypeIcon v-for="ty in x.types" :key="ty" :type="ty" /></span>
              <span class="track"
                ><span class="fill split" :style="{ '--w': x.share / dualMost }"
                  ><span v-for="ty in x.types" :key="ty" :data-type="ty"></span></span
              ></span>
              <span class="num pct">{{ percent(x.share) }}</span>
              <span class="num change" :class="changeClass(x.change)">{{
                hasChange ? points(x.change ?? 0) : ''
              }}</span>
              <span class="tops"
                ><PokemonIcon v-for="p in x.top" :id="p" :key="p" v-tip:group="name(p)" :scale="0.75"
              /></span>
            </li>
          </ol>
        </template>
        <template v-else>
          <div class="legend">
            <span><i class="sw weak"></i>{{ t('metaTypes.weakShare') }}</span>
            <span><i class="sw resisted"></i>{{ t('metaTypes.resistShare') }}</span>
          </div>
          <ol class="bars press-list">
            <li v-for="p in fold(types.weakTo, monAll)" :key="p.type" class="bar-row press">
              <span class="badges"><TypeIcon :type="p.type" /></span>
              <span
                v-tip:group="
                  t('metaTypes.weakToTip', {
                    type: typeName(p.type),
                    weak: percent(p.weak),
                    resisted: percent(p.resisted),
                  })
                "
                class="diverge"
                :style="{
                  '--weak': p.weak / pressureMost(types.weakTo),
                  '--res': p.resisted / pressureMost(types.weakTo),
                }"
                ><span class="half left"><span class="fill resisted"></span></span
                ><span class="half right"><span class="fill weak"></span></span
              ></span>
              <span class="num pct">{{ percent(p.weak) }}</span>
              <span class="num change" :class="changeClass(p.change)">{{
                hasChange ? points(p.change ?? 0) : ''
              }}</span>
            </li>
          </ol>
          <MoreToggle v-model:all="monAll" :n="types.weakTo.length" :top="FOLDED" />
        </template>
      </section>

      <!-- Its attacks. -->
      <section class="card">
        <header class="card-head">
          <h3 v-tip="atkAbout" class="tipped" tabindex="0">{{ t('metaTypes.attacks') }}</h3>
          <SegmentedControl v-model="atkMode" class="soft mode" :label="t('metaTypes.show')" :options="atkModes" />
        </header>
        <template v-if="atkMode === 'types'">
          <ol class="bars">
            <li v-for="x in fold(types.attacks, atkAll)" :key="x.key" class="bar-row">
              <span class="badges"><TypeIcon :type="x.key" /></span>
              <span class="track"
                ><span class="fill" :data-type="x.key" :style="{ '--w': x.share / most(types.attacks) }"></span
              ></span>
              <span class="num pct">{{ percent(x.share) }}</span>
              <span class="num change" :class="changeClass(x.change)">{{
                hasChange ? points(x.change ?? 0) : ''
              }}</span>
              <span class="tops"
                ><PokemonIcon v-for="p in x.top" :id="p" :key="p" v-tip:group="name(p)" :scale="0.75"
              /></span>
            </li>
          </ol>
          <MoreToggle v-model:all="atkAll" :n="types.attacks.length" :top="FOLDED" />
        </template>
        <template v-else>
          <div class="legend">
            <span><i class="sw weak"></i>{{ t('metaTypes.hitShare') }}</span>
            <span><i class="sw resisted"></i>{{ t('metaTypes.resistedShare') }}</span>
          </div>
          <ol class="bars press-list">
            <li v-for="p in fold(types.pressure, atkAll)" :key="p.type" class="bar-row press">
              <span class="badges"><TypeIcon :type="p.type" /></span>
              <span
                v-tip:group="
                  t('metaTypes.againstTip', {
                    type: typeName(p.type),
                    weak: percent(p.weak),
                    resisted: percent(p.resisted),
                  })
                "
                class="diverge"
                :style="{
                  '--weak': p.weak / pressureMost(types.pressure),
                  '--res': p.resisted / pressureMost(types.pressure),
                }"
                ><span class="half left"><span class="fill resisted"></span></span
                ><span class="half right"><span class="fill weak"></span></span
              ></span>
              <span class="num pct">{{ percent(p.weak) }}</span>
              <span class="num change" :class="changeClass(p.change)">{{
                hasChange ? points(p.change ?? 0) : ''
              }}</span>
            </li>
          </ol>
          <MoreToggle v-model:all="atkAll" :n="types.pressure.length" :top="FOLDED" />
        </template>
      </section>
    </div>
    <p v-if="hasChange && since" class="fine">{{ t('metaTypes.changeSince', { dates: since }) }}</p>
  </section>
</template>

<style scoped>
.band {
  font-size: 1rem;
}
.cards {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 1000px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
.card {
  container-type: inline-size;
  min-width: 0;
  padding: 12px 14px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 10px;
}
.card-head h3 {
  margin: 0;
  font-size: 0.78em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.mode {
  margin-left: auto;
  font-size: 0.9em;
}
/* A card's heading: what its numbers are, for the choice shown, on hover (tapped on phones). */
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
.fine {
  margin: 8px 0 0;
  font-size: 0.8em;
  color: var(--muted);
}
.sub {
  margin: 14px 0 6px;
  font-size: 0.78em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

/* A row per type (or pair): its badge, a bar of its share in its color against the list's biggest, the share, its
   change and the Pokémon adding most to it. */
.bars {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  gap: 4px 8px;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bar-row {
  display: contents;
}
.badges {
  display: flex;
  gap: 2px;
}
/* The pairs' list: room for two badges, so a type alone's bar starts level with the rest. */
.bars.pairs .badges {
  min-width: calc(54px * var(--icon-scale, 1));
}
.track {
  position: relative;
  height: 12px;
  background: color-mix(in srgb, var(--border) 45%, transparent);
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--w, 0));
  background: var(--tc, var(--accent));
}
/* A pair's bar: its two types' colors, half each. */
.fill.split {
  display: flex;
  background: none;
}
.fill.split > span {
  flex: 1;
  background: var(--tc);
}
.pct {
  min-width: 3.4em;
  font-weight: bold;
  text-align: right;
}
.change {
  min-width: 2.6em;
  font-size: 0.85em;
  color: var(--muted);
  text-align: right;
}
.change.up {
  color: var(--good);
}
.change.down {
  color: var(--bad);
}
.tops {
  display: flex;
  min-width: calc(3 * 30px);
}
/* The matchups' rows have no Pokémon at their end. */
.bars.press-list {
  grid-template-columns: auto minmax(0, 1fr) auto auto;
}
/* Resisted to the left of the middle, super effective to its right, each against the list's biggest. */
.diverge {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 12px;
}
.half {
  position: relative;
  background: color-mix(in srgb, var(--border) 45%, transparent);
}
.half.left {
  border-right: 1px solid var(--ink, var(--text));
}
.half .fill {
  background: none;
}
.half.left .fill {
  inset: 0 0 0 auto;
  width: calc(100% * var(--res, 0));
}
.half.right .fill {
  width: calc(100% * var(--weak, 0));
}
.fill.weak,
.sw.weak {
  background: var(--m2-bg);
}
.fill.resisted,
.sw.resisted {
  background: var(--m05-bg);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0 0 8px;
  font-size: 0.85em;
  color: var(--muted);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.sw {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid var(--border);
}

/* The combinations' chart: a type's color heading each row and column, each cell shaded by its share. */
.grid {
  display: grid;
  grid-template-columns: repeat(19, minmax(0, 1fr));
  gap: 1px;
  max-width: 560px;
}
.grid .row {
  display: contents;
}
.hd {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  color: #ffffff;
  background: var(--tc);
}
.hd :deep(.type-glyph) {
  width: 70%;
  height: 70%;
}
.cell {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  background: color-mix(in srgb, var(--accent) calc(var(--v, 0) * 100%), var(--panel));
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  cursor: default;
}
.cell.mono {
  outline: 1px solid var(--muted);
  outline-offset: -1px;
}
.cell.empty {
  background: var(--panel);
}
.cell-num {
  font-size: 0.62em;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.cell.strong .cell-num {
  color: #ffffff;
}
/* Phones: cells and headers big enough to read and tap, the chart scrolling within a box of its own, its headers
   stuck to its top and left (and covering the gaps between them, so what scrolls under them doesn't show through). */
@media (max-width: 720px) {
  .grid-scroll {
    max-height: 70vh;
    overflow: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--border);
    background: var(--panel-alt);
  }
  .grid {
    grid-template-columns: repeat(19, 34px);
    width: max-content;
    max-width: none;
  }
  .hd :deep(.type-glyph) {
    width: 22px;
    height: 22px;
  }
  .colh,
  .rowh,
  .corner {
    position: sticky;
    z-index: 1;
    box-shadow: 0 0 0 1px var(--panel-alt);
  }
  .colh {
    top: 0;
  }
  .rowh {
    left: 0;
  }
  .corner {
    top: 0;
    left: 0;
    z-index: 2;
    background: var(--panel-alt);
  }
  .cell-num {
    font-size: 0.72em;
  }
}
@container (max-width: 360px) {
  .tops {
    min-width: 0;
  }
  .tops :deep(.sheet-icon:nth-child(n + 3)) {
    display: none;
  }
}
</style>
