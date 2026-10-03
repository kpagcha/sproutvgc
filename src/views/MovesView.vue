<script setup lang="ts">
import { availableIds } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import MoveTable from '@/components/MoveTable.vue'

// Every move the regulation has, with its numbers and short description.
const ids = availableIds('move')
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.moves') }}</h1>
    <p class="muted">{{ t('moves.intro', { reg: REGULATION, n: ids.length }) }}</p>
    <MoveTable :ids="ids" descriptions :placeholder="t('moves.search')" />
  </div>
</template>
