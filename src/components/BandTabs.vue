<script lang="ts">
/** How much of the tabs slides off the top of the screen as they stick, which they are the shorter by while stuck. */
export const LIFT = 8
</script>

<script setup lang="ts" generic="T extends string">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import type { NamedLocation } from '@/lib/links'
import AppLink from '@/components/AppLink'

// Pages of one thing, a link each, as the band of the page's first panel (`panel banded`, this its first child): a strip
// of segments, the others in the band's accent, the one shown in the panel's own color, opening into the panel. On phones, they share the width by their names' lengths. The rankings' (`RankingsTabs`), a tournament's. With
// `sticky`, stuck to the top as the page scrolls: on wide screens the band itself, shorter while stuck, its top sliding
// off the screen as the page scrolls on (`LIFT`) and its names down to the middle of what's left, with the scroll; on
// phones, where folder tabs over the page look heavy, once they reach the top a compact bar takes their
// place, across the screen: the tabs as a switch, and under it whatever the page puts in the `bar` slot (a tournament's
// row of links to its panels, as one bar with the switch rather than a second strip). With `noBar`, on phones too the
// band itself, as on wide screens (the rankings', heading one page rather than a tournament's). With `bare`, not a panel's
// band but a strip of its own, outlined as a panel is, heading what the one shown opens into: a tournament's over its
// Pokémon tab's row of links (`SectionNav`), the rankings'; its sticking the page's to place.
const props = defineProps<{
  label: string
  current: T
  tabs: readonly { value: T; label: string; to: NamedLocation }[]
  sticky?: boolean
  bare?: boolean
  noBar?: boolean
}>()

// Where they don't fit (a narrow phone, a long language), the band scrolls sideways: the one shown scrolled into view,
// by the band's own scroll alone, not the page's.
const band = useTemplateRef<HTMLElement>('band')
// The bar on phones, and its height, for what the page lands under it.
const bar = useTemplateRef<HTMLElement>('bar')
defineExpose({ band, bar })
onMounted(() => {
  const el = band.value
  const on = el?.querySelector<HTMLElement>('.on')
  if (!el || !on || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
})

// Stuck: its top at the screen's, checked as the page scrolls; and how far its top has slid off it, from none to all of
// `LIFT` (`--lifted`, 0 to 1), set on the band as is rather than drawn again.
const phone = useMediaQuery('(max-width: 720px)')
const stuck = shallowRef(false)
let frame = 0
function check() {
  frame = 0
  const el = band.value
  if (!el) return
  const r = el.getBoundingClientRect()
  stuck.value = r.top <= 0.5 && window.scrollY > 0
  el.style.setProperty('--lifted', String(Math.min(Math.max(-r.top / LIFT, 0), 1)))
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
// The bar on phones, shown while stuck: it comes in at the tabs' own size, over them, and eases into its compact look
// (`settled`) a frame later; and going, eases back to their size before it's hidden, the tabs then where it is.
const shown = shallowRef(false)
const settled = shallowRef(false)
let settling = 0
let hiding = 0
watch(stuck, (on) => {
  cancelAnimationFrame(settling)
  clearTimeout(hiding)
  if (on) {
    shown.value = true
    settling = requestAnimationFrame(() => (settling = requestAnimationFrame(() => (settled.value = true))))
  } else {
    settled.value = false
    hiding = window.setTimeout(() => (shown.value = false), 200)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(frame)
  cancelAnimationFrame(settling)
  clearTimeout(hiding)
})
</script>

<template>
  <nav
    ref="band"
    class="band band-tabs"
    :class="{ sticky, stuck, bare, 'no-bar': noBar }"
    :style="{ '--lift': `${LIFT}px` }"
    :aria-label="label"
  >
    <AppLink
      v-for="l in tabs"
      :key="l.value"
      :to="l.to"
      class="tab"
      :class="{ on: current === l.value }"
      :aria-current="current === l.value ? 'page' : undefined"
    >
      <span class="name">{{ l.label }}</span>
    </AppLink>
  </nav>
  <Teleport v-if="sticky && phone && !noBar" to="body">
    <div ref="bar" class="tab-bar" :class="{ shown, settled }" :inert="!stuck">
      <nav class="switch" :aria-label="label">
        <AppLink
          v-for="l in tabs"
          :key="l.value"
          :to="l.to"
          class="switch-tab"
          :class="{ on: current === l.value }"
          :aria-current="current === l.value ? 'page' : undefined"
        >
          {{ l.label }}
        </AppLink>
      </nav>
      <slot name="bar" />
    </div>
  </Teleport>
</template>

<style scoped>
/* The band as a strip of segments, one per page, each its full height and as wide as its name, an ink line closing
   each: the others in the band's accent, the one shown in the panel's color, its bottom edge left out so it opens into
   the panel. The band's bottom edge is the tabs' own (and, after the last, the rest of the band's), so the one shown
   can leave it out while the band scrolls sideways where they don't fit, which clips what overhangs it. */
:root:root .panel.banded > .band.band-tabs,
.band-tabs.bare {
  display: flex;
  overflow-x: auto;
  padding: 0;
  color: var(--accent-text);
  background: var(--accent);
  border-bottom: none;
  scrollbar-width: none;
}
/* Bare: the band of a panel, outlined and shadowed as one is, on its own: its shadow (`--hard`'s, 3px down and right)
   only down its right side, from 3px under its top to its bottom, where the shadow of what it heads (tucked 3px under
   it) carries on. Two shadows shrunk by their spread so that none of either is under the band's bottom edge: a shadow
   there (or a clip-path cutting one off at it) bleeds into that edge's pixels as a faint dark line wherever the edge
   falls between pixels. */
.band-tabs.bare {
  /* Over what it heads, which tucks under its bottom edge (`.panel` in retro.css, `SectionNav` attached). */
  position: relative;
  z-index: 3;
  border: 2px solid var(--ink);
  border-bottom: none;
  box-shadow:
    6px 3px 0 -3px var(--ink),
    6px 0 0 -3px var(--ink);
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
.tab.on,
.tab.on:hover {
  color: var(--text);
  background: var(--panel);
  border-bottom-color: transparent;
}
/* On wide screens (with `noBar`, on phones too), stuck to the top, over what scrolls under it, shorter while stuck: as
   the page scrolls on, its top slides off the screen, `LIFT` of it, and its names slide down to the middle of what's
   left (`--shift`: half of it, a bare band's top outline among what goes), the two with the scroll, nothing laid out
   again. */
.band-tabs.sticky {
  --shift: calc(var(--lift) / 2);
}
.band-tabs.bare.sticky {
  --shift: calc(var(--lift) / 2 - 1px);
}
.name {
  display: inline-block;
}
@media (min-width: 721px) {
  .band-tabs.sticky {
    position: sticky;
    top: calc(-1 * var(--lift));
    z-index: 3;
  }
  .band-tabs.sticky .name {
    transform: translateY(calc(var(--lifted, 0) * var(--shift)));
  }
}
.band-tabs.sticky.no-bar {
  position: sticky;
  top: calc(-1 * var(--lift));
  z-index: 3;
}
.band-tabs.sticky.no-bar .name {
  transform: translateY(calc(var(--lifted, 0) * var(--shift)));
}
/* The bar, on phones: across the top of the screen, there as soon as the tabs reach the top, at first at their size
   over them, then settling into its own: widening to the screen's edges, its switch shorter. Its switch the tabs side
   by side, colored as the band: the others in the accent, the one shown in the panel's color. */
.tab-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 40;
  padding: 0 16px;
  visibility: hidden;
  transition: padding 0.2s ease-out;
}
.tab-bar.settled {
  padding: 0;
}
.tab-bar.shown {
  visibility: visible;
}
.switch {
  display: flex;
  border: 2px solid var(--ink);
}
.switch-tab {
  /* Sharing the width by their names' lengths, as the tabs do on phones, so it comes in over them exactly. */
  flex: 1 0 auto;
  padding: 8px;
  font-size: 0.9em;
  transition: padding 0.2s ease-out;
  font-weight: bold;
  color: var(--accent-text);
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  background: var(--accent);
}
.tab-bar.settled .switch-tab {
  padding-block: 3px;
}
.switch-tab + .switch-tab {
  border-left: 2px solid var(--ink);
}
.switch-tab.on {
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
