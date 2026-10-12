<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { reachOf } from '@/lib/speedLineup'
import SpeedCommonSpeeds from '@/components/SpeedCommonSpeeds.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'
import type { VersusMon } from '@/components/SpeedVersus.vue'

// One of yours against an opponent, either at its sets, in the matchups: the chart of the one at its sets (the
// opponent's when both are), the other on it; then, the opponent at its sets, its common Speeds and how yours does
// against each (`SpeedCommonSpeeds`), folded until opened or a mark on the chart is tapped, unfolding them at it.
const props = defineProps<{ yours: VersusMon; opponent: VersusMon; trickRoom: boolean }>()

const open = ref(false)
const focus = ref<number | null>(null)
watch(
  () => props.opponent.id,
  () => (focus.value = null),
)
function pick(speed: number) {
  focus.value = speed
  open.value = true
}

const charted = computed(() =>
  props.opponent.sets
    ? { me: props.opponent, them: props.yours, tone: 'opponent' as const }
    : { me: props.yours, them: props.opponent, tone: 'yours' as const },
)
</script>

<template>
  <div class="sets-detail">
    <SpeedSpread
      :title="t('compare.spread', { name: charted.me.name })"
      :spread="charted.me.spread"
      :tone="charted.tone"
      :other="{ name: charted.them.name, spread: charted.them.spread, sets: charted.them.sets }"
      :reach="reachOf(charted.me.id, charted.me.build)"
      :trick-room="trickRoom"
      :pickable="opponent.sets"
      @pick="pick"
    />
    <SpeedCommonSpeeds
      v-if="opponent.sets"
      v-model:open="open"
      :yours
      :opponent
      :trick-room="trickRoom"
      :focus
      foldable
    />
  </div>
</template>

<style scoped>
.sets-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
}
</style>
