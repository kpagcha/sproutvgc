<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { move, pokemon, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useOpenState } from '@/composables/useOpenState'
import { buildQuery } from '@/lib/speedBuild'
import type { Battler } from '@/lib/team'
import type { MetaBalance, Plotted } from '@/lib/teamBalance'
import { teamSpeed, type ControlKind, type SpeedControl, type SpeedMode } from '@/lib/teamSpeed'
import AppLink from '@/components/AppLink'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The team builder's Speed, a panel laid out as its Defense and Offense (`TeamBalance`): a verdict, then cards: the
// chart against the meta's Speeds (`BalanceLanes`, one lane; the team's side as it is, in Tailwind or under Trick Room,
// its choice in the card's header, remembered), with the ways to the speed tiers (the team found there) and the
// comparison (the team as yours, at its builds) under it, and what controls Speed on the team. The meta's side comes in after the page (`meta`: undefined until
// then, null with no meta). Folds, folded by default on phones, then as last left.
const props = defineProps<{
  members: readonly Battler[]
  meta: MetaBalance | null | undefined
}>()

const { open, onToggle } = useOpenState('sproutvgc.builder.speedOpen', !window.matchMedia('(max-width: 720px)').matches)
const pending = computed(() => props.meta === undefined)
const pct = (x: number) => `${Math.round(x * 100)}%`
const name = (id: PokemonId) => refName(pokemon(id))

const MODE_KEY = 'sproutvgc.builder.speedMode'
const MODES = ['none', 'tailwind', 'trickroom'] as const
const mode = shallowRef<SpeedMode>('none')
try {
  const saved = localStorage.getItem(MODE_KEY)
  if ((MODES as readonly (string | null)[]).includes(saved)) mode.value = saved as SpeedMode
} catch {
  // Storage unavailable: as it is.
}
watch(mode, (m) => {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
})
const modes = computed(() => MODES.map((value) => ({ value, label: t(`builder.speed.mode.${value}`) })))

const speed = computed(() => teamSpeed(props.members, props.meta?.speed ?? null, mode.value))
const lanes = computed((): LaneView<'speed'>[] => [
  {
    side: 'speed',
    label: t('builder.speed.lane'),
    sub: mode.value === 'none' ? undefined : t(`builder.speed.mode.${mode.value}`),
    shape: props.meta?.speed.shape ?? null,
    points: speed.value.entries,
    mean: speed.value.mean,
  },
])
const ends: [string, string] = [t('builder.speed.slower'), t('builder.speed.faster')]
const first = (rank: number | null) => (rank === null ? '' : t('builder.speed.first', { pct: pct(rank) }))
const tip = (p: Plotted) => [name(p.pokemon), `${t('stat.spe')} ${p.value}`, first(p.rank)].filter(Boolean).join(' · ')
const meanTip = () => [t('builder.balance.average'), first(speed.value.rank)].filter(Boolean).join(' · ')

const verdict = computed(() => {
  const r = speed.value.rank
  if (r === null) return null
  const how = r >= 0.6 ? 'good' : r <= 0.4 ? 'bad' : 'even'
  return t(`builder.speed.verdict.${mode.value}.${how}`, { pct: pct(r) })
})

// What controls Speed: a group per kind, those it has.
const KINDS: ControlKind[] = ['ours', 'theirs', 'room']
const control = computed(() =>
  KINDS.flatMap((kind) => {
    const items = speed.value.control.filter((c) => c.kind === kind)
    return items.length ? [{ kind, items }] : []
  }),
)
const controlTip = (c: SpeedControl) => `${refName(move(c.move))}: ${c.pokemon.map(name).join(', ')}`

// The speed pages: the team found on the speed tiers, and the team as yours in the comparison, at its builds. Under
// Trick Room, there too.
const trickroom = computed(() => (mode.value === 'trickroom' ? '1' : undefined))
const tiersQuery = computed(() => ({
  find: [...new Set(speed.value.entries.map((e) => e.pokemon))].join(',') || undefined,
  trickroom: trickroom.value,
}))
const compareQuery = computed(() => ({
  ...Object.assign(
    {},
    ...speed.value.entries.map((e, i) => {
      const slot = i ? `a${i + 1}` : 'a'
      return { [slot]: e.pokemon, ...buildQuery(e.build, slot) }
    }),
  ),
  trickroom: trickroom.value,
}))
const howBody = useTemplateRef<HTMLElement>('howBody')
</script>

<template>
  <details class="panel banded balance" :open @toggle="onToggle">
    <summary>{{ t('builder.section.speed') }}</summary>
    <p v-if="pending" class="verdict bone" aria-hidden="true"></p>
    <p v-else-if="verdict" class="verdict">{{ verdict }}</p>
    <div class="dash-wrap">
      <div class="dash">
        <!-- The chart against the meta. -->
        <section class="card chart-card">
          <header class="card-head">
            <h3 v-tip="howBody" class="tipped" tabindex="0" :aria-label="howBody?.textContent ?? undefined">
              {{ t('builder.speed.chart') }}
            </h3>
            <div hidden>
              <div ref="howBody" class="how">
                <p>{{ t('builder.speed.how') }}</p>
                <p>{{ t('builder.speed.howMeta') }}</p>
              </div>
            </div>
            <SegmentedControl
              v-model="mode"
              class="mode soft"
              :label="t('builder.speed.modeLabel')"
              :tip="t('builder.speed.modeTip')"
              :options="modes"
            />
          </header>
          <BalanceLanes :lanes :ends :tip :mean-tip :state="pending ? 'pending' : meta === null ? 'none' : undefined" />
          <p v-if="speed.entries.length" class="links">
            <AppLink v-tip="t('builder.speed.tiersTip')" :to="{ name: 'speedTiers', query: tiersQuery }"
              >{{ t('title.speedTiers') }} ›</AppLink
            >
            <AppLink v-tip="t('builder.speed.compareTip')" :to="{ name: 'speedCompare', query: compareQuery }"
              >{{ t('title.speedCompare') }} ›</AppLink
            >
          </p>
        </section>

        <!-- What controls Speed. -->
        <section class="card control-card">
          <header class="card-head">
            <h3>{{ t('builder.speed.control') }}</h3>
          </header>
          <p v-if="!control.length" class="muted none">{{ t('builder.speed.noControl') }}</p>
          <div v-for="g in control" :key="g.kind" class="control-group">
            <span class="control-kind muted">{{ t(`builder.speed.control.${g.kind}`) }}</span>
            <span class="control-items">
              <span v-for="c in g.items" :key="c.move" v-tip="controlTip(c)" class="chip"
                >{{ refName(move(c.move)) }}<PokemonIcon v-for="p in c.pokemon" :id="p" :key="p" :scale="0.75"
              /></span>
            </span>
          </div>
        </section>
      </div>
    </div>
  </details>
</template>

<style scoped>
.balance > summary {
  cursor: pointer;
  font-family: var(--font-display, inherit);
  font-weight: bold;
}
/* The verdict, as the Defense and Offense panels': a callout before the cards, its left edge the lane's color. */
.verdict {
  margin: 0 0 12px;
  padding: 10px 14px;
  font-weight: 600;
  line-height: 1.35;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
}
/* The chart and what controls Speed side by side (wide), one under the other (narrow). */
.dash-wrap {
  container-type: inline-size;
}
.dash {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'chart' 'control';
  gap: 12px;
}
@container (min-width: 760px) {
  .dash {
    grid-template-columns: minmax(0, 1fr) 15rem;
    grid-template-areas: 'chart control';
  }
}
.chart-card {
  grid-area: chart;
}
.control-card {
  grid-area: control;
}
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
  gap: 10px 12px;
  margin-bottom: 12px;
}
.card-head h3 {
  margin: 0;
  font-size: 0.78em;
  font-weight: bold;
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
/* What controls Speed: a group per kind, its name over its chips. */
.control-group + .control-group {
  margin-top: 10px;
}
.control-kind {
  display: block;
  margin-bottom: 4px;
  font-size: 0.85em;
}
.control-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.none {
  margin: 0;
  font-size: 0.9em;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 26px;
  padding: 1px 4px 1px 8px;
  font-size: 0.85em;
  background: var(--panel);
  border: 1px solid var(--border);
}
/* The ways to the speed pages, under the chart. */
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 12px 0 0;
  font-weight: bold;
}
.bone {
  display: block;
  background: var(--border);
  opacity: 0.5;
  animation: pulse 1.2s ease-in-out infinite alternate;
}
.verdict.bone {
  width: 60%;
  height: 1.3em;
}
@keyframes pulse {
  to {
    opacity: 0.25;
  }
}
</style>
