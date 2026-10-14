<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import AppLink from '@/components/AppLink'

// The usage lists, a page each (Pokémon at the bare `/meta/usage`, the one most come for), as the band of the page's
// first panel (`panel banded`, this its first child): a strip of segments, the others in the band's text, the one shown
// in the panel's own color, opening into the panel. On phones, they share the width.
export type UsageList = 'pokemon' | 'moves' | 'items' | 'abilities'

defineProps<{ current: UsageList }>()

const lists = computed(() => [
  { value: 'pokemon' as const, label: t('nav.pokemon'), to: { name: 'usage' } },
  { value: 'moves' as const, label: t('nav.moves'), to: { name: 'moveUsage' } },
  { value: 'items' as const, label: t('nav.items'), to: { name: 'itemUsage' } },
  { value: 'abilities' as const, label: t('nav.abilities'), to: { name: 'abilityUsage' } },
])
</script>

<template>
  <nav class="band usage-tabs" :aria-label="t('usage.lists')">
    <AppLink
      v-for="l in lists"
      :key="l.value"
      :to="l.to"
      class="tab"
      :class="{ on: current === l.value }"
      :aria-current="current === l.value ? 'page' : undefined"
    >
      {{ l.label }}
    </AppLink>
  </nav>
</template>

<style scoped>
/* The band as a strip of segments, one per list, each its full height, an ink line closing each. */
:root:root .panel.banded > .band.usage-tabs {
  display: flex;
  padding: 0;
}
.tab {
  padding: 8px 18px;
  font-weight: bold;
  color: inherit;
  text-align: center;
  text-decoration: none;
  border-right: 2px solid var(--ink);
}
.tab:hover {
  background: color-mix(in srgb, currentColor 18%, transparent);
}
/* The one shown: the panel's color, down over the band's bottom edge, so it opens into the panel. */
.tab.on,
.tab.on:hover {
  margin-bottom: -2px;
  padding-bottom: 10px;
  color: var(--text);
  background: var(--panel);
}
/* On phones, they share the width, the last closed by the panel's own outline. */
@media (max-width: 720px) {
  .tab {
    flex: 1;
    padding-inline: 4px;
  }
  .tab:last-child {
    border-right: none;
  }
}
</style>
