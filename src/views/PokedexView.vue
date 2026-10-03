<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, total, type StatId } from '@/data/pokemon'
import { TYPES, type TypeId } from '@/data/types'
import { locale, t, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { useSort } from '@/composables/useSort'
import PokemonIcon from '@/components/PokemonIcon.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon.vue'

// Every Pokémon the regulation has, with its types and base stats, sortable by any of them. Formes that only look
// different (Vivillon's patterns) are left to their species' page.
const rows = computed(() =>
  availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic)
    .map((id) => ({ id, name: refName(pokemon(id)), data: POKEMON[id] })),
)

// The home page's search links here with its query (`?q=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const type = ref<TypeId | ''>('')
const shown = computed(() => {
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if (type.value && !r.data.types.includes(type.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

type Key = 'num' | 'name' | StatId | 'total'
const { key, desc, toggle, sorted } = useSort({
  rows: shown,
  value: (r, k: Key) =>
    k === 'num' ? r.data.num : k === 'name' ? r.name : k === 'total' ? total(r.data) : r.data.stats[STATS.indexOf(k)]!,
  initial: 'num' as Key,
  startsDesc: (k) => k !== 'num' && k !== 'name',
  locale,
})

const link = (id: PokemonId) => ({ name: 'pokemon', params: { id } })
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.pokemon') }}</h1>
    <p class="muted">{{ t('pokedex.intro', { reg: REGULATION, n: rows.length }) }}</p>
    <div class="filters">
      <input
        v-model="query"
        type="search"
        class="search"
        :placeholder="t('pokedex.search')"
        :aria-label="t('pokedex.search')"
      />
      <select v-model="type" class="search type-filter" :aria-label="t('pokedex.type')">
        <option value="">{{ t('pokedex.anyType') }}</option>
        <option v-for="ty in TYPES" :key="ty" :value="ty">{{ typeName(ty) }}</option>
      </select>
    </div>
    <div v-if="sorted.length" class="table-wrap">
      <table class="dex-table">
        <thead>
          <tr>
            <SortHeader label="#" right :active="key === 'num'" :desc="desc" @sort="toggle('num')" />
            <SortHeader
              :label="t('pokedex.name')"
              class="grow"
              :active="key === 'name'"
              :desc="desc"
              @sort="toggle('name')"
            />
            <th>{{ t('pokedex.types') }}</th>
            <SortHeader
              v-for="s in STATS"
              :key="s"
              :label="t(`stat.${s}`)"
              right
              :active="key === s"
              :desc="desc"
              @sort="toggle(s)"
            />
            <SortHeader :label="t('stat.total')" right :active="key === 'total'" :desc="desc" @sort="toggle('total')" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sorted" :key="r.id">
            <td class="r num muted">{{ r.data.num }}</td>
            <td class="grow">
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
            <td v-for="(v, i) in r.data.stats" :key="i" class="r num">{{ v }}</td>
            <td class="r num total">{{ total(r.data) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">{{ t('pokedex.none') }}</p>
  </div>
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
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: -4px 0;
}
.types {
  display: flex;
  gap: 2px;
}
.total {
  font-weight: bold;
}
</style>
