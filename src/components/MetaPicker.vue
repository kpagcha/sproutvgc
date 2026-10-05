<script setup lang="ts">
import { computed } from 'vue'
import { currentSnapshots, metaLabel, metaParts, selectSnapshot, selectedSnapshot } from '@/data/meta'
import { t } from '@/i18n'

// The meta snapshot shown, by its label: a choice between them when there are several (`VITE_META_SETS`). Picking one
// shows it on every page (`selectSnapshot`). What they all share ("Showdown ladder · Sep 2026") is said once, beside
// the choice, which then only holds what tells them apart ("Strong players (1760+)"), short enough for a phone.
const snapshots = computed(currentSnapshots)
const split = computed(() => {
  const parts = snapshots.value.map(metaParts)
  const shared = parts[0]?.filter((p) => parts.every((ps) => ps.includes(p))) ?? []
  const own = (i: number) => parts[i]!.filter((p) => !shared.includes(p)).join(' · ')
  return { shared: shared.join(' · '), options: snapshots.value.map((s, i) => ({ id: s.id, label: own(i) })) }
})
</script>

<template>
  <span v-if="selectedSnapshot && snapshots.length > 1" class="picker">
    <span v-if="split.shared" class="label">{{ split.shared }}</span>
    <select
      class="search pick"
      :value="selectedSnapshot.id"
      :aria-label="t('usage.source')"
      @change="selectSnapshot(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="o in split.options" :key="o.id" :value="o.id">{{ o.label || metaLabel(selectedSnapshot) }}</option>
    </select>
  </span>
  <span v-else-if="selectedSnapshot" class="label">{{ metaLabel(selectedSnapshot) }}</span>
</template>

<style scoped>
.picker {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  max-width: 100%;
}
/* As wide as its label: the search fields' width limit would cut it off. */
.pick {
  width: auto;
  max-width: 100%;
  margin: 0;
}
.label {
  font-weight: bold;
}
</style>
