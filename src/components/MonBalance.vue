<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { ability, item, move, pokemon, type PokemonId } from '@/data/dex'
import type { MetaData, MetaSnapshot } from '@/data/meta'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  LANE_KEYS,
  metaPlace,
  offenseModeOf,
  type OffenseMode,
  type Placed,
  type Plotted,
  type Side,
} from '@/lib/teamBalance'
import { useMetaBalance } from '@/composables/useMetaBalance'
import AppLink from '@/components/AppLink'
import BalanceChart, { type SideView } from '@/components/BalanceChart.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// A Pokémon's bulk and power against the meta, on its meta page after its spreads: two cards, each one chart of both
// sides (`BalanceChart`): the meta's spread of values on each, overlapping, and this one where it falls on each, at its
// most common set (`metaPlace`), its place among the meta in its mark's tooltip; power by stats alone or with its best
// move (remembered, `sproutvgc.metaOverview.mode`). The ways to the bulk and power tiers have it found there (`?find=`).
const props = defineProps<{
  mon: PokemonId
  snapshot: MetaSnapshot | undefined
  data: MetaData | null | undefined
}>()
const balance = useMetaBalance(
  computed(() => props.snapshot),
  computed(() => props.data),
)
const state = computed(() => (balance.value === undefined ? 'pending' : balance.value === null ? 'none' : undefined))

// Measured as the rankings' overview is, the same choice.
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
const modes = computed(() => [
  { value: 'stats' as const, label: t('builder.balance.modeStats') },
  { value: 'moves' as const, label: t('builder.balance.modeMoves') },
])

const SIDES = ['physical', 'special'] as const
const pct = (x: number) => `${Math.round(x * 100)}%`

/** A chart's sides: the meta's shape on each, and this one on it. */
function sidesOf(kind: 'defense' | 'offense'): SideView[] {
  const b = balance.value
  const d = props.data?.[props.mon]
  const at = kind === 'defense' ? 'defense' : mode.value
  const placed = b && d?.usage ? metaPlace(props.mon, d, b, at) : null
  return SIDES.map((side) => {
    const p = placed?.[side] ?? null
    return {
      side,
      shape: b?.[LANE_KEYS[at][side]].shape ?? null,
      peakShape: kind === 'offense' && mode.value === 'moves' ? (b?.[LANE_KEYS.peak[side]].shape ?? null) : null,
      points: p ? [p] : [],
    }
  })
}
const defense = computed(() => sidesOf('defense'))
const offense = computed(() => sidesOf('offense'))

/** Its mark's tooltip: the set it's placed at, the move it's measured by, and where it stands. */
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
const tips = { defense: tipOf('defense'), offense: tipOf('offense') }
const ends = {
  defense: computed((): [string, string] => [t('builder.balance.frailer'), t('builder.balance.bulkier')]),
  offense: computed((): [string, string] => [t('builder.balance.softer'), t('builder.balance.harder')]),
}
// The ways to the bulk and power tiers with it found there, power measured as here.
const toBulk = computed(() => ({ name: 'bulkTiers', query: { find: props.mon } }))
const toPower = computed(() => ({
  name: 'powerTiers',
  query: { find: props.mon, ...(mode.value === 'moves' && { by: 'moves' }) },
}))

// Each card's heading explains, on hover, how it's measured.
const defenseHow = useTemplateRef<HTMLElement>('defenseHow')
const offenseHow = useTemplateRef<HTMLElement>('offenseHow')
</script>

<template>
  <section class="panel mon-balance">
    <div class="head">
      <h2 v-tip="t('overview.monAbout')" class="tipped" tabindex="0">{{ t('overview.title') }}</h2>
      <span class="to-tiers">
        <AppLink :to="toBulk">{{ t('nav.bulkTiers') }}<ChevronRight :size="14" aria-hidden="true" /></AppLink>
        <AppLink :to="toPower">{{ t('nav.powerTiers') }}<ChevronRight :size="14" aria-hidden="true" /></AppLink>
      </span>
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
              <p>{{ t('builder.balance.howMeta') }}</p>
            </div>
          </div>
        </header>
        <BalanceChart :sides="defense" :ends="ends.defense.value" :tip="tips.defense" :state />
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
        <BalanceChart :sides="offense" :ends="ends.offense.value" :tip="tips.offense" :state />
      </section>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
}
.head h2 {
  margin: 0;
}
.head h2.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 4px;
  cursor: help;
}
.to-tiers {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}
.to-tiers > a {
  display: inline-flex;
  align-items: center;
}
/* The two cards side by side where there's room, one under the other otherwise. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: 10px;
}
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
/* The heading at the top, the chart at the foot: the two cards' plots level whatever their headings hold. */
.card-head {
  flex: 1 0 auto;
  display: flex;
  align-content: flex-start;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 4px;
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
  flex-wrap: wrap;
  row-gap: 4px;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .mode {
    margin-left: 0;
  }
}
</style>
