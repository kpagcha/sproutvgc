<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ability, move, pokemon, type AbilityId, type MoveId, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useOpenState } from '@/composables/useOpenState'
import type { Member } from '@/lib/team'
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
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TeamCoverage from '@/components/TeamCoverage.vue'

// One side of the team builder's team, a panel of its own: Defense or Offense (`teamBalance.ts`). It opens with its
// verdict, a line (the side it's weak on led by that side's badge); then its stats against the meta, a lane each for
// physical and special (`BalanceLanes`: the meta's spread of values and the team's Pokémon on it), what the team has
// for each side at its lane's end (guards defending, boosts attacking; those for both on both), and, attacking, those
// that only support and those with no moves yet under them; and last its types (`TeamCoverage`), a row of the same
// grid, its chart from the plots' left edge. The meta's side comes in after the page (`meta`: undefined until then,
// placeholders meanwhile; null with no meta, said so). Folds, folded by default on phones, then as last left.
const props = defineProps<{
  side: 'defense' | 'offense'
  members: readonly Member[]
  meta: MetaBalance | null | undefined
}>()

const { open, onToggle } = useOpenState(
  `sproutvgc.builder.${props.side}Open`,
  !window.matchMedia('(max-width: 720px)').matches,
)
const defending = props.side === 'defense'
const meta = computed(() => props.meta ?? null)
const pct = (x: number) => `${Math.round(x * 100)}%`
const name = (id: PokemonId) => refName(pokemon(id))
const sideName = (s: Side) => t(s === 'physical' ? 'builder.balance.physical' : 'builder.balance.special')

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
const lanes = computed((): LaneView[] =>
  (['physical', 'special'] as const).map((side) => {
    const lane = (defense.value ?? offense.value)!.lanes[side]
    const split = meta.value?.physicalShare
    const share = split == null ? null : side === 'physical' ? split : 1 - split
    return {
      side,
      label: sideName(side),
      sub: defending
        ? share === null
          ? ''
          : t('builder.balance.ofAttacks', { pct: pct(share) })
        : t(lane.points.length === 1 ? 'builder.balance.attacker' : 'builder.balance.attackers', {
            n: lane.points.length,
          }),
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
  const rank = (defense.value ?? offense.value)!.lanes[l.side].rank
  return [t('builder.balance.average'), rank === null ? '' : standing(l.side, rank)].filter(Boolean).join(' · ')
}

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

// What the team has for each side: a lane's own, and those for both.
const helps = computed(() => defense.value?.guards ?? offense.value!.boosts)
const helpsFor = (side: Side) => helps.value.filter((s) => s.side === side || s.side === 'both')
const supportName = (s: Support) => refName(s.kind === 'move' ? move(s.id as MoveId) : ability(s.id as AbilityId))
const supportTip = (s: Support) => `${supportName(s)}: ${s.pokemon.map(name).join(', ')}`
</script>

<template>
  <details class="panel banded balance" :open @toggle="onToggle">
    <summary>{{ t(`builder.section.${side}`) }}</summary>
    <!-- Its verdict, a line; a placeholder until the meta's side is in. -->
    <p v-if="props.meta === undefined" class="verdict bone" aria-hidden="true"></p>
    <p v-else-if="verdict" class="verdict">
      <CategoryIcon v-if="verdict.side" :category="verdict.side" :tip="false" />{{ verdict.text }}
    </p>
    <!-- One grid: its lanes, what helps each side, then its types as a row of it. -->
    <div class="body">
      <BalanceLanes
        :lanes
        :ends
        :aside-title="t(defending ? 'builder.balance.guards' : 'builder.balance.boosts')"
        :has-aside="(lane) => helpsFor(lane).length > 0"
        :tip
        :mean-tip
        :state="props.meta === undefined ? 'pending' : props.meta === null ? 'none' : undefined"
      >
        <template v-if="!defending" #head>
          <SegmentedControl
            v-model="mode"
            :label="t('builder.balance.modeLabel')"
            :tip="t('builder.balance.modeTip')"
            :options="modes"
          />
        </template>
        <template #aside="{ side: lane }">
          <span v-for="x in helpsFor(lane)" :key="`${x.kind}:${x.id}`" v-tip="supportTip(x)" class="chip"
            >{{ supportName(x) }}<PokemonIcon v-for="p in x.pokemon" :id="p" :key="p" :scale="0.75"
          /></span>
        </template>
        <template #after>
          <!-- Attacking, those off the lanes. -->
          <template v-if="offense && (offense.support.length || offense.unset.length)">
            <div class="row-label small muted">{{ t('builder.balance.offLanes') }}</div>
            <p class="row-wide tray">
              <span v-if="offense.support.length" class="tray-group"
                ><span class="muted">{{ t('builder.balance.supportOnly') }}</span
                ><span v-for="p in offense.support" :key="p" v-tip="name(p)" class="tray-mon"
                  ><PokemonIcon :id="p" /></span
              ></span>
              <span v-if="offense.unset.length" class="tray-group"
                ><span class="muted">{{ t('builder.balance.noMoves') }}</span
                ><span v-for="p in offense.unset" :key="p" v-tip="name(p)" class="tray-mon"
                  ><PokemonIcon :id="p" /></span
              ></span>
            </p>
          </template>
          <div class="row-label">
            <span class="row-name">{{ t('builder.balance.types') }}</span>
            <span class="row-sub">{{ t(defending ? 'builder.balance.typesDef' : 'builder.balance.typesAtk') }}</span>
          </div>
          <TeamCoverage class="row-wide" :side="defending ? 'def' : 'atk'" :members />
        </template>
      </BalanceLanes>
    </div>
  </details>
</template>

<style scoped>
.balance > summary {
  cursor: pointer;
  font-family: var(--font-display, inherit);
  font-weight: bold;
}
/* The verdict: what to take from the panel, before its charts; in the text's own size and color, the charts the
   panel's loud part. */
.verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  line-height: 1.35;
}
.tray {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 0.85em;
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
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px 1px 8px;
  font-size: 0.85em;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
/* The grid's container: it lays itself out by the panel's width (`BalanceLanes`). */
.body {
  container-type: inline-size;
}
/* The verdict's placeholder while the meta's side is worked out. */
.verdict.bone {
  width: 60%;
  height: 1.3em;
  background: var(--border);
  opacity: 0.5;
  animation: pulse 1.2s ease-in-out infinite alternate;
}
@keyframes pulse {
  to {
    opacity: 0.25;
  }
}
</style>
