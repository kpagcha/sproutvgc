<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'

// A page's sections as a row of links stuck to the top of the screen, the one being read marked as the page scrolls
// (each section an element with the `id` given): the last whose top has passed a line a third of the way down the
// screen, or the last of all at the page's bottom, checked as the page scrolls and as it changes size. Clicking one
// scrolls to it. The row scrolls sideways where they don't fit, keeping the one marked in view. The page gives its
// sections room above them for the row (`scroll-margin-top`), and whatever else sticks to the top goes under it
// (`--sticky-offset`).
// `attached`, it's a bar under tabs (a tournament's, `BandTabs` bare) in the panel's color, outlined as panels are, which
// the tab shown opens into; on wide screens stuck under them as they stick (`--tabs-h`, their height); on phones not
// stuck at all, the tabs' bar taking over at the top with the row in it again (`inBar`, outlined the same, not stuck);
// under tabs stuck on phones too (`noBar`, the rankings'), stuck under them there as well. Its slot, at the row's
// end, holds what the page keeps at hand as it scrolls (the team builder's Megas), never scrolled away with the links.
const props = defineProps<{
  sections: readonly { id: string; label: string }[]
  attached?: boolean
  inBar?: boolean
  noBar?: boolean
}>()

const active = shallowRef<string | null>(null)
const row = useTemplateRef<HTMLElement>('row')

function update() {
  const line = window.innerHeight / 3
  let current: string | null = props.sections[0]?.id ?? null
  for (const s of props.sections) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top <= line) current = s.id
  }
  const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  if (bottom && props.sections.length) current = props.sections[props.sections.length - 1]!.id
  active.value = current
}

let frame = 0
function onScroll() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    update()
  })
}
window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll)
// And as the page grows or shrinks (what's under a section loading): a page short enough to be at its bottom marks its
// last section until then.
const resized = new ResizeObserver(onScroll)
resized.observe(document.documentElement)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  resized.disconnect()
  cancelAnimationFrame(frame)
})
watch(
  () => props.sections.map((s) => s.id).join(),
  () => void nextTick(update),
  { immediate: true },
)

// The marked one kept in view in the row, by the row's own scroll alone.
watch(active, async (id) => {
  await nextTick()
  const link = row.value?.querySelector<HTMLElement>(`[data-id="${id}"]`)
  if (!row.value || !link) return
  const r = row.value
  if (link.offsetLeft < r.scrollLeft) r.scrollLeft = link.offsetLeft
  else if (link.offsetLeft + link.offsetWidth > r.scrollLeft + r.clientWidth)
    r.scrollLeft = link.offsetLeft + link.offsetWidth - r.clientWidth
})

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
// Smooth only to a section within about a screen: what the page skips laying out until it's near the screen (a long
// table's rows, `content-visibility`) takes its real height as a smooth scroll passes it, moving the section from where
// the scroll was headed. Further, a jump, which lays out none of what it skips, so the section is where it was aimed.
function go(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const near = Math.abs(el.getBoundingClientRect().top) < window.innerHeight
  el.scrollIntoView({ behavior: near && !reduced.matches ? 'smooth' : 'auto', block: 'start' })
}
</script>

<template>
  <nav class="section-nav" :class="{ attached, 'in-bar': inBar, 'no-bar': noBar }">
    <div ref="row" class="row">
      <a
        v-for="s in sections"
        :key="s.id"
        :href="`#${s.id}`"
        :data-id="s.id"
        class="link"
        :class="{ on: active === s.id }"
        :aria-current="active === s.id ? 'location' : undefined"
        @click.prevent="go(s.id)"
        >{{ s.label }}</a
      >
    </div>
    <div v-if="$slots.default" class="end"><slot /></div>
  </nav>
</template>

<style scoped>
/* Stuck to the top on the page's color, a line under it, over what scrolls under it; the links, then what's at its end. */
.section-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 5;
  margin: 0 0 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
/* Attached under tabs: no line of its own, the row a bar outlined and shadowed as panels are; on wide screens stuck
   under the tabs. */
.section-nav.attached {
  background: none;
  border-bottom: none;
}
/* Right under bare tabs, its top tucked under their bottom edge (they're over it), as a panel's is (retro.css), so the
   seam where they meet, on screens that draw it between pixels, is over the row's own color rather than a faint line;
   3px, for its shadow to start where theirs ends; stuck, tucked as much. */
.band-tabs.bare + .section-nav.attached {
  z-index: 2;
  margin-top: -3px;
}
.section-nav.attached .row {
  padding: 0 4px;
  background: var(--panel);
  border: 2px solid var(--ink);
  border-top: none;
  box-shadow: var(--hard);
}
@media (min-width: 721px) {
  .section-nav.attached {
    top: var(--tabs-h, 0px);
  }
  .band-tabs.bare + .section-nav.attached {
    top: calc(var(--tabs-h, 0px) - 3px);
  }
}
@media (max-width: 720px) {
  .section-nav.attached {
    position: static;
  }
  .section-nav.attached.no-bar {
    position: sticky;
    top: calc(var(--tabs-h, 0px) - 3px);
  }
}
.section-nav.in-bar {
  position: static;
  margin: 0;
  background: none;
  border-bottom: none;
}
/* In the tabs' bar, outlined as it is attached on the page, under the tabs' switch. */
.section-nav.in-bar .row {
  padding: 0 4px;
  background: var(--panel);
  border: 2px solid var(--ink);
  border-top: none;
}
.row {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.end {
  flex: none;
  display: flex;
  align-items: center;
}
.row::-webkit-scrollbar {
  display: none;
}
.link {
  flex: none;
  padding: 8px 10px 6px;
  font-size: 0.9em;
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.link:hover {
  color: var(--text);
}
.link.on {
  color: var(--text);
  border-bottom-color: var(--accent);
}
</style>
