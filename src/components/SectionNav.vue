<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'

// A page's sections as a row of links stuck to the top of the screen, the one being read marked as the page scrolls
// (each section an element with the `id` given): the last whose top has passed a line a third of the way down the
// screen, or the last of all at the page's bottom, checked as the page scrolls and as it changes size. Clicking one
// scrolls to it. The row scrolls sideways where they don't fit, keeping the one marked in view. The page gives its
// sections room above them for the row (`scroll-margin-top`), and whatever else sticks to the top goes under it
// (`--sticky-offset`).
const props = defineProps<{ sections: readonly { id: string; label: string }[] }>()

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
function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <nav class="section-nav">
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
