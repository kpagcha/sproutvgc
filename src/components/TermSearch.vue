<script setup lang="ts">
import Marked from '@/components/Marked'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { Search } from '@lucide/vue'
import { sameRef, type ItemId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useSearch, type SectionKind } from '@/composables/useSearch'
import type { Term, TermKind } from '@/lib/searchTerms'
import type { Marks } from '@/lib/search'
import ItemIcon from '@/components/ItemIcon.vue'
import TypeIcon from '@/components/TypeIcon'

// An advanced search box: what's typed searches the list by name, as any search box, and finds the types, abilities,
// moves and items of `kinds` too, listed under it with how many of the list each would leave (`count`; those leaving
// none left out). Picking one, by clicking it or with the arrow keys and Enter, makes it a term of the search, a chip
// in the box before the text, and clears the text; a chip's cross takes it off again, as Backspace in an empty box
// takes off the last. The list is the dex's search (`useSearch`), a few of each kind. A magnifying glass leads the box,
// and the key the page focuses it with (`hotkey`) ends it, as the site's search boxes have them.
const props = defineProps<{
  placeholder: string
  kinds: readonly TermKind[]
  /** How many the list would have with `term` added to the terms: those that would have none aren't offered. */
  count: (term: Term) => number
  /** The key the page focuses it with, hinted at in it while there's nothing to clear (`SearchBox`'s). */
  hotkey?: string
}>()
const text = defineModel<string>('text', { required: true })
const terms = defineModel<Term[]>('terms', { required: true })

/** A kind lists this many at most. */
const PER_KIND = 5
const SECTION_KINDS = computed(() => props.kinds.filter((k): k is Exclude<TermKind, 'type'> => k !== 'type'))
const { results } = useSearch(() => text.value, SECTION_KINDS.value as SectionKind[])

interface Option {
  term: Term
  name: string
  parts: Marks
  n: number
}
/** What the text finds, by kind (types first), each with how many of the list it'd leave; what's a term already, out. */
const groups = computed(() => {
  const r = results.value
  if (!r) return []
  const offer = (term: Term, name: string, parts: Marks): Option[] => {
    if (terms.value.some((x) => sameRef(x, term))) return []
    const n = props.count(term)
    return n ? [{ term, name, parts, n }] : []
  }
  const types = props.kinds.includes('type')
    ? r.types.flatMap((x) => offer({ kind: 'type', id: x.id }, refName({ kind: 'type', id: x.id }), x.parts))
    : []
  const sections = r.sections.map((s) => ({
    kind: s.kind as TermKind,
    options: s.hits.flatMap((h) => offer({ kind: s.kind, id: h.id } as Term, h.name, h.parts)).slice(0, PER_KIND),
  }))
  return [{ kind: 'type' as TermKind, options: types.slice(0, PER_KIND) }, ...sections].filter((g) => g.options.length)
})
const options = computed(() => groups.value.flatMap((g) => g.options))

const focused = ref(false)
const dismissed = ref(false)
const open = computed(() => focused.value && !dismissed.value && options.value.length > 0)
const active = ref(0)
watch(options, () => (active.value = 0))
watch(text, () => (dismissed.value = false))

const input = useTemplateRef('input')
defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) })
function pick(o: Option) {
  terms.value = [...terms.value, o.term]
  text.value = ''
  input.value?.focus()
}
function remove(term: Term) {
  terms.value = terms.value.filter((x) => !sameRef(x, term))
  input.value?.focus()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Backspace' && !text.value && terms.value.length) {
    terms.value = terms.value.slice(0, -1)
    return
  }
  if (!open.value) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = options.value.length
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(options.value[active.value]!)
  } else if (e.key === 'Escape') dismissed.value = true
}

const KIND_LABEL = {
  type: 'filter.kind.type',
  ability: 'filter.kind.ability',
  move: 'filter.kind.move',
  item: 'filter.kind.item',
} as const
const listId = useId()
const optionId = (i: number) => `${listId}-${i}`
/** Each option's place in the flat list, for the arrow keys. */
const indexOf = (o: Option) => options.value.indexOf(o)
</script>

<template>
  <div class="term-search">
    <!-- The box: the terms as chips, then the text. Clicking anywhere in it is typing in it. -->
    <div class="box" @click="input?.focus()">
      <Search class="glass" :size="16" :stroke-width="2.5" aria-hidden="true" />
      <span v-for="term in terms" :key="`${term.kind}:${term.id}`" class="chip">
        <TypeIcon v-if="term.kind === 'type'" :type="term.id" />
        <ItemIcon v-else-if="term.kind === 'item'" :id="term.id as ItemId" :scale="0.67" />
        <span v-if="term.kind !== 'type'">{{ refName(term) }}</span>
        <button
          type="button"
          class="remove"
          :aria-label="t('filter.remove', { name: refName(term) })"
          @click.stop="remove(term)"
        >
          ×
        </button>
      </span>
      <input
        ref="input"
        v-model="text"
        type="text"
        class="text"
        :placeholder="terms.length ? '' : placeholder"
        :aria-label="placeholder"
        :aria-keyshortcuts="hotkey"
        role="combobox"
        autocomplete="off"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="open ? optionId(active) : undefined"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKey"
      />
      <button
        v-if="text || terms.length"
        type="button"
        class="clear"
        :aria-label="t('search.clear')"
        @click.stop="((text = ''), (terms = []), input?.focus())"
      >
        ×
      </button>
      <kbd v-else-if="hotkey" class="hotkey" aria-hidden="true">{{ hotkey }}</kbd>
    </div>
    <!-- What the text finds, by kind, under the box. -->
    <ul v-show="open" :id="listId" class="options" role="listbox">
      <template v-for="g in groups" :key="g.kind">
        <li role="presentation" class="group">{{ t(KIND_LABEL[g.kind]) }}</li>
        <li
          v-for="o in g.options"
          :id="optionId(indexOf(o))"
          :key="o.term.id"
          role="option"
          class="option"
          :class="{ active: indexOf(o) === active }"
          :aria-selected="indexOf(o) === active"
          @mousedown.prevent="pick(o)"
          @mouseenter="active = indexOf(o)"
        >
          <TypeIcon v-if="o.term.kind === 'type'" :type="o.term.id" />
          <ItemIcon v-else-if="o.term.kind === 'item'" :id="o.term.id as ItemId" :scale="0.67" />
          <span v-if="o.term.kind !== 'type'" class="option-name"><Marked :p="o.parts" /></span>
          <span class="option-count">{{ o.n }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.term-search {
  position: relative;
  width: 100%;
  max-width: 480px;
}
/* The box, as the site's search fields are: the chips and the text in a row, wrapping. */
.box {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 38px;
  padding: 3px 32px 3px 4px;
  background: var(--panel-alt);
  border: 2px solid var(--ink);
  cursor: text;
}
.box:focus-within {
  border-color: var(--accent);
  box-shadow: var(--hard);
}
/* The text, borderless in the box, taking what's left of its line. */
:root:root .box .text {
  flex: 1 1 8em;
  min-width: 8em;
  padding: 3px 4px;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  box-shadow: none;
  outline: none;
}
/* The magnifying glass leading the box, as `SearchBox`'s. */
.glass {
  flex: none;
  margin: 0 2px 0 6px;
  color: var(--muted);
}
/* The key that focuses it, where the clear button goes, as `SearchBox`'s. */
.hotkey {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  min-width: 18px;
  padding: 2px 4px;
  font:
    11px/1 Verdana,
    sans-serif;
  text-align: center;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 2px;
  pointer-events: none;
}
/* Touch-first devices (phones, tablets) usually have no keyboard to press it on. */
@media (hover: none) and (pointer: coarse) {
  .hotkey {
    display: none;
  }
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0 1px 4px;
  font-size: 0.9em;
  background: var(--panel);
  border: 1px solid var(--border-strong);
}
.remove,
.clear {
  padding: 0 6px;
  font: inherit;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.remove {
  font-size: 1.1em;
}
.remove:hover,
.clear:hover {
  color: inherit;
}
.clear {
  position: absolute;
  top: 50%;
  right: 4px;
  font-size: 1.3em;
  transform: translateY(-50%);
}
/* What the text finds: a card under the box, as the Pokémon pickers' lists are. */
.options {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 2px;
  list-style: none;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
}
.group {
  padding: 6px 6px 2px;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.option {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 6px;
  cursor: pointer;
}
.option.active {
  background: var(--sel);
}
.option-name {
  min-width: 0;
}
/* How many of the list it'd leave, at the row's end. */
.option-count {
  margin-left: auto;
  padding-left: 8px;
  font-size: 0.85em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
