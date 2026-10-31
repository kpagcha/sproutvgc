<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { Search, SlidersHorizontal } from '@lucide/vue'
import type { ItemId, PokemonId } from '@/data/dex'
import { locale, t } from '@/i18n'
import { useAdvancedFilters } from '@/composables/useAdvancedFilters'
import { confirmDialog } from '@/composables/useConfirm'
import { useTermPicker, type TermOption } from '@/composables/useTermPicker'
import { isPlain, noFilters, replaced, without, withFilter, withoutLast } from '@/lib/filterGroups'
import {
  searchedBy,
  termName,
  type Detail,
  type RefTerm,
  type Term,
  type TermFilters,
  type TermKind,
  type TextMatch,
} from '@/lib/searchTerms'
import { refName } from '@/i18n/refName'
import DetailMenu from '@/components/DetailMenu.vue'
import FilterGroups from '@/components/FilterGroups.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TermOptions from '@/components/TermOptions.vue'
import TypeIcon from '@/components/TypeIcon'

// A list's search and filters, one box for both, as every list on the site has them. What's typed searches the list
// (by name, or by what its entries do too: `match`), and finds the terms of `kinds` to filter it by (a type, an
// ability, a move's category… `searchTerms.ts`), listed under the box with how many of the list each would leave
// (`count`; those leaving none left out), in the page's flow so the list stays in sight (`floating`, a card over it,
// `TermOptions`); the placeholder says what it searches by. Picking one, by clicking it or with
// the arrow keys and Enter, adds it to the filters (`filters`, kept in the URL by the page) and clears the text.
// Plainly the filters are chips under the box, all to pass, a chip's cross taking one off again, as
// Backspace in an empty box takes off the last. In the advanced mode (its button beside the box, one choice for every
// list, `useAdvancedFilters`; on too while the filters need it) they're groups under the box (`FilterGroups`), joined
// by AND or OR, any negated, each adding filters from the explicit choices of what to filter by and then the entry,
// what's picked in the box joining the last group.
// The list behind shows what Enter would do: while the options are open, the one highlighted makes `preview` the
// filters with it added, for the page to show. When the text finds some of the list by name too (`nameCount`), the
// options lead with that, highlighted at first, which keeps the text as a search, as Escape or leaving the box does.
// On a list of teams (`details`), a Pokémon's chip, its name tapped, narrows it to a build: the one Pokémon with an
// item, ability or moves its sets run (`DetailMenu`), its chip then naming them after it.
// Without `subject` there's no search by text: it only finds terms. A magnifying glass leads the box, and the key the
// page focuses it with (`hotkey`) ends it, as the site's search boxes have them. A placeholder too long for the box
// (on a phone) is a line of text under it instead, rather than cut short; and there the advanced mode's button is its
// icon alone.
// What's typed reaches the list (`text`) and the options once the typing pauses (`SETTLE`), so a long list isn't drawn
// again at every key; at once when the box is emptied, and before a key that acts on the options or leaving the box.
// Under `MIN_CHARS` it searches nothing: a letter alone finds most of any list.
const props = withDefaults(
  defineProps<{
    kinds: readonly TermKind[]
    /** How many the list would have with these filters. */
    count: (filters: TermFilters) => number
    /** What the list is of, for the placeholder ("Search moves by…") and the search by text's option; none for a box
     * that only finds terms. */
    subject?: string
    /** What the text searches the list by. */
    match?: readonly TextMatch[]
    /** How many of the list the text finds. */
    nameCount?: number
    /** The key the page focuses it with, hinted at in it while there's nothing to clear (`SearchBox`'s). */
    hotkey?: string
    /** Filters of dex entries link to their meta pages. */
    meta?: boolean
    /** On a list of teams, what a Pokémon's sets run, the most first, to narrow its filter to a build by. */
    details?: (id: PokemonId) => readonly Detail[]
    /** The options a card over what's under the box, rather than a panel pushing it down. */
    floating?: boolean
  }>(),
  { match: () => ['name'], subject: undefined, nameCount: 0, hotkey: undefined, details: undefined },
)
const text = defineModel<string>('text', { default: '' })
const filters = defineModel<TermFilters>('filters', { required: true })
/** The filters with the term highlighted added, while the options are open; null otherwise. */
const preview = defineModel<TermFilters | null>('preview', { default: null })

/** How long the typing pauses before the list follows, in milliseconds. */
const SETTLE = 180
/** What's typed searches only from this many characters. */
const MIN_CHARS = 2
/** What's in the box, ahead of `text` while the typing goes on. */
const typed = ref(text.value)
/** What the box searches for: what's typed, from `MIN_CHARS` on. */
const searched = (q: string) => (q.trim().length >= MIN_CHARS ? q : '')
let settling: ReturnType<typeof setTimeout> | undefined
/** Hands what's typed on to the list now; whether it changed anything. */
function settle() {
  clearTimeout(settling)
  settling = undefined
  const q = searched(typed.value)
  if (text.value === q) return false
  text.value = q
  return true
}
watch(typed, (q) => {
  clearTimeout(settling)
  settling = searched(q) ? setTimeout(settle, SETTLE) : undefined
  if (!settling) settle()
})
// Set from outside (the page clearing it, the URL), the box follows.
watch(text, (q) => {
  if (q === searched(typed.value)) return
  clearTimeout(settling)
  settling = undefined
  typed.value = q
})
onBeforeUnmount(() => clearTimeout(settling))

const placeholder = computed(() => {
  const by = searchedBy(props.subject ? props.match : [], props.kinds)
  return props.subject ? t('filter.placeholder', { what: props.subject, by }) : t('filter.placeholderTerms', { by })
})
/** The search by text, leading the options: "Moves named “ice”". */
const lead = computed(() => {
  const q = text.value.trim()
  if (!props.subject || !q || !props.nameCount) return []
  const what = props.subject.charAt(0).toLocaleUpperCase(locale.value) + props.subject.slice(1)
  const key = props.match.includes('effect') ? 'filter.namedOrDoing' : 'filter.named'
  return [{ label: t(key, { what, text: q }), n: props.nameCount }]
})

const { advanced: advancedPicked, setAdvanced } = useAdvancedFilters()
const plain = computed(() => isPlain(filters.value))
const advanced = computed(() => props.kinds.length > 0 && (advancedPicked.value || !plain.value))
async function toggleAdvanced() {
  // Filters the plain box can't show are cleared on the way back, once confirmed.
  if (advanced.value && !plain.value) {
    if (!(await confirmDialog({ message: t('filter.plainConfirm'), confirm: t('filter.clear'), danger: true }))) return
    filters.value = noFilters()
  }
  setAdvanced(!advanced.value)
}
/** The chips under the box: the plain filters. */
const chips = computed(() => (advanced.value ? [] : (filters.value.groups[0]?.terms ?? [])))

const input = useTemplateRef('input')
/** Whether the placeholder fits in the box; else it's under the box. */
const fits = ref(true)
let canvas: CanvasRenderingContext2D | null | undefined
function measure() {
  const el = input.value
  if (!el) return
  canvas ??= document.createElement('canvas').getContext('2d')
  if (!canvas) return
  const style = getComputedStyle(el)
  canvas.font = style.font
  const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  fits.value = canvas.measureText(placeholder.value).width <= room
}
let resized: ResizeObserver | undefined
onMounted(() => {
  resized = new ResizeObserver(measure)
  if (input.value) resized.observe(input.value)
  document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => resized?.disconnect())
watch(placeholder, measure, { flush: 'post' })
defineExpose({ focus: (options?: FocusOptions) => input.value?.focus(options) })
const picker = useTermPicker({
  text,
  kinds: () => props.kinds,
  count: (term) => props.count(withFilter(filters.value, term)),
  // Plainly, what's in the box already; in groups, what's in the last one, which a pick joins.
  taken: () => filters.value.groups.at(-1)?.terms ?? [],
  lead: () => lead.value.length,
  onPick: (o) => pick(o),
})
const { groups, open, focused, dismissed, active, highlighted, indexOf } = picker
watch(highlighted, (term) => (preview.value = term ? withFilter(filters.value, term) : null), { immediate: true })

function pick(o: TermOption | number) {
  if (typeof o === 'number') {
    dismissed.value = true
    return
  }
  filters.value = withFilter(filters.value, o.term)
  typed.value = text.value = ''
  input.value?.focus()
}
/** How many of the list there'd be with `old` narrowed (or widened) to a term, for its details; and the filters so. */
const countWith = (old: Term) => (term: Term) => props.count(replaced(filters.value, old, term))
const change = (old: Term, term: Term) => (filters.value = replaced(filters.value, old, term))
function remove(term: Term) {
  filters.value = without(filters.value, term)
  input.value?.focus()
}
async function onKey(e: KeyboardEvent) {
  if (e.key === 'Backspace' && !typed.value && filters.value.groups.length) {
    filters.value = withoutLast(filters.value)
    return
  }
  // The options for what's typed, not what was a moment ago, from the first of them; Enter once the page has the text
  // too, for whether the search by text leads them (`nameCount`).
  if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key) && settle()) {
    if (e.key === 'Enter') {
      e.preventDefault()
      await nextTick()
    }
    dismissed.value = false
    active.value = 0
  }
  picker.onKey(e)
}
function leave() {
  settle()
  focused.value = false
}
/** The box's cross: the text, and plainly the chips too (the groups have a clearing of their own). */
const clearable = computed(() => !!typed.value || chips.value.length > 0)
function clear() {
  typed.value = text.value = ''
  if (!advanced.value) filters.value = noFilters()
  input.value?.focus()
}
const listId = useId()
</script>

<template>
  <div class="filter-search">
    <div class="search-row">
      <!-- The box: the text. Clicking anywhere in it is typing in it. -->
      <div class="box" @click="input?.focus()">
        <Search class="glass" :size="16" :stroke-width="2.5" aria-hidden="true" />
        <input
          ref="input"
          v-model="typed"
          type="text"
          class="text"
          :placeholder="fits ? placeholder : ''"
          :aria-label="placeholder"
          :aria-keyshortcuts="hotkey"
          role="combobox"
          autocomplete="off"
          :aria-expanded="open"
          :aria-controls="listId"
          :aria-activedescendant="open ? `${listId}-${active}` : undefined"
          @focus="focused = true"
          @blur="leave"
          @keydown="onKey"
        />
        <button v-if="clearable" type="button" class="clear" :aria-label="t('search.clear')" @click.stop="clear">
          ×
        </button>
        <kbd v-else-if="hotkey" class="hotkey" aria-hidden="true">{{ hotkey }}</kbd>
        <TermOptions
          v-if="floating"
          v-show="open"
          :id="listId"
          floating
          :groups
          :active
          :index-of="indexOf"
          :lead
          @pick="pick"
          @hover="active = $event"
        />
      </div>
      <button
        v-if="kinds.length"
        type="button"
        class="btn switch advanced-toggle"
        :class="{ on: advanced }"
        :aria-pressed="advanced"
        :aria-label="t('filter.advanced')"
        @click="toggleAdvanced"
      >
        <SlidersHorizontal class="advanced-icon" :size="16" :stroke-width="2.5" aria-hidden="true" /><span
          class="advanced-label"
          >{{ t('filter.advanced') }}</span
        >
      </button>
    </div>
    <TermOptions
      v-if="!floating"
      v-show="open"
      :id="listId"
      :groups
      :active
      :index-of="indexOf"
      :lead
      @pick="pick"
      @hover="active = $event"
    />
    <p v-if="!fits" class="hint muted" aria-hidden="true">{{ placeholder }}</p>
    <!-- The plain filters, as chips under the box. -->
    <div v-if="chips.length" class="chips">
      <span v-for="(term, i) in chips" :key="`${term.kind}:${term.id}:${i}`" class="chip">
        <TypeIcon v-if="term.kind === 'type'" :type="term.id" />
        <ItemIcon v-else-if="term.kind === 'item'" :id="term.id as ItemId" :scale="0.67" />
        <PokemonIcon v-else-if="term.kind === 'pokemon'" :id="term.id as PokemonId" :scale="0.75" />
        <DetailMenu
          v-if="details && term.kind === 'pokemon'"
          :term
          :candidates="() => details!(term.id as PokemonId)"
          :count="countWith(term)"
          :label="t('filter.details.edit', { name: refName(term as RefTerm) })"
          @change="change(term, $event)"
          >{{ termName(term)
          }}<span v-if="!term.with?.length" class="with-hint">{{ t('filter.details.add') }}</span></DetailMenu
        >
        <span v-else-if="term.kind !== 'type'">{{ termName(term) }}</span>
        <button
          type="button"
          class="remove"
          :aria-label="t('filter.remove', { name: termName(term) })"
          @click.stop="remove(term)"
        >
          ×
        </button>
      </span>
    </div>
    <FilterGroups v-if="advanced" v-model="filters" class="groups" :kinds :meta :count :details />
  </div>
</template>

<style scoped>
.filter-search {
  width: 100%;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* The box, as the site's search fields are: the glass and the text. */
.box {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  gap: 4px;
  max-width: 480px;
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
  text-overflow: ellipsis;
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
/* A Pokémon's chip not narrowed to a build yet: "with…" after its name, saying its name opens the menu that does. */
.with-hint {
  margin-left: 6px;
  font-size: 0.9em;
  color: var(--muted);
}
/* The plain filters, a row of chips under the box, wrapping. */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
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
.advanced-toggle {
  flex: none;
}
/* Its icon on phones, in place of its label. */
.advanced-icon {
  display: none;
}
@media (max-width: 560px) {
  .advanced-icon {
    display: block;
  }
  .advanced-label {
    display: none;
  }
}
/* What it searches by, under it where the box is too narrow to say it: an aside, smaller, apart from the page's own
   text. */
.hint {
  margin: 4px 0 0;
  font-size: 0.8125em;
}
.groups {
  margin: 10px 0 0;
}
</style>
