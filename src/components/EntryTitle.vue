<script setup lang="ts">
import { Star } from '@lucide/vue'
import type { Ref } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useFavorites } from '@/composables/useFavorites'

// An entry page's title: the entry's name, and a star to add it to the reader's favorites (shown on the home page).
defineProps<{ to: Ref }>()

const { isFavorite, toggle } = useFavorites()
</script>

<template>
  <div class="entry-title">
    <h1>{{ refName(to) }}</h1>
    <button
      v-tip="t(isFavorite(to) ? 'favorites.remove' : 'favorites.add')"
      type="button"
      class="star"
      :class="{ on: isFavorite(to) }"
      :aria-label="t('favorites.add')"
      :aria-pressed="isFavorite(to)"
      @click="toggle(to)"
    >
      <Star :size="16" :stroke-width="2.5" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.entry-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.entry-title h1 {
  margin: 0;
}
.star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: -2px 0;
  padding: 0;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
}
.star:hover {
  color: var(--text);
}
.star.on {
  color: var(--accent);
}
.star.on .lucide {
  fill: currentColor;
}
</style>
