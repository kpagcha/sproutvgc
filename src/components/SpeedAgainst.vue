<script setup lang="ts">
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { t } from '@/i18n'
import { pointsText, type toMoveFirst } from '@/lib/speedBuild'

// What it takes a Pokémon to move before another, at each nature effect, under its heading. The comparison's: in each
// side's panel, and on phones together under the two.
defineProps<{ title: string; rows: NonNullable<ReturnType<typeof toMoveFirst>> }>()

const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const canHover = window.matchMedia('(hover: hover)').matches
</script>

<template>
  <strong class="small">{{ title }}</strong>
  <dl class="versus small">
    <template v-for="v in rows" :key="v.effect">
      <dt v-tip="canHover && !!EFFECT_ICONS[v.effect] && t(`speed.effect.${v.effect}`)" class="effect">
        <template v-if="EFFECT_ICONS[v.effect]"
          ><component :is="EFFECT_ICONS[v.effect]" :size="14" aria-hidden="true" /><span aria-hidden="true">{{
            t('stat.spe')
          }}</span
          ><span class="visually-hidden">{{ t(`speed.effect.${v.effect}`) }}</span></template
        >
        <template v-else>{{ t(`speed.effect.${v.effect}`) }}</template>
      </dt>
      <dd>{{ pointsText(v.result) }}</dd>
    </template>
  </dl>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.versus {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 0;
}
.versus dd {
  margin: 0;
}
.effect {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
