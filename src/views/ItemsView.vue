<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { availableIds, item } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { ITEM_KINDS, ITEMS } from '@/data/items'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import DexText from '@/components/DexText.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import SearchBox from '@/components/SearchBox.vue'

// Every item the regulation has, by kind (held items, berries, Mega Stones), with its short description.
const items = computed(() =>
  availableIds('item')
    .map((id) => ({ id, name: refName(item(id)), kind: ITEMS[id].kind, text: description('item', id)?.short ?? '' }))
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
  <div class="panel">
    <h1>{{ t('title.items') }}</h1>
    <p class="muted">{{ t('items.intro', { reg: REGULATION }) }}</p>
    <SearchBox v-model="query" :placeholder="t('items.search')" :aria-label="t('items.search')" />
    <section v-for="g in groups" :key="g.kind">
      <h2>{{ t(`items.kind.${g.kind}`) }}</h2>
      <dl class="entries">
        <template v-for="it in g.items" :key="it.id">
          <dt>
            <RouterLink :to="{ name: 'item', params: { id: it.id } }" class="name">
              <ItemIcon :id="it.id" />
              <span>
                <template v-if="it.parts"
                  >{{ it.parts[0] }}<mark>{{ it.parts[1] }}</mark
                  >{{ it.parts[2] }}</template
                >
                <template v-else>{{ it.name }}</template>
              </span>
            </RouterLink>
          </dt>
          <dd class="muted"><DexText :text="it.text" /></dd>
        </template>
      </dl>
    </section>
    <p v-if="!groups.length" class="muted">{{ t('items.none') }}</p>
  </div>
</template>

<style scoped>
section + section {
  margin-top: 16px;
}
.entries {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  align-items: center;
  margin: 0;
}
.entries dt {
  font-weight: bold;
}
.entries dd {
  margin: 0;
}
.name {
  display: flex;
  align-items: center;
  gap: 4px;
}
@media (max-width: 560px) {
  .entries {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .entries dd {
    margin-bottom: 8px;
  }
}
</style>
