<script setup lang="ts">
import { ChevronDown, CircleHelp } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { refName } from '@/i18n/refName'
import PokemonIcon from '@/components/PokemonIcon'

// What opens a drawer's picking (the speed pages', `SpeedPickDrawer`): drawn as a field, the one picked's icon and name
// in it, or none picked a silhouette and what it asks for, an arrow at its end.
defineProps<{ id: PokemonId | null; placeholder: string }>()
</script>

<template>
  <button type="button" class="pick-field" :class="{ empty: !id }">
    <PokemonIcon v-if="id" :id />
    <CircleHelp v-else class="who" :size="20" aria-hidden="true" />
    <span class="pick-name">{{ id ? refName(pokemon(id)) : placeholder }}</span>
    <ChevronDown class="caret" :size="16" aria-hidden="true" />
  </button>
</template>

<style scoped>
.pick-field {
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  padding: 2px 8px 2px 4px;
  font: inherit;
  font-weight: bold;
  color: inherit;
  text-align: left;
  background: var(--panel);
  border: 1px solid var(--border-strong, var(--border));
  cursor: pointer;
}
.pick-field:hover,
.pick-field:focus-visible {
  background: var(--panel-alt);
}
.pick-field.empty {
  font-weight: normal;
  color: var(--muted);
}
.who {
  flex: none;
  margin: 0 4px;
}
.pick-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.caret {
  flex: none;
  color: var(--muted);
}
</style>
