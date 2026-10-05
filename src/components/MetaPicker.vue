<script setup lang="ts">
import { computed } from 'vue'
import { currentSnapshots, metaLabel, selectSnapshot, selectedSnapshot } from '@/data/meta'
import { t } from '@/i18n'

// The meta snapshot shown, by its label: a choice between them when there are several (`VITE_META_SETS`). Picking one
// shows it on every page (`selectSnapshot`).
const snapshots = computed(currentSnapshots)
</script>

<template>
  <select
    v-if="selectedSnapshot && snapshots.length > 1"
    class="search pick"
    :value="selectedSnapshot.id"
    :aria-label="t('usage.source')"
    @change="selectSnapshot(($event.target as HTMLSelectElement).value)"
  >
    <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ metaLabel(s) }}</option>
  </select>
  <span v-else-if="selectedSnapshot" class="label">{{ metaLabel(selectedSnapshot) }}</span>
</template>

<style scoped>
.pick {
  width: auto;
  margin: 0;
}
.label {
  font-weight: bold;
}
</style>
