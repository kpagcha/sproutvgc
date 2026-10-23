<script setup lang="ts">
import { locale, t } from '@/i18n'

// How many battles the meta's data shown counts, beside it on the rankings: toned down, smaller than the intro and
// fainter, one style for the whole of it.
defineProps<{ n: number }>()
</script>

<template>
  <span class="battles">{{ t('usage.battles', { n: n.toLocaleString(locale) }) }}</span>
</template>

<style scoped>
.battles {
  font-size: 0.8125em;
  color: color-mix(in srgb, var(--muted) 75%, transparent);
  font-variant-numeric: tabular-nums;
}
</style>
