<script lang="ts">
import { shallowRef } from 'vue'
import type { MoveId } from '@/data/dex'
import type { Move } from '@/data/moves'

// The moves' data, for their types, shared by every chip and loaded by the first move's: the pages showing chips
// (the home page) don't need it otherwise.
const moves = shallowRef<Record<MoveId, Move> | null>(null)
let loading = false
function moveType(id: string) {
  if (!moves.value && !loading) {
    loading = true
    void import('@/data/moves').then((m) => (moves.value = m.MOVES))
  }
  return moves.value?.[id as MoveId]?.type
}
</script>

<script setup lang="ts">
import type { ItemId, PokemonId, Ref } from '@/data/dex'
import { refName } from '@/i18n/refName'
import { follow, refHref } from '@/lib/links'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// A dex entry as a flat chip linking to its page, with its icon (a move its type, once the moves' data is in): the
// home page's favorites and recently viewed. All the same height whether or not they have an icon.
defineProps<{ to: Ref }>()
</script>

<template>
  <a :href="refHref(to)" class="entry-chip" @click="follow">
    <PokemonIcon v-if="to.kind === 'pokemon'" :id="to.id as PokemonId" />
    <ItemIcon v-else-if="to.kind === 'item'" :id="to.id as ItemId" />
    <TypeIcon v-else-if="to.kind === 'move' && moveType(to.id)" :type="moveType(to.id)!" />
    {{ refName(to) }}
  </a>
</template>

<style scoped>
.entry-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.entry-chip:hover {
  text-decoration: none;
  background: var(--hover);
  border-color: var(--border-strong);
}
.entry-chip :deep(.sheet-icon) {
  margin: -4px 0;
}
</style>
