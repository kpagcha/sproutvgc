<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { move, pokemon, type PokemonId } from '@/data/dex'
import type { MetaData, MetaSnapshot } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useMetaBalance } from '@/composables/useMetaBalance'
import { LANE_KEYS, metaOverview, type OffenseMode, type Plotted, type Side } from '@/lib/teamBalance'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The rankings' overview of the meta's physical and special side, after its trends: two cards, its bulk and its
// attack, each the team builder's chart (`BalanceLanes`): the meta's spread of values on each side, and its most used
// Pokémon (`OVERVIEW`) placed on it at their most common spread (`metaOverview`); attacking, measured by stats alone or
// with each one's best move at its peak, as the team builder can (remembered apart from it). The meta's side is worked
// out once per dataset when the browser is idle (`useMetaBalance`), placeholders until then.
const props = defineProps<{ snapshot: MetaSnapshot | undefined; data: MetaData | null | undefined }>()
const balance = useMetaBalance(
  computed(() => props.snapshot),
  computed(() => props.data),
)
const state = computed(() => (balance.value === undefined ? 'pending' : balance.value === null ? 'none' : undefined))

const MODE_KEY = 'sproutvgc.metaOverview.mode'
const mode = shallowRef<OffenseMode>('stats')
try {
  if (localStorage.getItem(MODE_KEY) === 'moves') mode.value = 'moves'
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

const pct = (x: number) => `${Math.round(x * 100)}%`
const sideName = (s: Side) => t(s === 'physical' ? 'builder.balance.physical' : 'builder.balance.special')
const SIDES = ['physical', 'special'] as const

/** A chart's lanes: the meta's shape on each side, and its most used Pokémon on it. */
function lanesOf(kind: 'defense' | 'offense'): LaneView[] {
  const b = balance.value
  const points = b && props.data ? metaOverview(props.data, b, kind === 'defense' ? 'defense' : mode.value) : null
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
    points: points?.[side] ?? [],
    mean: null,
  }))
}
const defense = computed(() => lanesOf('defense'))
const offense = computed(() => lanesOf('offense'))

const name = (id: PokemonId) => refName(pokemon(id))
function tipOf(kind: 'defense' | 'offense') {
  return (p: Plotted, side: Side) => {
    const how = p.move
      ? refName(move(p.move))
      : kind === 'defense'
        ? ''
        : `${t(side === 'physical' ? 'stat.atk' : 'stat.spa')} ${Math.round(p.value)}`
    const where =
      p.rank === null
        ? ''
        : kind === 'defense'
          ? t('builder.balance.bulkierThan', { pct: pct(p.rank) })
          : t(side === 'physical' ? 'builder.balance.physHarder' : 'builder.balance.specHarder', { pct: pct(p.rank) })
    return [name(p.pokemon), how, where, p.mixed ? t('builder.balance.mixedTip') : ''].filter(Boolean).join(' · ')
  }
}
const defenseTip = tipOf('defense')
const offenseTip = tipOf('offense')
const noMean = () => ''
const defenseEnds = computed((): [string, string] => [t('builder.balance.frailer'), t('builder.balance.bulkier')])
const offenseEnds = computed((): [string, string] => [t('builder.balance.softer'), t('builder.balance.harder')])

// Each chart's heading explains, on hover, how the meta is pooled.
const defenseHow = useTemplateRef<HTMLElement>('defenseHow')
const offenseHow = useTemplateRef<HTMLElement>('offenseHow')
</script>

<template>
  <section class="panel overview">
    <h2>{{ t('overview.title') }}</h2>
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
        <BalanceLanes :lanes="defense" :ends="defenseEnds" :tip="defenseTip" :mean-tip="noMean" :state />
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
        <BalanceLanes :lanes="offense" :ends="offenseEnds" :tip="offenseTip" :mean-tip="noMean" :state />
      </section>
    </div>
  </section>
</template>

<style scoped>
.overview h2 {
  margin: 0 0 12px;
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
  margin-bottom: 12px;
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
