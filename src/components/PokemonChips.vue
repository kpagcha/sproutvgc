<script setup lang="ts">
import { pokemon, type PokemonId } from '@/data/dex'
import { refName } from '@/i18n/refName'
import PokemonIcon from '@/components/PokemonIcon.vue'

// Pokémon as a row of links, each with its icon.
defineProps<{ ids: readonly PokemonId[] }>()
</script>

<template>
  <ul class="pokemon-chips">
    <li v-for="id in ids" :key="id">
      <RouterLink :to="{ name: 'pokemon', params: { id } }" class="chip">
        <PokemonIcon :id="id" />{{ refName(pokemon(id)) }}
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.pokemon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px 0 2px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
</style>
