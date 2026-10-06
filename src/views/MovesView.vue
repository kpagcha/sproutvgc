<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { CATEGORIES, FLAGS, type Category, type Flag } from '@/data/moves'
import { t } from '@/i18n'
import MoveTable from '@/components/MoveTable.vue'
import { useActiveQuery } from '@/composables/useActiveQuery'

// Every move the regulation has, with its numbers and short description.
const ids = availableIds('move')
// The home page's search links here with its query (`?q=`).
const route = useActiveQuery()
const q = computed(() => (typeof route.value.q === 'string' ? route.value.q : undefined))
// The category and flag filters are kept in the URL (`?category=`, `?flag=`), so a move's page can link here with them.
const router = useRouter()
function param<T extends string>(name: string, values: readonly T[]) {
  return computed({
    get: () => {
      const v = route.value[name]
      return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : ''
    },
    set: (v: T | '') => void router.replace({ query: { ...route.value, [name]: v || undefined } }),
  })
}
const category = param<Category>('category', CATEGORIES)
const flag = param<Flag>('flag', FLAGS)
</script>

<template>
  <!-- The heading and the filters, and the table, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <MoveTable
      :ids="ids"
      descriptions
      panels
      :placeholder="t('moves.search')"
      :query="q"
      remember="moves"
      v-model:category="category"
      v-model:flag="flag"
    >
      <h1>{{ t('title.moves') }}</h1>
      <p class="muted">{{ t('moves.intro', { reg: REGULATION, n: ids.length }) }}</p>
    </MoveTable>
  </div>
</template>
