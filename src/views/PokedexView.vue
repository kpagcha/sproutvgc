<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ability, availableIds, pokemon, sameRef, type MoveId, type PokemonId, type Ref } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, loadLearnsets, total, type AbilitySlot, type StatId } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { locale, t, typeName } from '@/i18n'
import { loadDescriptions, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { formatFilters, parseFilters, passes, type PokemonFilter } from '@/lib/pokemonFilters'
import { useSearch } from '@/composables/useSearch'
import { useSort } from '@/composables/useSort'
import PokemonIcon from '@/components/PokemonIcon.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon.vue'
import SearchBox from '@/components/SearchBox.vue'
import DexRef from '@/components/DexRef.vue'
import SearchResults from '@/components/SearchResults.vue'

// Every Pokémon the regulation has, with its types, abilities and base stats, sortable by its name and stats. Formes
// that only look different (Vivillon's patterns) are left to their species' page.
const SLOTS: AbilitySlot[] = ['0', '1', 'H']
const rows = computed(() =>
  availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic)
    .map((id) => ({
      id,
      name: refName(pokemon(id)),
      data: POKEMON[id],
      abilities: SLOTS.flatMap((slot) => {
        const a = POKEMON[id].abilities[slot]
        return a ? [{ ref: ability(a), hidden: slot === 'H' }] : []
      }),
    })),
)

// An ability's short description on hover, saying first when it's a hidden one. Not on touch screens, where a tap
// follows the link.
const canHover = window.matchMedia('(hover: hover)').matches
function abilityTip(a: { ref: Ref; hidden: boolean }) {
  if (!canHover) return undefined
  const short = shortText(a.ref)
  return a.hidden ? [t('pokedex.hidden'), short].filter(Boolean).join(': ') : short
}

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

const link = (id: PokemonId) => ({ name: 'pokemon', params: { id } })
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
    <!-- Not in a .table-wrap: its sideways scrolling would keep the header from sticking to the top of the page. Phones
         get a narrower table instead. -->
    <table v-if="sorted.length" class="dex-table">
      <thead>
        <tr>
          <SortHeader
            :label="t('pokedex.name')"
            class="name-col"
            :active="key === 'name'"
            :desc="desc"
            @sort="toggle('name')"
          />
          <th>{{ t('pokedex.types') }}</th>
          <th class="wide abilities-col">{{ t('pokedex.abilities') }}</th>
          <SortHeader
            v-for="s in STATS"
            :key="s"
            class="wide"
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
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in sorted" :key="r.id">
          <td class="name-col">
            <RouterLink :to="link(r.id)" class="mon">
              <PokemonIcon :id="r.id" />
              <span class="name">
                <template v-if="r.parts"
                  >{{ r.parts[0] }}<mark>{{ r.parts[1] }}</mark
                  >{{ r.parts[2] }}</template
                >
                <template v-else>{{ r.name }}</template>
              </span>
            </RouterLink>
          </td>
          <td>
            <span class="types">
              <RouterLink v-for="ty in r.data.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
                <TypeIcon :type="ty" />
              </RouterLink>
            </span>
          </td>
          <td class="wide abilities-col">
            <ul class="abilities">
              <li v-for="a in r.abilities" :key="a.ref.id" :class="{ hidden: a.hidden }">
                <DexRef :to="a.ref" :tip="abilityTip(a)" />
                <span v-if="a.hidden" class="sr-only">{{ t('pokemon.hidden') }}</span>
              </li>
            </ul>
          </td>
          <td v-for="(v, i) in r.data.stats" :key="i" class="wide r num">{{ v }}</td>
          <td class="r num total">{{ total(r.data) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">{{ t('pokedex.none') }}</p>
  </div>
  <SearchResults v-if="others" :query :results="others" :filters />
</template>

<style scoped>
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
     table and .table-wrap shows a scroll bar. */
  margin: -3px 0;
}
.types {
  display: flex;
  gap: 2px;
}
.total {
  font-weight: bold;
}

/* The header sticks to the top of the page, with a line under it standing in for the first row's, which scrolls
   away under it. */
.dex-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--panel);
  box-shadow: inset 0 -1px var(--border);
}
.dex-table tbody tr:first-child td {
  border-top: none;
}
/* The abilities take up the room the other columns leave, wrapping when they run out of it. */
.abilities-col {
  width: 100%;
  white-space: normal;
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
.abilities .hidden {
  font-style: italic;
  border-style: dashed;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Phones: just the icon, name, types and stat total, the name taking up the room left, and wrapping when there isn't
   enough of it ("Abomasnow (Mega)"), as the table has no sideways scrolling to spill into. */
@media (max-width: 720px) {
  .dex-table .wide {
    display: none;
  }
  .name-col {
    width: 100%;
    white-space: normal;
  }
}
</style>
