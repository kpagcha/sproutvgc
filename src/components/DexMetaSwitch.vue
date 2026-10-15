<script setup lang="ts">
import { t } from '@/i18n'
import AppLink from '@/components/AppLink'

// A Pokémon's two pages, side by side as a switch: its dex entry (what it is) and its meta page (how it's played), at
// the same place on both, so going from one to the other is one tap at one spot. Drawn as `SegmentedControl`'s strip.
defineProps<{ id: string; current: 'dex' | 'meta' }>()
</script>

<template>
  <nav class="lens" :aria-label="t('pokemon.lens')">
    <AppLink
      :to="{ name: 'pokemon', params: { id } }"
      :class="{ on: current === 'dex' }"
      :aria-current="current === 'dex' ? 'page' : undefined"
      >{{ t('nav.dex') }}</AppLink
    >
    <AppLink
      :to="{ name: 'metaPokemon', params: { id } }"
      :class="{ on: current === 'meta' }"
      :aria-current="current === 'meta' ? 'page' : undefined"
      >{{ t('nav.meta') }}</AppLink
    >
  </nav>
</template>

<style scoped>
.lens {
  display: inline-flex;
  margin-left: 8px;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  font-size: 0.875em;
  font-weight: bold;
}
.lens a {
  padding: 1px 10px;
  background: var(--panel-alt);
  color: inherit;
  text-decoration: none;
}
.lens a + a {
  border-left: 2px solid var(--ink);
}
.lens a:hover {
  background: var(--hover);
}
.lens a.on {
  background: var(--sel);
}
.lens a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
}
</style>
