<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { t, type MessageKey } from '@/i18n'
import { termOptions, toTerm, type Term, type TermKind } from '@/lib/searchTerms'

// Adds a filter to a group of a list's (`FilterGroups`): a button that opens the explicit choices, what to filter by
// (`kinds`; with only one, straight to its entries) and then the entry, every one of that kind by name
// (`termOptions`), those `taken` already left out. Picking one adds it and closes again, as Escape or its cross does.
// `label` names the button (a new group). `shown` shows the choices with no button to open them, nor a cross to close
// them: the first filter's, the advanced mode's start.
const props = defineProps<{
  label?: string
  shown?: boolean
  kinds: readonly TermKind[]
  /** The terms already there, not offered again. */
  taken: readonly Term[]
}>()
const emit = defineEmits<{ add: [term: Term] }>()

const open = ref(false)
const kind = ref<TermKind>(props.kinds[0]!)
const kindSelect = useTemplateRef('kindSelect')
const entrySelect = useTemplateRef('entrySelect')

async function start() {
  if (!props.kinds.includes(kind.value)) kind.value = props.kinds[0]!
  open.value = true
  await nextTick()
  ;(kindSelect.value ?? entrySelect.value)?.focus()
}

const options = computed(() =>
  termOptions(kind.value).filter((o) => !props.taken.some((x) => x.kind === kind.value && x.id === o.id)),
)

function pick(e: Event) {
  const select = e.target as HTMLSelectElement
  const term = select.value ? toTerm(kind.value, select.value) : null
  if (!term) return
  emit('add', term)
  open.value = false
}
</script>

<template>
  <span v-if="open || shown" class="adder" @keydown.escape="open = false">
    <select v-if="kinds.length > 1" ref="kindSelect" v-model="kind" class="search" :aria-label="t('filter.kind')">
      <option v-for="k in kinds" :key="k" :value="k">{{ t(`filter.kind.${k}` as MessageKey) }}</option>
    </select>
    <select
      ref="entrySelect"
      :key="kind"
      class="search"
      :aria-label="t(`filter.kind.${kind}` as MessageKey)"
      @change="pick"
    >
      <option value="">{{ t('filter.choose') }}</option>
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.name }}</option>
    </select>
    <button v-if="!shown" type="button" class="remove" :aria-label="t('filter.cancel')" @click="open = false">×</button>
  </span>
  <button
    v-else
    v-tip="label ? undefined : t('filter.addTo')"
    type="button"
    class="btn chip"
    :aria-label="label ? undefined : t('filter.addTo')"
    @click="start"
  >
    + {{ label }}
  </button>
</template>

<style scoped>
.adder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.adder .search {
  width: auto;
  max-width: 12em;
  margin: 0;
  padding: 1px 4px;
}
.btn.chip {
  min-height: 22px;
}
.remove {
  padding: 0 6px;
  font: inherit;
  font-size: 1.15em;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.remove:hover {
  color: inherit;
}
</style>
