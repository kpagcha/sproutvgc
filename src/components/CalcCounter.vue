<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'

// A count the damage calculator keeps of a side's battle, stepped one at a time between 0 and `max`: its allies
// fainted (Supreme Overlord, Last Respects), the times it's been hit (Rage Fist). A quiet chip, in full once it's
// past 0. In the side's In battle part, and in the row of the move it changes, both the same count.
defineProps<{ label: string; max: number; down: string; up: string }>()
const value = defineModel<number>({ required: true })
</script>

<template>
  <span class="btn quiet mod counter" :class="{ on: value }">
    {{ label }}
    <button type="button" :disabled="value <= 0" :aria-label="down" @click="value = value - 1">
      <Minus :size="12" aria-hidden="true" />
    </button>
    <output>{{ value }}</output>
    <button type="button" :disabled="value >= max" :aria-label="up" @click="value = value + 1">
      <Plus :size="12" aria-hidden="true" />
    </button>
  </span>
</template>

<style scoped>
.mod {
  min-height: 0;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  line-height: inherit;
  cursor: default;
}
/* Quiet, flat and muted until it's past 0: then in full, a wash under it (the quiet button's). */
.mod.on {
  font-weight: bold;
}
.counter button {
  display: flex;
  padding: 1px 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.counter button:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
