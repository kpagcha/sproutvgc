<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import { reachOf, type SpreadPoint } from '@/lib/speedLineup'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import SpeedCommonSpeeds from '@/components/SpeedCommonSpeeds.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'

// How one of the comparison's Pokémon does against another, in panels of its own under its side's, each topped by a
// band of its side's color: at its sets, every Speed they reach against the other, as a chart (`SpeedSpread`), and,
// the other at one build, a panel folded under it of its common Speeds and what the other takes to move before each
// (`SpeedCommonSpeeds`), a mark tapped on the chart unfolding it at that Speed; both at one build, what it takes to
// move before the other (`SpeedAgainst`). At one build against the other at its sets, nothing: the other's panels
// have it.
export interface VersusMon {
  id: PokemonId
  name: string
  build: SpeedBuild
  /** At one build its Speed; at its sets, the most common. */
  speed: number
  spread: readonly SpreadPoint[]
  sets: boolean
}
const props = defineProps<{
  me: VersusMon
  them: VersusMon
  tone: 'yours' | 'opponent'
  trickRoom: boolean
}>()

const breakdown = computed(() => props.me.sets && !props.them.sets)
const open = ref(false)
const focus = ref<number | null>(null)
watch(
  () => props.me.id,
  () => (focus.value = null),
)
function pick(speed: number) {
  focus.value = speed
  open.value = true
}
</script>

<template>
  <div v-if="me.sets || !them.sets" class="versus" :class="tone">
    <section class="panel insight">
      <SpeedSpread
        v-if="me.sets"
        :title="t('compare.spread', { name: me.name })"
        :spread="me.spread"
        :tone
        :other="{ name: them.name, spread: them.spread, sets: them.sets }"
        :reach="reachOf(me.id, me.build)"
        :trick-room="trickRoom"
        :pickable="breakdown"
        banded
        @pick="pick"
      />
      <SpeedAgainst
        v-else
        :title="t('compare.against', { name: them.name, speed: them.speed })"
        :id="me.id"
        :build="me.build"
        :target="them.speed"
        :trick-room="trickRoom"
        banded
      />
    </section>
    <section v-if="breakdown" class="panel insight">
      <SpeedCommonSpeeds
        v-model:open="open"
        :yours="them"
        :opponent="me"
        :trick-room="trickRoom"
        :focus
        banded
        foldable
      />
    </section>
  </div>
</template>

<style scoped>
.versus {
  --side: var(--accent);
  --side-text: var(--accent-text);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.versus.opponent {
  --side: var(--opponent);
  --side-text: var(--opponent-text);
}
.insight {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
</style>
