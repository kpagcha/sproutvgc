<script setup lang="ts">
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { Benchmark } from '@/lib/stats'
import EffectTag from '@/components/EffectTag'
import type { OddsRow } from '@/components/SpeedOdds.vue'

export type Pointed = OddsRow['builds'][number] | { speed: number; bench: Benchmark }

// What the speed tiers' ladder's tooltip says, moved into it by tippy: the Speed, its share, and the builds reaching
// it, as the ladder's tags have them; or, on a row with no sets (or a benchmark's tick), the benchmark it is. A
// component of its own, given a holder rather than what it points at, so that pointing from mark to mark draws it
// alone again, not the ladder.
defineProps<{ state: { pointed: Pointed | null } }>()
</script>

<template>
  <div class="tip-body">
    <template v-if="state.pointed && 'bench' in state.pointed">
      <div class="tip-head num">{{ state.pointed.speed }} · {{ t(`stat.bench.${state.pointed.bench}`) }}</div>
      <div>{{ t(`speed.benchTip.${state.pointed.bench}`) }}</div>
    </template>
    <template v-else-if="state.pointed">
      <div class="tip-head num">{{ state.pointed.speed }} · {{ percent(state.pointed.share) }}</div>
      <div v-for="b in state.pointed.sets" :key="`${b.effect}:${b.points}`" class="tip-build">
        <EffectTag :effect="b.effect" /><span>{{ t('speed.points', { n: b.points }) }}</span
        ><span v-if="state.pointed.sets.length > 1" class="tip-share">{{ percent(b.share) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The Speed and its share, then a line per build reaching it. */
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
