<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { AREAS, PITCH } from '@/lib/areas'
import { preloadSearch, searchFocus, useSearch } from '@/composables/useSearch'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import RecentPanel from '@/components/RecentPanel.vue'
import SearchResults from '@/components/SearchResults.vue'
import SearchBox from '@/components/SearchBox.vue'
import logoUrl from '@/assets/logo.png'

// The front door to the whole site: the search (of the dex and the site's pages), the reader's favorites and recently
// viewed, and a card per area with its sections. While searching, the results take the place of all but the search.

// The search is kept in the URL (`?q=`), so coming back from a result brings the results back.
const route = useRoute()
const router = useRouter()
const query = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.query, q: q || undefined } }),
})

// The page itself shows no dex entries, so it doesn't wait for their names (or descriptions); they load in the
// background, ready to search by the time anyone types.
onMounted(preloadSearch)

// The header's Search link focuses the box, whether it brought us here or we were here already. Without scrolling:
// the box is at the top, and on phones the page may still be sliding in.
const box = useTemplateRef('box')
function focusBox() {
  if (!searchFocus.value) return
  searchFocus.value = false
  box.value?.focus({ preventScroll: true })
}
onMounted(focusBox)
watch(searchFocus, focusBox)

const { results, only } = useSearch(() => query.value, undefined, { pages: true })
function openOnly() {
  if (only.value) void router.push(only.value)
}

// The regulation's hyphens don't break ("M-C" stays on one line): U+2011, the non-breaking hyphen.
const params = { game: GAME_NAME, reg: REGULATION.replace(/-/g, String.fromCharCode(0x2011)) }
</script>

<template>
  <div class="home">
    <div class="hero">
      <div class="brand">
        <img :src="logoUrl" alt="" width="90" height="72" />
        <div class="brand-text">
          <h1 class="name font-display">sprout<span>vgc</span></h1>
          <p class="muted tagline">{{ t('home.intro', params) }}</p>
        </div>
      </div>
      <SearchBox
        ref="box"
        v-model="query"
        wide
        icon
        :placeholder="t('home.search')"
        :aria-label="t('home.search')"
        @keydown.enter="openOnly"
      />
    </div>
    <SearchResults v-if="results" :query :results />
    <template v-else>
      <FavoritesPanel />
      <RecentPanel />
      <div class="areas">
        <section v-for="a in AREAS" :key="a.id" class="panel area">
          <RouterLink :to="{ name: a.route }" class="area-head">
            <span class="area-title font-display">{{ t(a.label) }} <span class="arrow">›</span></span>
            <span class="muted">{{ t(PITCH[a.id], params) }}</span>
          </RouterLink>
          <ul class="area-sections">
            <li v-for="s in a.sections" :key="s.key">
              <RouterLink
                v-tip="s.soon ? t('soon.title') : undefined"
                :to="{ name: s.route }"
                :class="{ soon: s.soon }"
              >
                {{ t(s.label) }}
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The logo and name large and centered, the search under them. */
.hero {
  max-width: 560px;
  margin: 24px auto 28px;
  text-align: center;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.brand img {
  /* Pixel art, drawn at a whole multiple of its size, which keeps its pixels. */
  image-rendering: pixelated;
}
.name {
  margin: 0;
  font-size: calc(44px * var(--display-scale, 1) * var(--text-scale));
  letter-spacing: -0.5px;
  line-height: 1.1;
  color: var(--logo-sprout);
}
.name span {
  color: var(--logo-vgc);
}
.tagline {
  margin: 4px 0 0;
}
.hero :deep(.search-box) {
  margin: 16px 0 0;
}

/* The areas: a card each, side by side, stacked on narrow screens. */
.areas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 16px;
}
.area-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text);
}
.area-head:hover {
  text-decoration: none;
}
.area-title {
  font-weight: bold;
  font-size: calc(20px * var(--display-scale, 1) * var(--text-scale));
}
.area-head:hover .area-title {
  text-decoration: underline;
}
.arrow {
  color: var(--accent);
}
/* Its sections as small flat chips, which wrap cleanly. */
.area-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.area-sections a {
  display: block;
  padding: 2px 8px;
  font-size: 0.9em;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.area-sections a:hover {
  text-decoration: none;
  background: var(--hover);
  border-color: var(--border-strong);
}
/* Not built yet: dashed and fainter. */
.area-sections a.soon {
  color: var(--muted);
  border-style: dashed;
}

@media (max-width: 720px) {
  .areas {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .hero {
    margin: 8px auto 20px;
  }
  .name {
    font-size: calc(36px * var(--display-scale, 1) * var(--text-scale));
  }
}
</style>
