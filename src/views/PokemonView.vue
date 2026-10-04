<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { available, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import { POKEMON_LAYOUTS, usePokemonLayout } from '@/composables/usePokemonLayout'
import PokemonClassic from '@/components/PokemonClassic.vue'
import PokemonSummary from '@/components/summary/PokemonSummary.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// One Pokémon, laid out as the reader picks (saved): the games' summary screen, or the classic dex page.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const exists = computed(() => available(pokemon(id.value)))
const layout = usePokemonLayout()
</script>

<template>
  <template v-if="exists">
    <SegmentedControl
      v-model="layout"
      class="layout"
      :label="t('pokemon.layout')"
      :options="POKEMON_LAYOUTS.map((l) => ({ value: l, label: t(`pokemon.layout.${l}`) }))"
    />
    <PokemonSummary v-if="layout === 'summary'" :id />
    <PokemonClassic v-else :id />
  </template>
  <div v-else class="panel">
    <p>{{ t('pokemon.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.layout {
  justify-content: flex-end;
  margin-bottom: 8px;
}
</style>
