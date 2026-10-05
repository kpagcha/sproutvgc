<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAME_NAME, REGULATION } from '@/data/format'
import { t } from '@/i18n'
import { areaOf } from '@/lib/areas'
import { preloadSearch, useSearch } from '@/composables/useSearch'
import SearchBox from '@/components/SearchBox.vue'
import SearchResults from '@/components/SearchResults.vue'
import SectionDecor from '@/components/SectionDecor.vue'

// An area's own page (`/dex`, `/competitive`, `/tools`): a card per section, what it is, and whether it's coming. The
// dex's has the home page's search too (kept in `?q=`), its results in place of the cards.
const route = useRoute()
const router = useRouter()
const area = computed(() => areaOf(route.meta.area)!)
const params = { game: GAME_NAME, reg: REGULATION }

const searchable = computed(() => area.value.id === 'dex')
const query = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.query, q: q || undefined } }),
})
const { results, only } = useSearch(() => (searchable.value ? query.value : ''), undefined, { pages: true })
function openOnly() {
  if (only.value) void router.push(only.value)
}
onMounted(() => searchable.value && preloadSearch())
</script>

<template>
  <div class="area">
    <h1>{{ t(area.title) }}</h1>
    <p class="muted intro">{{ t(route.meta.descKey!, params) }}</p>
    <SearchBox
      v-if="searchable"
      v-model="query"
      wide
      icon
      class="search"
      :placeholder="t('home.search')"
      :aria-label="t('home.search')"
      @keydown.enter="openOnly"
    />
    <SearchResults v-if="results" :query :results />
    <div v-else class="cards">
      <RouterLink v-for="s in area.sections" :key="s.key" :to="{ name: s.route }" class="panel card">
        <span class="card-title font-display">
          {{ t(s.label) }} <span class="arrow" aria-hidden="true">›</span>
          <SectionDecor v-if="area.id === 'dex'" :section="s.key" class="decor" />
          <span v-if="s.soon" class="soon">{{ t('soon.tag') }}</span>
        </span>
        <span class="muted">{{ t(s.desc, params) }}</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
}
.search {
  margin-bottom: 16px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 14px 16px;
  color: var(--text);
}
.card:hover {
  text-decoration: none;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  font-size: calc(18px * var(--display-scale, 1) * var(--text-scale));
}
.card:hover .card-title {
  text-decoration: underline;
}
.arrow {
  color: var(--accent);
}
.decor {
  margin-left: 10px;
}
/* A section not built yet: a tag after its name. */
.soon {
  margin-left: auto;
  padding: 0 6px;
  font-size: 0.6em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  background: var(--sel);
}
</style>
