<script setup lang="ts">
import { useRoute } from 'vue-router'
import { availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import MoveTable from '@/components/MoveTable.vue'

// Every move the regulation has, with its numbers and short description.
const ids = availableIds('move')
// The home page's search links here with its query (`?q=`).
const q = useRoute().query.q
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.moves') }}</h1>
    <p class="muted">{{ t('moves.intro', { reg: REGULATION, n: ids.length }) }}</p>
    <MoveTable
      :ids="ids"
      descriptions
      :placeholder="t('moves.search')"
      :query="typeof q === 'string' ? q : undefined"
    />
  </div>
</template>
