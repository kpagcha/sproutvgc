<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { t } from '@/i18n'
import { holdScroll } from '@/lib/scroll'

// The way to show a long list whole or only its first `top` (`all`, of `n`), as the tournament's Pokémon tab has it.
// Unfolded, the page kept where it is, the rest under what's on screen (`holdScroll`); folded back, the page scrolled
// so the toggle stays on screen, rather than left far below what's now there.
const props = defineProps<{ n: number; top: number }>()
const all = defineModel<boolean>('all', { required: true })

const button = useTemplateRef('button')
async function toggle() {
  if (!all.value) holdScroll()
  all.value = !all.value
  if (all.value) return
  await nextTick()
  button.value?.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <button v-if="props.n > props.top" ref="button" type="button" class="more-toggle" :aria-pressed="all" @click="toggle">
    <component :is="all ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />{{
      all ? t('more.top', { n: top }) : t('more.all', { n })
    }}
  </button>
</template>

<style scoped>
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 2px 6px 2px 2px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.more-toggle:hover {
  color: var(--text);
  background: var(--hover);
}
</style>
