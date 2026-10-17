<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { formatTermFilters, parseTermFilters, type TermFilters } from '@/lib/searchTerms'
import { t } from '@/i18n'
import MoveTable from '@/components/MoveTable.vue'
import { useActiveQuery } from '@/composables/useActiveQuery'

// Every move the regulation has, with its numbers and short description.
const ids = availableIds('move')
// The home page's search links here with its query (`?q=`).
const route = useActiveQuery()
const q = computed(() => (typeof route.value.q === 'string' ? route.value.q : undefined))
// The filters are kept in the URL (`?f=`, `?fm=`), so a move's page can link here with them. A link from before them
// (`?category=`, `?flag=`) is read as theirs.
const router = useRouter()
const KINDS = ['type', 'category', 'flag', 'reach', 'pokemon'] as const
const filters = computed<TermFilters>({
  get: () => {
    const { f, category, flag } = route.value
    const old = [category && `category:${String(category)}`, flag && `flag:${String(flag)}`].filter(Boolean).join(',')
    return parseTermFilters(f ?? old, route.value.fm, KINDS)
  },
  set: (f) =>
    void router.replace({ query: { ...route.value, category: undefined, flag: undefined, ...formatTermFilters(f) } }),
})
</script>

<template>
  <!-- The heading and the filters, and the table, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <MoveTable :ids="ids" descriptions panels :kinds="KINDS" :query="q" remember="moves" v-model:filters="filters">
      <!-- Their usage rankings, as they link here. -->
      <div class="title-row">
        <h1>{{ t('title.moves') }}</h1>
        <RouterLink :to="{ name: 'moveRankings' }" class="other-page">{{ t('lists.toMeta') }} ›</RouterLink>
      </div>
      <p class="muted">{{ t('moves.intro', { reg: REGULATION, n: ids.length }) }}</p>
    </MoveTable>
  </div>
</template>
