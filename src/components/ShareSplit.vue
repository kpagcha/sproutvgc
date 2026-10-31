<script setup lang="ts" generic="T extends { key: string; share?: number }">
import { computed } from 'vue'

// A few choices with their shares, quietly: their label, then one thin bar split by their shares, each segment in a
// muted gray (fainter for each next one), the rest a fainter track, and each part's name under its segment (a segment
// too narrow for its name widened to fit it). What each part says is the page's (`#part`), and so is what's said on
// hovering or tapping it (`tip`): its share, with what it is.
const props = defineProps<{
  label: string
  parts: readonly T[]
  tip?: (part: T) => string | Element | false
}>()
defineSlots<{ part(props: { part: T }): unknown }>()

const rest = computed(() => Math.max(0, 1 - props.parts.reduce((a, p) => a + (p.share ?? 0), 0)))
</script>

<template>
  <div class="share-split">
    <p class="muted split-label">{{ label }}</p>
    <div class="split">
      <span
        v-for="(p, i) in parts"
        :key="p.key"
        v-tip:group="tip ? tip(p) : false"
        class="split-part"
        tabindex="0"
        :style="{ flexGrow: p.share ?? 0, '--i': i }"
        ><span class="seg" aria-hidden="true"></span><span class="name"><slot name="part" :part="p" /></span
      ></span>
      <span v-if="rest > 0.0005" class="split-part rest" aria-hidden="true" :style="{ flexGrow: rest }"
        ><span class="seg"></span
      ></span>
    </div>
  </div>
</template>

<style scoped>
.share-split {
  font-size: 0.85em;
}
.split-label {
  margin: 0 0 4px;
}
.split {
  display: flex;
  gap: 2px;
}
/* Each part as wide as its share, or its name when that's wider. */
.split-part {
  flex-basis: 0;
  min-width: max-content;
  display: flex;
  flex-direction: column;
  gap: 3px;
  cursor: default;
}
.split-part.rest {
  min-width: 0;
}
.seg {
  height: 4px;
  background: color-mix(in srgb, var(--muted) calc(55% - var(--i) * 15%), transparent);
}
.rest .seg {
  background: color-mix(in srgb, var(--border) 35%, transparent);
}
.name {
  padding-right: 6px;
  white-space: nowrap;
}
</style>
