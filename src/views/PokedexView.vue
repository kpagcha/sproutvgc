<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ability, availableIds, pokemon, sameRef, type MoveId, type PokemonId, type Ref } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, loadLearnsets, total, type StatId } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { locale, t, typeName } from '@/i18n'
import { loadDescriptions, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { follow, hrefOf, refHref } from '@/lib/links'
import { fold, split } from '@/lib/search'
import { cellStyle } from '@/lib/sprites'
import { formatFilters, parseFilters, passes, type PokemonFilter } from '@/lib/pokemonFilters'
import { usePageEntered } from '@/composables/usePageEntered'
import { useSearch } from '@/composables/useSearch'
import { useSort } from '@/composables/useSort'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon.vue'
import SearchBox from '@/components/SearchBox.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import DexRef from '@/components/DexRef.vue'
import SearchResults from '@/components/SearchResults.vue'

// Every Pokémon the regulation has, with its types, abilities and base stats, sortable by its name and stats. Formes
// that only look different (Vivillon's patterns) are left to their species' page. The rows are plain markup, with
// their links' hrefs and the icon's style worked out here, and the router follows the links (`follow` on the table):
// components (RouterLinks, icons) in each of hundreds of rows take a while to mount.
const rows = computed(() =>
  availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic)
    .map((id) => ({
      id,
      name: refName(pokemon(id)),
      data: POKEMON[id],
      href: hrefOf({ name: 'pokemon', params: { id } }),
      icon: cellStyle('pokemon', POKEMON[id].icon),
      types: POKEMON[id].types.map((type) => ({ type, href: hrefOf({ name: 'types', params: { type } }) })),
      abilities: POKEMON[id].abilities.map((a) => {
        const ref = ability(a)
        return { ref, name: refName(ref), href: refHref(ref) }
      }),
    })),
)

// An ability's short description on hover. Not on touch screens, where a tap follows the link.
const canHover = window.matchMedia('(hover: hover)').matches
const abilityTip = (a: Ref) => (canHover ? shortText(a) : undefined)

// The search (`?q=`) and the filters (`?f=`) are kept in the URL, so the home page's search can link here with them.
const route = useRoute()
const router = useRouter()
const query = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.query, q: q || undefined } }),
})
const filters = computed(() => parseFilters(route.query.f))
function removeFilter(filter: PokemonFilter) {
  const f = formatFilters(filters.value.filter((x) => !sameRef(x, filter)))
  void router.replace({ query: { ...route.query, f } })
}
// Backspace in an empty search box takes off the last filter, as if it were part of the search.
function removeLastFilter() {
  const last = filters.value.at(-1)
  if (!query.value && last) removeFilter(last)
}

// Filtering by move needs the learnsets, which only load then.
const learnsets = ref<Record<PokemonId, MoveId[]> | null>(null)
watchEffect(async () => {
  if (!learnsets.value && filters.value.some((f) => f.kind === 'move')) learnsets.value = await loadLearnsets()
})

// What else the search finds, grouped as on the home page: abilities, moves and types, each with a link to filter by
// it. Their descriptions load in the background.
const { results } = useSearch(() => query.value, ['ability', 'move'])
const others = computed(() => (results.value?.types.length || results.value?.sections.length ? results.value : null))
onMounted(() => void loadDescriptions(['ability', 'move']))

const type = ref<TypeId | ''>('')
const shown = computed(() => {
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if (type.value && !r.data.types.includes(type.value)) return []
    if (!passes(r.id, filters.value, learnsets.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

type Key = 'name' | StatId | 'total'
const { key, desc, toggle, sorted } = useSort({
  rows: shown,
  value: (r, k: Key) => (k === 'name' ? r.name : k === 'total' ? total(r.data) : r.data.stats[STATS.indexOf(k)]!),
  initial: 'name' as Key,
  startsDesc: (k) => k !== 'name',
  locale,
})

// The rows render once the page is in, with a skeleton until then: all of them take over 100ms.
const entered = usePageEntered()
const SKELETON = ['grow', '', 'wide-only', ...STATS.map(() => 'wide-only r'), 'r']
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.pokemon') }}</h1>
    <p class="muted">{{ t('pokedex.intro', { reg: REGULATION, n: rows.length }) }}</p>
    <div class="filters">
      <SearchBox
        v-model="query"
        :placeholder="t('pokedex.search')"
        :aria-label="t('pokedex.search')"
        @keydown.backspace="removeLastFilter"
      />
      <select v-model="type" class="search type-filter" :aria-label="t('pokedex.type')">
        <option value="">{{ t('pokedex.anyType') }}</option>
        <option v-for="ty in TYPES" :key="ty" :value="ty">{{ typeName(ty) }}</option>
      </select>
    </div>
    <ul v-if="filters.length" class="active-filters">
      <li v-for="f in filters" :key="`${f.kind}:${f.id}`" class="active-filter">
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
    <div v-if="sorted.length" class="dex-table" role="table" @click="follow">
      <div class="row head" role="row">
        <SortHeader :label="t('pokedex.name')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
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
        <div v-for="r in sorted" :key="r.id" class="row" role="row">
          <div role="cell" class="grow">
            <a :href="r.href" class="mon">
              <span class="sheet-icon" :style="r.icon" aria-hidden="true"></span>
              <span class="name">
                <template v-if="r.parts"
                  >{{ r.parts[0] }}<mark>{{ r.parts[1] }}</mark
                  >{{ r.parts[2] }}</template
                >
                <template v-else>{{ r.name }}</template>
              </span>
            </a>
          </div>
          <div role="cell">
            <span class="types">
              <a v-for="ty in r.types" :key="ty.type" :href="ty.href"><TypeIcon :type="ty.type" /></a>
            </span>
          </div>
          <div role="cell" class="wide-only grow">
            <ul class="abilities">
              <li v-for="a in r.abilities" :key="a.ref.id">
                <a v-tip="abilityTip(a.ref)" :href="a.href">{{ a.name }}</a>
              </li>
            </ul>
          </div>
          <div v-for="(v, i) in r.data.stats" :key="i" role="cell" class="wide-only r num">{{ v }}</div>
          <div role="cell" class="r num total">{{ total(r.data) }}</div>
        </div>
      </template>
    </div>
    <p v-else class="muted">{{ t('pokedex.none') }}</p>
  </div>
  <SearchResults v-if="others" :query :results="others" :filters />
</template>

<style scoped>
/* Name, types (room for two badges), abilities, the six stats and their total; on phones name, types and total. */
.dex-table {
  --types: calc(64px * var(--icon-scale, 1) + 14px);
  --num: minmax(2.6em, auto);
  --cols: minmax(11em, 1fr) var(--types) minmax(0, 1fr) repeat(7, var(--num));
}
@media (max-width: 720px) {
  .dex-table {
    --cols: minmax(0, 1fr) var(--types) var(--num);
  }
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.type-filter {
  width: auto;
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
.types {
  display: flex;
  gap: 2px;
}
.total {
  font-weight: bold;
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
