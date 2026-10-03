<script setup lang="ts">
import type { PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { cellStyle } from '@/lib/sprites'

// A Pokémon's icon, from the icon sheet: decorative, as its name is always beside it.
withDefaults(defineProps<{ id: PokemonId; scale?: number }>(), { scale: 1 })
</script>

<template>
  <span class="sheet-icon" :style="cellStyle('pokemon', POKEMON[id].icon, scale)" aria-hidden="true"></span>
</template>
