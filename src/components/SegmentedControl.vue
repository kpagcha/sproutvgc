<script setup lang="ts" generic="T extends string">
import { useId, type Component } from 'vue'

// A choice of how something is shown, rather than of what is (a filter): a label and its options joined in one
// outlined strip, the picked one highlighted. Radio buttons underneath, so arrow keys move between them. An option
// can show an icon in place of its label, with a short text beside it, the label then naming it to screen readers and,
// unless `noTips`, in a tooltip.
defineProps<{
  label: string
  /** Explains the choice, on the label's hover. */
  tip?: string
  /** Leaves the icons' labels out of tooltips, for when what's around already says what the options are. */
  noTips?: boolean
  options: readonly { value: T; label: string; icon?: Component; short?: string }[]
}>()
const model = defineModel<T>({ required: true })
const id = useId()
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-labelledby="id">
    <span :id v-tip="tip" class="muted">{{ label }}</span>
    <span class="segments">
      <label
        v-for="o in options"
        :key="o.value"
        v-tip="!noTips && o.icon && o.label"
        :class="{ on: model === o.value, icon: o.icon }"
      >
        <input v-model="model" type="radio" :name="id" :value="o.value" :aria-label="o.icon ? o.label : undefined" />
        <template v-if="o.icon">
          <component :is="o.icon" :size="16" aria-hidden="true" />
          <span v-if="o.short" aria-hidden="true">{{ o.short }}</span>
        </template>
        <template v-else>{{ o.label }}</template>
      </label>
    </span>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875em;
}
.segments {
  display: flex;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.segments label {
  position: relative;
  padding: 1px 10px;
  background: var(--panel-alt);
  cursor: pointer;
}
.segments label.icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.segments label + label {
  border-left: 2px solid var(--ink);
}
.segments label:hover {
  background: var(--hover);
}
.segments label.on {
  background: var(--sel);
}
.segments label:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
}
.segments input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
</style>
