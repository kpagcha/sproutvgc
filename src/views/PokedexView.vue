<script setup lang="ts">
import { computed, h, onMounted, ref, useTemplateRef, watchEffect, type FunctionalComponent } from 'vue'
import { useRouter } from 'vue-router'
import {
  ability,
  available as isAvailable,
  availableIds,
  pokemon,
  sameRef,
  type MoveId,
  type PokemonId,
  type Ref,
} from '@/data/dex'
import { REGULATION } from '@/data/format'
import { TYPES, type TypeId } from '@/data/types'
import { POKEMON, STATS, loadLearnsets, speciesOf, splitForme, statColor, total, type StatId } from '@/data/pokemon'
import { locale, t, typeName } from '@/i18n'
import { loadDescriptions, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { percentiles } from '@/lib/statPercentiles'
import {
  NO_FILTERS,
  allTerms,
  formatFilters,
  isPlain,
  parseFilters,
  passes,
  type Filters,
  type PokemonFilter,
} from '@/lib/pokemonFilters'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSearch } from '@/composables/useSearch'
import { useSort } from '@/composables/useSort'
import { LIST_STAT_MARKS, samples, setPercentiles, useListStatMarks } from '@/composables/useStatReference'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'
import SearchBox from '@/components/SearchBox.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import PokemonIcon from '@/components/PokemonIcon'
import SearchResults from '@/components/SearchResults.vue'
import FilterGroups from '@/components/FilterGroups.vue'
import { confirmDialog } from '@/composables/useConfirm'

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

// The search (`?q=`) and the filters (`?f=`, `?fm=`) are kept in the URL, so the home page's search can link here with them.
const route = useActiveQuery()
const router = useRouter()
const query = computed({
  get: () => (typeof route.value.q === 'string' ? route.value.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.value, q: q || undefined } }),
})
const filters = computed({
  get: () => parseFilters(route.value.f, route.value.fm),
  set: (f: Filters) => void router.replace({ query: { ...route.value, ...formatFilters(f) } }),
})

// Plainly, the filters are a list, a Pokémon passing any of them, beside a pick of one type it has to have. In the
// advanced mode (`FilterGroups`), they're groups, joined by AND or OR, any of them negated: the mode is on when the
// reader turns it on (remembered), or when the URL's filters need it.
const ADVANCED_KEY = 'sproutvgc.pokedex.advancedFilters'
function readAdvanced() {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1'
  } catch {
    return false
  }
}
const advancedPicked = ref(readAdvanced())
const advanced = computed(() => advancedPicked.value || !isPlain(filters.value))
function pickAdvanced(on: boolean) {
  advancedPicked.value = on
  try {
    localStorage.setItem(ADVANCED_KEY, on ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}
const type = ref<TypeId | ''>('')
async function toggleAdvanced() {
  if (!advanced.value) {
    // The type picked becomes a group of its own, which the others have to pass as well.
    if (type.value) {
      const groups = [
        ...filters.value.groups,
        { join: 'any' as const, terms: [{ kind: 'type' as const, id: type.value }] },
      ]
      filters.value = { join: 'all', groups }
      type.value = ''
    }
    pickAdvanced(true)
    return
  }
  // Filters the plain list can't show are cleared on the way back, once confirmed.
  if (!isPlain(filters.value)) {
    if (!(await confirmDialog({ message: t('filter.plainConfirm'), confirm: t('filter.clear'), danger: true }))) return
    filters.value = NO_FILTERS
  }
  pickAdvanced(false)
}
const plainFilters = computed(() => filters.value.groups[0]?.terms ?? [])
function removeFilter(filter: PokemonFilter) {
  const terms = plainFilters.value.filter((x) => !sameRef(x, filter))
  filters.value = terms.length ? { join: 'all', groups: [{ join: 'any', terms }] } : NO_FILTERS
}

// Backspace in an empty search box takes off the last filter, as if it were part of the search.
function removeLastFilter() {
  const groups = filters.value.groups
  const last = groups.at(-1)
  if (query.value || !last) return
  const terms = last.terms.slice(0, -1)
  filters.value = {
    ...filters.value,
    groups: terms.length ? [...groups.slice(0, -1), { ...last, terms }] : groups.slice(0, -1),
  }
}

// Filtering by move needs the learnsets, which only load then.
const learnsets = ref<Record<PokemonId, MoveId[]> | null>(null)
watchEffect(async () => {
  if (!learnsets.value && allTerms(filters.value).some((f) => f.kind === 'move'))
    learnsets.value = await loadLearnsets()
})

// What else the search finds, grouped as on the home page: abilities, moves and types, each with a link to filter by
// it. Their descriptions load in the background.
const { results } = useSearch(() => query.value, ['ability', 'move'])
const others = computed(() => (results.value?.types.length || results.value?.sections.length ? results.value : null))
onMounted(() => void loadDescriptions(['ability', 'move']))

const shown = computed(() => {
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if (!advanced.value && type.value && !r.data.types.includes(type.value)) return []
    if (!passes(r.id, filters.value, learnsets.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

// Each stat is marked by where it stands among the Pokémon it's compared with (`useListStatMarks`), as a bar from the
// middle of its cell, the median, towards the right above it and the left below, colored by `statColor`.
const reference = useListStatMarks()
const percentile = computed(() =>
  reference.value === 'plain'
    ? null
    : reference.value === 'shown'
      ? percentiles(samples(shown.value.map((r) => r.id)))
      : setPercentiles(reference.value),
)
const markLabel = (m: (typeof LIST_STAT_MARKS)[number]) =>
  m === 'plain' ? t('stats.plain') : m === 'shown' ? t('pokedex.compare.shown') : t(`stats.vs.${m}`)
interface Mark {
  class: 'hi' | 'lo'
  style: string
}
const statMarks = computed(() => {
  const p = percentile.value
  if (!p) return null
  return new Map(
    rows.value.map((r): [PokemonId, (Mark | null)[]] => [
      r.id,
      r.data.stats.map((v, i) => {
        let x = p.rank(i, v)
        if (x === null) return null
        x = Math.round(x * 1000) / 1000
        const color = `--color: ${statColor(v)}`
        return x >= 0.5
          ? { class: 'hi', style: `--from: 0.5; --to: ${x}; ${color}` }
          : { class: 'lo', style: `--from: ${x}; --to: 0.5; ${color}` }
      }),
    ]),
  )
})

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
        ? total(r.data)
        : r.data.stats[STATS.indexOf(k)]!,
  initial: 'name' as Key,
  startsDesc: (k) => k !== 'name',
  locale,
  remember: 'pokemon',
})

type Marks = [string, string, string]
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
function marks(parts: Marks | null, text: string, at: number): Marks {
  if (!parts) return [text, '', '']
  const from = Math.min(text.length, Math.max(0, parts[0].length - at))
  const to = Math.min(text.length, Math.max(from, parts[0].length + parts[1].length - at))
  return [text.slice(0, from), text.slice(from, to), text.slice(to)]
}

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

// A name with the search's match marked.
const Marked: FunctionalComponent<{ p: Marks }> = ({ p }) => [p[0], p[1] ? h('mark', p[1]) : null, p[2]]
Marked.props = ['p']

// The rows render once the page is in, with a skeleton until then: all of them take over 100ms.
const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
const SKELETON = ['grow', '', 'wide-only', ...STATS.map(() => 'wide-only r'), 'r']
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.pokemon') }}</h1>
    <p class="muted">{{ t('pokedex.intro', { reg: REGULATION, ...counts }) }}</p>
    <div class="filters">
      <SearchBox
        v-model="query"
        :placeholder="t('pokedex.search')"
        :aria-label="t('pokedex.search')"
        @keydown.backspace="removeLastFilter"
      />
      <select v-if="!advanced" v-model="type" class="search type-filter" :aria-label="t('pokedex.type')">
        <option value="">{{ t('pokedex.anyType') }}</option>
        <option v-for="ty in TYPES" :key="ty" :value="ty">{{ typeName(ty) }}</option>
      </select>
      <button
        type="button"
        class="btn advanced-toggle"
        :class="{ on: advanced }"
        :aria-pressed="advanced"
        @click="toggleAdvanced"
      >
        {{ t('filter.advanced') }}
      </button>
      <SegmentedControl
        v-model="reference"
        class="view-opts"
        :label="t('pokedex.compare')"
        :tip="t('pokedex.compareTip')"
        :options="LIST_STAT_MARKS.map((m) => ({ value: m, label: markLabel(m) }))"
      />
    </div>
    <FilterGroups v-if="advanced" v-model="filters" />
    <ul v-else-if="plainFilters.length" class="active-filters">
      <li v-for="f in plainFilters" :key="`${f.kind}:${f.id}`" class="active-filter">
        <span class="muted">{{ t(`filter.kind.${f.kind}`) }}:</span>
        <TypeIcon v-if="f.kind === 'type'" :type="f.id" />
        <DexRef :to="f" />
        <button
          type="button"
          class="remove"
          :aria-label="t('filter.remove', { name: refName(f) })"
          @click="removeFilter(f)"
        >
          ×
        </button>
      </li>
    </ul>
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
          :label="t('stat.bst')"
          :tip="t('stat.bstFull')"
          right
          :active="key === 'total'"
          :desc="desc"
          @sort="toggle('total')"
        />
      </div>
      <SkeletonRows v-if="!entered" :cells="SKELETON" height="2.3em" />
      <template v-else>
        <div
          v-for="{ row: r, child, last, parent, context, title, tag } in lines"
          :key="r.id"
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
          <div
            v-for="(v, i) in r.data.stats"
            :key="i"
            role="cell"
            class="wide-only r num stat"
            :class="statMarks?.get(r.id)?.[i]?.class"
            :style="statMarks?.get(r.id)?.[i]?.style"
          >
            {{ v }}
          </div>
          <div role="cell" class="r num total">{{ total(r.data) }}</div>
        </div>
      </template>
    </div>
    <p v-else class="muted">{{ t('pokedex.none') }}</p>
  </div>
  <SearchResults v-if="others" :query :results="others" :filters />
</template>

<style scoped>
/* Name, types (room for two badges), abilities, the six stats and their total; on phones name, types and total. The
   name column fits the widest name shown (`.sizer`), within bounds, and the abilities take the rest; on phones, the
   total. */
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.type-filter {
  width: auto;
}
.advanced-toggle {
  align-self: flex-start;
  min-height: 0;
  margin-bottom: 12px;
  padding: 6px 10px;
  line-height: inherit;
}
.advanced-toggle.on {
  background: var(--sel);
}
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}
.active-filters li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.active-filter {
  padding: 2px 2px 2px 8px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
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
/* What the stats are marked against: how the table shows them, not which rows it shows, so it sits apart from the
   filters, at the far end of their row (or of its own, when it wraps), as one segmented control. As tall as the
   search box, less its margin. Left out on phones along with the stats. */
.view-opts {
  margin: 0 0 12px auto;
}
@media (max-width: 720px) {
  .view-opts {
    display: none;
  }
}
/* A stat's mark: a bar along the bottom of its cell, between the median (the middle) and where the stat stands (the
   left edge the lowest, the right edge the highest), on a faint track the cell's width. */
.stat {
  --inset: 6px;
  position: relative;
}
.stat.hi::before,
.stat.lo::before,
.stat.hi::after,
.stat.lo::after {
  content: '';
  position: absolute;
  left: calc(var(--inset) + (100% - 2 * var(--inset)) * var(--from));
  width: calc((100% - 2 * var(--inset)) * (var(--to) - var(--from)));
  bottom: 3px;
}
.stat.hi::before,
.stat.lo::before {
  --from: 0;
  --to: 1;
  height: 1px;
  bottom: 4px;
  background: var(--border);
}
.stat.hi::after,
.stat.lo::after {
  height: 3px;
  background: var(--color);
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
  .stat {
    --inset: 3px;
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
