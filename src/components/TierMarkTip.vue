<script setup lang="ts">
import { percent } from '@/data/meta'
import type { StatId } from '@/data/pokemon'
import { t } from '@/i18n'
import type { Benchmark, NatureEffect } from '@/lib/stats'
import EffectTag from '@/components/EffectTag'

/** What a mark is: its value as the ladder writes it, its share of the Pokémon's sets and the builds reaching it; or,
 * on a row with no sets, the benchmark it is. */
export type TierPointed =
  | {
      label: string
      share: number
      sets: { effect: NatureEffect; points: number; hp: number; share: number }[]
    }
  | { label: string; bench: Benchmark }

// The bulk and power tiers' marks' tooltip, as the speed tiers' (`SpeedOddsTip`): the value and its share, then a line
// per build reaching it, its nature's effect on the stat, its HP points (bulk) and the stat's points, and its share
// where there are several; or the benchmark. Given a holder, so pointing from mark to mark draws it alone again.
defineProps<{ state: { pointed: TierPointed | null }; stat: StatId; hp: boolean }>()
</script>

<template>
  <div class="tip-body">
    <template v-if="state.pointed && 'bench' in state.pointed">
      <div class="tip-head num">{{ state.pointed.label }} · {{ t(`stat.bench.${state.pointed.bench}`) }}</div>
      <div>{{ t(`tiers.benchTip.${state.pointed.bench}`, { stat: t(`stat.${stat}`) }) }}</div>
    </template>
    <template v-else-if="state.pointed">
      <div class="tip-head num">{{ state.pointed.label }} · {{ percent(state.pointed.share) }}</div>
      <div v-for="b in state.pointed.sets" :key="`${b.effect}:${b.hp}:${b.points}`" class="tip-build">
        <EffectTag :effect="b.effect" :stat /><span v-if="hp">{{ t('tiers.hpPoints', { n: b.hp }) }}</span
        ><span>{{ t('tiers.statPoints', { n: b.points, stat: t(`stat.${stat}`) }) }}</span
        ><span v-if="state.pointed.sets.length > 1" class="tip-share">{{ percent(b.share) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The value and its share, then a line per build reaching it. */
.tip-head {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.tip-build {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.tip-share {
  margin-left: auto;
  padding-left: 8px;
  opacity: 0.75;
}
</style>
