<script setup lang="ts" generic="T extends string">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import type { NamedLocation } from '@/lib/links'
import AppLink from '@/components/AppLink'

// Pages of one thing, a link each, as the band of the page's first panel (`panel banded`, this its first child): a strip
// of segments, the others in the band's text, the one shown in the panel's own color, opening into the panel. On
// phones, they share the width by their names' lengths. The rankings' (`RankingsTabs`), a tournament's. With `sticky`,
// stuck to the top as the page scrolls, toned down while stuck: the band past the tabs in the panel's color, and
// shorter, easing into it. With `bare`, not a panel's band but a strip of its own, as they look stuck: a tournament's
// over its Pokémon tab's row of links, once its panel's band has scrolled under it.
const props = defineProps<{
  label: string
  current: T
  tabs: readonly { value: T; label: string; to: NamedLocation }[]
  sticky?: boolean
  bare?: boolean
}>()

// Where they don't fit (a narrow phone, a long language), the band scrolls sideways: the one shown scrolled into view,
// by the band's own scroll alone, not the page's.
const band = useTemplateRef<HTMLElement>('band')
onMounted(() => {
  const el = band.value
  const on = el?.querySelector<HTMLElement>('.on')
  if (!el || !on || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
})

// Stuck: its top at the screen's, checked as the page scrolls.
const stuck = shallowRef(false)
let frame = 0
function check() {
  frame = 0
  const el = band.value
  stuck.value = !!el && el.getBoundingClientRect().top <= 0.5 && window.scrollY > 0
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(check)
}
onMounted(() => {
  if (!props.sticky) return
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  check()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <nav ref="band" class="band band-tabs" :class="{ sticky, stuck, bare }" :aria-label="label">
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
/* Stuck to the top, over what scrolls under it; easing between the two looks, its height and the room it gives up
   under it together, so what's under it doesn't move as it shrinks. */
:root:root .panel.banded > .band.band-tabs.sticky {
  position: sticky;
  top: 0;
  z-index: 3;
  transition:
    background-color 0.2s ease-out,
    margin-bottom 0.2s ease-out;
}
.band-tabs.sticky::after,
.band-tabs.sticky .tab {
  transition:
    background-color 0.2s ease-out,
    border-color 0.2s ease-out,
    padding 0.2s ease-out;
}
/* While stuck, toned down, as it's over the page rather than heading the panel: the tabs keep the band's accent, but the
   rest of it, past them, is the panel's color with a fainter line, so it's the tabs alone that stand out; and shorter,
   taking less of the screen, the room it gives up added under it, so what's under it doesn't move. */
:root:root .panel.banded > .band.band-tabs.stuck {
  margin-bottom: calc(var(--panel-pad) + 8px);
  background: var(--panel);
}
.band-tabs.stuck .tab,
.band-tabs.bare .tab {
  padding-block: 4px;
}
/* The one shown closed off too, as nothing under it is its panel: by the fainter line. */
.band-tabs.stuck .tab.on {
  border-bottom-color: color-mix(in srgb, var(--ink) 35%, transparent);
}
.band-tabs:is(.stuck, .bare) .tab:not(.on) {
  color: var(--accent-text);
  background: var(--accent);
}
.band-tabs:is(.stuck, .bare) .tab:not(.on):hover {
  background: color-mix(in srgb, var(--accent-text) 18%, var(--accent));
}
.band-tabs.stuck::after {
  border-bottom-color: color-mix(in srgb, var(--ink) 35%, transparent);
}
/* Bare: the strip outlined as a panel is, the one shown in the panel's color. */
.band-tabs.bare {
  display: flex;
  overflow-x: auto;
  background: var(--panel);
  border: 2px solid var(--ink);
  border-bottom: none;
  scrollbar-width: none;
}
.band-tabs.bare .tab.on {
  color: var(--text);
  background: var(--panel);
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
