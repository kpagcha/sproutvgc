<script setup lang="ts">
import { t } from '@/i18n'
import { useListOptions } from '@/composables/useListOptions'
import OptionsMenu from '@/components/OptionsMenu.vue'

// At the top right of a meta list's panel, how the lists show (`useListOptions`): for now, whether the short
// descriptions do.
const { descriptions } = useListOptions()
</script>

<template>
  <OptionsMenu :title="t('listOptions.title')">
    <label>
      <input v-model="descriptions" type="checkbox" />
      {{ t('listOptions.descriptions') }}
    </label>
  </OptionsMenu>
</template>
