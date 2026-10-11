<script setup lang="ts">
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import type { NatureEffect } from '@/lib/stats'
import { toMoveFirst, type SpeedBuild } from '@/lib/speedBuild'
import { toBeatAll, type SpreadPoint } from '@/lib/speedLineup'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'

// How one of the comparison's Pokémon does against another, in its panel: at its sets, every Speed they reach against
// the other (`SpeedSpread`); at one build, what it takes to move before the other, at each nature effect: before its
// Speed, or, the other at its sets, before its most common Speed and before every one of them.
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
  banded?: boolean
  pickable?: boolean
}>()
const emit = defineEmits<{ pick: [b: { effect: NatureEffect; points: number }] }>()

const rows = (speed: number) => toMoveFirst(props.me.id, props.me.build, speed, props.trickRoom)
</script>

<template>
  <SpeedSpread
    v-if="me.sets"
    :title="t('compare.spread', { name: me.name })"
    :spread="me.spread"
    :tone
    :other="{ name: them.name, spread: them.spread, sets: them.sets }"
    :trick-room="trickRoom"
    :banded
    :pickable
    @pick="(b) => emit('pick', b)"
  />
  <template v-else-if="them.sets">
    <SpeedAgainst
      :title="t('compare.againstCommon', { name: them.name, speed: them.speed })"
      :rows="rows(them.speed)"
      :current="me.build.effect"
      :banded
    />
    <SpeedAgainst
      v-if="toBeatAll(them.spread, trickRoom) !== them.speed"
      :title="t('compare.againstAll', { name: them.name, speed: toBeatAll(them.spread, trickRoom) })"
      :rows="rows(toBeatAll(them.spread, trickRoom))"
      :current="me.build.effect"
      :banded
    />
  </template>
  <SpeedAgainst
    v-else
    :title="t('compare.against', { name: them.name, speed: them.speed })"
    :rows="rows(them.speed)"
    :current="me.build.effect"
    :banded
  />
</template>
