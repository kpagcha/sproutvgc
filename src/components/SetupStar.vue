<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Star } from '@lucide/vue'
import { t } from '@/i18n'
import { useFavorites } from '@/composables/useFavorites'
import type { PageVisit } from '@/composables/useRecent'

// The star by a page's heading that adds its setup as it is now to the reader's favorites (what its route's
// `meta.setup` keeps of the URL), or takes it out when it's already there: lit while the page shows a setup starred.
// Nothing while the page has no setup to star (a comparison with one Pokémon picked). As `EntryTitle`'s, in a heading
// that folds the page's controls, so its click is its own.
const route = useRoute()
const { isSetupFavorite, toggleSetup } = useFavorites()

const setup = computed((): PageVisit | null => {
  const query = route.meta.setup?.(route.query)
  return query ? { page: String(route.name), path: route.path, query } : null
})
const on = computed(() => !!setup.value && isSetupFavorite(setup.value))
</script>

<template>
  <button
    v-if="setup"
    v-tip="t(on ? 'favorites.removeSetup' : 'favorites.addSetup')"
    type="button"
    class="star"
    :class="{ on }"
    :aria-label="t('favorites.addSetup')"
    :aria-pressed="on"
    @click.stop.prevent="toggleSetup(setup)"
    @keydown.enter.stop
    @keydown.space.stop
  >
    <Star :size="18" :stroke-width="2.5" aria-hidden="true" />
  </button>
</template>

<style scoped>
.star {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 6px;
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
