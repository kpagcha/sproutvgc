<script setup lang="ts">
import { computed, watch } from 'vue'
import { Star } from '@lucide/vue'
import type { Ref } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useFavorites } from '@/composables/useFavorites'
import { useRecent } from '@/composables/useRecent'

// An entry page's title: the entry's name, and a star to add it to the reader's favorites (shown on the home page).
// It records the visit too, for the home page's recently viewed. With `meta`, a Pokémon's meta entry's: its star is
// the meta entry's, and the router records the visit (`meta.recent`).
const props = defineProps<{ to: Ref; meta?: boolean }>()

const { isFavorite, toggle, isMetaFavorite, toggleMeta } = useFavorites()
const { visit } = useRecent()
watch(
  () => props.to,
  (to) => !props.meta && visit(to),
  { immediate: true },
)
const on = computed(() => (props.meta ? isMetaFavorite(props.to.id) : isFavorite(props.to)))
const flip = () => (props.meta ? toggleMeta(props.to.id) : toggle(props.to))
</script>

<template>
  <div class="entry-title">
    <h1>{{ refName(to) }}</h1>
    <button
      v-tip="t(on ? 'favorites.remove' : 'favorites.add')"
      type="button"
      class="star"
      :class="{ on }"
      :aria-label="t('favorites.add')"
      :aria-pressed="on"
      @click="flip"
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
