<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { availableIds, item } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { ITEM_KINDS, ITEMS } from '@/data/items'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import ItemList from '@/components/ItemList.vue'
import SearchBox from '@/components/SearchBox.vue'

// Every item the regulation has, by kind (held items, berries, Mega Stones), with its short description (`ItemList`).
const items = computed(() =>
  availableIds('item')
    .map((id) => ({ id, name: refName(item(id)), kind: ITEMS[id].kind }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)

// The home page's search links here with its query (`?q=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const groups = computed(() => {
  const q = fold(query.value.trim())
  const shown = items.value.flatMap((it) => {
    const parts = q ? split(it.name, q) : null
    return !q || parts ? [{ ...it, parts }] : []
  })
  return ITEM_KINDS.map((kind) => ({ kind, items: shown.filter((it) => it.kind === kind) })).filter(
    (g) => g.items.length,
  )
})
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
      <SearchBox v-model="query" :placeholder="t('items.search')" :aria-label="t('items.search')" />
    </div>
    <div class="panel">
      <section v-for="g in groups" :key="g.kind">
        <h2>{{ t(`items.kind.${g.kind}`) }}</h2>
        <ItemList :items="g.items" />
      </section>
      <p v-if="!groups.length" class="muted">{{ t('items.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
section + section {
  margin-top: 16px;
}
</style>
