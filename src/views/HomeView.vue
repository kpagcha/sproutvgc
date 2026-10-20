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

// The front door to the whole site: the search (of the site's pages, the meta pages and the dex), and under it the
// areas, a card each, two to a row (where to go: its name and its sections, links alone; Meta and Tools standing out), then the meta at a glance (what the site is most about, `MetaHighlights`); then
// the reader's favorites and recently viewed. While searching, the results take the place of all but the search.

/** The areas that stand out, the site's own (what players use, and what to work with): on an accent shadow over a
 * dotted ground, their sections raised buttons. */
const FEATURED = new Set<AreaId>(['meta', 'tools'])

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
      <!-- Under them, the site's areas, a card each, two to a row (where to go), then the meta at a glance (what it's
           about). -->
      <nav class="areas" :aria-label="t('home.explore')">
        <section v-for="a in AREAS" :key="a.id" class="panel area" :class="{ featured: FEATURED.has(a.id) }">
          <RouterLink :to="{ name: a.route }" class="area-head font-display"
            >{{ t(a.label) }} <span class="arrow">›</span></RouterLink
          >
          <ul class="area-sections">
            <li v-for="sec in a.sections" :key="sec.key">
              <RouterLink
                v-tip="sec.soon ? t('soon.title') : undefined"
                :to="{ name: sec.route }"
                :class="{ soon: sec.soon }"
                >{{ t(sec.label) }}</RouterLink
              >
            </li>
          </ul>
        </section>
      </nav>
      <MetaHighlights class="highlights" />
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

/* The areas: a card each, two to a row, one on phones; each its name (a link) and its sections. */
.areas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
  margin-bottom: 20px;
}
.area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}
.area-head {
  align-self: start;
  font-weight: bold;
  font-size: calc(18px * var(--display-scale, 1) * var(--text-scale));
  color: var(--text);
}
.arrow {
  color: var(--accent);
}
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
  padding: 1px 8px;
  font-size: 0.875em;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
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
/* Meta and Tools: a hard shadow in the accent, a faint dotted ground, a larger name, their sections raised buttons
   (lifting on hover, pressed flat when clicked). */
:root:root .area.featured {
  background:
    radial-gradient(color-mix(in srgb, var(--accent) 22%, transparent) 1px, transparent 1.5px) 0 0 / 10px 10px,
    var(--panel);
  box-shadow: 6px 6px 0 var(--accent);
}
.featured .area-head {
  font-size: calc(26px * var(--display-scale, 1) * var(--text-scale));
}
.featured .area-sections {
  gap: 10px;
}
.featured .area-sections a {
  padding: 4px 12px;
  font-size: 0.95em;
  font-weight: bold;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
  transition:
    transform 0.08s ease-out,
    box-shadow 0.08s ease-out;
}
.featured .area-sections a:hover {
  background: var(--hover);
  transform: translate(-1px, -1px);
  box-shadow: var(--hard);
}
.featured .area-sections a:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.featured .area-sections a.soon {
  font-weight: normal;
  border: 2px dashed var(--border-strong);
  box-shadow: none;
}
.highlights {
  margin: 0 0 16px;
}

@media (max-width: 560px) {
  .areas {
    grid-template-columns: minmax(0, 1fr);
  }
  /* On phones, Meta's and Tools' buttons a little smaller. */
  .featured .area-sections {
    gap: 8px;
  }
  .featured .area-sections a {
    padding: 3px 9px;
    font-size: 0.9em;
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
