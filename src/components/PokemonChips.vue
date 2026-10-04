<script setup lang="ts">
import { computed } from 'vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import PokemonIcon from '@/components/PokemonIcon'

// Pokémon as a row of links, each with its icon, by name in the reader's language. `current`, if among them, is the
// page's own Pokémon: shown, but not a link.
const props = defineProps<{ ids: readonly PokemonId[]; current?: PokemonId }>()
const mons = computed(() =>
  props.ids
    .map((id) => ({ id, name: refName(pokemon(id)) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)
</script>

<template>
  <ul class="pokemon-chips">
    <li v-for="m in mons" :key="m.id">
      <span v-if="m.id === current" class="chip current" aria-current="page"
        ><PokemonIcon :id="m.id" />{{ m.name }}</span
      >
      <RouterLink v-else :to="{ name: 'pokemon', params: { id: m.id } }" class="chip">
        <PokemonIcon :id="m.id" />{{ m.name }}
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
.current {
  background: var(--sel);
  border-color: var(--border-strong);
}
</style>
