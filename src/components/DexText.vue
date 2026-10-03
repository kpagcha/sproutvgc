<script setup lang="ts">
import { computed } from 'vue'
import type { Ref } from '@/data/dex'
import DexRef from '@/components/DexRef.vue'
import { description, isDescribed } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'

// Curated text with references to dex entries embedded as markers (`{type:flying}`, `{move:taunt}`): the markers
// render as the entries' names, in the reader's language, linked once their category has pages. `npm run check-text`
// makes sure every marker names an entry the regulation has. Entries with descriptions (abilities, moves, items,
// conditions) show their short one on hover, where there is hover (on touch screens a tap would show it and follow the
// link at once).
const props = defineProps<{ text: string }>()

const MARKER = /\{(\w+):(\w+)\}/g
const canHover = window.matchMedia('(hover: hover)').matches

function tip(ref: Ref): string | undefined {
  const short = canHover && isDescribed(ref.kind) ? description(ref.kind, ref.id)?.short : undefined
  return short?.replace(MARKER, (_, kind: string, id: string) => refName({ kind, id } as Ref))
}

const parts = computed(() =>
  props.text.split(/(\{\w+:\w+\})/).map((part) => {
    const marker = part.match(/^\{(\w+):(\w+)\}$/)
    return marker ? { ref: { kind: marker[1], id: marker[2] } as Ref } : { text: part }
  }),
)
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <DexRef v-if="part.ref" :to="part.ref" :tip="tip(part.ref)" />
    <template v-else>{{ part.text }}</template>
  </template>
</template>
