<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import FolderTabs from '@/components/FolderTabs.vue'
import TypeMatchupsView from '@/views/TypeMatchupsView.vue'
import TypeChartView from '@/views/TypeChartView.vue'

// The type matchups and the type chart, one page: its title, then a tab each, folder tabs on a rule across the page
// (as the damage calculator's), each tab a child route, a page of its own (`/tools/types/matchups`,
// `/tools/types/chart`) with its own title for search. Their picks aren't carried from one to the other: the two read
// `atk` and `def` differently. The tab drawn here, not by a nested `RouterView`, which would empty as the page slides
// away to another (its route then has no child): kept as it was while the route is another page's.
type Tab = 'matchups' | 'chart'
const route = useRoute()
const router = useRouter()
const tab = shallowRef<Tab>('matchups')
watch(
  () => route.name,
  (name) => {
    if (name === 'chart' || name === 'matchups') tab.value = name
  },
  { immediate: true },
)
const tabs = computed(() => [
  { value: 'matchups' as const, label: t('nav.matchups') },
  { value: 'chart' as const, label: t('title.chart') },
])
const toTab = (to: Tab) => {
  if (to !== tab.value) void router.push({ name: to })
}
</script>

<template>
  <h1 class="types-title">{{ t('title.matchups') }}</h1>
  <div class="types-tabs">
    <FolderTabs :model-value="tab" :label="t('title.matchups')" :options="tabs" @update:model-value="toTab" />
  </div>
  <TypeMatchupsView v-if="tab === 'matchups'" />
  <TypeChartView v-else />
</template>

<style scoped>
.types-title {
  margin: 4px 0 8px;
}
/* The tabs on a rule across the page, the one shown the page's color, joined to it. */
.types-tabs {
  --tab-bg: var(--bg);
  margin-bottom: 12px;
  border-bottom: 2px solid var(--ink);
}
</style>
