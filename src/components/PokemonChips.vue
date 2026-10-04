<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { pokemon, type PokemonId } from '@/data/dex'
import { splitForme } from '@/data/pokemon'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import PokemonIcon from '@/components/PokemonIcon'

// Pokémon as a row of links, each with its icon, by name in the reader's language. `current`, if among them, is the
// page's own Pokémon: shown, but not a link. `query`, if given, keeps only the ones whose name it finds, as the dex's
// searches do, with the match highlighted. `formes` names a species' formes by the forme alone, as the Pokémon list
// does under their species (its formes listed together, the species first).
const props = defineProps<{ ids: readonly PokemonId[]; current?: PokemonId; query?: string; formes?: boolean }>()
const all = computed(() =>
  props.ids
    .map((id) => ({ id, full: refName(pokemon(id)) }))
    .sort((a, b) => a.full.localeCompare(b.full, locale.value))
    .map(({ id, full }) => ({ id, name: props.formes ? (splitForme(id, full).forme ?? full) : full })),
)
const mons = computed(() => {
  const q = fold(props.query?.trim() ?? '')
  return all.value.flatMap((m) => {
    const parts = q ? split(m.name, q) : null
    return !q || parts ? [{ ...m, parts }] : []
  })
})
</script>

<template>
  <ul v-if="mons.length || !all.length" class="pokemon-chips">
    <li v-for="m in mons" :key="m.id">
      <component
        :is="m.id === current ? 'span' : RouterLink"
        :to="m.id === current ? undefined : { name: 'pokemon', params: { id: m.id } }"
        class="chip"
        :class="{ current: m.id === current }"
        :aria-current="m.id === current ? 'page' : undefined"
      >
        <PokemonIcon :id="m.id" />
        <template v-if="m.parts"
          >{{ m.parts[0] }}<mark>{{ m.parts[1] }}</mark
          >{{ m.parts[2] }}</template
        >
        <template v-else>{{ m.name }}</template>
      </component>
    </li>
  </ul>
  <p v-else class="muted">{{ t('pokedex.none') }}</p>
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
