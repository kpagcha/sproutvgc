<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'
import { Plus } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import type { SpeedBuild } from '@/lib/speedBuild'
import SpeedPickDrawer from '@/components/SpeedPickDrawer.vue'

// The comparison's slot adding a team's second Pokémon: a dashed button in its team's color that picks one straight
// away, as the damage calculator does (a drawer beside it, or on phones a dialog: `SpeedPickDrawer`), nothing changing
// until one is picked (the page then going on to its Speed); left without one, it's as it was. Greyed out while the
// team's first isn't picked.
const props = defineProps<{
  team: 'yours' | 'opponent'
  /** What it says: adding a second Pokémon, or which team's. */
  label: string
  disabled?: boolean
  /** The team's first, which it can't be (nor one of its species). */
  taken?: readonly PokemonId[]
}>()
const emit = defineEmits<{ pick: [id: PokemonId, build?: SpeedBuild] }>()

defineOptions({ inheritAttrs: false })
const step = shallowRef<'pokemon' | 'speed' | null>(null)
const button = useTemplateRef<HTMLElement>('button')
</script>

<template>
  <button
    ref="button"
    v-bind="$attrs"
    type="button"
    class="add-second"
    :class="props.team"
    :disabled="props.disabled"
    @click="step = 'pokemon'"
  >
    <Plus :size="16" aria-hidden="true" />{{ props.label }}
  </button>
  <SpeedPickDrawer
    v-model:step="step"
    :id="null"
    :taken="props.taken"
    :anchor="button"
    @pick="(id: PokemonId) => emit('pick', id)"
    @team="(id: PokemonId, b: SpeedBuild) => emit('pick', id, b)"
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
</style>
