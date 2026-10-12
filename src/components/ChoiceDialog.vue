<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import ChoiceCard from '@/components/ChoiceCard.vue'
import ModalDialog from '@/components/ModalDialog.vue'

// A choice of one, as a button saying the one picked (drawn as the selects beside it are) that opens a card of them
// (`ChoiceCard`), each with what it means in a line under its name when it says: dropping from the button, closed by a press outside
// it or Escape; on phones, in a dialog over the page. Picking one closes it. As `MetaDialog` is to the data shown.
const props = defineProps<{ label: string; options: readonly { value: T; label: string; desc?: string }[] }>()
const model = defineModel<T>({ required: true })
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')

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
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => {
  open.value = false
  phoneQuery.removeEventListener('change', onPhone)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
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
      class="search toggle"
      :aria-expanded="open"
      :aria-haspopup="phone ? 'dialog' : 'true'"
      :aria-label="`${label}: ${picked?.label ?? ''}`"
      @click="open = !open"
    >
      <span class="picked">{{ picked?.label }}</span>
      <ChevronDown :size="14" class="chevron" :class="{ open }" aria-hidden="true" />
    </button>
    <ModalDialog v-if="phone" v-model:open="open" :label>
      <ChoiceCard :label :options :picked="model" @pick="pick" @close="open = false" />
    </ModalDialog>
    <div v-else-if="open" class="pop">
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
  gap: 8px;
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
</style>
