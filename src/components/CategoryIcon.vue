<script setup lang="ts">
import { t } from '@/i18n'
import type { Category } from '@/data/moves'
import { CATEGORY_ICONS } from '@/lib/sprites'

// A move's category badge (Showdown's), the size of a type badge.
defineProps<{ category: Category }>()
</script>

<template>
  <img
    v-tip="t(`move.category.${category}`)"
    class="pixel category-icon"
    :src="CATEGORY_ICONS[category]"
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
