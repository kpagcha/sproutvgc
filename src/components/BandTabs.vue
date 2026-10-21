<script setup lang="ts" generic="T extends string">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import type { NamedLocation } from '@/lib/links'
import AppLink from '@/components/AppLink'

// Pages of one thing, a link each, as the band of the page's first panel (`panel banded`, this its first child): a strip
// of segments, the others in the band's accent, the one shown in the panel's own color, opening into the panel. On phones, they share the width by their names' lengths. The rankings' (`RankingsTabs`), a tournament's. With
// `sticky`, stuck to the top as the page scrolls: on wide screens the band itself, shorter while stuck, easing into it;
// on phones, where folder tabs over the page look heavy, once they reach the top a compact bar takes their
// place, across the screen: the tabs as a switch, and under it whatever the page puts in the `bar` slot (a tournament's
// row of links to its panels, as one bar with the switch rather than a second strip). With `bare`, not a panel's
// band but a strip of its own, outlined as a panel is, heading what the one shown opens into: a tournament's over its
// Pokémon tab's row of links (`SectionNav`); its sticking the page's to place (they don't shrink).
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
// The bar on phones, and its height, for what the page lands under it.
const bar = useTemplateRef<HTMLElement>('bar')
defineExpose({ band, bar })
onMounted(() => {
  const el = band.value
  const on = el?.querySelector<HTMLElement>('.on')
  if (!el || !on || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
})

// Stuck: its top at the screen's, checked as the page scrolls.
const phone = useMediaQuery('(max-width: 720px)')
const stuck = shallowRef(false)
let frame = 0
function check() {
  frame = 0
  const r = band.value?.getBoundingClientRect()
  stuck.value = !!r && r.top <= 0.5 && window.scrollY > 0
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
  <Teleport v-if="sticky && phone" to="body">
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
/* Bare: the band of a panel, outlined and shadowed as one is, on its own. */
.band-tabs.bare {
  border: 2px solid var(--ink);
  border-bottom: none;
  box-shadow: var(--hard);
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
/* On wide screens, stuck to the top, over what scrolls under it; a panel's band shorter while stuck, taking less of the
   screen: easing into it, the room it gives up added under it as it does, so what's under it doesn't move. */
@media (min-width: 721px) {
  :root:root .panel.banded > .band.band-tabs.sticky,
  .band-tabs.bare.sticky {
    position: sticky;
    top: 0;
    z-index: 3;
  }
  :root:root .panel.banded > .band.band-tabs.sticky {
    transition: margin-bottom 0.2s ease-out;
  }
  :root:root .panel.banded > .band.band-tabs.sticky .tab {
    transition: padding 0.2s ease-out;
  }
  :root:root .panel.banded > .band.band-tabs.stuck {
    margin-bottom: calc(var(--panel-pad) + 12px);
  }
  :root:root .panel.banded > .band.band-tabs.stuck .tab {
    padding-block: 2px;
  }
}
/* The bar, on phones: across the top of the screen, there as soon as the tabs reach the top, at first at their size
   over them, then settling into its own: in the page's color, a line under it, its switch shorter. Its switch the tabs
   side by side, colored as the band: the others in the accent, the one shown in the panel's color. */
.tab-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 40;
  padding: 0 16px;
  background: transparent;
  border-bottom: 2px solid transparent;
  visibility: hidden;
  transition:
    padding 0.2s ease-out,
    background-color 0.2s ease-out,
    border-color 0.2s ease-out;
}
.tab-bar.settled {
  padding: 6px 16px;
  background: var(--bg);
  border-bottom-color: var(--ink);
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
