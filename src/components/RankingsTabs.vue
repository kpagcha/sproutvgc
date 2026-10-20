<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import BandTabs from '@/components/BandTabs.vue'

// The rankings, a page each (`/meta/pokemon`, the one most come for, `/meta/moves`, `/meta/items`, `/meta/abilities`),
// as tabs on the band of the page's first panel (`BandTabs`).
export type RankingList = 'pokemon' | 'moves' | 'items' | 'abilities'

defineProps<{ current: RankingList }>()

const lists = computed(() => [
  { value: 'pokemon' as const, label: t('nav.pokemon'), to: { name: 'rankings' } },
  { value: 'moves' as const, label: t('nav.moves'), to: { name: 'moveRankings' } },
  { value: 'items' as const, label: t('nav.items'), to: { name: 'itemRankings' } },
  { value: 'abilities' as const, label: t('nav.abilities'), to: { name: 'abilityRankings' } },
])
</script>

<template>
  <BandTabs :label="t('usage.lists')" :current :tabs="lists" />
</template>
