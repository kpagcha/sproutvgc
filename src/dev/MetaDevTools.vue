<script setup lang="ts">
// Dev-only: which meta snapshots the app shows, instead of `.env`'s `VITE_META_SETS`, saved in this browser. With
// more than one, pages with meta data let the reader pick; with none, there's no meta. Loaded by SettingsView only
// when import.meta.env.DEV is true. Not translated.
import { computed } from 'vue'
import DevZone from '@/dev/DevZone.vue'
import { DEFAULT_ACTIVE, GENERATED_SNAPSHOTS, metaLabel, setActiveSnapshots, snapshots } from '@/data/meta'

const active = computed(() => new Set(snapshots.value.map((s) => s.id)))
const generated = new Set(GENERATED_SNAPSHOTS.map((s) => s.id))
const isDefault = computed(
  () => snapshots.value.map((s) => s.id).join() === DEFAULT_ACTIVE.filter((id) => generated.has(id)).join(),
)

/** Turns one on or off, keeping the generator's order: the first on is the default. */
function toggle(id: string, on: boolean) {
  setActiveSnapshots(GENERATED_SNAPSHOTS.map((s) => s.id).filter((s) => (s === id ? on : active.value.has(s))))
}
</script>

<template>
  <DevZone class="zone">
    <h2>Meta snapshots</h2>
    <p class="muted">
      Which ones the app shows, the first on by default. <code>.env</code> has
      <code>{{ DEFAULT_ACTIVE.join(', ') || 'none' }}</code
      >.
    </p>
    <p v-if="!GENERATED_SNAPSHOTS.length" class="muted">None generated: run <code>npm run gen-data</code>.</p>
    <label v-for="s in GENERATED_SNAPSHOTS" :key="s.id" class="row">
      <input
        type="checkbox"
        :checked="active.has(s.id)"
        @change="toggle(s.id, ($event.target as HTMLInputElement).checked)"
      />
      <code>{{ s.id }}</code>
      <span class="muted">{{ metaLabel(s) }}</span>
    </label>
    <p>
      <button type="button" class="btn" :disabled="isDefault" @click="setActiveSnapshots(null)">
        Back to <code>.env</code>'s
      </button>
    </p>
  </DevZone>
</template>

<style scoped>
.zone {
  /* Room for the label that sits on the zone's top edge. */
  margin: 20px 0 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}
</style>
