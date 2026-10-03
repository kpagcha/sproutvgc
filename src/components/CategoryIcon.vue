<script setup lang="ts">
import { t } from '@/i18n'
import type { Category } from '@/data/moves'
import physical from '@/assets/sprites/physical.png'
import special from '@/assets/sprites/special.png'
import status from '@/assets/sprites/status.png'

// A move's category badge (Showdown's), the size of a type badge.
defineProps<{ category: Category }>()
const URLS: Record<Category, string> = { physical, special, status }
</script>

<template>
  <img
    v-tip="t(`move.category.${category}`)"
    class="pixel category-icon"
    :src="URLS[category]"
    :alt="t(`move.category.${category}`)"
    width="32"
    height="14"
    draggable="false"
  />
</template>

<style scoped>
.category-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
