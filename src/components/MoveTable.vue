<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { move, type MoveId } from '@/data/dex'
import { CATEGORIES, MOVES, type Category, type Move } from '@/data/moves'
import { TYPES, type TypeId } from '@/data/types'
import type { MessageKey } from '@/i18n'
import { locale, t, typeName } from '@/i18n'
import { description, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { parseDexText } from '@/lib/dexText'
import { follow, hrefOf, refHref } from '@/lib/links'
import { CATEGORY_ICONS } from '@/lib/sprites'
import { fold, split } from '@/lib/search'
import { usePageEntered } from '@/composables/usePageEntered'
import { useSort } from '@/composables/useSort'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon.vue'
import SearchBox from '@/components/SearchBox.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'

// A table of moves with their type, category, power, accuracy and PP, sortable by any of them, searchable by name and
// filtered by type and category; with `descriptions`, each move's short description too.
const props = defineProps<{ ids: readonly MoveId[]; descriptions?: boolean; placeholder: string; query?: string }>()

// Plain markup, with what goes in it worked out here (the links' hrefs, the descriptions' references, as `DexText`
// would), and the router follows the links (`follow` on the table): components in each of hundreds of rows take a
// while to mount. References show their entry's short description on hover, where there is hover.
const canHover = window.matchMedia('(hover: hover)').matches
const rows = computed(() =>
  props.ids.map((id) => ({
    id,
    name: refName(move(id)),
    data: MOVES[id],
    href: hrefOf({ name: 'move', params: { id } }),
    typeHref: hrefOf({ name: 'types', params: { type: MOVES[id].type } }),
    category: t(`move.category.${MOVES[id].category}`),
    desc: props.descriptions
      ? parseDexText(description('move', id)?.short ?? '').map((part) =>
          'ref' in part
            ? { text: refName(part.ref), href: refHref(part.ref), tip: canHover ? shortText(part.ref) : undefined }
            : { text: part.text, href: undefined, tip: undefined },
        )
      : [],
  })),
)

const query = ref(props.query ?? '')
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

// Phones leave out PP, and show the descriptions under the moves' names rather than in a column of their own.
const COLUMNS: { k: Key; label: MessageKey; right?: boolean; wideOnly?: boolean }[] = [
  { k: 'type', label: 'move.type' },
  { k: 'category', label: 'move.categoryShort' },
  { k: 'power', label: 'move.power', right: true },
  { k: 'accuracy', label: 'move.accuracy', right: true },
  { k: 'pp', label: 'move.pp', right: true, wideOnly: true },
]
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhone))

// The rows render once the page is in, with a skeleton until then: all of them can take over 100ms.
const entered = usePageEntered()
const skeleton = computed(() => [
  'grow',
  '',
  '',
  'r',
  'r',
  'wide-only r',
  ...(props.descriptions && !phone.value ? ['grow'] : []),
])
</script>

<template>
  <div class="filters">
    <SearchBox v-model="query" :placeholder="placeholder" :aria-label="placeholder" />
    <select v-model="type" class="search select" :aria-label="t('move.type')">
      <option value="">{{ t('pokedex.anyType') }}</option>
      <option v-for="ty in TYPES" :key="ty" :value="ty">{{ typeName(ty) }}</option>
    </select>
    <select v-model="category" class="search select" :aria-label="t('move.category')">
      <option value="">{{ t('moves.anyCategory') }}</option>
      <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t(`move.category.${c}`) }}</option>
    </select>
  </div>
  <div v-if="sorted.length" class="dex-table" :class="{ described: descriptions }" role="table" @click="follow">
    <div class="row head" role="row">
      <SortHeader :label="t('move.name')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
      <SortHeader
        v-for="c in COLUMNS"
        :key="c.k"
        :class="{ 'wide-only': c.wideOnly }"
        :label="t(c.label)"
        :right="c.right"
        :active="key === c.k"
        :desc="desc"
        @sort="toggle(c.k)"
      />
      <div v-if="descriptions && !phone" role="columnheader"></div>
    </div>
    <SkeletonRows v-if="!entered" :cells="skeleton" height="2.05em" />
    <template v-else>
      <div v-for="r in sorted" :key="r.id" class="row" role="row">
        <div role="cell" class="grow">
          <a :href="r.href" class="name">
            <template v-if="r.parts"
              >{{ r.parts[0] }}<mark>{{ r.parts[1] }}</mark
              >{{ r.parts[2] }}</template
            >
            <template v-else>{{ r.name }}</template>
          </a>
          <div v-if="descriptions && phone" class="muted below">
            <template v-for="(part, i) in r.desc" :key="i"
              ><a v-if="part.href" v-tip="part.tip" :href="part.href">{{ part.text }}</a
              ><template v-else>{{ part.text }}</template></template
            >
          </div>
        </div>
        <div role="cell">
          <a :href="r.typeHref"><TypeIcon :type="r.data.type" /></a>
        </div>
        <div role="cell">
          <img
            v-tip="r.category"
            class="pixel category"
            :src="CATEGORY_ICONS[r.data.category]"
            :alt="r.category"
            width="32"
            height="14"
            draggable="false"
          />
        </div>
        <div role="cell" class="r num">{{ r.data.power || '—' }}</div>
        <div role="cell" class="r num">{{ r.data.accuracy === true ? '—' : r.data.accuracy }}</div>
        <div role="cell" class="wide-only r num">{{ r.data.pp }}</div>
        <div v-if="descriptions && !phone" role="cell" class="grow muted">
          <template v-for="(part, i) in r.desc" :key="i"
            ><a v-if="part.href" v-tip="part.tip" :href="part.href">{{ part.text }}</a
            ><template v-else>{{ part.text }}</template></template
          >
        </div>
      </div>
    </template>
  </div>
  <p v-else class="muted">{{ t('moves.none') }}</p>
</template>

<style scoped>
/* Name, type, category, power, accuracy, PP and, with descriptions, the description; phones leave out PP and show the
   descriptions under the names. */
.dex-table {
  --num: minmax(2.6em, auto);
  --cols: minmax(0, 1fr) auto auto repeat(3, var(--num));
}
.dex-table.described {
  --cols: minmax(9em, 1fr) auto auto repeat(3, var(--num)) minmax(0, 2fr);
}
@media (max-width: 720px) {
  .dex-table,
  .dex-table.described {
    --cols: minmax(0, 1fr) auto auto repeat(2, var(--num));
  }
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.select {
  width: auto;
}
.category {
  vertical-align: middle;
}
.below {
  font-size: 0.9em;
}
</style>
