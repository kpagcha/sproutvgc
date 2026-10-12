<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'
import { X } from '@lucide/vue'
import { t } from '@/i18n'

// `ChoiceDialog`'s card: what it's a choice of, its close at the band's end, then each option to pick, its name and
// what it means in a line under it (when it says), the one picked marked.
defineProps<{ label: string; options: readonly { value: T; label: string; desc?: string }[]; picked: T }>()
const emit = defineEmits<{ pick: [value: T]; close: [] }>()
const id = useId()
</script>

<template>
  <div class="panel banded choice-card">
    <div class="band">
      <span :id="`${id}-label`">{{ label }}</span>
      <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <div class="options" role="radiogroup" :aria-labelledby="`${id}-label`">
      <label v-for="o in options" :key="o.value" class="option" :class="{ on: o.value === picked }">
        <input type="radio" :name="id" :checked="o.value === picked" @change="emit('pick', o.value)" />
        <span class="text">
          <span class="name">{{ o.label }}</span>
          <span v-if="o.desc" class="desc muted">{{ o.desc }}</span>
        </span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.choice-card {
  margin: 0;
}
/* Its band: what it is, its close at the end. */
:root:root .choice-card.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
.close {
  min-height: 0;
  padding: 2px 4px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 10px;
}
/* Each a row to pick: its radio, its name, and what it means under it; the one picked marked. */
.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  cursor: pointer;
}
.option:hover {
  background: var(--hover);
}
.option.on {
  background: var(--sel);
  border-color: var(--border-strong);
}
.option input {
  margin: 3px 0 0;
}
.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-weight: bold;
}
.desc {
  font-size: 0.875em;
}
</style>
