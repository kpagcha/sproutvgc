<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useIntersectionObserver, watchDebounced } from '@vueuse/core'
import { ability as abilityRef, condition, move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { loadLearnsets, movesOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { abilityOf, BOOSTED, battlerOf, type Battlefield, type Fighter } from '@/lib/damage'
import { conditionName, fieldOf, sideOf, terrainOf, weatherOf } from '@/components/calcConditions'
import { setsAs } from '@/lib/team'
import { runThreats, threatMoves, threatSteps, type Threat } from '@/lib/threats'
import MoreToggle from '@/components/MoreToggle.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeIcon from '@/components/TypeIcon'

// The threats: every damaging move the opponent learns against yours, at its sets in the meta shown (`threats.ts`),
// each with its damage, the chance it knocks yours out in one hit and in two, and how often its sets run it; sorted by
// threat (the likeliest knockout first) or by usage. Or at its team sheet (`sheet`, the page's URL's): its item, ability,
// nature and moves as its set on the calc has them, as an open team sheet shows them, its stat points what varies.
// Everything the calc has set counts (both sides' stages, status, HP, allies fainted, times hit and what's on their side,
// the field, and the options set on its moves' rows, the side's `hitOpts`), named over the table. Worked out a slice at a time,
// once the section is near the screen and the sides have settled (a slider dragged doesn't start it over at every
// step), what it showed kept, faded, until the new one's in. Its first 10 until unfolded.
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  field: Battlefield
  data: MetaData | null
}>()

type Sort = 'threat' | 'usage'
const SORT_KEY = 'sproutvgc.calc.threatSort'
const sort = shallowRef<Sort>('threat')
try {
  const s = localStorage.getItem(SORT_KEY)
  if (s === 'threat' || s === 'usage') sort.value = s
} catch {
  // Storage unavailable: as it is.
}
watch(sort, (s) => {
  try {
    localStorage.setItem(SORT_KEY, s)
  } catch {
    // Storage unavailable: for this visit.
  }
})
/** At its team sheet: the page's, in its URL (`?sheet=1`). */
const sheet = defineModel<boolean>('sheet', { default: false })
const sorts = computed(() => [
  { value: 'threat' as const, label: t('calc.threats.byThreat') },
  { value: 'usage' as const, label: t('calc.threats.byUsage') },
])

const theirId = computed(() => battlerOf(props.theirs))
const yourId = computed(() => battlerOf(props.yours))
const name = (id: PokemonId) => refName(pokemon(id))

// Worked out only once the section is near the screen: nothing spent on it while reading the sides.
const root = useTemplateRef<HTMLElement>('root')
const near = shallowRef(false)
useIntersectionObserver(root, ([e]) => e?.isIntersecting && (near.value = true), { rootMargin: '600px 0px' })

const learnsets = shallowRef<Awaited<ReturnType<typeof loadLearnsets>> | null>(null)
watch(near, (n) => n && void loadLearnsets().then((l) => (learnsets.value = l)), { immediate: true })

const rows = shallowRef<Threat[] | null>(null)
/** How far the work in hand has got, 0 to 1; null when none is. */
const progress = shallowRef<number | null>(null)
let stop: (() => void) | null = null
onUnmounted(() => stop?.())

function start() {
  stop?.()
  stop = null
  const id = theirId.value
  if (!near.value || !learnsets.value || !id || !yourId.value) return
  const moves = threatMoves(movesOf(learnsets.value, id), props.theirs, sheet.value)
  const entry = props.data?.[setsAs(props.theirs.member) ?? id] ?? undefined
  progress.value = 0
  stop = runThreats(
    threatSteps(props.theirs, props.yours, props.field, entry, moves, {
      sheet: sheet.value,
      moveOpts: props.theirs.hitOpts,
    }),
    moves.length,
    (p) => (progress.value = p),
    (r) => {
      rows.value = r
      progress.value = null
      stop = null
    },
  )
}
// Its inputs changed: worked out again once they've settled; another Pokémon, what it showed for the last one goes.
watch(theirId, () => (rows.value = null))
watchDebounced(
  () => [props.yours, props.theirs, props.field, props.data, sheet.value, near.value, learnsets.value] as const,
  start,
  { debounce: 150, immediate: true },
)

/** The likeliest knockout first: in one hit, then in two, then the most damage. */
const byThreat = (x: Threat, y: Threat) => y.ohko - x.ohko || y.two - x.two || y.maxPct - x.maxPct
const sorted = computed(() =>
  [...(rows.value ?? [])].sort(
    sort.value === 'usage' ? (x, y) => (y.run ?? -1) - (x.run ?? -1) || byThreat(x, y) : byThreat,
  ),
)
const ohkoCount = computed(() => (rows.value ?? []).filter((r) => r.ohko > 0))
const ohkoRun = computed(() => ohkoCount.value.filter((r) => r.run !== null))
/** Whether the data shown has its sets' moves: a move missing from them is run on under 1% of its sets. */
const hasMoves = computed(() => {
  const id = theirId.value
  return !!id && !!props.data?.[setsAs(props.theirs.member) ?? id]?.moves?.length
})

/** A side's stages in short: "+1 Atk", "−2 SpD". */
const stagesOf = (f: Fighter) =>
  BOOSTED.flatMap((stat, i) => {
    const n = f.boosts[i]!
    return n ? [`${n > 0 ? '+' : '−'}${Math.abs(n)} ${t(`stat.${stat}`)}`] : []
  })
/**
 * What the calc has set that counts, by whose it is: each side's stages, status, HP left, allies fainted, times hit,
 * its ability's condition met and what's on its side; the field's weather, terrain and the rest; and its moves set on
 * their rows (a critical hit and the like). Only what's set.
 */
const counted = computed(() => {
  const side = (f: Fighter, attacking: boolean) => {
    const list = stagesOf(f)
    if (f.status) list.push(refName(condition(f.status)))
    if (f.hp < 100) list.push(t('calc.threats.hp', { n: f.hp }))
    if (attacking && f.fainted) list.push(t('calc.threats.fainted', { n: f.fainted }))
    if (attacking && f.attacked) list.push(t('calc.threats.attacked', { n: f.attacked }))
    const a = abilityOf(f)
    if (f.abilityOn && a) list.push(t('calc.abilityOn', { ability: refName(abilityRef(a)) }))
    for (const e of f.side) {
      const c = sideOf(e)
      if (c) list.push(conditionName(c))
    }
    if (f.spikes) list.push(`${refName(condition('spikes'))} ×${f.spikes}`)
    return list
  }
  const field: string[] = []
  const w = props.field.weather && weatherOf(props.field.weather)
  if (w) field.push(conditionName(w))
  const tr = props.field.terrain && terrainOf(props.field.terrain)
  if (tr) field.push(conditionName(tr))
  for (const e of props.field.effects) {
    const c = fieldOf(e)
    if (c) field.push(conditionName(c))
  }
  const moves = Object.entries(props.theirs.hitOpts ?? {})
    .filter(([, o]) => o && (o.crit || o.doubled || o.single || o.hits || o.stockpile))
    .map(([mv]) => moveName(mv as MoveId))
  return [
    { who: theirId.value ? name(theirId.value) : '', list: side(props.theirs, true) },
    { who: yourId.value ? name(yourId.value) : '', list: side(props.yours, false) },
    { who: t('calc.section.field'), list: field },
    { who: t('calc.threats.moveOpts'), list: moves },
  ].filter((g) => g.list.length)
})

/** A chance in short: none, under 1%, else to the percent. */
const chance = (x: number) => (x <= 0 ? '—' : x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`)
const kind = (r: Threat) => (r.ohko >= 0.5 ? 'ohko' : r.ohko > 0 ? 'maybe' : r.two >= 0.5 ? 'two' : '')
const moveName = (id: MoveId) => refName(move(id))

const TOP = 10
const all = shallowRef(false)
</script>

<template>
  <section ref="root" class="panel threats">
    <div class="threats-head">
      <h2>
        <span
          v-tip="theirId && yourId ? t('calc.threats.about', { name: name(theirId), yours: name(yourId) }) : undefined"
          class="about"
          tabindex="0"
          >{{ t('calc.threats.title') }}</span
        >
      </h2>
      <span class="controls">
        <!-- At its team sheet: its item, ability, nature and moves as set on the calc. -->
        <button
          v-tip="t('calc.threats.sheetTip')"
          type="button"
          class="btn switch sheet"
          :class="{ on: sheet }"
          :aria-pressed="sheet"
          @click="sheet = !sheet"
        >
          {{ t('calc.threats.sheet') }}
        </button>
        <SegmentedControl v-model="sort" class="soft" :label="t('calc.threats.sort')" :options="sorts" />
      </span>
    </div>
    <p v-if="!theirId || !yourId" class="muted intro">{{ t('calc.threats.pickBoth') }}</p>
    <template v-else>
      <!-- Working it out: how far it's got, what it showed before faded under it. -->
      <div v-if="progress !== null" class="progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)">
        <span :style="{ width: `${progress * 100}%` }"></span>
      </div>
      <!-- What it's at: its sets, or its team sheet; and what the calc has set that counts. -->
      <p class="muted intro">
        {{ sheet ? t('calc.threats.atSheet') : t('calc.threats.atSets') }}
      </p>
      <ul v-if="counted.length" class="counted">
        <li v-for="g in counted" :key="g.who">
          <span class="muted">{{ g.who }}</span>
          <span v-for="x in g.list" :key="x" class="chip">{{ x }}</span>
        </li>
      </ul>
      <p v-else class="muted small-note">{{ t('calc.threats.nothingSet') }}</p>
      <p v-if="sheet && rows && !rows.length && progress === null" class="muted intro">
        {{ t('calc.threats.noSheetMoves') }}
      </p>
      <template v-if="rows && rows.length">
        <p class="summary" :class="{ stale: progress !== null }">
          {{
            !ohkoCount.length
              ? t('calc.threats.none')
              : sheet
                ? t('calc.threats.summarySheet', { n: ohkoCount.length })
                : t('calc.threats.summary', { n: ohkoCount.length, run: ohkoRun.length })
          }}
        </p>
        <div class="table-wrap" :class="{ stale: progress !== null }">
          <table class="grid">
            <thead>
              <tr>
                <th scope="col">{{ t('calc.threats.move') }}</th>
                <th scope="col" class="num">{{ t('calc.threats.damage') }}</th>
                <th scope="col" class="num">
                  <span v-tip="t('calc.threats.ohkoTip')" class="about" tabindex="0">OHKO</span>
                </th>
                <th scope="col" class="num">
                  <span v-tip="t('calc.threats.twoTip')" class="about" tabindex="0">2HKO</span>
                </th>
                <th scope="col" class="num">
                  <span v-tip="t('calc.threats.runTip')" class="about" tabindex="0">{{ t('calc.threats.run') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sorted.slice(0, all ? undefined : TOP)" :key="r.move" :class="kind(r)">
                <th scope="row" class="move">
                  <span class="move-name"><TypeIcon :type="MOVES[r.move].type" />{{ moveName(r.move) }}</span>
                </th>
                <td class="num range">{{ r.minPct.toFixed(0) }}–{{ r.maxPct.toFixed(0) }}%</td>
                <td class="num ko">{{ chance(r.ohko) }}</td>
                <td class="num">{{ chance(r.two) }}</td>
                <td class="num">
                  <span v-if="r.run !== null">{{ percent(r.run) }}</span>
                  <span v-else class="muted">{{ hasMoves ? '<1%' : '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MoreToggle v-if="sorted.length > TOP" v-model:all="all" :n="sorted.length" :top="TOP" />
      </template>
    </template>
  </section>
</template>

<style scoped>
.threats {
  margin: 0;
}
.threats-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 16px;
}
.threats-head h2 {
  margin: 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-left: auto;
}
.sheet.on {
  background: var(--sel);
}
.counted {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0 0 10px;
  padding: 0;
  font-size: 0.85em;
  list-style: none;
}
.counted li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.chip {
  padding: 0 6px;
  border: 1px solid var(--border);
}
.small-note {
  margin: 0 0 10px;
  font-size: 0.8em;
}
.summary {
  margin: 0 0 8px;
  font-size: 0.9em;
  font-weight: bold;
}
.about {
  text-decoration: underline dotted;
  text-underline-offset: 4px;
  cursor: help;
}
.intro {
  margin: 6px 0 10px;
  font-size: 0.85em;
}
/* What it showed, while the new one's worked out. */
.stale {
  opacity: 0.5;
  transition: opacity 0.15s;
}
.progress {
  height: 3px;
  margin-top: 8px;
  background: var(--panel-alt);
}
.progress > span {
  display: block;
  height: 100%;
  background: var(--accent);
}
.table-wrap {
  overflow-x: auto;
}
.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}
.grid th,
.grid td {
  padding: 4px 6px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--border);
}
.grid thead th {
  font-weight: normal;
  color: var(--muted);
}
.grid .num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.move-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: bold;
  white-space: nowrap;
}
.ko {
  font-weight: bold;
}
/* Theirs knocking yours out is bad news: the row tinted by how likely, on each cell over the panel's color, so the
   move's cell, stuck on phones, hides what scrolls under it. */
.grid tbody th,
.grid tbody td {
  background: linear-gradient(var(--tint, transparent), var(--tint, transparent)), var(--panel);
}
tr.ohko {
  --tint: color-mix(in srgb, var(--bad) 22%, transparent);
}
tr.maybe {
  --tint: color-mix(in srgb, var(--bad) 12%, transparent);
}
tr.two {
  --tint: color-mix(in srgb, var(--bad) 5%, transparent);
}
@media (max-width: 720px) {
  .controls {
    margin-left: 0;
  }
  /* Narrow, the table scrolling sideways, each move kept in view at its left. */
  .grid .move,
  .grid thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 1;
  }
  .grid thead th:first-child {
    background: var(--panel);
  }
}
</style>
