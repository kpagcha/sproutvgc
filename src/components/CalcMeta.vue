<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { splitForme } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, damaging, koKind, type Battlefield, type Fighter, type Hit } from '@/lib/damage'
import { dangerOf, leanOf, matchupSteps, shareOf, within, type Matchup } from '@/lib/metaMatchups'
import { runSliced } from '@/lib/slices'
import FolderTabs from '@/components/FolderTabs.vue'
import MoreToggle from '@/components/MoreToggle.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeIcon from '@/components/TypeIcon'

// Your Pokémon against the meta, the calculator's Meta tab: the most used Pokémon of the data shown, each at its most
// common set (`metaFoes`), on the calculator's field, theirs as they come in (the weather or terrain their ability sets
// over it). Two views: the matchups, a row each (your hardest hit on it, its hardest on yours, who moves first, and who
// wins trading them one on one, as a threat meter: `src/lib/metaMatchups.ts`), sorted by usage, by threat, by target or
// by danger (threat times usage); or your moves, a column each headed by how much of the meta, by usage, it knocks out
// in one hit and in two. Over them, how yours does against the whole of it. A row taps into the damage tab as the
// opponent. Its first 15 until unfolded.
const props = defineProps<{ yours: Fighter; field: Battlefield; data: MetaData | null }>()
const emit = defineEmits<{ pick: [f: Fighter] }>()

type View = 'matchups' | 'moves'
type Sort = 'usage' | 'threat' | 'target' | 'danger'
const TOPS = ['25', '50', '100'] as const
const VIEW_KEY = 'sproutvgc.calc.metaMode'
const TOP_KEY = 'sproutvgc.calc.metaTop'
const SORT_KEY = 'sproutvgc.calc.metaSort'
const view = shallowRef<View>('matchups')
const top = shallowRef<(typeof TOPS)[number]>('50')
const sort = shallowRef<Sort>('usage')
try {
  const v = localStorage.getItem(VIEW_KEY)
  if (v === 'matchups' || v === 'moves') view.value = v
  const n = localStorage.getItem(TOP_KEY)
  if ((TOPS as readonly (string | null)[]).includes(n)) top.value = n as (typeof TOPS)[number]
  const s = localStorage.getItem(SORT_KEY)
  if (s === 'usage' || s === 'threat' || s === 'target' || s === 'danger') sort.value = s
} catch {
  // Storage unavailable: as it is.
}
watch([view, top, sort], ([v, n, s]) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
    localStorage.setItem(TOP_KEY, n)
    localStorage.setItem(SORT_KEY, s)
  } catch {
    // Storage unavailable: for this visit.
  }
})
const views = computed(() => [
  { value: 'matchups' as const, label: t('calc.meta.matchups') },
  { value: 'moves' as const, label: t('calc.meta.byMove') },
])
const tops = computed(() => TOPS.map((n) => ({ value: n, label: n })))
const sorts = computed(() => [
  { value: 'usage' as const, label: t('calc.meta.sort.usage') },
  { value: 'danger' as const, label: t('calc.meta.sort.danger') },
  { value: 'threat' as const, label: t('calc.meta.sort.threat') },
  { value: 'target' as const, label: t('calc.meta.sort.target') },
])

const yourId = computed(() => battlerOf(props.yours))
const yourMoves = computed(() => props.yours.member.moves.filter(damaging))

// Worked out a slice at a time once the inputs settle (a slider dragged doesn't start it over at every step), a run
// gone stale dropped; the rows shown meanwhile those before, faded.
const rows = shallowRef<Matchup[] | null>(null)
const working = shallowRef(false)
let stop: (() => void) | null = null
function start() {
  stop?.()
  stop = null
  if (!yourId.value || !props.data) {
    rows.value = null
    working.value = false
    return
  }
  const n = Number(top.value)
  working.value = true
  stop = runSliced(
    matchupSteps(props.yours, props.data, n, props.field),
    n,
    () => {},
    (r) => {
      rows.value = r
      working.value = false
      stop = null
    },
  )
}
watch(yourId, () => (rows.value = null))
watch(() => [top.value, props.data] as const, start, { immediate: true })
watchDebounced(() => [props.yours, props.field] as const, start, { debounce: 150 })
onUnmounted(() => stop?.())

const sorted = computed(() => {
  const r = rows.value ?? []
  const by: Record<Sort, (a: Matchup, b: Matchup) => number> = {
    usage: (a, b) => b.usage - a.usage,
    threat: (a, b) => b.threat - a.threat || b.usage - a.usage,
    target: (a, b) => a.threat - b.threat || b.usage - a.usage,
    danger: (a, b) => dangerOf(b) - dangerOf(a) || b.usage - a.usage,
  }
  return [...r].sort(by[sort.value])
})

// How yours does against the whole of it, by usage.
const summary = computed(() => {
  const r = rows.value ?? []
  return {
    wins: shareOf(r, (m) => (m.threat < 0.45 ? 1 : 0)),
    loses: shareOf(r, (m) => (m.threat > 0.55 ? 1 : 0)),
    yourOne: shareOf(r, (m) => within(m.mine, 1)),
    yourTwo: shareOf(r, (m) => within(m.mine, 2)),
    theirOne: shareOf(r, (m) => within(m.theirs, 1)),
    theirTwo: shareOf(r, (m) => within(m.theirs, 2)),
  }
})
const moveSummaries = computed(() =>
  yourMoves.value.map((mv, j) => ({
    mv,
    one: shareOf(rows.value ?? [], (m) => within(m.hits[j], 1)),
    two: shareOf(rows.value ?? [], (m) => within(m.hits[j], 2)),
  })),
)

/** A verdict in a few characters: "OHKO", "62% 2HKO", "4HKO"; nothing past 4 hits. */
function short(h: Hit | null | undefined): string {
  if (!h || h.none) return t('calc.noEffect')
  if (!h.koHits || h.koHits > 4) return ''
  const n = h.koHits === 1 ? 'OHKO' : `${h.koHits}HKO`
  return h.koChance >= 1 ? n : `${Math.round(h.koChance * 100)}% ${n}`
}
const range = (h: Hit | null | undefined) => (h && !h.none ? `${h.minPct.toFixed(0)}–${h.maxPct.toFixed(0)}%` : '')
const pct = (x: number) => `${Math.round(x * 100)}%`

/** The meter in words, and its side to color it by. */
const VERDICTS = {
  target: 'calc.meta.wins',
  targetLikely: 'calc.meta.winsLikely',
  even: 'calc.meta.even',
  threatLikely: 'calc.meta.losesLikely',
  threat: 'calc.meta.loses',
} as const
const verdict = (m: Matchup) => t(VERDICTS[leanOf(m.threat)])
const lean = (m: Matchup) => (m.threat > 0.55 ? 'threat' : m.threat < 0.45 ? 'target' : 'even')
/** The meter's bar, from its middle: toward the right a threat, toward the left a target. */
const meterStyle = (m: Matchup) => {
  const w = Math.abs(m.threat - 0.5) * 100
  return m.threat >= 0.5 ? { left: '50%', width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` }
}
/** Why, its tooltip: the hits each needs to knock the other out (and the chance, when it isn't sure), and who moves
 * first. */
function hitsText(h: Hit | null | undefined): string {
  if (!h || h.none || !h.koHits) return t('calc.meta.why.noKo')
  const n = t(h.koHits === 1 ? 'calc.meta.why.hit' : 'calc.meta.why.hits', { n: h.koHits })
  return h.koChance >= 1 ? n : `${n} (${Math.round(h.koChance * 100)}%)`
}
const FIRST = { a: 'calc.meta.why.youFirst', b: 'calc.meta.why.itFirst', tie: 'calc.meta.why.tie' } as const
function why(m: Matchup): string {
  const parts = [
    t('calc.meta.why.you', { hits: hitsText(m.mine) }),
    t('calc.meta.why.it', { hits: hitsText(m.theirs) }),
  ]
  if (m.duel) parts.push(t(FIRST[m.duel.first]))
  return parts.join(' · ')
}

const TOP = 15
const all = shallowRef(false)
/** Its name, its forme apart, a chip under the species ("Charizard", "Mega-Y"), so the column stays narrow. */
const split = (id: PokemonId) => splitForme(id, refName(pokemon(id)))
/** Its usage, the share of teams with it, on hover alone: a tap picks it. */
const canHover = window.matchMedia('(hover: hover)').matches
const usageTip = (usage: number) => (canHover ? t('calc.meta.usageTip', { usage: percent(usage) }) : undefined)
const moveName = (id: MoveId) => refName(move(id))
</script>

<template>
  <section class="panel meta" :class="{ working: working && rows }">
    <!-- Its title, and how much of the meta it's against at the row's end. -->
    <div class="meta-head">
      <h2 class="meta-title">{{ t('calc.meta.title') }}</h2>
      <SegmentedControl v-model="top" class="soft" :label="t('calc.meta.top')" :options="tops" />
    </div>
    <p v-if="!yourId" class="muted intro">{{ t('calc.meta.pickYours') }}</p>
    <div v-if="yourId && rows" class="loads-in-stagger">
      <!-- How yours does against the whole of it, by usage: one on one, its hits, theirs. -->
      <div class="summary">
        <div class="stat">
          <span class="stat-label">{{ t('calc.meta.summary.duel') }}</span>
          <span class="stat-nums"
            ><span class="big">{{ pct(summary.wins) }}</span> {{ t('calc.meta.win') }}
            <span class="minor">{{ t('calc.meta.lose', { share: pct(summary.loses) }) }}</span></span
          >
          <span class="share-bar" aria-hidden="true"
            ><span class="good" :style="{ width: pct(summary.wins) }"></span><span class="rest"></span
            ><span class="bad" :style="{ width: pct(summary.loses) }"></span
          ></span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ t('calc.meta.summary.yours') }}</span>
          <span class="stat-nums"
            ><span class="big">{{ pct(summary.yourOne) }}</span> OHKO
            <span class="minor">{{ t('calc.meta.within2', { share: pct(summary.yourTwo) }) }}</span></span
          >
          <span class="share-bar" aria-hidden="true"
            ><span class="good" :style="{ width: pct(summary.yourOne) }"></span
            ><span class="good-light" :style="{ width: pct(Math.max(0, summary.yourTwo - summary.yourOne)) }"></span
          ></span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ t('calc.meta.summary.theirs') }}</span>
          <span class="stat-nums"
            ><span class="big">{{ pct(summary.theirOne) }}</span> OHKO
            <span class="minor">{{ t('calc.meta.within2', { share: pct(summary.theirTwo) }) }}</span></span
          >
          <span class="share-bar" aria-hidden="true"
            ><span class="bad" :style="{ width: pct(summary.theirOne) }"></span
            ><span class="bad-light" :style="{ width: pct(Math.max(0, summary.theirTwo - summary.theirOne)) }"></span
          ></span>
        </div>
      </div>

      <!-- Which table, folder tabs on a rule across the panel, the one shown joined to it; the matchups' sorting
           under it. -->
      <div class="view-tabs">
        <FolderTabs v-model="view" :label="t('calc.meta.show')" :options="views" />
      </div>
      <div v-if="view === 'matchups'" class="sort-row">
        <SegmentedControl
          v-model="sort"
          class="soft"
          :label="t('calc.meta.sort')"
          :tip="t('calc.meta.sortTip')"
          :options="sorts"
        />
      </div>

      <!-- The matchups, a row each. -->
      <template v-if="view === 'matchups'">
        <div class="table-wrap">
          <table class="grid matchups">
            <thead>
              <tr>
                <th class="who-col" scope="col">{{ t('calc.meta.pokemon') }}</th>
                <th scope="col" class="meter-col">
                  <span v-tip="t('calc.meta.threatTip')" class="tipped" tabindex="0">{{ t('calc.meta.threat') }}</span>
                </th>
                <th scope="col">{{ t('calc.meta.yourHit') }}</th>
                <th scope="col">{{ t('calc.meta.theirHit') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in sorted.slice(0, all ? undefined : TOP)" :key="m.id">
                <th scope="row" class="who-col">
                  <button v-tip="usageTip(m.usage)" type="button" class="who" @click="emit('pick', m.set)">
                    <PokemonIcon :id="m.id" />
                    <span class="who-text">
                      <span class="who-name">{{ split(m.id).species }}</span>
                      <span v-if="split(m.id).forme" class="forme">{{ split(m.id).forme }}</span>
                    </span>
                  </button>
                </th>
                <td v-tip="why(m)" class="meter-col" :class="lean(m)">
                  <span class="meter" aria-hidden="true"><span class="meter-fill" :style="meterStyle(m)"></span></span>
                  <span class="meter-text">{{ verdict(m) }}</span>
                </td>
                <td class="cell mine" :class="koKind(m.mine)">
                  <template v-if="m.mine">
                    <span class="cell-move"
                      ><TypeIcon :type="MOVES[m.mine.move].type" />{{ moveName(m.mine.move) }}</span
                    >
                    <span class="cell-ko">{{ short(m.mine) }}</span>
                    <span class="cell-range muted">{{ range(m.mine) }}</span>
                  </template>
                  <span v-else class="muted">{{ t('calc.meta.nothing') }}</span>
                </td>
                <td class="cell theirs" :class="koKind(m.theirs)">
                  <template v-if="m.theirs">
                    <span class="cell-move"
                      ><TypeIcon :type="MOVES[m.theirs.move].type" />{{ moveName(m.theirs.move) }}</span
                    >
                    <span class="cell-ko">{{ short(m.theirs) }}</span>
                    <span class="cell-range muted">{{ range(m.theirs) }}</span>
                  </template>
                  <span v-else class="muted">{{ t('calc.meta.nothing') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MoreToggle v-if="sorted.length > TOP" v-model:all="all" :n="sorted.length" :top="TOP" />
      </template>

      <!-- Your moves: a column each, headed by how much of the meta it knocks out. -->
      <template v-else>
        <p v-if="!yourMoves.length" class="muted">{{ t('calc.meta.noMoves') }}</p>
        <template v-else>
          <div class="table-wrap">
            <table class="grid by-move">
              <thead>
                <tr>
                  <th class="who-col" scope="col">{{ t('calc.meta.pokemon') }}</th>
                  <th v-for="s in moveSummaries" :key="s.mv" scope="col" class="move-col">
                    <span class="move-head"><TypeIcon :type="MOVES[s.mv].type" />{{ moveName(s.mv) }}</span>
                    <span class="ko-share">
                      <span class="share-bar" aria-hidden="true"
                        ><span class="good" :style="{ width: pct(s.one) }"></span
                        ><span class="good-light" :style="{ width: pct(Math.max(0, s.two - s.one)) }"></span
                      ></span>
                      <span class="share-text">{{
                        t('calc.meta.koShare', { one: percent(s.one), two: percent(s.two) })
                      }}</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in (rows ?? []).slice(0, all ? undefined : TOP)" :key="m.id">
                  <th scope="row" class="who-col">
                    <button v-tip="usageTip(m.usage)" type="button" class="who" @click="emit('pick', m.set)">
                      <PokemonIcon :id="m.id" />
                      <span class="who-text">
                        <span class="who-name">{{ split(m.id).species }}</span>
                        <span v-if="split(m.id).forme" class="forme">{{ split(m.id).forme }}</span>
                      </span>
                    </button>
                  </th>
                  <td v-for="(h, j) in m.hits" :key="j" class="cell" :class="koKind(h)">
                    <span class="cell-ko" :class="{ muted: !h || h.none }">{{ short(h) }}</span>
                    <span class="cell-range muted">{{ range(h) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <MoreToggle v-if="rows.length > TOP" v-model:all="all" :n="rows.length" :top="TOP" />
        </template>
      </template>
    </div>
    <p v-else-if="yourId && working" class="muted loads-in">{{ t('calc.meta.working') }}</p>
  </section>
</template>

<style scoped>
.meta {
  /* The summary's bars toned down: blended into the panel. */
  --good-fill: color-mix(in srgb, var(--good) 60%, var(--panel));
  --bad-fill: color-mix(in srgb, var(--bad) 60%, var(--panel));
  margin: 0;
  min-width: 0;
  transition: opacity 0.15s;
}
.meta.working {
  opacity: 0.6;
}
.meta-title {
  margin: 0;
  font-size: 1.1em;
}
/* Its title and the top shown on one row, the top at its end; under it where they don't fit. */
.meta-head {
  margin-bottom: 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}
/* Which table, as the calculator's own tabs: folder tabs on a rule, the one shown in the panel's color. */
.view-tabs {
  --tab-bg: var(--panel);
  margin-top: 4px;
  border-bottom: 2px solid var(--ink);
}
/* The matchups' sorting, at the end of the row under the tabs. */
.sort-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.view-tabs + .table-wrap,
.view-tabs + p,
.sort-row {
  margin-bottom: 8px;
}
.view-tabs + .table-wrap,
.view-tabs + p {
  margin-top: 8px;
}
.intro {
  margin: 6px 0 12px;
  font-size: 0.85em;
}
/* How yours does against the whole of it: three bars side by side, one under the other where they don't fit. */
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px 24px;
  margin-bottom: 18px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.stat-label {
  font-weight: bold;
  font-size: 0.85em;
}
/* Its headline number large, what it is after it, the other number smaller and muted. */
.stat-nums {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  font-size: 0.85em;
}
.big {
  font-size: 1.4em;
  font-weight: bold;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.minor {
  margin-left: 4px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
/* Under them, the summary's bars thin, a proportion to glance at, no outline. */
.summary .share-bar {
  height: 6px;
  margin-top: 2px;
  background: var(--border);
  border: 0;
  border-radius: 3px;
  overflow: hidden;
}
.table-wrap {
  overflow-x: auto;
}
.grid {
  --icon-scale: 1;
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
  padding-top: 8px;
  padding-bottom: 8px;
  vertical-align: bottom;
  font-weight: normal;
}
.who-col {
  width: 1%;
  white-space: nowrap;
}
.who {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  font: inherit;
  color: var(--link);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.who:hover .who-name {
  text-decoration: underline;
}
/* Its name and its forme's chip on one line where they fit in the column's widest, else the chip on the next: as
   wide as the two on one line (so the column sizes to it rather than to the narrowest it could wrap to), at most that
   width. */
.who-text {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  width: max-content;
  max-width: 9em;
  line-height: 1.2;
}
.who-name {
  font-weight: bold;
}
/* Its forme, as the rankings' tag (their size and line height, the cell's text being smaller). */
.forme {
  padding: 0 5px;
  font-size: 0.95em;
  line-height: 1.45;
  font-weight: normal;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.move-col {
  min-width: 9em;
}
.move-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: bold;
}
.ko-share {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  font-size: 0.85em;
}
/* How much of the meta: in one hit, solid; in two, lighter; the rest empty (one on one, its middle undecided). */
.share-bar {
  display: flex;
  height: 8px;
  background: var(--panel-alt);
  border: 1px solid var(--ink);
}
.share-bar .rest {
  flex: 1;
}
.share-bar .good {
  background: var(--good-fill);
}
.share-bar .good-light {
  background: color-mix(in srgb, var(--good) 25%, var(--panel));
}
.share-bar .bad {
  background: var(--bad-fill);
}
.share-bar .bad-light {
  background: color-mix(in srgb, var(--bad) 25%, var(--panel));
}
.share-text {
  color: var(--muted);
}
.cell {
  font-variant-numeric: tabular-nums;
}
.by-move .cell {
  white-space: nowrap;
}
.cell-ko {
  font-weight: bold;
}
.cell-ko.muted {
  font-weight: normal;
}
.cell-range {
  margin-left: 6px;
  font-size: 0.9em;
}
.cell-move {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85em;
  white-space: nowrap;
}
/* Your knockouts good news, theirs bad: the cell tinted by how many hits it takes. */
.cell.ohko {
  background: color-mix(in srgb, var(--good) 22%, transparent);
}
.cell.two {
  background: color-mix(in srgb, var(--good) 9%, transparent);
}
.cell.theirs.ohko {
  background: color-mix(in srgb, var(--bad) 22%, transparent);
}
.cell.theirs.two {
  background: color-mix(in srgb, var(--bad) 9%, transparent);
}
/* The threat meter: a bar from its middle, toward the right a threat, toward the left a target. */
.meter-col {
  width: 6.5em;
  min-width: 6.5em;
}
/* The matchups' cells their move, then their verdict and range under it. */
.matchups .cell-ko,
.matchups .cell-range {
  display: block;
  margin: 0;
}
.meter {
  position: relative;
  display: block;
  height: 8px;
  background: var(--panel-alt);
  border: 1px solid var(--ink);
}
.meter::after {
  content: '';
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 50%;
  width: 1px;
  background: var(--ink);
}
.meter-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--muted);
}
.threat .meter-fill {
  background: var(--bad);
}
.target .meter-fill {
  background: var(--good);
}
.meter-text {
  display: block;
  margin-top: 2px;
  font-size: 0.8em;
}
.threat .meter-text {
  color: var(--bad);
  font-weight: bold;
}
.target .meter-text {
  color: var(--good);
  font-weight: bold;
}
@media (max-width: 720px) {
  /* The sorting from the start of its row, where it may not fit beside nothing. */
  .sort-row {
    justify-content: flex-start;
  }
  /* Narrow, each Pokémon its icon and usage, kept in view as the table scrolls sideways; each cell's range under its
  verdict. */
  .grid .who-col {
    width: auto;
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--panel);
  }
  .who {
    flex-direction: column;
    gap: 2px;
  }
  .who-text {
    flex-direction: column;
    width: auto;
    max-width: none;
    align-items: center;
  }
  .who-name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .move-col {
    min-width: 6.5em;
  }
  .cell-ko,
  .cell-range {
    display: block;
    margin: 0;
  }
  .meter-col {
    width: 5.5em;
    min-width: 5.5em;
  }
}
</style>
