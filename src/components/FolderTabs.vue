<script setup lang="ts" generic="T extends string">
// Views of what's under them, as folder tabs on the page standing on the next panel's top edge: the one shown in
// `--tab-bg` (the panel's color unless the page says otherwise), outlined as panels are, covering the panel's border
// under it so the two are one shape; the others plain text on the page. A choice of one, as radio buttons are. On
// phones, they share the width. One `apart` stands at the far end, outlined dashed while not shown: a view of a
// different kind from the rest (the whole of what the others split).
defineProps<{ label: string; options: readonly { value: T; label: string; apart?: boolean }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="folder-tabs" role="radiogroup" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      class="tab"
      :class="{ on: model === o.value, apart: o.apart }"
      :aria-checked="model === o.value"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.folder-tabs {
  display: flex;
  gap: 4px;
  padding-inline: 8px;
}
.tab {
  position: relative;
  z-index: 1;
  white-space: nowrap;
  margin-bottom: -2px;
  padding: 6px 14px 8px;
  font: inherit;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: 2px solid transparent;
  border-bottom: none;
  cursor: pointer;
}
.tab:hover {
  color: var(--text);
}
.tab.on {
  color: var(--text);
  background: var(--tab-bg, var(--panel));
  border-color: var(--ink);
}
.tab.apart {
  margin-left: auto;
}
/* Not shown: outlined dashed on its top and sides, standing a little off the panel rather than on its edge. */
.tab.apart:not(.on) {
  margin-bottom: 4px;
  border-color: var(--border-strong);
  border-style: dashed dashed none;
}
@media (max-width: 720px) {
  .tab {
    flex: 1;
    padding-inline: 8px;
  }
}
</style>
