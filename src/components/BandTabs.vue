<script setup lang="ts" generic="T extends string">
import { onMounted, useTemplateRef } from 'vue'
import type { NamedLocation } from '@/lib/links'
import AppLink from '@/components/AppLink'

// Pages of one thing, a link each, as the band of the page's first panel (`panel banded`, this its first child): a strip
// of segments, the others in the band's text, the one shown in the panel's own color, opening into the panel. On
// phones, they share the width by their names' lengths. The rankings' (`RankingsTabs`), a tournament's.
defineProps<{ label: string; current: T; tabs: readonly { value: T; label: string; to: NamedLocation }[] }>()

// Where they don't fit (a narrow phone, a long language), the band scrolls sideways: the one shown scrolled into view,
// by the band's own scroll alone, not the page's.
const band = useTemplateRef<HTMLElement>('band')
onMounted(() => {
  const el = band.value
  const on = el?.querySelector<HTMLElement>('.on')
  if (!el || !on || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
})
</script>

<template>
  <nav ref="band" class="band band-tabs" :aria-label="label">
    <AppLink
      v-for="l in tabs"
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
/* The band as a strip of segments, one per page, each its full height and as wide as its name, an ink line closing
   each. Its bottom edge is the segments' own (and, after the last, the rest of the band's), so the one shown can leave
   it out and open into the panel while the band scrolls sideways where they don't fit, which clips what overhangs it. */
:root:root .panel.banded > .band.band-tabs {
  display: flex;
  overflow-x: auto;
  padding: 0;
  border-bottom: none;
  scrollbar-width: none;
}
.band-tabs::-webkit-scrollbar {
  display: none;
}
.band-tabs::after {
  content: '';
  flex: 1;
  border-bottom: 2px solid var(--ink);
}
.tab {
  flex: none;
  padding: 8px 18px;
  font-weight: bold;
  color: inherit;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  border-right: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
}
.tab:hover {
  background: color-mix(in srgb, currentColor 18%, transparent);
}
/* The one shown: the panel's color, its bottom edge left out, so it opens into the panel. */
.tab.on,
.tab.on:hover {
  color: var(--text);
  background: var(--panel);
  border-bottom-color: transparent;
}
/* On phones, smaller, sharing the width by their names' lengths, the last closed by the panel's own outline. */
@media (max-width: 720px) {
  .band-tabs::after {
    display: none;
  }
  .tab {
    flex: 1 0 auto;
    padding-inline: 8px;
    font-size: 0.9em;
  }
  .tab:last-child {
    border-right: none;
  }
}
</style>
