<script setup lang="ts">
import { t } from '@/i18n'
import { STATS, type StatId } from '@/data/pokemon'

// A table's one stat column on phones, where the six don't fit: its header picks the stat (or their total), with the
// arrow before it sorting by it, or reversing it (the dex's Pokémon, the rankings' stats).
export type StatKey = StatId | 'total'
defineProps<{
  /** The stat the column shows. */
  column: StatKey
  /** The table is sorted by it. */
  active: boolean
  desc: boolean
}>()
const emit = defineEmits<{ sort: []; pick: [key: StatKey] }>()
const KEYS: StatKey[] = [...STATS, 'total']
const label = (k: StatKey) => t(k === 'total' ? 'stat.bst' : `stat.${k}`)
</script>

<template>
  <div role="columnheader" class="r stat-pick" :aria-sort="active ? (desc ? 'descending' : 'ascending') : undefined">
    <button
      type="button"
      class="sort"
      :class="{ active }"
      :aria-label="t('pokedex.sortBy', { stat: label(column) })"
      @click="emit('sort')"
    >
      <span class="arrow" :class="{ shown: active, up: !desc }" aria-hidden="true">▾</span>
    </button>
    <select
      class="stat-select"
      :class="{ active }"
      :value="column"
      :aria-label="t('pokedex.statColumn')"
      @change="emit('pick', ($event.target as HTMLSelectElement).value as StatKey)"
    >
      <option v-for="k in KEYS" :key="k" :value="k">{{ label(k) }}</option>
    </select>
  </div>
</template>

<style scoped>
.stat-pick {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.15em;
}
.stat-pick .arrow {
  font-size: 0.8em;
}
.stat-pick .arrow.up {
  transform: scaleY(-1);
}
.stat-pick .arrow:not(.shown) {
  visibility: hidden;
}
.stat-select {
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
.stat-select.active {
  color: var(--text);
  font-weight: bold;
}
</style>
