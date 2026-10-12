<script setup lang="ts">
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import { reachOf, type SpreadPoint } from '@/lib/speedLineup'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import SpeedCommonSpeeds from '@/components/SpeedCommonSpeeds.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'

// How one of the comparison's Pokémon does against another, in its panel: at its sets, every Speed they reach against
// the other, as a chart (`SpeedSpread`); at one build, what it takes to move before the other (`SpeedAgainst`), or, the
// other at its sets, before each of its common Speeds (`SpeedCommonSpeeds`).
export interface VersusMon {
  id: PokemonId
  name: string
  build: SpeedBuild
  /** At one build its Speed; at its sets, the most common. */
  speed: number
  spread: readonly SpreadPoint[]
  sets: boolean
}
defineProps<{
  me: VersusMon
  them: VersusMon
  tone: 'yours' | 'opponent'
  trickRoom: boolean
  banded?: boolean
}>()
</script>

<template>
  <SpeedSpread
    v-if="me.sets"
    :title="t('compare.spread', { name: me.name })"
    :spread="me.spread"
    :tone
    :other="{ name: them.name, spread: them.spread, sets: them.sets }"
    :reach="reachOf(me.id, me.build)"
    :trick-room="trickRoom"
    :banded
  />
  <SpeedCommonSpeeds v-else-if="them.sets" :yours="me" :opponent="them" :trick-room="trickRoom" :banded />
  <SpeedAgainst
    v-else
    :title="t('compare.against', { name: them.name, speed: them.speed })"
    :id="me.id"
    :build="me.build"
    :target="them.speed"
    :trick-room="trickRoom"
    :banded
  />
</template>
