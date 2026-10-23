<script setup lang="ts">
import Marked from '@/components/Marked'
import { computed, onUnmounted, ref, shallowRef, useTemplateRef, watch, watchEffect } from 'vue'
import { move, type MoveId, type PokemonId } from '@/data/dex'
import { CATEGORIES, hasPriority, MOVES, reachOf, type Move } from '@/data/moves'
import { loadLearnsets, movesOf } from '@/data/pokemon'
import { TYPES } from '@/data/types'
import type { MessageKey } from '@/i18n'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, marksKey, split } from '@/lib/search'
import { allFilters, noFilters as none, passesGroups } from '@/lib/filterGroups'
import type { Term, TermFilters, TermKind } from '@/lib/searchTerms'
import { percent } from '@/data/meta'
import { useGradualRows } from '@/composables/useGradualRows'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import CategoryIcon from '@/components/CategoryIcon'
import DexText from '@/components/DexText'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'
import FilterSearch from '@/components/FilterSearch.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'

// A table of moves with their type, category, power, accuracy and PP, sortable by any of them, searched by name and
// filtered by the terms of `kinds` (type, category and tag unless given; reach, priority, and the Pokémon that learn them, its
// learnsets loaded on demand), one box for both (`FilterSearch`); with `descriptions`, each move's short description
// too. The filters are a model, for a page that keeps them in its URL; unbound, the table keeps them itself. With
// `panels`, the
// filters (after what's given in the slot: the page's heading) and the table go in panels of their own (for `.panels`);
// without, both go in the caller's. A Pokémon's usage page gives each move's share of its sets (`shares`: a column of
// its own, the table sorted by it at first, each move leading to its meta page rather than its dex entry), and leaves
// out PP (`noPp`) and the search and filters (`noFilters`) but for its whole movepool, the descriptions under the names,
// each a line of its own the whole width of its row (`stacked`).
const props = defineProps<{
  ids: readonly MoveId[]
  descriptions?: boolean
  /** What it's filtered by; none, with `noFilters`. */
  kinds?: readonly TermKind[]
  shares?: Partial<Record<MoveId, number>>
  /** What a move without a share shows ("<1%", under what the data keeps), rather than "—". */
  under?: string
  noPp?: boolean
  noFilters?: boolean
  /** The descriptions under the names, as on phones, where the table is narrow. */
  stacked?: boolean
  query?: string
  /** Keep the sort under this name when the table is mounted again (`useSort`'s `remember`). */
  remember?: string
  panels?: boolean
}>()

// Its links are `AppLink`s and its icons and descriptions functional components: RouterLinks and full components in
// each of hundreds of rows take a while to mount.
const rows = computed(() => props.ids.map((id) => ({ id, name: refName(move(id)), data: MOVES[id] })))

// The search starts from `query`, and takes it again whenever it changes (a search from the home page coming back to
// the page kept alive).
const query = ref(props.query ?? '')
watch(
  () => props.query,
  (q) => (query.value = q ?? ''),
)
const kinds = computed((): readonly TermKind[] =>
  props.noFilters ? [] : (props.kinds ?? ['type', 'category', 'flag']),
)
const filters = defineModel<TermFilters>('filters', { default: () => none() })
const preview = shallowRef<TermFilters | null>(null)
// Filtering by the Pokémon that learn them needs the learnsets, which load once it can.
const learnsets = shallowRef<Record<PokemonId, MoveId[]> | null>(null)
watchEffect(async () => {
  if (!learnsets.value && kinds.value.includes('pokemon') && (query.value || allFilters(filters.value).length))
    learnsets.value = await loadLearnsets()
})
function matches(r: (typeof rows.value)[number], f: Term): boolean | null {
  if (f.kind === 'type') return r.data.type === f.id
  if (f.kind === 'category') return r.data.category === f.id
  if (f.kind === 'flag') return r.data.flags.includes(f.id)
  if (f.kind === 'reach') return reachOf(r.data) === f.id
  if (f.kind === 'priority') return hasPriority(r.data, f.id)
  if (f.kind === 'pokemon') return learnsets.value ? movesOf(learnsets.value, f.id).includes(r.id) : null
  return false
}
const passes = (r: (typeof rows.value)[number], f: TermFilters) => passesGroups(f, (x) => matches(r, x))
/** How many of the moves these filters would leave: offered with each term. */
const count = (f: TermFilters) => rows.value.filter((r) => passes(r, f)).length
/** How many the text finds by name, with the filters. */
const named = computed(() => {
  const q = fold(query.value.trim())
  return q ? rows.value.filter((r) => split(r.name, q) && passes(r, filters.value)).length : 0
})
const shown = computed(() => {
  // A term highlighted shows the table with it added, rather than the text's search by name.
  if (preview.value) return rows.value.flatMap((r) => (passes(r, preview.value!) ? [{ ...r, parts: null }] : []))
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if (!passes(r, filters.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

type Key = 'name' | 'type' | 'category' | 'power' | 'accuracy' | 'pp' | 'share'
const value = (r: { id: MoveId; name: string; data: Move }, k: Key): number | string => {
  if (k === 'name') return r.name
  if (k === 'share') return props.shares?.[r.id] ?? -1
  if (k === 'type') return TYPES.indexOf(r.data.type)
  if (k === 'category') return CATEGORIES.indexOf(r.data.category)
  if (k === 'accuracy') return r.data.accuracy === true ? 101 : r.data.accuracy
  return r.data[k]
}
const { key, desc, toggle, sorted } = useSort({
  rows: shown,
  value,
  initial: (props.shares ? 'share' : 'name') as Key,
  startsDesc: (k) => k === 'power' || k === 'accuracy' || k === 'pp' || k === 'share',
  locale,
  remember: props.remember,
})

// Phones leave out accuracy and PP, and show the descriptions under the moves' names rather than in a column of
// their own.
const COLUMNS = computed(() => {
  const list: { k: Key; label: MessageKey; right?: boolean; wideOnly?: boolean }[] = [
    { k: 'type', label: 'move.type' },
    { k: 'category', label: 'move.categoryShort' },
    { k: 'power', label: 'move.power', right: true },
    { k: 'accuracy', label: 'move.accuracy', right: true, wideOnly: true },
  ]
  if (!props.noPp) list.push({ k: 'pp', label: 'move.pp', right: true, wideOnly: true })
  if (props.shares) list.push({ k: 'share', label: 'usageMon.share', right: true })
  return list
})
// The table's columns, as wide as they need: the name, the badges, a number each, and the description's room.
const cols = computed(() => {
  const nums = COLUMNS.value.length - 2
  const wide = `${props.descriptions && !props.stacked ? 'minmax(9em, 1fr)' : 'minmax(0, 1fr)'} auto auto repeat(${nums}, var(--num))`
  return {
    '--cols-wide': props.descriptions && !props.stacked ? `${wide} minmax(0, 2fr)` : wide,
    '--cols-phone': `minmax(0, 1fr) auto auto repeat(${nums - COLUMNS.value.filter((c) => c.wideOnly).length}, var(--num))`,
    // Very narrow (`stacked`), without the category's.
    '--cols-narrow': `minmax(0, 1fr) auto repeat(${nums - COLUMNS.value.filter((c) => c.wideOnly).length}, var(--num))`,
  }
})
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhone))
/** A move's short description; on a usage page (`shares`), none for a move with no effect beyond its damage, which says
 * nothing there. */
function shortOf(id: MoveId) {
  const text = description('move', id)?.short ?? ''
  return props.shares && text === t('move.noEffect') ? '' : text
}
/** The descriptions go under the names rather than in a column of their own. */
const below = computed(() => phone.value || props.stacked)

// The rows render once the page is in, with a skeleton until then: all of them can take over 100ms.
const { entered, restoring } = usePageEntered()
const drawn = useGradualRows(sorted)
useRowColumns(useTemplateRef('head'))
const skeleton = computed(() => [
  'grow',
  ...COLUMNS.value.map((c) => (c.right ? 'r' : '') + (c.wideOnly ? ' wide-only' : '')),
  ...(props.descriptions && !below.value ? ['grow'] : []),
])
</script>

<template>
  <div v-if="!noFilters" :class="{ panel: panels }">
    <slot />
    <FilterSearch
      v-model:text="query"
      v-model:filters="filters"
      v-model:preview="preview"
      class="filters"
      :subject="t('filter.subject.moves')"
      :name-count="named"
      :kinds
      :count
    />
  </div>
  <div :class="{ panel: panels, 'table-box': stacked }">
    <div
      v-if="sorted.length"
      class="dex-table"
      :class="{ restoring, tight: stacked, previewing: preview }"
      :style="cols"
      role="table"
    >
      <div ref="head" class="row head" role="row">
        <SortHeader :label="t('move.name')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
        <SortHeader
          v-for="c in COLUMNS"
          :key="c.k"
          :class="{
            'wide-only': c.wideOnly,
            badge: c.k === 'type' || c.k === 'category',
            category: c.k === 'category',
          }"
          :label="t(stacked && phone && c.k === 'power' ? 'move.powerShort' : c.label)"
          :right="c.right"
          :active="key === c.k"
          :desc="desc"
          @sort="toggle(c.k)"
        />
        <div v-if="descriptions && !below" role="columnheader"></div>
      </div>
      <SkeletonRows v-if="!entered" :cells="skeleton" height="2.05em" />
      <template v-else>
        <!-- Each row drawn again only when what it shows changes, not with every change to the page (the search's text, its
             options, the count it shows): hundreds of rows take a while. -->
        <div
          v-for="r in drawn"
          :key="r.id"
          v-memo="[r.id, r.name, marksKey(r.parts), shares, under, below, stacked, descriptions, noPp, locale]"
          class="row"
          role="row"
        >
          <div role="cell" class="grow">
            <AppLink :to="{ name: shares ? 'metaMove' : 'move', params: { id: r.id } }" class="name">
              <Marked v-if="r.parts" :p="r.parts" />
              <template v-else>{{ r.name }}</template>
            </AppLink>
            <div v-if="descriptions && below && !stacked" class="muted below">
              <DexText :text="shortOf(r.id)" />
            </div>
          </div>
          <div role="cell">
            <AppLink :to="{ name: 'types', params: { type: r.data.type } }"><TypeIcon :type="r.data.type" /></AppLink>
          </div>
          <div role="cell" class="category">
            <AppLink :to="{ name: 'moves', query: { f: `category:${r.data.category}` } }"
              ><CategoryIcon :category="r.data.category"
            /></AppLink>
          </div>
          <div role="cell" class="r num">{{ r.data.power || '—' }}</div>
          <div role="cell" class="wide-only r num">{{ r.data.accuracy === true ? '—' : r.data.accuracy }}</div>
          <div v-if="!noPp" role="cell" class="wide-only r num">{{ r.data.pp }}</div>
          <div v-if="shares" role="cell" class="r num meter" :style="{ '--share': shares[r.id] ?? 0 }">
            {{ shares[r.id] === undefined ? (under ?? '—') : percent(shares[r.id]!) }}
          </div>
          <div v-if="descriptions && stacked && shortOf(r.id)" role="cell" class="muted span-desc">
            <DexText :text="shortOf(r.id)" />
          </div>
          <div v-if="descriptions && !below" role="cell" class="grow muted">
            <DexText :text="shortOf(r.id)" />
          </div>
        </div>
      </template>
    </div>
    <p v-else class="muted">{{ t('moves.none') }}</p>
  </div>
</template>

<style scoped>
/* Name, type, category, power, accuracy, PP (unless left out), the share (when given) and, with descriptions, the
   description (`cols`); phones leave out accuracy and PP, show the descriptions under the names, and take the type and
   category badges down from the phone size. */
.dex-table {
  --num: minmax(2.6em, auto);
  --row-height: 2.05em;
  --cols: var(--cols-wide);
}
@media (max-width: 720px) {
  .dex-table {
    --icon-scale: 1.25;
    --cols: var(--cols-phone);
  }
}
/* Narrow (`stacked`), the badges' and numbers' columns as tight as they go, leaving the room to the name and its
   description. */
.dex-table.tight {
  --icon-scale: 1;
  --num: minmax(2em, auto);
}
/* On phones, the header's labels smaller: they size the badges' and numbers' columns, which then leave the name more
   room. */
@media (max-width: 720px) {
  .dex-table.tight .head {
    font-size: 0.8em;
  }
  /* The share's column as wide as its numbers ("98.7%"), wider than its header, which sizes it, at this size. */
  .dex-table.tight .head > :last-child {
    min-width: calc(12px + 3.3rem + 6px);
  }
  /* The badges' columns as narrow as the badges (and their padding): their labels left unshown, the badges saying what
     they are. */
  .dex-table.tight .head > .badge {
    min-width: calc(26px + 6px);
    font-size: 0;
  }
}
/* Each description a line of its own under its row, the whole width, rather than under the name alone. */
.dex-table .row > .span-desc {
  grid-column: 1 / -1;
  padding-top: 0;
  font-size: 0.9em;
  white-space: normal;
}
.dex-table.tight .row > :not(:first-child) {
  padding-inline: 3px;
}
/* The numbers keep room at their left for the sort arrow, which hangs there; the share, more, apart from the power
   before it. */
.dex-table.tight .row > .r {
  padding-left: 10px;
}
.dex-table.tight .row > .meter,
.dex-table.tight .head > :last-child {
  padding-left: 12px;
}
/* Its bar under its number alone, from where the number's room starts. */
.dex-table.tight .meter::before,
.dex-table.tight .meter::after {
  left: 12px;
}
.dex-table.tight .meter::after {
  width: calc((100% - 18px) * var(--share, 0));
}
/* The outer edge keeps the cells' own 6px: on phones the table runs to the panel's border (`--panel-bleed`), and that
   is its margin there. So does each description, in line with its name. */
.dex-table.tight .row > .meter,
.dex-table.tight .head > :last-child {
  padding-right: 6px;
}
.dex-table.tight .row > .span-desc {
  padding-inline: 6px;
}
/* Very narrow (`stacked`, its box under 320px), no category: the name has its room. The type's badge and the power
   still say most of it. */
.table-box {
  container-type: inline-size;
}
@container (max-width: 320px) {
  .dex-table.tight {
    --cols: var(--cols-narrow);
  }
  .dex-table.tight .category {
    display: none;
  }
}
/* A name longer than its room breaks across lines rather than running into the badges after it. */
.dex-table.tight .name {
  overflow-wrap: anywhere;
}
/* A move's share of a Pokémon's sets: its number, its bar under it, out of all of them. */
.meter {
  position: relative;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 6px;
  bottom: 3px;
}
.meter::before {
  right: 6px;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc((100% - 12px) * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
.filters {
  margin-bottom: 12px;
}
/* The table with a term highlighted in the search's options: a preview, faded a little. */
.dex-table.previewing {
  opacity: 0.75;
}
.below {
  font-size: 0.9em;
}
</style>
