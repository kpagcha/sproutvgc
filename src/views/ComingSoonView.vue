<script setup lang="ts">
import { useSlots } from 'vue'
import { useRoute } from 'vue-router'
import { GAME_NAME, REGULATION } from '@/data/format'
import { t } from '@/i18n'

// A page of an area not built yet: its name, what it will be, and that it's coming. What's given it goes first, as the
// panel's band (the usage lists' tabs).
const route = useRoute()
const slots = useSlots()
const params = { game: GAME_NAME, reg: REGULATION }
</script>

<template>
  <div class="panel soon" :class="{ banded: !!slots.default }">
    <slot />
    <h1>{{ t(route.meta.titleKey!) }}</h1>
    <p class="muted">{{ t(route.meta.descKey!, params) }}</p>
    <p class="coming font-display">{{ t('soon.title') }}</p>
  </div>
</template>

<style scoped>
.soon {
  --panel-pad: 24px;
  padding: var(--panel-pad);
}
.soon p {
  margin: 0;
}
.soon .coming {
  margin-top: 16px;
  font-size: calc(18px * var(--display-scale, 1) * var(--text-scale));
  font-weight: bold;
}
</style>
