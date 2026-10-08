<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import PokemonPicker from '@/components/PokemonPicker.vue'

// The comparison's slot adding a team's second Pokémon: a dashed field in its team's color that picks one straight away
// (a list under it, or on phones a screen of its own), nothing changing until one is picked; left without one, it's as
// it was. Greyed out while the team's first isn't picked.
const props = defineProps<{
  team: 'yours' | 'opponent'
  /** What it says: adding a second Pokémon, or which team's. */
  label: string
  disabled?: boolean
  /** The team's first, which it can't be (nor one of its species). */
  taken?: readonly PokemonId[]
}>()
const emit = defineEmits<{ pick: [id: PokemonId] }>()

// The field emptied after each pick, for the next time.
const round = ref(0)
function pick(id: PokemonId | null) {
  round.value++
  if (id) emit('pick', id)
}
</script>

<template>
  <button v-if="props.disabled" type="button" class="add-second" :class="props.team" disabled>
    <Plus :size="16" aria-hidden="true" />{{ props.label }}
  </button>
  <PokemonPicker
    v-else
    :key="round"
    recent
    :model-value="null"
    :placeholder="`+ ${props.label}`"
    :title="props.team === 'yours' ? t('speed.yours') : t('compare.opponent')"
    :tone="props.team"
    :taken="props.taken"
    speed
    class="add-second add-picker"
    :class="props.team"
    @update:model-value="pick"
  />
</template>

<style scoped>
/* A dashed slot in its team's color, its text too; faded while its team's first isn't picked. */
.add-second {
  --team: var(--accent);
  --tint: color-mix(in srgb, var(--team) 8%, var(--panel));
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  font: inherit;
  font-weight: bold;
  color: var(--team);
}
.add-second.opponent {
  --team: var(--opponent);
}
button.add-second {
  padding: 8px 10px;
  text-align: left;
  background: var(--tint);
  border: 2px dashed var(--team);
}
button.add-second:disabled {
  cursor: default;
  opacity: 0.4;
}
/* The field itself the slot: as wide as what it's in, dashed until it's in use. */
.add-picker.add-picker :deep(.search-box) {
  max-width: none;
}
.add-picker.add-picker :deep(input.search[type='search']) {
  padding-block: 8px;
  font-weight: bold;
  color: var(--text);
  background: var(--tint);
  border: 2px dashed var(--team);
  cursor: pointer;
}
.add-picker.add-picker :deep(input.search[type='search']):focus {
  border-style: solid;
  cursor: text;
}
.add-picker :deep(input.search::placeholder) {
  color: var(--team);
  opacity: 1;
}
</style>
