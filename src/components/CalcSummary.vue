<script setup lang="ts">
import { computed } from 'vue'
import { pokemon } from '@/data/dex'
import { refName } from '@/i18n/refName'
import { battlerOf, type Fighter } from '@/lib/damage'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A damage calculator's side in short, on one line, for its band on phones: the Pokémon and its item's icon.
const props = defineProps<{ fighter: Fighter }>()

const id = computed(() => battlerOf(props.fighter))
</script>

<template>
  <span v-if="id" class="summary">
    <PokemonIcon :id />
    <span class="name">{{ refName(pokemon(id)) }}</span>
    <ItemIcon v-if="fighter.member.item" :id="fighter.member.item" class="item" />
  </span>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.name {
  flex: none;
  white-space: nowrap;
}
.item {
  flex: none;
}
</style>
