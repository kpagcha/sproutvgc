<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import ChoiceCard from '@/components/ChoiceCard.vue'
import ModalDialog from '@/components/ModalDialog.vue'

// A choice of one, as a button saying the one picked (drawn as `MetaDialog`'s button is) that opens a card of them
// (`ChoiceCard`), each with what it means in a line under its name when it says: dropping from the button, closed by a press outside
// it or Escape; on phones, in a dialog over the page. Picking one closes it. As `MetaDialog` is to the data shown.
// The card opens where it fits: under the button, or over it when there's more room there; from the button's edge on
// its side of the screen (its right edge on the right half), unless it would run off the screen.
const props = defineProps<{
  label: string
  options: readonly { value: T; label: string; desc?: string }[]
  disabled?: boolean
}>()
const model = defineModel<T>({ required: true })
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const pop = useTemplateRef<HTMLElement>('pop')

/** Where the card opens: over the button rather than under it, from its right edge rather than its left, and as tall as
 * the room it has. */
const place = ref({ up: false, end: false, room: Infinity, scroll: false })
const GAP = 6
const MARGIN = 8
function measure() {
  const button = root.value?.getBoundingClientRect()
  const card = pop.value
  if (!button || !card) return
  const below = window.innerHeight - button.bottom - GAP - MARGIN
  const above = button.top - GAP - MARGIN
  const up = card.scrollHeight > below && above > below
  const width = card.offsetWidth
  // From the edge on the button's side of the screen, so it stays over the page; the other one if that runs off it.
  const fitsEnd = button.right - width >= MARGIN
  const end =
    fitsEnd &&
    (button.left + button.width / 2 > window.innerWidth / 2 || button.left + width > window.innerWidth - MARGIN)
  const room = Math.max(0, up ? above : below)
  // Scrolling only when it must, as that clips the card's shadow.
  place.value = { up, end, room, scroll: card.scrollHeight > room }
}
watch(open, (on) => on && measure(), { flush: 'post' })

const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)

function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open.value = false)
watch([open, phone], ([on, p]) => {
  if (on && !p) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', measure)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', measure)
  }
})
onBeforeUnmount(() => {
  open.value = false
  phoneQuery.removeEventListener('change', onPhone)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measure)
})

const picked = computed(() => props.options.find((o) => o.value === model.value))
function pick(v: T) {
  model.value = v
  open.value = false
}
</script>

<template>
  <div ref="root" class="choice-dialog">
    <button
      type="button"
      class="btn toggle"
      :aria-expanded="open"
      :aria-haspopup="phone ? 'dialog' : 'true'"
      :aria-label="`${label}: ${picked?.label ?? ''}`"
      :disabled
      @click="open = !open"
    >
      <span class="picked">{{ picked?.label }}</span>
      <ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <ModalDialog v-if="phone" v-model:open="open" :label>
      <ChoiceCard :label :options :picked="model" @pick="pick" @close="open = false" />
    </ModalDialog>
    <div
      v-else-if="open"
      ref="pop"
      class="pop"
      :class="{ up: place.up, end: place.end, scroll: place.scroll }"
      :style="place.scroll ? { maxHeight: `${place.room}px` } : undefined"
    >
      <ChoiceCard :label :options :picked="model" @pick="pick" @close="open = false" />
    </div>
  </div>
</template>

<style scoped>
.choice-dialog {
  position: relative;
  display: inline-flex;
  min-width: 0;
}
/* The one picked, then the arrow. */
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
}
.picked {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  flex: none;
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* Under the button, over the page. */
.pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: min(360px, calc(100vw - 32px));
}
.pop.scroll {
  overflow-y: auto;
}
.pop.up {
  top: auto;
  bottom: calc(100% + 6px);
}
.pop.end {
  left: auto;
  right: 0;
}
.toggle:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
