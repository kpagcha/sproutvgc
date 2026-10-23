<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'
import { t } from '@/i18n'
import BandTabs, { LIFT } from '@/components/BandTabs.vue'

// The rankings, a page each (`/meta/pokemon`, the one most come for, `/meta/moves`, `/meta/items`, `/meta/abilities`),
// as tabs (`BandTabs`, bare) heading the page's first panel, stuck to the top for the whole page as it scrolls, on
// phones too; the height they take there set on the page (`--stuck-h`), for its table's header to stick under them.
export type RankingList = 'pokemon' | 'moves' | 'items' | 'abilities'

defineProps<{ current: RankingList }>()

const lists = computed(() => [
  { value: 'pokemon' as const, label: t('nav.pokemon'), to: { name: 'rankings' } },
  { value: 'moves' as const, label: t('nav.moves'), to: { name: 'moveRankings' } },
  { value: 'items' as const, label: t('nav.items'), to: { name: 'itemRankings' } },
  { value: 'abilities' as const, label: t('nav.abilities'), to: { name: 'abilityRankings' } },
])

const tabs = useTemplateRef<{ band: HTMLElement | null }>('tabs')
const { height } = useElementSize(() => tabs.value?.band, undefined, { box: 'border-box' })
watchEffect(() => tabs.value?.band?.parentElement?.style.setProperty('--stuck-h', `${height.value - LIFT}px`))
</script>

<template>
  <BandTabs ref="tabs" bare sticky no-bar :label="t('usage.lists')" :current :tabs="lists" />
</template>
