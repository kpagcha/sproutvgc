<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, useId, useTemplateRef, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import {
  ability,
  available as isAvailable,
  availableIds,
  pokemon,
  type MoveId,
  type PokemonId,
  type Ref,
} from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, gameStats, gameTotal, loadLearnsets, speciesOf, splitForme, type StatId } from '@/data/pokemon'
import { locale, t } from '@/i18n'
import { shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, marksKey, sliceMarks, split, type Marks } from '@/lib/search'
import { allFilters } from '@/lib/filterGroups'
import { FILTER_KINDS, parseFilters, passes } from '@/lib/pokemonFilters'
import { formatTermFilters, type TermFilters } from '@/lib/searchTerms'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useGradualRows } from '@/composables/useGradualRows'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import SortHeader from '@/components/SortHeader.vue'
import StatPickHeader, { type StatKey } from '@/components/StatPickHeader.vue'
import TypeIcon from '@/components/TypeIcon'
import SkeletonRows from '@/components/SkeletonRows.vue'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import PokemonIcon from '@/components/PokemonIcon'
import Marked from '@/components/Marked'
import FilterSearch from '@/components/FilterSearch.vue'
import { useSlashFocus } from '@/composables/useSlashFocus'

// Every Pokémon the regulation has, with its types, abilities and base stats, sortable by its name and stats. Formes
// that only look different (Vivillon's patterns) are left to their species' page. Its links are `AppLink`s and its
// icons functional components: RouterLinks and full components in each of hundreds of rows take a while to mount.
const listed = (id: PokemonId) => !POKEMON[id].cosmetic
const rows = computed(() =>
  availableIds('pokemon')
    .filter(listed)
    .map((id) => {
      const name = refName(pokemon(id))
      // A forme's species and forme are shown apart.
      const { species, forme } = splitForme(id, name)
      return {
        id,
        name,
        species,
        forme,
        parent: parentOf(id),
        data: POKEMON[id],
        abilities: POKEMON[id].abilities.map(ability),
      }
    }),
)
type Row = (typeof rows.value)[number]

// Sorted by name, formes go under their species, or, when the regulation doesn't have it, under the forme they change
// from in battle (Floette-Mega under Floette-Eternal).
function parentOf(id: PokemonId): PokemonId | undefined {
  const { base, battleOnly } = POKEMON[id]
  const has = (p?: PokemonId) => p && isAvailable(pokemon(p)) && listed(p)
  return has(base) ? base : has(battleOnly) ? battleOnly : undefined
}
const byId = computed(() => new Map(rows.value.map((r) => [r.id, r])))

// The intro counts species, not rows, and Mega Evolutions by their Mega Stone: Showdown splits Mega Meowstic in two,
// one per gender, though the game has one.
const counts = computed(() => ({
  n: new Set(rows.value.map((r) => speciesOf(r.id))).size,
  megas: new Set(rows.value.flatMap((r) => (r.data.mega ? [r.data.item] : []))).size,
}))

// An ability's short description on hover. Not on touch screens, where a tap follows the link.
const canHover = window.matchMedia('(hover: hover)').matches
const abilityTip = (a: Ref) => (canHover ? shortText(a) : undefined)

// The search (`?q=`) and the filters (`?f=`, `?fm=`), one box (`FilterSearch`), kept in the URL: the text finds
// Pokémon by name, and the types, abilities and moves to filter them by. While a term is highlighted in its options
// (`preview`), the list shows it added, faded a little: what picking it would do.
const route = useActiveQuery()
const router = useRouter()
const query = computed({
  get: () => (typeof route.value.q === 'string' ? route.value.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.value, q: q || undefined } }),
})
const filters = computed({
  get: () => parseFilters(route.value.f, route.value.fm),
  set: (f: TermFilters) => void router.replace({ query: { ...route.value, ...formatTermFilters(f) } }),
})
const preview = shallowRef<TermFilters | null>(null)

// Filtering by move needs the learnsets, which load once there's a move to filter by, or text that could find one.
const learnsets = ref<Record<PokemonId, MoveId[]> | null>(null)
watchEffect(async () => {
  if (!learnsets.value && (query.value || allFilters(filters.value).some((f) => f.kind === 'move')))
    learnsets.value = await loadLearnsets()
})
/** How many of the list these filters would leave: offered with each term. */
const count = (f: TermFilters) => rows.value.filter((r) => passes(r.id, f, learnsets.value)).length
/** How many the text finds by name, with the filters. */
const named = computed(() => {
  const q = fold(query.value.trim())
  return q ? rows.value.filter((r) => split(r.name, q) && passes(r.id, filters.value, learnsets.value)).length : 0
})

const search = useTemplateRef('search')
useSlashFocus(() => {
  if (!search.value) return false
  search.value.focus({ preventScroll: true })
})

const shown = computed(() => {
  // A term highlighted shows the list with it added, rather than the text's search by name.
  if (preview.value)
    return rows.value.flatMap((r) => (passes(r.id, preview.value!, learnsets.value) ? [{ ...r, parts: null }] : []))
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if (!passes(r.id, filters.value, learnsets.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

// Its stats as the game shows them (`gameStats`), worked out once a row.
const statsOf = computed(() => new Map(rows.value.map((r) => [r.id, gameStats(r.data)])))

type Key = 'name' | StatId | 'total'
// By name, a forme sorts as its parent, and the tie keeps it after it (IDs are in alphabetical order, a species' first).
const { key, desc, toggle, sorted } = useSort({
  rows: shown,
  value: (r, k: Key) =>
    k === 'name'
      ? r.parent
        ? byId.value.get(r.parent)!.name
        : r.name
      : k === 'total'
        ? gameTotal(r.data)
        : statsOf.value.get(r.id)![STATS.indexOf(k)]!,
  initial: 'name' as Key,
  startsDesc: (k) => k !== 'name',
  locale,
  remember: 'pokemon',
})

// Phones have room for one stat column: the one sorted by, or, sorted by name, the one last picked (the total at first),
// picked in its header.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhone))
const picked = ref<StatKey>(key.value === 'name' ? 'total' : key.value)
const column = computed(() => (key.value === 'name' ? picked.value : key.value))
function pick(k: StatKey) {
  picked.value = k
  if (key.value !== k) toggle(k)
}
const statIndex = computed(() => (column.value === 'total' ? -1 : STATS.indexOf(column.value)))

interface Line {
  row: Row
  /** Under its parent, named by its forme alone; `last` of its parent's. */
  child: boolean
  last: boolean
  /** With formes under it. */
  parent: boolean
  /** Shown only for a forme under it the search or filters found. */
  context: boolean
  title: Marks
  tag: Marks | null
}

// The search's match within part of a row's name: `text`, which starts at `at` in it.
const marks = (parts: Marks | null, text: string, at: number): Marks => (parts ? sliceMarks(parts, text, at) : [text])

// The rows as shown: by name, each species' formes under it, with the species dimmed when only a forme matches; by a
// stat, every row on its own, a forme's name its species' with the forme as a tag.
const lines = computed(() => {
  const grouped = key.value === 'name'
  const line = (row: Row, parts: Marks | null, context = false): Line => {
    const child = grouped && !!row.parent
    const formeAt = row.name.length - (row.forme?.length ?? 0) - 1
    return {
      row,
      child,
      last: false,
      parent: false,
      context,
      title: child && row.forme ? marks(parts, row.forme, formeAt) : marks(parts, row.species, 0),
      tag: !child && row.forme ? marks(parts, row.forme, formeAt) : null,
    }
  }
  const out: Line[] = []
  const seen = new Set<PokemonId>()
  for (const r of sorted.value) {
    if (grouped && r.parent && !seen.has(r.parent)) {
      seen.add(r.parent)
      out.push(line(byId.value.get(r.parent)!, null, true))
    }
    seen.add(r.id)
    out.push(line(r, r.parts))
  }
  out.forEach((l, i) => {
    const next = !!out[i + 1]?.child
    l.last = l.child && !next
    l.parent = !l.child && next
  })
  return out
})

// The name column fits the widest of the names shown, within bounds (`--name-min`, `--name-max`). The rows take their
// columns from the header (`useRowColumns`), and those off screen aren't laid out, so the header holds a hidden copy of
// the few names that look widest, measured roughly here, and the browser sizes the column to them exactly.
const canvas = document.createElement('canvas').getContext('2d')
const widest = computed(() => {
  if (!canvas) return []
  const family = getComputedStyle(document.body).fontFamily
  const width = (text: string, size: number) => {
    canvas.font = `bold ${size}px ${family}`
    return canvas.measureText(text).width
  }
  const estimate = (l: Line) =>
    width(l.title.join(''), 16) + (l.child ? 32 : 0) + (l.tag ? width(l.tag.join(''), 13.6) + 16 : 0)
  return lines.value
    .map((l) => ({ l, w: estimate(l) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map(({ l }) => l)
})

// The rows render once the page is in, with a skeleton until then: all of them take over 100ms.
const { entered, restoring } = usePageEntered()
const drawn = useGradualRows(lines)
useRowColumns(useTemplateRef('head'))
const SKELETON = ['grow', '', 'wide-only', ...STATS.map(() => 'wide-only r'), 'r']

// The spot in the list for its search's options, as its first rows (`FilterSearch`'s `rowsAt`).
const termRows = useId()
</script>

<template>
  <!-- The heading and the filters, and the table, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <div class="panel">
      <!-- Its usage rankings, as they link here. -->
      <div class="title-row">
        <h1>{{ t('title.pokemon') }}</h1>
        <AppLink :to="{ name: 'rankings' }" class="other-page">{{ t('lists.toMeta') }} ›</AppLink>
      </div>
      <p class="muted">{{ t('pokedex.intro', { reg: REGULATION, ...counts }) }}</p>
      <FilterSearch
        :rows-at="termRows"
        ref="search"
        v-model:text="query"
        v-model:filters="filters"
        v-model:preview="preview"
        class="list-search"
        hotkey="/"
        :subject="t('filter.subject.pokemon')"
        :name-count="named"
        :kinds="FILTER_KINDS"
        :count
      />
    </div>
    <div class="panel" :class="{ previewing: preview }">
      <div :id="termRows" class="term-rows bleed"></div>
      <div v-if="sorted.length" class="dex-table" :class="{ restoring }" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader
            class="name-head"
            :label="t('pokedex.name')"
            :active="key === 'name'"
            :desc="desc"
            @sort="toggle('name')"
          />
          <div class="sizer" aria-hidden="true">
            <div v-for="l in widest" :key="l.row.id" :class="{ child: l.child }">
              <span class="mon">
                <PokemonIcon :id="l.row.id" />
                <span class="label">
                  <span class="name">{{ l.title.join('') }}</span>
                  <span v-if="l.tag" class="forme">{{ l.tag.join('') }}</span>
                </span>
              </span>
            </div>
          </div>
          <div role="columnheader">{{ t('pokedex.types') }}</div>
          <div role="columnheader" class="wide-only">{{ t('pokedex.abilities') }}</div>
          <SortHeader
            v-for="s in STATS"
            :key="s"
            class="wide-only"
            :label="t(`stat.${s}`)"
            right
            :active="key === s"
            :desc="desc"
            @sort="toggle(s)"
          />
          <SortHeader
            v-if="!phone"
            :label="t('stat.bst')"
            :tip="t('stat.bstFull')"
            right
            :active="key === 'total'"
            :desc="desc"
            @sort="toggle('total')"
          />
          <StatPickHeader v-else :column :active="key === column" :desc @sort="toggle(column)" @pick="pick" />
        </div>
        <SkeletonRows v-if="!entered" :cells="SKELETON" height="2.3em" />
        <template v-else>
          <!-- Each row drawn again only when what it shows changes, not with every change to the page (the search's text, its
               options, the count it shows): hundreds of rows take a while. -->
          <div
            v-for="{ row: r, child, last, parent, context, title, tag } in drawn"
            :key="r.id"
            v-memo="[r.id, child, last, parent, context, marksKey(title), marksKey(tag), phone, statIndex, locale]"
            class="row"
            :class="{ child, last, parent, context }"
            role="row"
          >
            <div role="cell" class="grow name-cell">
              <AppLink :to="{ name: 'pokemon', params: { id: r.id } }" class="mon">
                <PokemonIcon :id="r.id" />
                <span class="label">
                  <span class="name"><Marked :p="title" /></span>
                  <span v-if="tag" class="forme"><Marked :p="tag" /></span>
                </span>
              </AppLink>
            </div>
            <div role="cell">
              <span class="types">
                <AppLink v-for="ty in r.data.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
                  <TypeIcon :type="ty" />
                </AppLink>
              </span>
            </div>
            <div role="cell" class="wide-only grow">
              <ul class="abilities">
                <li v-for="a in r.abilities" :key="a.id">
                  <DexRef :to="a" :tip="abilityTip(a)" :tip-group="`abilities:${r.id}`" />
                </li>
              </ul>
            </div>
            <div v-for="(v, i) in statsOf.get(r.id)" :key="i" role="cell" class="wide-only r num stat">
              {{ v }}
            </div>
            <div v-if="!phone || statIndex < 0" role="cell" class="r num total">{{ gameTotal(r.data) }}</div>
            <div v-else role="cell" class="r num stat">
              {{ statsOf.get(r.id)![statIndex] }}
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('pokedex.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Name, types (room for two badges), abilities, the six stats and their total; on phones name, types and one stat. The
   name column fits the widest name shown (`.sizer`), within bounds, and the abilities take the rest; on phones, the
   stat. */
.dex-table {
  --types: calc(64px * var(--icon-scale, 1) + 14px);
  --num: minmax(2.6em, auto);
  --row-height: 2.3em;
  --name-min: 11em;
  --name-max: 15em;
  --cols: fit-content(var(--name-max)) var(--types) minmax(0, 1fr) repeat(7, var(--num));
}
@media (max-width: 720px) {
  .dex-table {
    /* Smaller type badges than elsewhere on phones. */
    --icon-scale: 1.25;
    --name-min: 7em;
    --name-max: 12em;
    --cols: fit-content(var(--name-max)) var(--types) var(--num);
  }
}
/* The hidden copy of the widest names, in the name header's cell: it sizes the column, at least `--name-min` wide,
   but takes no height. Its text wraps, so on a narrow screen the column can shrink as the rows' names wrap. */
.name-head,
.sizer {
  grid-area: 1 / 1;
}
.dex-table .head > .sizer {
  min-width: var(--name-min);
  height: 0;
  padding-block: 0;
  overflow: hidden;
  visibility: hidden;
  white-space: normal;
}
.list-search {
  margin-bottom: 12px;
}
/* The list with a term highlighted in the search's options: a preview, faded a little. */
.previewing .dex-table {
  opacity: 0.75;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  /* The icon is taller than the row: let it into the cell's padding, but no further, or the last row's overflows the
     table. */
  margin: -3px 0;
}
/* A forme under its species: indented, on a line down from the species' icon, the rows of a species run together.
   The name cells take the row's full height, so the line runs unbroken from row to row; it starts under the species'
   icon (30px tall) and ends at the last forme's. */
.name-cell {
  display: flex;
  align-items: center;
  align-self: stretch;
  position: relative;
}
.mon {
  min-width: 0;
}
.row.child {
  border-top: none;
}
.child .mon {
  padding-left: 32px;
}
.parent .name-cell::before,
.child .name-cell::before,
.child .name-cell::after {
  content: '';
  position: absolute;
  left: 26px;
  border: 0 solid var(--border-strong);
}
.parent .name-cell::before {
  top: calc(50% + 15px);
  bottom: 0;
  border-left-width: 1px;
}
.child .name-cell::before {
  top: 0;
  bottom: 0;
  border-left-width: 1px;
}
.child.last .name-cell::before {
  bottom: 50%;
}
.child .name-cell::after {
  top: 50%;
  width: 10px;
  border-top-width: 1px;
}
.child .name {
  font-weight: normal;
}
/* A forme's tag, sorted by a stat, wraps under its species' name when the two don't fit. */
.label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
}
.forme {
  padding: 0 5px;
  font-size: 0.85em;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.context {
  opacity: 0.55;
}
.types {
  display: flex;
  gap: 2px;
}
.total {
  font-weight: bold;
}

/* Short of the page's full width, the stats sit closer together, so the abilities keep room for theirs on one line. */
@media (max-width: 1000px) {
  .dex-table {
    --num: minmax(2.2em, auto);
  }
  .row > .r {
    padding-left: 3px;
    padding-right: 3px;
  }
}

.abilities {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.abilities li {
  padding: 0 5px;
  font-size: 0.9em;
  white-space: nowrap;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.abilities a {
  color: inherit;
}
</style>
