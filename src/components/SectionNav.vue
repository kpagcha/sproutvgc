<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'

// A page's sections as a row of links stuck to the top of the screen, the one being read marked as the page scrolls
// (each section an element with the `id` given): the last whose top has passed a line a third of the way down the
// screen, or the last of all at the page's bottom, checked as the page scrolls and as it changes size. Clicking one
// scrolls to it. The row scrolls sideways where they don't fit, keeping the one marked in view. The page gives its
// sections room above them for the row (`scroll-margin-top`), and whatever else sticks to the top goes under it
// (`--sticky-offset`).
// What the page puts in its `lead` slot (a tournament's tabs) heads the row once `after` (where it is on the page) has
// scrolled under it, sliding in; the room it takes taken back under the row, so what's under it doesn't move.
const props = defineProps<{ sections: readonly { id: string; label: string }[]; after?: HTMLElement | null }>()

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
  const nav = navEl.value
  led.value = !!props.after && !!nav && props.after.getBoundingClientRect().bottom <= nav.getBoundingClientRect().bottom
}
const navEl = useTemplateRef<HTMLElement>('nav')
const lead = useTemplateRef<HTMLElement>('lead')
const led = shallowRef(false)
const { height: leadHeight } = useElementSize(lead, undefined, { box: 'border-box' })

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
function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <nav ref="nav" class="section-nav" :class="{ led }" :style="{ '--lead-h': `${leadHeight}px` }">
    <div v-if="$slots.lead" ref="lead" class="lead" :inert="!led"><slot name="lead" /></div>
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
  </nav>
</template>

<style scoped>
/* Stuck to the top on the page's color, a line under it, over what scrolls under it. */
.section-nav {
  position: sticky;
  top: 0;
  z-index: 5;
  margin: 0 0 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
/* The lead, out of the way until shown: then at the top of the row, the row's margin under it less its height. */
.lead {
  position: absolute;
  inset: 0 0 auto;
  visibility: hidden;
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out,
    visibility 0s 0.15s;
}
.section-nav.led {
  margin-bottom: calc(12px - var(--lead-h));
}
.section-nav.led .lead {
  position: static;
  visibility: visible;
  opacity: 1;
  transform: none;
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}
.row {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
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
