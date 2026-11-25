<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { ItemId, PokemonId } from '@/data/dex'
import type { TypeId } from '@/data/types'
import { t, type MessageKey } from '@/i18n'
import { fold, split, type Marks } from '@/lib/search'
import { termOptions, toTerm, type Term, type TermKind } from '@/lib/searchTerms'
import ItemIcon from '@/components/ItemIcon.vue'
import Marked from '@/components/Marked'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// Adds a filter to a group of a list's (`FilterGroups`): a button that opens the explicit choices, what to filter by
// (`kinds`; with only one, straight to its entries) and then the entry, searched by name in a box with every one of
// that kind under it (`termOptions`), those `taken` already left out: typing narrows them, the arrow keys move through
// them and Enter picks, as a click does. Picking one adds it and closes again, as Escape or its cross does. `label`
// names the button (a new group). `shown` shows the choices with no button to open them, nor a cross to close them:
// the first filter's, the advanced mode's start.
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
const entryInput = useTemplateRef('entryInput')
const listEl = useTemplateRef('listEl')
const listId = `filter-adder-${Math.random().toString(36).slice(2, 8)}`

async function start() {
  if (!props.kinds.includes(kind.value)) kind.value = props.kinds[0]!
  open.value = true
  await nextTick()
  ;(kindSelect.value ?? entryInput.value)?.focus()
}

const text = ref('')
/** Whether the entries are showing under the box: while it has the focus. */
const listing = ref(false)
const active = ref(0)

const all = computed(() =>
  termOptions(kind.value).filter((o) => !props.taken.some((x) => x.kind === kind.value && x.id === o.id)),
)
const options = computed((): { id: string; name: string; parts: Marks }[] => {
  const q = fold(text.value.trim())
  if (!q) return all.value.map((o) => ({ ...o, parts: [o.name] }))
  return all.value.flatMap((o) => {
    const parts = split(o.name, q)
    return parts ? [{ ...o, parts }] : []
  })
})
watch(options, () => (active.value = 0))
watch(kind, async () => {
  text.value = ''
  await nextTick()
  entryInput.value?.focus()
})

function pick(id: string) {
  const term = toTerm(kind.value, id)
  if (!term) return
  emit('add', term)
  text.value = ''
  listing.value = false
  open.value = false
}

async function move(by: number) {
  const n = options.value.length
  if (!n) return
  listing.value = true
  active.value = (active.value + by + n) % n
  await nextTick()
  listEl.value?.querySelector<HTMLElement>(`#${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    move(e.key === 'ArrowDown' ? 1 : -1)
  } else if (e.key === 'Enter') {
    const o = options.value[active.value]
    if (listing.value && o) {
      e.preventDefault()
      pick(o.id)
    }
  } else if (e.key === 'Escape' && listing.value && props.shown) {
    // The first filter's choices stay; Escape only folds their entries away.
    e.stopPropagation()
    listing.value = false
  }
}

function close() {
  open.value = false
  listing.value = false
  text.value = ''
}
</script>

<template>
  <span v-if="open || shown" class="adder" @keydown.escape="!shown && close()">
    <select v-if="kinds.length > 1" ref="kindSelect" v-model="kind" class="search" :aria-label="t('filter.kind')">
      <option v-for="k in kinds" :key="k" :value="k">{{ t(`filter.kind.${k}` as MessageKey) }}</option>
    </select>
    <span class="entry">
      <input
        ref="entryInput"
        v-model="text"
        type="search"
        class="search"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        :placeholder="t('filter.choose')"
        :aria-label="t(`filter.kind.${kind}` as MessageKey)"
        :aria-expanded="listing"
        :aria-controls="listId"
        :aria-activedescendant="listing && options.length ? `${listId}-${active}` : undefined"
        @focus="listing = true"
        @click="listing = true"
        @input="listing = true"
        @blur="listing = false"
        @keydown="onKey"
      />
      <ul v-if="listing" :id="listId" ref="listEl" class="entries" role="listbox">
        <li
          v-for="(o, i) in options"
          :id="`${listId}-${i}`"
          :key="o.id"
          role="option"
          class="option"
          :class="{ active: i === active }"
          :aria-selected="i === active"
          @mousedown.prevent="pick(o.id)"
          @mousemove="active = i"
        >
          <TypeIcon v-if="kind === 'type'" :type="o.id as TypeId" />
          <ItemIcon v-else-if="kind === 'item'" :id="o.id as ItemId" :scale="0.67" />
          <PokemonIcon v-else-if="kind === 'pokemon'" :id="o.id as PokemonId" />
          <span v-if="kind !== 'type'" class="option-name"><Marked :p="o.parts" /></span>
        </li>
        <li v-if="!options.length" class="none">{{ t('filter.noMatch') }}</li>
      </ul>
    </span>
    <button v-if="!shown" type="button" class="remove" :aria-label="t('filter.cancel')" @click="close">×</button>
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
.entry {
  position: relative;
}
/* The kind's entries, a card under the box over what's under it, as the filter search's terms are. */
.entries {
  --icon-scale: 1;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 2px;
  list-style: none;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
}
.option {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 6px;
  white-space: nowrap;
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
.none {
  padding: 6px;
  color: var(--muted);
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
