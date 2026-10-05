<script setup lang="ts">
import type { ItemId, PokemonId } from '@/data/dex'
import CategoryIcon from '@/components/CategoryIcon'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// A dex section card's decoration, beside its title (the home page's cards, the dex's own page): a few entries of the
// section. Sections without one (abilities, conditions) show nothing.
defineProps<{ section: string }>()

const POKEMON: PokemonId[] = ['incineroar', 'garchomp', 'whimsicott']
const ITEMS: ItemId[] = ['choicescarf', 'focussash', 'sitrusberry']
</script>

<template>
  <span v-if="section === 'pokemon'" class="decor" aria-hidden="true">
    <PokemonIcon v-for="p in POKEMON" :id="p" :key="p" />
  </span>
  <span v-else-if="section === 'moves'" class="decor" aria-hidden="true">
    <CategoryIcon category="physical" :tip="false" />
    <CategoryIcon category="special" :tip="false" />
    <CategoryIcon category="status" :tip="false" />
  </span>
  <span v-else-if="section === 'items'" class="decor" aria-hidden="true">
    <ItemIcon v-for="i in ITEMS" :id="i" :key="i" />
  </span>
  <span v-else-if="section === 'types'" class="decor" aria-hidden="true">
    <TypeIcon type="fire" />
    <TypeIcon type="water" />
    <TypeIcon type="grass" />
  </span>
</template>

<style scoped>
/* Badges decorate the title rather than lead the card: a bit smaller than elsewhere, and on one row with it. */
.decor {
  --icon-scale: 1;
  display: flex;
  gap: 3px;
  flex: none;
}
@media (max-width: 560px) {
  .decor {
    --icon-scale: 1.2;
  }
}
</style>
