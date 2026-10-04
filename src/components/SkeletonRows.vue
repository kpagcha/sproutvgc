<script setup lang="ts">
// Placeholder rows for a dex table (see `.dex-table`) that hasn't rendered its own yet (`usePageEntered`): one cell per
// column, with the classes of the real ones (`cells`), so the bars sit in the real columns and the same ones are left
// out on phones. Hidden from screen readers.
withDefaults(defineProps<{ cells: string[]; rows?: number; height: string }>(), { rows: 20 })
</script>

<template>
  <div v-for="i in rows" :key="i" class="row skeleton" :style="{ height }" aria-hidden="true">
    <div v-for="(cell, j) in cells" :key="j" :class="cell"><span class="bone"></span></div>
  </div>
</template>

<style scoped>
.bone {
  display: inline-block;
  width: 60%;
  height: 0.8em;
  vertical-align: middle;
  background: var(--border);
  border-radius: 2px;
  opacity: 0.6;
  animation: pulse 1.2s ease-in-out infinite alternate;
}
.r .bone {
  width: 1.8em;
}
@keyframes pulse {
  to {
    opacity: 0.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bone {
    animation: none;
  }
}
</style>
