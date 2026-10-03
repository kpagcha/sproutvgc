<script setup lang="ts">
// A table column's header that sorts by it (`useSort`): an arrow marks the column sorted by, and its direction.
defineProps<{ label: string; active: boolean; desc: boolean; right?: boolean }>()
defineEmits<{ sort: [] }>()
</script>

<template>
  <th :class="{ r: right }" :aria-sort="active ? (desc ? 'descending' : 'ascending') : undefined">
    <button type="button" class="sort" :class="{ active }" @click="$emit('sort')">
      {{ label }}<span v-if="active" aria-hidden="true">{{ desc ? ' ▾' : ' ▴' }}</span>
    </button>
  </th>
</template>
