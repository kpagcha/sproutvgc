<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import { useRoute } from 'vue-router'
import { availableIds, item, type ItemId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { ITEM_KINDS, ITEMS } from '@/data/items'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { passesGroups } from '@/lib/filterGroups'
import type { TermFilters } from '@/lib/searchTerms'
import { useUrlFilters } from '@/composables/useUrlFilters'
import ItemList from '@/components/ItemList.vue'
import FilterSearch from '@/components/FilterSearch.vue'

// Every item the regulation has, by kind (held items, berries, Mega Stones), with its short description (`ItemList`).
const items = computed(() =>
  availableIds('item')
    .map((id) => ({ id, name: refName(item(id)), kind: ITEMS[id].kind }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)

// The search (`FilterSearch`): its text finds items by name (the home page's search links here with it, `?q=`), and
// what they're for to filter them by (`?f=`, `?fm=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const KINDS = ['itemCategory'] as const
const filters = useUrlFilters(() => KINDS)
const preview = shallowRef<TermFilters | null>(null)
const passes = (id: ItemId, f: TermFilters) =>
  passesGroups(f, (x) => x.kind === 'itemCategory' && ITEMS[id].category === x.id)
const count = (f: TermFilters) => items.value.filter((it) => passes(it.id, f)).length
const named = computed(() => {
  const q = fold(query.value.trim())
  return q ? items.value.filter((it) => split(it.name, q) && passes(it.id, filters.value)).length : 0
})
const groups = computed(() => {
  const q = preview.value ? '' : fold(query.value.trim())
  const shown = items.value.flatMap((it) => {
    if (!passes(it.id, preview.value ?? filters.value)) return []
    const parts = q ? split(it.name, q) : null
    return !q || parts ? [{ ...it, parts }] : []
  })
  return ITEM_KINDS.map((kind) => ({ kind, items: shown.filter((it) => it.kind === kind) })).filter(
    (g) => g.items.length,
  )
})

// The spot in the list for its search's options, as its first rows (`FilterSearch`'s `rowsAt`).
const termRows = useId()
</script>

<template>
  <!-- The heading and the search, and the list, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <div class="panel">
      <!-- Their usage rankings, as they link here. -->
      <div class="title-row">
        <h1>{{ t('title.items') }}</h1>
        <RouterLink :to="{ name: 'itemRankings' }" class="other-page">{{ t('lists.toMeta') }} ›</RouterLink>
      </div>
      <p class="muted">{{ t('items.intro', { reg: REGULATION }) }}</p>
      <FilterSearch
        :rows-at="termRows"
        v-model:text="query"
        v-model:filters="filters"
        v-model:preview="preview"
        class="list-search"
        :subject="t('filter.subject.items')"
        :name-count="named"
        :kinds="KINDS"
        :count
      />
    </div>
    <div class="panel" :class="{ previewing: preview }">
      <div :id="termRows" class="term-rows bleed"></div>
      <section v-for="g in groups" :key="g.kind">
        <h2>{{ t(`items.kind.${g.kind}`) }}</h2>
        <ItemList :items="g.items" />
      </section>
      <p v-if="!groups.length" class="muted">{{ t('items.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
.list-search {
  margin-bottom: 12px;
}
.previewing section {
  opacity: 0.75;
}
section + section {
  margin-top: 16px;
}
</style>
