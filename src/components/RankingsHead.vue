<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'

// A rankings page's heading: its title, and the data shown (the slot: its `MetaDialog` and what goes with it) on the
// title's line, after it, where it fits there whole; else on a line of its own under it. Whether it fits is the title's
// width and its own, each as wide as its content, against the heading's, so it doesn't change with where it's placed.
defineProps<{ title: string }>()

const head = useTemplateRef<HTMLElement>('head')
const name = useTemplateRef<HTMLElement>('name')
const source = useTemplateRef<HTMLElement>('source')
const beside = shallowRef(true)
const GAP = 16
function measure() {
  if (!head.value || !name.value || !source.value) return
  beside.value = name.value.offsetWidth + GAP + source.value.offsetWidth <= head.value.clientWidth
}
useResizeObserver([head, name, source], measure)
</script>

<template>
  <div ref="head" class="rankings-head" :class="{ beside }" :style="{ '--gap': `${GAP}px` }">
    <h1 ref="name">{{ title }}</h1>
    <div v-if="$slots.default" ref="source" class="source-slot"><slot /></div>
  </div>
</template>

<style scoped>
.rankings-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px var(--gap);
  margin-bottom: 12px;
}
h1 {
  margin: 0;
  flex: none;
  max-width: 100%;
}
.source-slot {
  flex: none;
  max-width: 100%;
  order: 1;
}
.beside .source-slot {
  order: 0;
}
@media (max-width: 720px) {
  .rankings-head {
    margin-bottom: 8px;
  }
}
</style>
