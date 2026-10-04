<script setup lang="ts">
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { available, type ItemId, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { SECTIONS } from '@/composables/useSearch'
import { useFavorites } from '@/composables/useFavorites'
import { follow, refHref } from '@/lib/links'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The home page's favorites: the entries starred on their pages, as a pinboard of tags above the dex's sections, by
// category (in the sections' order), each alphabetically. Those the regulation doesn't have are left out (and kept,
// for when it has them again). Nothing shows until something is starred.
const { favorites } = useFavorites()

const order: string[] = SECTIONS.map((s) => s.kind)
const refs = computed(() =>
  favorites.value
    .filter((r) => available(r))
    .map((r) => ({ ref: r, name: refName(r) }))
    .sort((a, b) => order.indexOf(a.ref.kind) - order.indexOf(b.ref.kind) || a.name.localeCompare(b.name)),
)
</script>

<template>
  <section v-if="refs.length" class="favorites" :aria-label="t('favorites.title')">
    <h2 class="label font-display">
      <Star :size="14" :stroke-width="2.5" aria-hidden="true" />{{ t('favorites.title') }}
    </h2>
    <ul>
      <li v-for="{ ref: r, name } in refs" :key="`${r.kind}:${r.id}`">
        <a :href="refHref(r)" class="tag" @click="follow">
          <PokemonIcon v-if="r.kind === 'pokemon'" :id="r.id as PokemonId" />
          <ItemIcon v-else-if="r.kind === 'item'" :id="r.id as ItemId" />
          {{ name }}
        </a>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* Not a panel like the sections below: a dashed board the tags are pinned to. */
.favorites {
  margin-bottom: 16px;
  padding: 10px 12px 12px;
  border: 2px dashed var(--border-strong);
}
.label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: calc(13px * var(--display-scale, 1) * var(--text-scale));
  color: var(--muted);
}
.label .lucide {
  color: var(--accent);
  fill: currentColor;
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* Each favorite a tag that lifts like the type tools' cards. */
.tag {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 2px 10px;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  color: var(--text);
  font-weight: bold;
  transition:
    transform 0.08s ease-out,
    box-shadow 0.08s ease-out;
}
.tag:hover {
  text-decoration: none;
  transform: translate(-1px, -1px);
  box-shadow: var(--hard);
}
.tag:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .tag {
    transition: none;
  }
  .tag:is(:hover, :active) {
    transform: none;
  }
}
</style>
