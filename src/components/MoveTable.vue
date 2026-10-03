<script setup lang="ts">
import { computed, ref } from 'vue'
import { move, type MoveId } from '@/data/dex'
import { CATEGORIES, MOVES, type Category, type Move } from '@/data/moves'
import { TYPES, type TypeId } from '@/data/types'
import type { MessageKey } from '@/i18n'
import { locale, t, typeName } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { useSort } from '@/composables/useSort'
import CategoryIcon from '@/components/CategoryIcon.vue'
import DexText from '@/components/DexText.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon.vue'

// A table of moves with their type, category, power, accuracy and PP, sortable by any of them, searchable by name and
// filtered by type and category; with `descriptions`, each move's short description too.
const props = defineProps<{ ids: readonly MoveId[]; descriptions?: boolean; placeholder: string }>()

const rows = computed(() => props.ids.map((id) => ({ id, name: refName(move(id)), data: MOVES[id] })))

const query = ref('')
const type = ref<TypeId | ''>('')
const category = ref<Category | ''>('')
const shown = computed(() => {
  const q = fold(query.value.trim())
  return rows.value.flatMap((r) => {
    if ((type.value && r.data.type !== type.value) || (category.value && r.data.category !== category.value)) return []
    const parts = q ? split(r.name, q) : null
    return !q || parts ? [{ ...r, parts }] : []
  })
})

type Key = 'name' | 'type' | 'category' | 'power' | 'accuracy' | 'pp'
const value = (r: { name: string; data: Move }, k: Key): number | string => {
  if (k === 'name') return r.name
  if (k === 'type') return typeName(r.data.type)
  if (k === 'category') return CATEGORIES.indexOf(r.data.category)
  if (k === 'accuracy') return r.data.accuracy === true ? 101 : r.data.accuracy
  return r.data[k]
}
const { key, desc, toggle, sorted } = useSort({
  rows: shown,
  value,
  initial: 'name' as Key,
  startsDesc: (k) => k === 'power' || k === 'accuracy' || k === 'pp',
  locale,
})

const COLUMNS: { k: Key; label: MessageKey; right?: boolean }[] = [
  { k: 'type', label: 'move.type' },
  { k: 'category', label: 'move.categoryShort' },
  { k: 'power', label: 'move.power', right: true },
  { k: 'accuracy', label: 'move.accuracy', right: true },
  { k: 'pp', label: 'move.pp', right: true },
]
</script>

<template>
  <div class="filters">
    <input v-model="query" type="search" class="search" :placeholder="placeholder" :aria-label="placeholder" />
    <select v-model="type" class="search select" :aria-label="t('move.type')">
      <option value="">{{ t('pokedex.anyType') }}</option>
      <option v-for="ty in TYPES" :key="ty" :value="ty">{{ typeName(ty) }}</option>
    </select>
    <select v-model="category" class="search select" :aria-label="t('move.category')">
      <option value="">{{ t('moves.anyCategory') }}</option>
      <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t(`move.category.${c}`) }}</option>
    </select>
  </div>
  <div v-if="sorted.length" class="table-wrap">
    <table class="dex-table">
      <thead>
        <tr>
          <SortHeader
            :label="t('move.name')"
            :class="{ grow: !descriptions }"
            :active="key === 'name'"
            :desc="desc"
            @sort="toggle('name')"
          />
          <SortHeader
            v-for="c in COLUMNS"
            :key="c.k"
            :label="t(c.label)"
            :right="c.right"
            :active="key === c.k"
            :desc="desc"
            @sort="toggle(c.k)"
          />
          <th v-if="descriptions" class="grow"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in sorted" :key="r.id">
          <td :class="{ grow: !descriptions }">
            <RouterLink :to="{ name: 'move', params: { id: r.id } }" class="name">
              <template v-if="r.parts"
                >{{ r.parts[0] }}<mark>{{ r.parts[1] }}</mark
                >{{ r.parts[2] }}</template
              >
              <template v-else>{{ r.name }}</template>
            </RouterLink>
          </td>
          <td>
            <RouterLink :to="{ name: 'types', params: { type: r.data.type } }"
              ><TypeIcon :type="r.data.type"
            /></RouterLink>
          </td>
          <td><CategoryIcon :category="r.data.category" /></td>
          <td class="r num">{{ r.data.power || '—' }}</td>
          <td class="r num">{{ r.data.accuracy === true ? '—' : r.data.accuracy }}</td>
          <td class="r num">{{ r.data.pp }}</td>
          <td v-if="descriptions" class="grow muted desc">
            <DexText :text="description('move', r.id)?.short ?? ''" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="muted">{{ t('moves.none') }}</p>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.select {
  width: auto;
}
.desc {
  min-width: 240px;
}
</style>
