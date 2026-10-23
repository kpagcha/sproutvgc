<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'
import { t } from '@/i18n'
import BandTabs, { LIFT } from '@/components/BandTabs.vue'
import SectionNav from '@/components/SectionNav.vue'

// The rankings, a page each (`/meta/pokemon`, the one most come for, `/meta/moves`, `/meta/items`, `/meta/abilities`),
// as tabs (`BandTabs`, bare) heading the page, stuck to the top for the whole page as it scrolls, on phones too, with
// the row of links to the page's panels under them (`SectionNav`, `sections`), stuck under them; the height the tabs
// take there set on the page (`--tabs-h`), and the tabs' and the row's (`--stuck-h`), for its table's header to stick
// under them and a panel scrolled to to land under them.
export type RankingList = 'pokemon' | 'moves' | 'items' | 'abilities'

defineProps<{ current: RankingList; sections?: readonly { id: string; label: string }[] }>()

const lists = computed(() => [
  { value: 'pokemon' as const, label: t('nav.pokemon'), to: { name: 'rankings' } },
  { value: 'moves' as const, label: t('nav.moves'), to: { name: 'moveRankings' } },
  { value: 'items' as const, label: t('nav.items'), to: { name: 'itemRankings' } },
  { value: 'abilities' as const, label: t('nav.abilities'), to: { name: 'abilityRankings' } },
])

const box = { box: 'border-box' } as const
const tabs = useTemplateRef<{ band: HTMLElement | null }>('tabs')
const nav = useTemplateRef<{ $el: HTMLElement }>('nav')
const { height } = useElementSize(() => tabs.value?.band, undefined, box)
const { height: navHeight } = useElementSize(() => nav.value?.$el, undefined, box)
watchEffect(() => {
  const page = tabs.value?.band?.parentElement
  if (!page) return
  page.style.setProperty('--tabs-h', `${height.value - LIFT}px`)
  // The row tucked 3px under the tabs (`SectionNav`).
  page.style.setProperty('--stuck-h', `${height.value - LIFT + (nav.value ? navHeight.value - 3 : 0)}px`)
})
</script>

<template>
  <BandTabs ref="tabs" bare sticky no-bar :label="t('usage.lists')" :current :tabs="lists" />
  <SectionNav v-if="sections?.length" ref="nav" attached no-bar :sections />
</template>
