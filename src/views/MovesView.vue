<script setup lang="ts">
import { computed } from 'vue'
import { availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import MoveTable from '@/components/MoveTable.vue'
import { useActiveQuery } from '@/composables/useActiveQuery'

// Every move the regulation has, with its numbers and short description.
const ids = availableIds('move')
// The home page's search links here with its query (`?q=`).
const route = useActiveQuery()
const q = computed(() => (typeof route.value.q === 'string' ? route.value.q : undefined))
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.moves') }}</h1>
    <p class="muted">{{ t('moves.intro', { reg: REGULATION, n: ids.length }) }}</p>
    <MoveTable :ids="ids" descriptions :placeholder="t('moves.search')" :query="q" />
  </div>
</template>
