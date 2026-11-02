<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { X } from '@lucide/vue'
import { ability, item, move, pokemon, type PokemonId } from '@/data/dex'
import { percent, usageRanks, type MetaData, type MetaSnapshot } from '@/data/meta'
import { natureName } from '@/data/natures'
import { POKEMON } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useMetaBalance } from '@/composables/useMetaBalance'
import {
  LANE_KEYS,
  LADDER_CUT,
  metaLadder,
  metaOverview,
  offenseModeOf,
  type OffenseMode,
  type Placed,
  type Plotted,
  type Side,
} from '@/lib/teamBalance'
import { useUnfolded } from '@/composables/useUnfolded'
import BalanceLadder from '@/components/BalanceLadder.vue'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import MoreToggle from '@/components/MoreToggle.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The rankings' overview of the meta's physical and special side, after its trends: two cards, its bulk and its
// power, each the team builder's chart (`BalanceLanes`): the meta's spread of values on each side, and its most used
// Pokémon (`OVERVIEW`) placed on it at their most common spread, ability and item (`metaOverview`);
// power measured by stats alone or with each one's best move, typically and at its peak, as the team builder can
// (remembered apart from it). Or, the other view (`View`, remembered), each card a tier list per side, after the speed
// tiers' ladder (`BalanceLadder`): every Pokémon with usage (or, a switch, those on `LADDER_CUT` of teams or more), strongest first, at its most common
// set (`metaLadder`), its first `FOLDED` until unfolded (`MoreToggle`), the picks shown wherever they are. The reader's
// picks (`found`: the list's Pokémon filters, `?f=pokemon:…`, so the list
// narrows to them too) are added to both and marked, picked here as well, each a chip letting it go. The meta's side is
// worked out once per dataset when the browser is idle (`useMetaBalance`), placeholders until then.
const props = defineProps<{
  snapshot: MetaSnapshot | undefined
  data: MetaData | null | undefined
  found: readonly PokemonId[]
}>()
const emit = defineEmits<{ add: [id: PokemonId]; remove: [id: PokemonId] }>()
const balance = useMetaBalance(
  computed(() => props.snapshot),
  computed(() => props.data),
)
const state = computed(() => (balance.value === undefined ? 'pending' : balance.value === null ? 'none' : undefined))

const MODE_KEY = 'sproutvgc.metaOverview.mode'
const mode = shallowRef<OffenseMode>('stats')
try {
  mode.value = offenseModeOf(localStorage.getItem(MODE_KEY)) ?? 'stats'
} catch {
  // Storage unavailable: by stats.
}
watch(mode, (m) => {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
})
const VIEW_KEY = 'sproutvgc.metaOverview.view'
type View = 'chart' | 'list'
const view = shallowRef<View>('chart')
try {
  if (localStorage.getItem(VIEW_KEY) === 'list') view.value = 'list'
} catch {
  // Storage unavailable: the chart.
}
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
})
const views = computed(() => [
  { value: 'chart' as const, label: t('overview.chart') },
  { value: 'list' as const, label: t('overview.tierList') },
])
const modes = computed(() => [
  { value: 'stats' as const, label: t('builder.balance.modeStats') },
  { value: 'moves' as const, label: t('builder.balance.modeMoves') },
])

const pct = (x: number) => `${Math.round(x * 100)}%`
const sideName = (s: Side) => t(s === 'physical' ? 'builder.balance.physical' : 'builder.balance.special')
const SIDES = ['physical', 'special'] as const

/** A chart's lanes: the meta's shape on each side, and its Pokémon on it. */
function lanesOf(kind: 'defense' | 'offense'): LaneView[] {
  const b = balance.value
  const points =
    b && props.data ? metaOverview(props.data, b, kind === 'defense' ? 'defense' : mode.value, props.found) : null
  const split = b?.physicalShare ?? null
  return SIDES.map((side) => ({
    side,
    label: sideName(side),
    // Bulk, the meta's share of attacks on that side, on its name's hover.
    tip:
      kind === 'defense' && split !== null
        ? t(`builder.balance.share.${side}`, { pct: pct(side === 'physical' ? split : 1 - split) })
        : undefined,
    shape: b?.[LANE_KEYS[kind === 'defense' ? 'defense' : mode.value][side]].shape ?? null,
    peakShape: kind !== 'defense' && mode.value === 'moves' ? (b?.[LANE_KEYS.peak[side]].shape ?? null) : null,
    points: points?.[side] ?? [],
    mean: null,
  }))
}
const defense = computed(() => lanesOf('defense'))
const offense = computed(() => lanesOf('offense'))

/** A mark's tooltip: who, the set it's placed at, the move it's measured by, and where it stands. */
function tipOf(kind: 'defense' | 'offense') {
  return (plotted: Plotted, side: Side) => {
    const p = plotted as Placed
    const set = [
      p.nature && natureName(p.nature),
      p.ability && refName(ability(p.ability)),
      p.item && refName(item(p.item)),
    ]
      .filter(Boolean)
      .join(', ')
    const how = p.move
      ? refName(move(p.move))
      : kind === 'defense'
        ? ''
        : `${t(side === 'physical' ? 'stat.atk' : 'stat.spa')} ${Math.round(p.value)}`
    const where =
      p.rank === null
        ? ''
        : kind === 'defense'
          ? t(side === 'physical' ? 'overview.physBulkier' : 'overview.specBulkier', { pct: pct(p.rank) })
          : t(side === 'physical' ? 'builder.balance.physHarder' : 'builder.balance.specHarder', { pct: pct(p.rank) })
    return [refName(pokemon(p.pokemon)), set, how, where].filter(Boolean).join(' · ')
  }
}
const defenseTip = tipOf('defense')
const offenseTip = tipOf('offense')
const noMean = () => ''
const defenseEnds = computed((): [string, string] => [t('builder.balance.frailer'), t('builder.balance.bulkier')])
const offenseEnds = computed((): [string, string] => [t('builder.balance.softer'), t('builder.balance.harder')])

// The tier lists: each card's two sides on one axis (their values' range), the meta's median on each.
const FOLDED = 10
// Every Pokémon with usage, or, the switch on (remembered), those on `LADDER_CUT` of teams or more.
const CUT_KEY = 'sproutvgc.metaOverview.cut'
const cut = shallowRef(false)
try {
  cut.value = localStorage.getItem(CUT_KEY) === '1'
} catch {
  // Storage unavailable: every Pokémon.
}
watch(cut, (on) => {
  try {
    localStorage.setItem(CUT_KEY, on ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
})
type Kind = 'defense' | 'offense'
function laddersOf(kind: Kind) {
  const b = balance.value
  if (!b || !props.data || view.value !== 'list') return null
  const at = kind === 'defense' ? 'defense' : mode.value
  const ladder = metaLadder(props.data, b, at, props.found, cut.value ? LADDER_CUT : 0)
  const values = SIDES.flatMap((side) => ladder[side].map((p) => p.value))
  const hi = Math.max(...values, 1)
  const lo = Math.min(...values, hi) * 0.9
  return {
    lo,
    hi,
    n: Math.max(...SIDES.map((side) => ladder[side].length)),
    sides: SIDES.map((side) => ({
      side,
      rows: ladder[side],
      median: b[LANE_KEYS[at][side]].shape?.median ?? null,
    })),
  }
}
const ladders = computed(() => ({ defense: laddersOf('defense'), offense: laddersOf('offense') }))
const unfolded = { defense: useUnfolded('overview:defense'), offense: useUnfolded('overview:offense') }

// The picks: any of the meta's Pokémon, by usage.
const ids = computed(() =>
  Object.entries(props.data ?? {})
    .filter(([id, d]) => d?.usage && POKEMON[id as PokemonId] && !props.found.includes(id as PokemonId))
    .map(([id]) => id as PokemonId),
)
const ranks = computed(() => (props.data ? usageRanks(props.data) : undefined))
function add(id: PokemonId | null) {
  if (id) emit('add', id)
}

// Each chart's heading explains, on hover, how the meta is pooled.
const [DefineLadders, ReuseLadders] = createReusableTemplate<{ kind: Kind }>()
const defenseHow = useTemplateRef<HTMLElement>('defenseHow')
const offenseHow = useTemplateRef<HTMLElement>('offenseHow')
</script>

<template>
  <section class="panel overview">
    <!-- A card's tier lists: its two sides side by side (one under the other, narrow), unfolded together. -->
    <DefineLadders v-slot="{ kind }">
      <p v-if="state === 'pending'" class="muted">…</p>
      <p v-else-if="state === 'none' || !ladders[kind]" class="muted">{{ t('builder.balance.noMeta') }}</p>
      <template v-else>
        <div class="ladders">
          <BalanceLadder
            v-for="l in ladders[kind]!.sides"
            :key="l.side"
            :side="l.side"
            :kind
            :rows="l.rows"
            :lo="ladders[kind]!.lo"
            :hi="ladders[kind]!.hi"
            :median="l.median"
            :found
            :all="unfolded[kind].value"
            :top="FOLDED"
            :rare="LADDER_CUT"
          />
        </div>
        <MoreToggle v-model:all="unfolded[kind].value" :n="ladders[kind]!.n" :top="FOLDED" />
        <p v-if="!cut && (unfolded[kind].value || found.length)" class="note muted">
          {{ t('usage.rare', { share: percent(LADDER_CUT) }) }}
        </p>
      </template>
    </DefineLadders>
    <div class="head">
      <h2>{{ t('overview.title') }}</h2>
      <SegmentedControl v-model="view" class="soft view" :label="t('overview.view')" :options="views" />
      <label v-if="view === 'list'" class="btn switch cut" :class="{ on: cut }">
        <input v-model="cut" type="checkbox" />
        {{ t('overview.cut', { share: percent(LADDER_CUT) }) }}
      </label>
      <!-- The picks: added to the charts and marked, the list narrowed to them. -->
      <div class="picks">
        <PokemonPicker
          class="pick"
          adds
          :model-value="null"
          :ids
          :ranks
          :placeholder="found.length ? t('overview.addMore') : t('overview.add')"
          @update:model-value="add"
        />
        <ul v-if="found.length" class="found-list" :aria-label="t('overview.found')">
          <li v-for="id in found" :key="id" class="found-chip">
            <span class="found-name"><PokemonIcon :id />{{ refName(pokemon(id)) }}</span>
            <button
              type="button"
              class="found-remove"
              :aria-label="t('overview.remove', { name: refName(pokemon(id)) })"
              @click="emit('remove', id)"
            >
              <X :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
    </div>
    <div class="cards">
      <section class="card">
        <header class="card-head">
          <h3 v-tip="defenseHow" class="tipped" tabindex="0" :aria-label="defenseHow?.textContent ?? undefined">
            {{ t('overview.bulk') }}
          </h3>
          <div hidden>
            <div ref="defenseHow" class="how">
              <p>{{ t('builder.balance.howDef') }}</p>
              <p>{{ t('overview.howSets') }}</p>
              <p>{{ t('builder.balance.howMeta') }}</p>
            </div>
          </div>
        </header>
        <BalanceLanes
          v-if="view === 'chart'"
          :lanes="defense"
          :ends="defenseEnds"
          :tip="defenseTip"
          :mean-tip="noMean"
          :state
          :found
        />
        <ReuseLadders v-else kind="defense" />
      </section>
      <section class="card">
        <header class="card-head">
          <h3 v-tip="offenseHow" class="tipped" tabindex="0" :aria-label="offenseHow?.textContent ?? undefined">
            {{ t('overview.attack') }}
          </h3>
          <div hidden>
            <div ref="offenseHow" class="how">
              <p>{{ t('builder.balance.howAtk') }}</p>
              <p v-if="mode === 'moves'">{{ t('builder.balance.howMoves') }}</p>
              <p>{{ t('overview.howSets') }}</p>
              <p>{{ t('builder.balance.howMeta') }} {{ t('builder.balance.howMetaAtk') }}</p>
            </div>
          </div>
          <SegmentedControl
            v-model="mode"
            class="mode soft"
            :label="t('builder.balance.modeLabel')"
            :tip="t('builder.balance.modeTip')"
            :options="modes"
          />
        </header>
        <BalanceLanes
          v-if="view === 'chart'"
          :lanes="offense"
          :ends="offenseEnds"
          :tip="offenseTip"
          :mean-tip="noMean"
          :state
          :found
        />
        <ReuseLadders v-else kind="offense" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
}
.head h2 {
  margin: 0;
}
.view,
.cut {
  font-size: 0.9em;
}
.note {
  margin: 8px 0 0;
  font-size: 0.85em;
}
/* The tier lists: the two sides side by side, one under the other where they don't fit. */
.ladders {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: 12px 20px;
}
.picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1 1 18em;
  min-width: 0;
}
.pick {
  flex: 0 1 16em;
  min-width: 12em;
}
.found-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* A pick: its name and a cross letting it go, one pill. */
.found-chip {
  display: flex;
}
.found-name,
.found-remove {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px 0 2px;
  font: inherit;
  font-size: 0.875em;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--border-strong);
}
.found-remove {
  margin-left: -2px;
  padding: 0 6px;
  color: var(--muted);
  cursor: pointer;
}
.found-remove:hover {
  background: var(--sel);
  color: var(--text);
}
.found-name :deep(.sheet-icon) {
  margin-block: -4px;
}
.cards {
  display: grid;
  gap: 12px;
}
/* A card: a question of its own, its header over the chart that answers it (as the team builder's). */
.card {
  min-width: 0;
  padding: 12px 14px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 8px;
}
.card-head h3 {
  margin: 0;
  font-size: 0.78em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.card-head h3.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
.how {
  max-width: 22rem;
}
.how p {
  margin: 0;
}
.how p + p {
  margin-top: 6px;
}
.mode {
  margin-left: auto;
  font-size: 0.9em;
  /* Its label and choices each on one line, squeezed under the heading, and the choices under the label where the
     two don't fit on one. */
  flex-wrap: wrap;
  row-gap: 4px;
  white-space: nowrap;
}
/* On phones, under the heading at the left. */
@media (max-width: 720px) {
  .mode {
    margin-left: 0;
  }
}
</style>
