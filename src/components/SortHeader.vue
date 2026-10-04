<script setup lang="ts">
// A table column's header that sorts by it (`useSort`): an arrow marks the column sorted by, and its direction. `tip`,
// if given, spells out an abbreviated label on hover. It takes the same room sorted by or not, so sorting doesn't
// resize its column: the label as wide as in bold, and room for the arrow; in right-aligned columns the arrow goes
// before the label, which stays lined up with the numbers under it.
defineProps<{ label: string; active: boolean; desc: boolean; right?: boolean; tip?: string }>()
defineEmits<{ sort: [] }>()
</script>

<template>
  <div role="columnheader" :class="{ r: right }" :aria-sort="active ? (desc ? 'descending' : 'ascending') : undefined">
    <button v-tip="tip" type="button" class="sort" :class="{ active, right }" @click="$emit('sort')">
      <span class="label" :data-label="label">{{ label }}</span>
      <span class="arrow" :class="{ shown: active, up: !desc }" aria-hidden="true">▾</span>
    </button>
  </div>
</template>

<style scoped>
.sort {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
}
.sort.right {
  flex-direction: row-reverse;
}
.arrow {
  font-size: 0.8em;
  font-weight: normal;
}
/* A bold copy of the label, out of sight, keeps it as wide as when it's bold. */
.label {
  display: inline-flex;
  flex-direction: column;
}
.right .label {
  align-items: flex-end;
}
.label::after {
  content: attr(data-label);
  height: 0;
  overflow: hidden;
  visibility: hidden;
  font-weight: bold;
}
/* One glyph, flipped, as ▴ and ▾ aren't quite as wide. */
.arrow.up {
  transform: scaleY(-1);
}
.arrow:not(.shown) {
  visibility: hidden;
}
</style>
