<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '@/i18n'
import { AREAS, type AreaId } from '@/lib/areas'

// The header's one drop-down of an area's sections, under the area link hovered (`anchor`, `current`). Moving from one
// area to the next, it glides there and takes the next one's size, the next one's sections sliding in from the side it
// came from, with no fade, each area's list drawn once and kept (only the current one shown and reachable). Opened from
// nothing, it's there at once. It sits in the nav, placed by its links'.
const props = defineProps<{ current: AreaId | null; anchor: HTMLElement | null }>()
const emit = defineEmits<{ enter: []; leave: [] }>()

const route = useRoute()
const root = useTemplateRef('root')
const lists = useTemplateRef<HTMLElement[]>('lists')

/** Each area's list's size, measured as drawn. */
const sizes = shallowRef<Record<string, { w: number; h: number }>>({})
function measure() {
  const next: Record<string, { w: number; h: number }> = {}
  for (const el of lists.value ?? []) next[el.dataset.area!] = { w: el.offsetWidth, h: el.offsetHeight }
  sizes.value = next
}
let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  for (const el of lists.value ?? []) observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

/** Its place in the nav, and whether it was open already (so it glides there rather than appearing). */
const x = ref(0)
const gliding = ref(false)
const index = computed(() => AREAS.findIndex((a) => a.id === props.current))
// The last area shown, kept while it fades out so it doesn't empty as it goes.
const last = ref<AreaId | null>(null)

watch(
  () => [props.current, props.anchor] as const,
  ([id, el], [prev]) => {
    gliding.value = !!prev && !!id
    if (!id || !el) return
    last.value = id
    const nav = root.value?.parentElement
    if (!nav) return
    const n = nav.getBoundingClientRect()
    const w = sizes.value[id]?.w ?? 0
    const left = el.getBoundingClientRect().left - n.left + nav.scrollLeft - 4
    x.value = Math.max(0, Math.min(left, nav.clientWidth - w))
  },
)

const shown = computed(() => props.current ?? last.value)
const size = computed(() => (shown.value ? sizes.value[shown.value] : undefined))
/** Where each list sits against the one shown: before it to the left, after it to the right. */
const sideOf = (i: number) => {
  const at = props.current ? index.value : AREAS.findIndex((a) => a.id === last.value)
  return i < at ? 'before' : i > at ? 'after' : 'at'
}
</script>

<template>
  <div
    ref="root"
    class="area-menu"
    :class="{ open: current, gliding }"
    :style="{ transform: `translateX(${x}px)` }"
    :inert="!current"
    @pointerenter="emit('enter')"
    @pointerleave="emit('leave')"
    @focusin="emit('enter')"
    @focusout="emit('leave')"
  >
    <div class="viewport panel" :style="size && { width: `${size.w}px`, height: `${size.h}px` }">
      <div
        v-for="(a, i) in AREAS"
        ref="lists"
        :key="a.id"
        :data-area="a.id"
        class="list"
        :class="sideOf(i)"
        :inert="a.id !== current"
      >
        <RouterLink
          v-for="s in a.sections"
          :key="s.key"
          :to="{ name: s.route }"
          :class="{ active: route.meta.section === s.key, soon: s.soon }"
        >
          {{ t(s.label) }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.area-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 30;
  /* The gap down to it is its own, so crossing it keeps the hover. */
  padding-top: 6px;
  visibility: hidden;
  pointer-events: none;
}
.area-menu.open {
  visibility: visible;
  pointer-events: auto;
}
.area-menu.gliding {
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.viewport {
  position: relative;
  box-sizing: content-box;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.area-menu.gliding .viewport {
  transition:
    width 0.26s cubic-bezier(0.2, 0.8, 0.2, 1),
    height 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.list {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  min-width: 170px;
  padding: 4px;
  /* No fade: the one leaving gone at once, the one coming in there at once, sliding the last bit in. */
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.list:is(.before, .after) {
  visibility: hidden;
  transition: none;
}
.list.before {
  transform: translateX(-12px);
}
.list.after {
  transform: translateX(12px);
}
.area-menu:not(.gliding) .list {
  transition: none;
}
.list a {
  padding: 6px 10px;
  border-radius: 3px;
  color: var(--text);
  white-space: nowrap;
}
.list a:hover {
  background: var(--hover);
  text-decoration: none;
}
.list a.active {
  background: var(--sel);
}
.list a.soon:not(.active) {
  opacity: 0.7;
}
@media (prefers-reduced-motion: reduce) {
  .area-menu,
  .area-menu.gliding,
  .viewport,
  .list {
    transition: none;
  }
}
</style>
