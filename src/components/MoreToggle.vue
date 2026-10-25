<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { t } from '@/i18n'

// The way to show a long list whole or only its first `top` (`all`, of `n`), as the tournament's Pokémon tab has it.
// Unfolded, the page left where it is; folded back, scrolled to the top of the list's panel when that's gone above the
// screen (or under what's stuck to its top), rather than left far below what's now there. Which one it was is decided
// before setting `all`: the model reads the parent's prop, which keeps its old value until the parent renders again, so
// reading it back would take an unfolding for a folding.
const props = defineProps<{ n: number; top: number }>()
const all = defineModel<boolean>('all', { required: true })

/** How far down the screen what's stuck to its top reaches (tabs, a row of links, a table's header), stacked: each
 * found under the one before, at the screen's middle. */
function stuckBottom(): number {
  let bottom = 0
  for (let i = 0; i < 6; i++) {
    const at = document.elementsFromPoint(innerWidth / 2, bottom + 1)
    let next = bottom
    for (const el of at) {
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const pos = getComputedStyle(e).position
        if (pos === 'sticky' || pos === 'fixed') next = Math.max(next, e.getBoundingClientRect().bottom)
      }
    }
    if (next <= bottom) break
    bottom = next
  }
  return bottom
}

const button = useTemplateRef('button')
async function toggle() {
  const unfolding = !all.value
  all.value = unfolding
  if (unfolding) return
  await nextTick()
  const panel = button.value?.closest('.panel') ?? button.value?.parentElement
  if (!panel) return
  const offset = stuckBottom() + 8
  const top = panel.getBoundingClientRect().top
  if (top < offset) window.scrollBy({ top: top - offset, behavior: 'instant' })
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
