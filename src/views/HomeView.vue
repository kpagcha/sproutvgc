<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, type MessageKey } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { AREAS, type AreaId } from '@/lib/areas'
import { preloadSearch, searchFocus, useSearch } from '@/composables/useSearch'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useMeta } from '@/composables/useMeta'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import MetaHighlights from '@/components/MetaHighlights.vue'
import RecentPanel from '@/components/RecentPanel.vue'
import { RECENT_ON } from '@/composables/useRecent'
import SearchResults from '@/components/SearchResults.vue'
import SearchBox from '@/components/SearchBox.vue'
import logoUrl from '@/assets/logo.png'

// The front door to the whole site: the search (of the site's pages, the meta pages and the dex), and under it the
// areas: Meta first and largest (what the site is most about), its sections buttons (Usage across the top, a box
// of its four lists' links, its name leading to the Pokémon's, so its moves, abilities and items aren't missed), Tools a
// column beside it, a row per section, and the quizzes and the dex (its name alone, its lists not to be mistaken for
// Usage's) a band under them; then the meta at a glance (`MetaHighlights`), the reader's favorites and recently viewed. While searching, the
// results take the place of all but the search.

const areaById = (id: AreaId) => AREAS.find((a) => a.id === id)!
const metaArea = areaById('meta')
const usage = metaArea.sections.find((s) => s.key === 'rankings')!
const metaRest = metaArea.sections.filter((s) => s !== usage)
/** Usage's lists, in its tabs' order (`RankingsTabs`). */
const usageLists: { route: string; label: MessageKey }[] = [
  { route: 'rankings', label: 'nav.pokemon' },
  { route: 'moveRankings', label: 'nav.moves' },
  { route: 'itemRankings', label: 'nav.items' },
  { route: 'abilityRankings', label: 'nav.abilities' },
]
const toolsArea = areaById('tools')
/** The rest, a row each of the band under them. */
const bandAreas = [areaById('quizzes'), areaById('dex')]

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
      <!-- Under them, the site's areas, a card each, one under another (where to go), then the meta at a glance (what it's
           about). -->
      <nav class="explore" :aria-label="t('home.explore')">
        <div class="explore-top">
          <section class="panel featured meta-area">
            <div class="meta-head">
              <RouterLink :to="{ name: metaArea.route }" class="area-name font-display"
                >{{ t(metaArea.label) }} <span class="arrow">›</span></RouterLink
              >
              <span class="muted meta-blurb">{{ t('meta.regulation', params) }}</span>
            </div>
            <div class="usage">
              <RouterLink :to="{ name: usage.route }" class="sec-name usage-name"
                >{{ t(usage.label) }} <span class="arrow">›</span></RouterLink
              >
              <ul class="usage-lists">
                <li v-for="l in usageLists" :key="l.route">
                  <RouterLink :to="{ name: l.route }">{{ t(l.label) }}</RouterLink>
                </li>
              </ul>
            </div>
            <ul class="meta-sections">
              <li v-for="sec in metaRest" :key="sec.key">
                <RouterLink :to="{ name: sec.route }" class="meta-button">
                  <span class="sec-name">{{ t(sec.label) }} <span class="arrow">›</span></span>
                </RouterLink>
              </li>
            </ul>
          </section>
          <section class="panel featured tools-area">
            <RouterLink :to="{ name: toolsArea.route }" class="area-name tools-head font-display"
              >{{ t(toolsArea.label) }} <span class="arrow">›</span></RouterLink
            >
            <ul>
              <li v-for="sec in toolsArea.sections" :key="sec.key">
                <RouterLink :to="{ name: sec.route }" class="tool-row" :class="{ soon: sec.soon }">
                  <span class="sec-name"
                    >{{ t(sec.label) }}
                    <span v-if="sec.soon" class="soon-tag">{{ t('soon.tag') }}</span>
                    <span v-else class="arrow">›</span></span
                  >
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
        <div class="panel band">
          <div v-for="a in bandAreas" :key="a.id" class="band-row">
            <RouterLink :to="{ name: a.route }" class="band-name font-display"
              >{{ t(a.label) }} <span class="arrow">›</span></RouterLink
            >
            <ul v-if="a.id !== 'dex'" class="band-links">
              <li v-for="sec in a.sections" :key="sec.key">
                <RouterLink :to="{ name: sec.route }">{{ t(sec.label) }}</RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <MetaHighlights class="highlights" />
      <FavoritesPanel />
      <RecentPanel v-if="RECENT_ON" />
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

/* The areas: Meta and Tools side by side (Meta twice as wide), on an accent shadow; the dex and the quizzes a band of
   links under them. */
.explore {
  display: grid;
  gap: 20px;
  margin-bottom: 20px;
}
.explore ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.explore a {
  color: var(--text);
}
.explore a:hover {
  text-decoration: none;
}
.explore-top {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 22px;
}
.explore .panel {
  margin: 0;
}
.area-name {
  font-weight: bold;
  font-size: calc(24px * var(--display-scale, 1) * var(--text-scale));
}
.arrow {
  color: var(--accent);
}
.sec-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}
/* Meta and Tools: a hard shadow in the accent; Meta's on a faint dotted ground. */
:root:root .featured {
  box-shadow: 6px 6px 0 var(--accent);
}
:root:root .meta-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 20px;
}
.meta-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 12px;
}
.meta-blurb {
  font-size: 0.9em;
}
/* Its sections raised buttons, Usage's lists in a box across the top and the rest three to a row, lifting on hover and pressed
   flat when clicked. */
.meta-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.meta-sections li {
  display: flex;
}
.meta-button {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
  transition:
    transform 0.08s ease-out,
    box-shadow 0.08s ease-out;
}
.meta-button .sec-name {
  font-size: 1.1em;
}
.meta-button:hover {
  background: var(--hover);
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--ink);
}
.meta-button:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}
/* Usage: its name (a link to the Pokémon's) and its lists' links on one row (wrapping under it where they don't fit), in a box as the buttons
   are, but not one itself. */
.usage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 14px;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
}
.usage .sec-name {
  font-size: 1.1em;
}
/* Its name leads to the Pokémon's, the first of them. */
.usage-name:hover {
  color: var(--accent);
}
.usage-lists {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.usage-lists a {
  display: block;
  padding: 3px 11px;
  font-weight: 600;
  background: var(--panel-alt);
  border: 1.5px solid var(--ink);
}
.usage-lists a:hover {
  background: var(--hover);
}
/* Tools: its name over its sections, a row each. */
:root:root .tools-area {
  display: flex;
  flex-direction: column;
  padding: 0;
}
.tools-head {
  padding: 14px 16px 10px;
  border-bottom: 2px solid var(--ink);
}
.tool-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 16px;
  border-bottom: 1px dashed var(--border);
}
.tools-area li:last-child .tool-row {
  border-bottom: none;
}
.tool-row:hover {
  background: var(--hover);
}
/* Not built yet: fainter, tagged. */
.explore .tool-row.soon {
  color: var(--muted);
}
.soon-tag {
  font-size: 0.7em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border: 1px dashed var(--muted);
}
/* The dex and the quizzes: a row each, its name then its sections. */
:root:root .band {
  padding: 0;
}
.band-row {
  display: flex;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 16px;
}
.band-row + .band-row {
  border-top: 1px solid var(--border);
}
.band-name {
  flex: none;
  width: 6em;
  font-weight: bold;
  font-size: calc(17px * var(--display-scale, 1) * var(--text-scale));
}
.band-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.band-links a {
  display: block;
  padding: 3px 11px;
  font-size: 0.9em;
  font-weight: 600;
  background: var(--panel-alt);
  border: 1.5px solid var(--ink);
}
.band-links a:hover {
  background: var(--hover);
}
.highlights {
  margin: 0 0 16px;
}

/* Narrower, Tools under Meta; on phones, Meta's buttons one to a row and the band's names over their links. */
@media (max-width: 760px) {
  .explore-top {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .meta-sections {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  .band-row {
    flex-direction: column;
    align-items: start;
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
