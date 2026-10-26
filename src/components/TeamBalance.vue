<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { ChevronDown, Lightbulb } from '@lucide/vue'
import { ability, move, pokemon, type AbilityId, type MoveId, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useOpenState } from '@/composables/useOpenState'
import type { Battler } from '@/lib/team'
import {
  defenseVerdict,
  LANE_KEYS,
  offenseVerdict,
  teamDefense,
  teamOffense,
  type MetaBalance,
  type OffenseMode,
  type Plotted,
  type Side,
  type Support,
} from '@/lib/teamBalance'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import CategoryIcon from '@/components/CategoryIcon'
import OptionsMenu from '@/components/OptionsMenu.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TeamCoverage from '@/components/TeamCoverage.vue'

// One side of the team builder's team, a panel of its own laid out as a dashboard: Defense or Offense
// (`teamBalance.ts`). Its verdict, a line, a lightbulb by it opening the numbers behind it (`OptionsMenu`): each side's
// percentile among the meta, the team's mean (defending, each lane's name tells the meta's share of attacks on its side,
// on hover); then cards, each a question with its own header: the chart against the meta, a lane per side
// (`BalanceLanes`; attacking, measured by stats alone or with moves, its choice in the card's header, and those
// off the lanes under it), what helps each side (guards defending, boosts attacking), and its types (`TeamCoverage`).
// Wide, the chart and what helps side by side; narrow, every card under the last. The meta's side comes in after the
// page (`meta`: undefined until then, placeholders meanwhile; null with no meta, said so). Folds, folded by default
// on phones, then as last left.
const props = defineProps<{
  side: 'defense' | 'offense'
  members: readonly Battler[]
  meta: MetaBalance | null | undefined
}>()

const { open, onToggle } = useOpenState(
  `sproutvgc.builder.${props.side}Open`,
  !window.matchMedia('(max-width: 720px)').matches,
)
// Its types' card, on phones, folded until unfolded, then as last left.
const narrow = useMediaQuery('(max-width: 720px)')
const { open: typesOpen, toggle: toggleTypes } = useOpenState(`sproutvgc.builder.${props.side}TypesOpen`, false)
const defending = props.side === 'defense'
const meta = computed(() => props.meta ?? null)
const pending = computed(() => props.meta === undefined)
const pct = (x: number) => `${Math.round(x * 100)}%`
const name = (id: PokemonId) => refName(pokemon(id))
const sideName = (s: Side) => t(s === 'physical' ? 'builder.balance.physical' : 'builder.balance.special')
const SIDES = ['physical', 'special'] as const
/** The share of the meta's attacks that's physical; null with no meta. */
const split = computed(() => meta.value?.physicalShare ?? null)

const defense = computed(() => (defending ? teamDefense(props.members, meta.value) : null))
// Attacking, by stats alone or with each attacker's best move at its peak, as last picked.
const MODE_KEY = 'sproutvgc.builder.offenseMode'
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
const offense = computed(() => (defending ? null : teamOffense(props.members, meta.value, mode.value)))
const teamLanes = computed(() => (defense.value ?? offense.value)!.lanes)

// The chart.
const lanes = computed((): LaneView[] =>
  SIDES.map((side) => {
    const lane = teamLanes.value[side]
    return {
      side,
      label: sideName(side),
      sub: defending
        ? undefined
        : t(lane.points.length === 1 ? 'builder.balance.attacker' : 'builder.balance.attackers', {
            n: lane.points.length,
          }),
      // Defending, the meta's share of attacks on that side, on its name's hover.
      tip:
        defending && split.value !== null
          ? t(`builder.balance.share.${side}`, { pct: pct(side === 'physical' ? split.value : 1 - split.value) })
          : undefined,
      shape: meta.value?.[LANE_KEYS[defending ? 'defense' : mode.value][side]].shape ?? null,
      points: lane.points,
      mean: lane.mean,
    }
  }),
)
const ends = computed((): [string, string] =>
  defending
    ? [t('builder.balance.frailer'), t('builder.balance.bulkier')]
    : [t('builder.balance.softer'), t('builder.balance.harder')],
)
const standing = (side: Side, rank: number) =>
  defending
    ? t('builder.balance.bulkierThan', { pct: pct(rank) })
    : t(side === 'physical' ? 'builder.balance.physHarder' : 'builder.balance.specHarder', { pct: pct(rank) })
function tip(p: Plotted, side: Side): string {
  const how = p.move
    ? refName(move(p.move))
    : defending
      ? ''
      : `${t(side === 'physical' ? 'stat.atk' : 'stat.spa')} ${Math.round(p.value)}`
  const where = p.rank === null ? '' : standing(side, p.rank)
  return [name(p.pokemon), how, where, p.mixed ? t('builder.balance.mixedTip') : ''].filter(Boolean).join(' · ')
}
function meanTip(l: LaneView): string {
  const rank = teamLanes.value[l.side].rank
  return [t('builder.balance.average'), rank === null ? '' : standing(l.side, rank)].filter(Boolean).join(' · ')
}

// The insights behind the verdict, in its lightbulb's popover: each side's percentile among the meta, the team's mean.
const insights = computed(() =>
  SIDES.map((side) => ({
    side,
    label: t(
      defending
        ? side === 'physical'
          ? 'builder.balance.physBulk'
          : 'builder.balance.specBulk'
        : side === 'physical'
          ? 'builder.balance.physAttack'
          : 'builder.balance.specAttack',
    ),
    rank: teamLanes.value[side].rank,
    caption: defending
      ? t('builder.balance.tileBulk')
      : t(side === 'physical' ? 'builder.balance.tilePhys' : 'builder.balance.tileSpec'),
  })),
)
// The panel's verdict.
const verdict = computed((): { text: string; side?: Side } | null => {
  if (!meta.value) return null
  if (defense.value) {
    const v = defenseVerdict(defense.value, meta.value)
    if (!v) return null
    if (v.kind === 'weak')
      return {
        text: t(v.side === 'physical' ? 'builder.balance.weakPhysical' : 'builder.balance.weakSpecial', {
          pct: v.share === null ? '' : pct(v.share),
        }),
        side: v.side,
      }
    return { text: t(`builder.balance.${v.kind}`) }
  }
  const v = offenseVerdict(offense.value!)
  if (!v) return { text: t('builder.balance.noAttacks') }
  const lean = t(`builder.balance.lean.${v.lean}`)
  return {
    text: v.hits ? t('builder.balance.offense', { lean, hits: t(`builder.balance.hits.${v.hits}`) }) : `${lean}.`,
    side: v.lean === 'balanced' ? undefined : v.lean,
  }
})

// What helps each side: a group per side (physical, special, both), those it has.
const helps = computed(() => {
  const list = defense.value?.guards ?? offense.value!.boosts
  return (['physical', 'special', 'both'] as const).flatMap((side) => {
    const items = list.filter((s) => s.side === side)
    return items.length ? [{ side, items }] : []
  })
})
const supportName = (s: Support) => refName(s.kind === 'move' ? move(s.id as MoveId) : ability(s.id as AbilityId))
// The chart's explanation, its heading's tooltip.
const howBody = useTemplateRef<HTMLElement>('howBody')
const supportTip = (s: Support) => `${supportName(s)}: ${s.pokemon.map(name).join(', ')}`
</script>

<template>
  <details class="panel banded balance" :open @toggle="onToggle">
    <summary>{{ t(`builder.section.${side}`) }}</summary>
    <!-- Its verdict, a line, and the numbers behind it in its lightbulb's popover; a placeholder until the meta's
         side is in. -->
    <p v-if="pending" class="verdict bone" aria-hidden="true"></p>
    <div v-else-if="verdict" class="verdict" :data-side="verdict.side">
      <CategoryIcon v-if="verdict.side" :category="verdict.side" :tip="false" /><span>{{ verdict.text }}</span>
      <OptionsMenu :title="t('builder.balance.insights')" :icon="Lightbulb" align="left">
        <dl class="insights">
          <div v-for="x in insights" :key="x.side" class="insight">
            <dt><CategoryIcon :category="x.side" :tip="false" />{{ x.label }}</dt>
            <dd>
              <span class="insight-value">{{ x.rank === null ? '—' : pct(x.rank) }}</span>
              <span class="muted">{{ x.caption }}</span>
            </dd>
          </div>
        </dl>
      </OptionsMenu>
    </div>
    <div class="dash-wrap">
      <div class="dash">
        <!-- The chart against the meta. -->
        <section class="card chart-card">
          <header class="card-head">
            <!-- How its percentages come about, in plain words, on its heading's hover (tapped on phones). -->
            <h3 v-tip="howBody" class="tipped" tabindex="0" :aria-label="howBody?.textContent ?? undefined">
              {{ t(defending ? 'builder.balance.chartDef' : 'builder.balance.chartAtk') }}
            </h3>
            <div hidden>
              <div ref="howBody" class="how">
                <p>{{ t(defending ? 'builder.balance.howDef' : 'builder.balance.howAtk') }}</p>
                <p v-if="!defending && mode === 'moves'">{{ t('builder.balance.howMoves') }}</p>
                <p>
                  {{ t('builder.balance.howMeta') }}
                  <template v-if="!defending">{{ t('builder.balance.howMetaAtk') }}</template>
                </p>
              </div>
            </div>
            <SegmentedControl
              v-if="!defending"
              v-model="mode"
              class="mode"
              :label="t('builder.balance.modeLabel')"
              :tip="t('builder.balance.modeTip')"
              :options="modes"
            />
          </header>
          <BalanceLanes :lanes :ends :tip :mean-tip :state="pending ? 'pending' : meta === null ? 'none' : undefined" />
          <!-- Attacking, those off the lanes. -->
          <p v-if="offense && (offense.support.length || offense.unset.length)" class="tray">
            <span v-if="offense.support.length" class="tray-group"
              ><span class="muted">{{ t('builder.balance.supportOnly') }}</span
              ><span v-for="p in offense.support" :key="p" v-tip="name(p)" class="tray-mon"
                ><PokemonIcon :id="p" /></span
            ></span>
            <span v-if="offense.unset.length" class="tray-group"
              ><span class="muted">{{ t('builder.balance.noMoves') }}</span
              ><span v-for="p in offense.unset" :key="p" v-tip="name(p)" class="tray-mon"><PokemonIcon :id="p" /></span
            ></span>
          </p>
        </section>

        <!-- What helps each side. -->
        <section class="card helps-card">
          <header class="card-head">
            <h3>{{ t(defending ? 'builder.balance.guards' : 'builder.balance.boosts') }}</h3>
          </header>
          <p v-if="!helps.length" class="muted helps-none">
            {{ t(defending ? 'builder.balance.noGuards' : 'builder.balance.noBoosts') }}
          </p>
          <div v-for="h in helps" :key="h.side" class="help-group">
            <span class="help-side">
              <template v-if="h.side === 'both'"
                ><CategoryIcon category="physical" :tip="false" /><CategoryIcon category="special" :tip="false"
              /></template>
              <CategoryIcon v-else :category="h.side" :tip="false" />
            </span>
            <span class="help-items">
              <span v-for="x in h.items" :key="`${x.kind}:${x.id}`" v-tip="supportTip(x)" class="chip"
                >{{ supportName(x) }}<PokemonIcon v-for="p in x.pokemon" :id="p" :key="p" :scale="0.75"
              /></span>
            </span>
          </div>
        </section>

        <!-- Its types; on phones folded until unfolded, then as last left. -->
        <section class="card types-card" :class="{ folded: narrow && !typesOpen }">
          <header class="card-head">
            <button
              v-if="narrow"
              type="button"
              class="fold"
              :aria-expanded="typesOpen"
              :aria-controls="`${side}-types`"
              @click="toggleTypes"
            >
              <span class="title">{{ t('builder.balance.types') }}</span>
              <span class="card-sub">{{ t(defending ? 'builder.balance.typesDef' : 'builder.balance.typesAtk') }}</span>
              <ChevronDown class="fold-chevron" :size="16" aria-hidden="true" />
            </button>
            <template v-else>
              <h3>{{ t('builder.balance.types') }}</h3>
              <span class="card-sub">{{ t(defending ? 'builder.balance.typesDef' : 'builder.balance.typesAtk') }}</span>
            </template>
          </header>
          <TeamCoverage v-if="!narrow || typesOpen" :id="`${side}-types`" :side="defending ? 'def' : 'atk'" :members />
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
/* The verdict: what to take from the panel, a callout before its cards, framed as they are; its left edge in the
   color of the side it's about (neutral when it's about both), its text the text's own color, a little heavier. */
.verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px 14px;
  font-weight: 600;
  line-height: 1.35;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-left: 3px solid var(--muted);
}
.verdict[data-side='physical'] {
  border-left-color: var(--physical);
}
.verdict[data-side='special'] {
  border-left-color: var(--special);
}
/* The dashboard: tiles across, then the chart and what helps side by side (wide), then the types across; laid out by
   the panel's width (its wrapper the container: a grid can't query its own). */
.dash-wrap {
  container-type: inline-size;
}
.dash {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'chart' 'helps' 'types';
  gap: 12px;
}
@container (min-width: 760px) {
  .dash {
    grid-template-columns: minmax(0, 1fr) 15rem;
    grid-template-areas: 'chart helps' 'types types';
  }
}
.chart-card {
  grid-area: chart;
}
.helps-card {
  grid-area: helps;
}
.types-card {
  grid-area: types;
}
/* A card: a question of its own, its header over what answers it. */
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
/* A heading with more to it on hover: how the card's numbers come about. */
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
.types-card.folded .card-head {
  margin-bottom: 0;
}
/* The types' header on phones, the way to fold them: across the card, its chevron at the end. */
.fold {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.fold-chevron {
  margin-left: auto;
  color: var(--muted);
  transition: transform 0.18s ease;
}
.folded .fold-chevron {
  transform: rotate(-90deg);
}
@media (prefers-reduced-motion: reduce) {
  .fold-chevron {
    transition: none;
  }
}
.card-head :is(h3, .title) {
  margin: 0;
  font-size: 0.78em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.card-sub {
  font-size: 0.85em;
  color: var(--muted);
}
.mode {
  margin-left: auto;
  font-size: 0.9em;
}
/* The insights, in the lightbulb's popover: a side per line, its badge and name, its percentile and what it means. */
.insights {
  display: grid;
  gap: 10px;
  min-width: 15rem;
  margin: 0;
}
.insight dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}
.insight dd {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 2px 0 0;
  font-size: 0.9em;
}
.insight-value {
  font-size: 1.3em;
  font-weight: bold;
}
.tray {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 14px 0 0;
  padding-top: 10px;
  font-size: 0.85em;
  border-top: 1px solid var(--border);
}
.tray-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tray-group > .muted {
  margin-right: 4px;
}
.tray-mon {
  line-height: 0;
}
/* What helps: a group per side, its badge (both for both) by its chips. */
.help-group {
  /* A row of chips as tall as the badge or a chip, whichever is taller, the badge level with the first. */
  --row: max(26px, calc(20px * var(--icon-scale, 1)));
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.help-group + .help-group {
  margin-top: 10px;
}
.help-side {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  min-height: var(--row);
}
.help-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
.helps-none {
  margin: 0;
  font-size: 0.9em;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: var(--row);
  padding: 1px 4px 1px 8px;
  font-size: 0.85em;
  background: var(--panel);
  border: 1px solid var(--border);
}
/* Placeholders while the meta's side is worked out. */
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
