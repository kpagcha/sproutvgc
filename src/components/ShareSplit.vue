<script setup lang="ts" generic="T extends { key: string; share?: number }">
import { computed } from 'vue'
import { percent } from '@/data/meta'

// A few choices with their shares, quietly: a line of them after their label, each with a swatch and its share (or
// under `min` when it has none: the data leaves out what's rarer), over one thin bar split by their shares, each segment
// in the swatch's shade (a muted gray, fainter for each next one), the rest a fainter track. What each part says is the
// page's (`#part`), and so is what's said on hovering it (`tip`).
const props = defineProps<{ label: string; parts: readonly T[]; min: number; tip?: (part: T) => string | false }>()
defineSlots<{ part(props: { part: T }): unknown }>()

const rest = computed(() => Math.max(0, 1 - props.parts.reduce((a, p) => a + (p.share ?? 0), 0)))
</script>

<template>
  <div class="share-split">
    <p class="split-line">
      <span class="muted">{{ label }}</span>
      <span class="split-parts"
        ><span
          v-for="(p, i) in parts"
          :key="p.key"
          v-tip:group="tip ? tip(p) : false"
          class="split-part"
          :style="{ '--i': i }"
          ><span class="swatch" aria-hidden="true"></span><slot name="part" :part="p" />
          <span class="muted">{{ p.share === undefined ? `<${percent(min)}` : percent(p.share) }}</span></span
        ></span
      >
    </p>
    <span class="split" aria-hidden="true"
      ><span
        v-for="(p, i) in parts"
        v-show="p.share"
        :key="p.key"
        class="seg"
        :style="{ flexGrow: p.share ?? 0, '--i': i }"
      ></span
      ><span v-if="rest > 0.0005" class="seg rest" :style="{ flexGrow: rest }"></span
    ></span>
  </div>
</template>

<style scoped>
.share-split {
  font-size: 0.85em;
}
.split-line {
  display: flex;
  gap: 12px;
  margin: 0 0 4px;
}
/* The parts after the label, those that don't fit on its line going on under the first. */
.split-parts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
}
.split-part {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.swatch,
.seg {
  background: color-mix(in srgb, var(--muted) calc(55% - var(--i) * 15%), transparent);
}
.swatch {
  flex: none;
  width: 8px;
  height: 8px;
}
.split {
  display: flex;
  gap: 2px;
  height: 4px;
}
.seg.rest {
  background: color-mix(in srgb, var(--border) 35%, transparent);
}
</style>
