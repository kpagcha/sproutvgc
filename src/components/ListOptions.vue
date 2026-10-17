<script setup lang="ts">
import { nextTick } from 'vue'
import { t } from '@/i18n'
import { useListOptions } from '@/composables/useListOptions'
import OptionsMenu from '@/components/OptionsMenu.vue'

// At the top right of a meta list's panel, how the lists show (`useListOptions`): for now, whether the short
// descriptions do.
// Turned on or off, the lists above grow or shrink: the page scrolls by as much, so the options stay where they were on
// screen and what's being read with them.
const { descriptions } = useListOptions()
async function toggle(e: Event) {
  const box = e.target as HTMLInputElement
  const before = box.getBoundingClientRect().top
  descriptions.value = box.checked
  await nextTick()
  const shift = box.getBoundingClientRect().top - before
  if (shift) window.scrollBy({ top: shift, behavior: 'instant' })
}
</script>

<template>
  <OptionsMenu :title="t('listOptions.title')">
    <label>
      <input :checked="descriptions" type="checkbox" @change="toggle" />
      {{ t('listOptions.descriptions') }}
    </label>
  </OptionsMenu>
</template>
