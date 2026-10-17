<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { AREAS, type AreaId } from '@/lib/areas'
import { preloadSearch, searchFocus, useSearch } from '@/composables/useSearch'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useMeta } from '@/composables/useMeta'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import MetaHighlights from '@/components/MetaHighlights.vue'
import RecentPanel from '@/components/RecentPanel.vue'
import SearchResults from '@/components/SearchResults.vue'
import SearchBox from '@/components/SearchBox.vue'
import logoUrl from '@/assets/logo.png'

// The front door to the whole site: the search (of the site's pages, the meta pages and the dex), and under it, side by side, the
// areas (where to go, by name: Meta's and Tools' with their sections) and the meta at a glance (what the site is most about,
// `MetaHighlights`); then the reader's favorites and recently viewed. While searching, the results take the place of all but the search.

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

// "/" focuses the box too, as on the speed tiers.
useSlashFocus(() => box.value?.focus({ preventScroll: true }))

// The site's search: its pages, the meta pages of the Pokémon in the meta shown (first, as the site leads with it),
// and the dex.
const { data: meta } = useMeta()
const { results, only } = useSearch(() => query.value, undefined, { pages: true, meta: () => meta.value })
function openOnly() {
  if (only.value) void router.push(only.value)
}

/** The areas whose sections show under their name: the dex's and the quizzes' are on their own pages. */
const WITH_SECTIONS = new Set<AreaId>(['meta', 'tools'])

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
        hotkey="/"
        :placeholder="t('home.searchAll')"
        :aria-label="t('home.searchAll')"
        @keydown.enter="openOnly"
      />
    </div>
    <SearchResults v-if="results" :query :results />
    <template v-else>
      <!-- Under them, side by side: the site's areas (where to go) at the left, the meta at a glance (what it's about)
           at the right; stacked on narrow screens, the areas first. -->
      <div class="board">
        <nav class="panel banded explore" :aria-label="t('home.explore')">
          <div class="band">
            <h2 class="band-title">{{ t('home.explore') }}</h2>
          </div>
          <div v-for="a in AREAS" :key="a.id" class="area">
            <RouterLink :to="{ name: a.route }" class="area-head">
              <span class="area-title font-display">{{ t(a.label) }} <span class="arrow">›</span></span>
            </RouterLink>
            <ul v-if="WITH_SECTIONS.has(a.id)" class="area-sections">
              <li v-for="s in a.sections" :key="s.key">
                <RouterLink
                  v-tip="s.soon ? t('soon.title') : undefined"
                  :to="{ name: s.route }"
                  :class="{ soon: s.soon }"
                  >{{ t(s.label) }}</RouterLink
                >
              </li>
            </ul>
          </div>
        </nav>
        <MetaHighlights />
      </div>
      <FavoritesPanel />
      <RecentPanel />
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

/* The areas and the meta side by side, the meta a little wider, both as tall as the taller: its ten against the four
   areas. */
.board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  align-items: stretch;
  gap: 16px;
  margin-bottom: 16px;
}
.board > :deep(.panel) {
  margin: 0;
}
.band-title {
  margin: 0;
}
/* An area a block each, ink rules between them: its name (a link), then, for Meta and Tools, its
   sections as chips. */
.explore {
  display: flex;
  flex-direction: column;
  padding-bottom: 4px;
}
/* Spread down the panel's height (the meta's beside it), each taking an equal share of what's left. */
.area {
  flex: 1 1 auto;
  padding: 10px 0;
}
.area + .area {
  border-top: 1px solid var(--border);
}
.area:first-of-type {
  padding-top: 0;
}
.area-head {
  display: flex;
  flex-direction: column;
  color: var(--text);
}
.area-head:hover {
  text-decoration: none;
}
.area-title {
  font-weight: bold;
  font-size: calc(18px * var(--display-scale, 1) * var(--text-scale));
}
.area-head:hover .area-title {
  text-decoration: underline;
}
.arrow {
  color: var(--accent);
}
.area-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.area-sections a {
  display: block;
  padding: 1px 8px;
  font-size: 0.875em;
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

@media (max-width: 860px) {
  .board {
    grid-template-columns: minmax(0, 1fr);
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
