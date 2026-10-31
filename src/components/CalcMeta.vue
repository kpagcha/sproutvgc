<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  abilityOf,
  battlerOf,
  damaging,
  hit,
  koKind,
  metaFoes,
  SETS_FIELD,
  type Battlefield,
  type Fighter,
  type Hit,
  type KoKind,
} from '@/lib/damage'
import MoreToggle from '@/components/MoreToggle.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeIcon from '@/components/TypeIcon'

// Your Pokémon against the meta: the most used Pokémon of the data shown, each at its most common set (`metaFoes`),
// on the calculator's field. Two ways round: your moves against each (a column per move, its range and how many hits it
// takes, each move headed by how much of the meta, by usage, it knocks out in one hit and in two), or each one's
// hardest hit on yours (its best common move, and how much of the meta knocks yours out in one hit and in two). Your
// side as it's set (its stages, HP, screens, ally's help); theirs as they come in, the weather or terrain their ability
// sets over the calculator's (`SETS_FIELD`). A row taps into the calculator as the
// opponent. Its first 15 until unfolded.
const props = defineProps<{ yours: Fighter; field: Battlefield; data: MetaData | null }>()
const emit = defineEmits<{ pick: [f: Fighter] }>()

type Mode = 'attack' | 'defend'
const MODE_KEY = 'sproutvgc.calc.metaMode'
const mode = shallowRef<Mode>('attack')
const TOP_KEY = 'sproutvgc.calc.metaTop'
const TOPS = ['25', '50', '100'] as const
const top = shallowRef<(typeof TOPS)[number]>('50')
try {
  const m = localStorage.getItem(MODE_KEY)
  if (m === 'attack' || m === 'defend') mode.value = m
  const n = localStorage.getItem(TOP_KEY)
  if ((TOPS as readonly (string | null)[]).includes(n)) top.value = n as (typeof TOPS)[number]
} catch {
  // Storage unavailable: as it is.
}
watch([mode, top], ([m, n]) => {
  try {
    localStorage.setItem(MODE_KEY, m)
    localStorage.setItem(TOP_KEY, n)
  } catch {
    // Storage unavailable: for this visit.
  }
})
const modes = computed(() => [
  { value: 'attack' as const, label: t('calc.meta.attack') },
  { value: 'defend' as const, label: t('calc.meta.defend') },
])
const tops = computed(() => TOPS.map((n) => ({ value: n, label: n })))

const yourId = computed(() => battlerOf(props.yours))
const foes = computed(() => metaFoes(props.data, Number(top.value)))
const yourMoves = computed(() => props.yours.member.moves.filter(damaging))
/** The field as one of them comes in: its weather or terrain, if its ability sets one, over the calculator's. */
const fieldWith = (f: Fighter): Battlefield => {
  const a = abilityOf(f)
  return { ...props.field, ...(a && SETS_FIELD[a]) }
}

/** A verdict in a few characters: "OHKO", "62% 2HKO", "4HKO"; nothing past 4 hits. */
function short(h: Hit | null | undefined): string {
  if (!h || h.none) return t('calc.noEffect')
  if (!h.koHits || h.koHits > 4) return ''
  const n = h.koHits === 1 ? 'OHKO' : `${h.koHits}HKO`
  return h.koChance >= 1 ? n : `${Math.round(h.koChance * 100)}% ${n}`
}
const range = (h: Hit | null | undefined) => (h && !h.none ? `${h.minPct.toFixed(0)}–${h.maxPct.toFixed(0)}%` : '')

/** Whether a hit surely or possibly knocks out in `n` hits or fewer, as a share: 1 surely, its chance, else 0. */
const within = (h: Hit | null | undefined, n: number) =>
  !h || h.none || !h.koHits ? 0 : h.koHits < n ? 1 : h.koHits === n ? h.koChance : 0

const attackRows = computed(() =>
  mode.value !== 'attack' || !yourId.value
    ? []
    : foes.value.map((f) => ({
        ...f,
        hits: yourMoves.value.map((mv) => hit(props.yours, f.set, mv, fieldWith(f.set))),
      })),
)
const defendRows = computed(() =>
  mode.value !== 'defend' || !yourId.value
    ? []
    : foes.value.map((f) => {
        const all = f.set.member.moves
          .filter(damaging)
          .map((mv) => hit(f.set, props.yours, mv, fieldWith(f.set)))
          .filter((h): h is Hit => !!h && !h.none)
          .sort((a, b) => b.max - a.max)
        return { ...f, best: all[0] ?? null, next: all[1] ?? null }
      }),
)
const totalUsage = computed(() => foes.value.reduce((s, f) => s + f.usage, 0) || 1)
/** Out of the meta shown, by usage, how much one move (or their best hit) knocks out in one hit and in two. */
const summary = (pick: (row: number) => Hit | null | undefined, rows: number) => {
  let one = 0
  let two = 0
  for (let i = 0; i < rows; i++) {
    const h = pick(i)
    const u = foes.value[i]!.usage
    one += within(h, 1) * u
    two += within(h, 2) * u
  }
  return { one: one / totalUsage.value, two: two / totalUsage.value }
}
const moveSummaries = computed(() =>
  yourMoves.value.map((mv, j) => ({
    mv,
    ...summary((i) => attackRows.value[i]?.hits[j], attackRows.value.length),
  })),
)
const defendSummary = computed(() => summary((i) => defendRows.value[i]?.best, defendRows.value.length))
const pct = (x: number) => `${Math.round(x * 100)}%`

const TOP = 10
const all = shallowRef(false)
const name = (id: PokemonId) => refName(pokemon(id))
/** What it shows, said in its heading's tooltip. */
const intro = computed(() =>
  yourId.value
    ? t(mode.value === 'attack' ? 'calc.meta.introAttack' : 'calc.meta.introDefend', {
        name: name(yourId.value),
        n: foes.value.length,
      })
    : undefined,
)
const kindOf = (h: Hit | null | undefined): KoKind => koKind(h)
const moveName = (id: MoveId) => refName(move(id))
</script>

<template>
  <section class="panel meta">
    <div class="meta-head">
      <!-- What it shows, a tooltip on its heading, underlined dotted. -->
      <h2>
        <span v-tip="intro" class="about" tabindex="0">{{ t('calc.meta.title') }}</span>
      </h2>
      <span class="controls">
        <SegmentedControl v-model="mode" class="soft" :label="t('calc.meta.show')" :options="modes" />
        <SegmentedControl v-model="top" class="soft" :label="t('calc.meta.top')" :options="tops" />
      </span>
    </div>
    <p class="muted intro">{{ yourId ? t('calc.meta.tap') : t('calc.meta.pickYours') }}</p>
    <template v-if="yourId && foes.length">
      <!-- Your moves: a column each, headed by how much of the meta it knocks out. -->
      <template v-if="mode === 'attack'">
        <p v-if="!yourMoves.length" class="muted">{{ t('calc.meta.noMoves') }}</p>
        <div v-else class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th class="who-col" scope="col">{{ t('calc.meta.pokemon') }}</th>
                <th v-for="s in moveSummaries" :key="s.mv" scope="col" class="move-col">
                  <span class="move-head"><TypeIcon :type="MOVES[s.mv].type" />{{ moveName(s.mv) }}</span>
                  <span class="ko-share">
                    <span class="share-bar" aria-hidden="true"
                      ><span class="one" :style="{ width: pct(s.one) }"></span
                      ><span class="two" :style="{ width: pct(Math.max(0, s.two - s.one)) }"></span
                    ></span>
                    <span class="share-text">{{ t('calc.meta.koShare', { one: pct(s.one), two: pct(s.two) }) }}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in attackRows.slice(0, all ? undefined : TOP)" :key="r.id">
                <th scope="row" class="who-col">
                  <button type="button" class="who" @click="emit('pick', r.set)">
                    <PokemonIcon :id="r.id" />
                    <span class="who-name">{{ name(r.id) }}</span>
                  </button>
                </th>
                <td v-for="(h, j) in r.hits" :key="j" class="cell" :class="kindOf(h)">
                  <span class="cell-ko" :class="{ muted: !h || h.none }">{{ short(h) }}</span>
                  <span class="cell-range muted">{{ range(h) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MoreToggle v-if="attackRows.length > TOP" v-model:all="all" :n="attackRows.length" :top="TOP" />
      </template>

      <!-- Their hardest hits on yours. -->
      <template v-else>
        <div class="defend-summary">
          <span class="share-bar wide" aria-hidden="true"
            ><span class="one" :style="{ width: pct(defendSummary.one) }"></span
            ><span class="two" :style="{ width: pct(Math.max(0, defendSummary.two - defendSummary.one)) }"></span
          ></span>
          <span>{{ t('calc.meta.koYou', { one: pct(defendSummary.one), two: pct(defendSummary.two) }) }}</span>
        </div>
        <div class="table-wrap">
          <table class="grid theirs">
            <thead>
              <tr>
                <th class="who-col" scope="col">{{ t('calc.meta.pokemon') }}</th>
                <th scope="col">{{ t('calc.meta.best') }}</th>
                <th scope="col" class="next-col">{{ t('calc.meta.next') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in defendRows.slice(0, all ? undefined : TOP)" :key="r.id">
                <th scope="row" class="who-col">
                  <button type="button" class="who" @click="emit('pick', r.set)">
                    <PokemonIcon :id="r.id" />
                    <span class="who-name">{{ name(r.id) }}</span>
                  </button>
                </th>
                <td class="cell best" :class="kindOf(r.best)">
                  <template v-if="r.best">
                    <span class="cell-move"
                      ><TypeIcon :type="MOVES[r.best.move].type" />{{ moveName(r.best.move) }}</span
                    >
                    <span class="cell-ko" :class="{ muted: !r.best || r.best.none }">{{ short(r.best) }}</span>
                    <span class="cell-range muted">{{ range(r.best) }}</span>
                    <!-- On phones, its next hardest under it, in place of a column of its own. -->
                    <span v-if="r.next" class="next-inline muted"
                      >{{ t('calc.meta.next') }}: {{ moveName(r.next.move) }} {{ range(r.next) }}</span
                    >
                  </template>
                  <span v-else class="muted">{{ t('calc.meta.nothing') }}</span>
                </td>
                <td class="cell next-col" :class="kindOf(r.next)">
                  <template v-if="r.next">
                    <span class="cell-move"
                      ><TypeIcon :type="MOVES[r.next.move].type" />{{ moveName(r.next.move) }}</span
                    >
                    <span class="cell-range muted">{{ range(r.next) }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MoreToggle v-if="defendRows.length > TOP" v-model:all="all" :n="defendRows.length" :top="TOP" />
      </template>
    </template>
  </section>
</template>

<style scoped>
.meta {
  margin: 0;
}
.meta-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.meta-head h2 {
  margin: 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-left: auto;
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
.who-name {
  font-weight: bold;
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
/* How much of the meta a move knocks out: in one hit, solid; in two, lighter; the rest empty. */
.share-bar {
  display: flex;
  height: 6px;
  background: var(--panel-alt);
  border: 1px solid var(--ink);
}
.share-bar.wide {
  flex: 1;
  min-width: 120px;
  height: 10px;
}
.share-bar .one {
  background: var(--good);
}
.share-bar .two {
  background: color-mix(in srgb, var(--good) 40%, var(--panel));
}
.theirs .share-bar .one,
.defend-summary .one {
  background: var(--bad);
}
.defend-summary .two {
  background: color-mix(in srgb, var(--bad) 40%, var(--panel));
}
.share-text {
  color: var(--muted);
}
.defend-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-bottom: 8px;
}
.cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 8px;
}
/* Your knockouts good news, theirs bad: the cell tinted by how many hits it takes. */
.cell.ohko {
  background: color-mix(in srgb, var(--good) 22%, transparent);
}
.cell.two {
  background: color-mix(in srgb, var(--good) 9%, transparent);
}
.theirs .cell.ohko {
  background: color-mix(in srgb, var(--bad) 22%, transparent);
}
.theirs .cell.two {
  background: color-mix(in srgb, var(--bad) 9%, transparent);
}
.next-inline {
  display: none;
}
@media (max-width: 720px) {
  .next-col {
    display: none;
  }
  .next-inline {
    display: block;
    font-size: 0.85em;
  }
  .best {
    white-space: normal;
  }
  .controls {
    margin-left: 0;
  }
  /* Narrow, each Pokémon its icon and each cell's range under its verdict, the Pokémon kept
  in view as the moves scroll sideways. */
  .grid .who-col {
    width: auto;
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--panel);
  }
  /* Its icon alone, its name read out but not shown. */
  .who {
    flex-direction: column;
    gap: 2px;
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
  .grid:not(.theirs) .cell-ko,
  .grid:not(.theirs) .cell-range {
    display: block;
    margin: 0;
  }
}
</style>
