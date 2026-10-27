<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BookOpen,
  Calculator,
  ChartColumn,
  ChartColumnBig,
  Scale,
  GraduationCap,
  Grid3x3,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
} from '@lucide/vue'
import { t, type MessageKey } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { AREAS, type AreaId } from '@/lib/areas'
import { preloadSearch, searchFocus, useSearch } from '@/composables/useSearch'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useMeta } from '@/composables/useMeta'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import LiveTournaments from '@/components/LiveTournaments.vue'
import MetaHighlights from '@/components/MetaHighlights.vue'
import RecentPanel from '@/components/RecentPanel.vue'
import { RECENT_ON } from '@/composables/useRecent'
import SearchResults from '@/components/SearchResults.vue'
import SearchBox from '@/components/SearchBox.vue'
import logoUrl from '@/assets/logo.png'

// The front door to the whole site: the search (of the site's pages, the meta pages and the dex), the tournaments under
// way a slim line under it (`LiveTournaments`), when there are some, and under them the areas, a card each, all alike:
// its name over its sections, a row each (Usage's row with its four lists' links as chips, its name leading to the
// Pokémon's, so its moves, abilities and items aren't missed); Meta and Tools first, on the accent's shadow, the
// quizzes and the dex under them, their names alone; then the meta at a glance (`MetaHighlights`), the reader's favorites and recently viewed.
// While searching, the results take the place of all but the search.

const areaById = (id: AreaId) => AREAS.find((a) => a.id === id)!
/** Usage's lists, in its tabs' order (`RankingsTabs`). */
const usageLists: { route: string; label: MessageKey }[] = [
  { route: 'rankings', label: 'nav.pokemon' },
  { route: 'moveRankings', label: 'nav.moves' },
  { route: 'itemRankings', label: 'nav.items' },
  { route: 'abilityRankings', label: 'nav.abilities' },
]
/** Each area's icon, and each of its sections' on the card, by its key. */
const AREA_ICONS: Record<AreaId, Component> = {
  meta: TrendingUp,
  tools: Wrench,
  quizzes: GraduationCap,
  dex: BookOpen,
}
const SECTION_ICONS: Record<string, Component> = {
  rankings: ChartColumn,
  tournaments: Trophy,
  speedTiers: ChartColumnBig,
  speedCompare: Scale,
  calc: Calculator,
  teamBuilder: Users,
  matchups: Swords,
  chart: Grid3x3,
}
/** The areas' cards, in reading order: Meta's and Tools' with their sections, those not built yet last, so the first
 * row leads somewhere; the quizzes' and the dex's their name alone (the dex's lists not to be mistaken for Usage's). */
const cards = (['meta', 'tools', 'quizzes', 'dex'] as const).map((id) => {
  const area = areaById(id)
  const featured = id === 'meta' || id === 'tools'
  return {
    area,
    featured,
    sections: featured ? [...area.sections].sort((a, b) => Number(!!a.soon) - Number(!!b.soon)) : [],
  }
})

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
const { data: meta, snapshot } = useMeta()
const { results, only } = useSearch(() => query.value, undefined, { pages: true, meta: () => meta.value })
function openOnly() {
  if (only.value) void router.push(only.value)
}

// The regulation's hyphens don't break ("M-C" stays on one line): U+2011, the non-breaking hyphen.
const unbroken = (reg: string) => reg.replace(/-/g, String.fromCharCode(0x2011))
const params = { game: GAME_NAME, reg: unbroken(REGULATION) }
// Meta's names the regulation of the data its pages show, as the meta at a glance under it does, not always the
// current one.
const shownReg = computed(() => ({ reg: unbroken(snapshot.value?.regulation ?? REGULATION) }))
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
      <LiveTournaments />
      <!-- Under them, the site's areas (where to go), then the meta at a glance (what it's about). -->
      <nav class="explore" :aria-label="t('home.explore')">
        <section
          v-for="c in cards"
          :key="c.area.id"
          class="panel area"
          :class="[`area-${c.area.id}`, { featured: c.featured }]"
        >
          <div class="area-head">
            <RouterLink :to="{ name: c.area.route }" class="area-name font-display"
              ><component :is="AREA_ICONS[c.area.id]" class="area-icon" :size="22" aria-hidden="true" />{{
                t(c.area.label)
              }}
              <span class="arrow">›</span></RouterLink
            >
            <span v-if="c.area.id === 'meta'" class="muted area-reg">{{ t('meta.regulation', shownReg) }}</span>
          </div>
          <ul v-if="c.sections.length" class="rows">
            <li v-for="sec in c.sections" :key="sec.key">
              <!-- Usage: its name a row's, its lists' links chips beside it (a link can't hold links). -->
              <div v-if="sec.key === 'rankings'" class="row usage">
                <RouterLink :to="{ name: sec.route }" class="row-label usage-name"
                  ><component :is="SECTION_ICONS[sec.key]" :size="16" aria-hidden="true" />{{
                    t(sec.label)
                  }}</RouterLink
                >
                <ul class="chips">
                  <li v-for="l in usageLists" :key="l.route">
                    <RouterLink :to="{ name: l.route }">{{ t(l.label) }}</RouterLink>
                  </li>
                </ul>
              </div>
              <RouterLink v-else :to="{ name: sec.route }" class="row" :class="{ soon: sec.soon }"
                ><span class="row-label"
                  ><component :is="SECTION_ICONS[sec.key]" :size="16" aria-hidden="true" />{{ t(sec.label) }}</span
                >
                <span v-if="sec.soon" class="soon-tag">{{ t('soon.tag') }}</span></RouterLink
              >
            </li>
          </ul>
        </section>
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

/* The areas, a card each, all alike: Meta and Tools side by side (Meta twice as wide), on the accent's shadow, their
   rows sharing each card's height, so the two end level; the quizzes and the dex under them, their names alone. */
.explore {
  /* Its links' hover a tint of the accent the featured areas stand on. */
  --explore-hover: color-mix(in srgb, var(--accent) 16%, var(--panel));
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-areas:
    'meta tools'
    'quizzes dex';
  gap: 22px;
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
.area-meta {
  grid-area: meta;
}
.area-tools {
  grid-area: tools;
}
.area-quizzes {
  grid-area: quizzes;
}
.area-dex {
  grid-area: dex;
}
:root:root .area {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}
:root:root .featured {
  box-shadow: 6px 6px 0 var(--accent);
}
/* Its name, and Meta's regulation across from it. */
.area-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 12px;
  padding: 14px 16px 10px;
  border-bottom: 2px solid var(--ink);
}
/* A card of its name alone. */
.area-head:only-child {
  border-bottom: none;
  padding-bottom: 14px;
}
.area-name {
  white-space: nowrap;
  font-weight: bold;
  font-size: calc(24px * var(--display-scale, 1) * var(--text-scale));
}
/* Its icon before it, in the accent, as its arrow after it. */
.area-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.area-icon {
  color: var(--accent);
}
/* A section's name with its icon before it, muted, so the names lead. */
.row-label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.row-label .lucide {
  color: var(--muted);
}
.area-reg {
  font-size: 0.9em;
}
.arrow {
  color: var(--accent);
}
/* Its sections: a row each, the whole row the link. */
.rows {
  flex: 1;
  display: grid;
  grid-auto-rows: 1fr;
}
.rows > li {
  display: flex;
}
.row {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  font-weight: bold;
  border-bottom: 1px dashed var(--border);
}
.rows > li:last-child .row {
  border-bottom: none;
}
a.row:hover {
  background: var(--explore-hover);
}
/* Not built yet: fainter, tagged. */
.explore .row.soon {
  color: var(--muted);
}
.soon-tag {
  font-size: 0.7em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border: 1px dashed var(--muted);
}
/* Usage: its name (a link to the Pokémon's) and its lists' links as chips, wrapping under it where they don't fit. */
.usage {
  flex-wrap: wrap;
  justify-content: start;
  gap: 6px 16px;
}
.usage-name:hover {
  color: var(--accent);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chips a {
  display: block;
  padding: 1px 10px;
  font-size: 0.9em;
  font-weight: 600;
  text-align: center;
  background: var(--panel-alt);
  border: 1.5px solid var(--ink);
}
.chips a:hover {
  background: var(--explore-hover);
}
.highlights {
  margin: 0 0 16px;
}

/* Narrower, Meta and Tools one under another and the quizzes and the dex side by side under them, the accent shadows smaller and the cards as far from the
   right edge (their shadow's end) as from the left; on phones, Usage's lists two to a row under its name. */
@media (max-width: 760px) {
  .explore {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'meta meta'
      'tools tools'
      'quizzes dex';
    gap: 18px;
    padding-right: 4px;
  }
  /* No card beside it to end level with: each row its own height (Usage's, with its chips under it, taller). */
  .rows {
    grid-auto-rows: auto;
  }
  :root:root .featured {
    box-shadow: 4px 4px 0 var(--accent);
  }
  /* The quizzes and the dex, half as wide: their names smaller. */
  .area-head:only-child .area-name {
    font-size: calc(20px * var(--display-scale, 1) * var(--text-scale));
  }
}
@media (max-width: 560px) {
  .usage .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
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
