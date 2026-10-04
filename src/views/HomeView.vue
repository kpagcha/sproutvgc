<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import type { ItemId, PokemonId } from '@/data/dex'
import { SECTIONS, preloadSearch, searchFocus, useSearch } from '@/composables/useSearch'
import TypeIcon from '@/components/TypeIcon.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import SearchResults from '@/components/SearchResults.vue'
import SearchBox from '@/components/SearchBox.vue'

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

const { results, only } = useSearch(() => query.value)
function openOnly() {
  if (only.value) void router.push(only.value)
}

// The cards' decorations: a few entries of their sections.
const DECOR_POKEMON: PokemonId[] = ['incineroar', 'garchomp', 'whimsicott']
const DECOR_ITEMS: ItemId[] = ['choicescarf', 'focussash', 'sitrusberry']
</script>

<template>
  <!-- One card per dex section, or the search's results grouped the same way. -->
  <div class="home">
    <div class="intro">
      <h1 class="title">mon<span>dex</span></h1>
      <p class="muted">{{ t('home.intro', { game: GAME_NAME, reg: REGULATION }) }}</p>
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
      <section v-for="s in SECTIONS" :key="s.kind" class="panel section">
        <RouterLink :to="s.list" class="section-head">
          <span class="section-text">
            <span class="section-title-row">
              <span class="section-title font-display">{{ t(s.title) }} <span class="arrow">›</span></span>
              <span v-if="s.kind === 'pokemon'" class="icons" aria-hidden="true">
                <PokemonIcon v-for="p in DECOR_POKEMON" :id="p" :key="p" />
              </span>
              <span v-else-if="s.kind === 'item'" class="icons" aria-hidden="true">
                <ItemIcon v-for="i in DECOR_ITEMS" :id="i" :key="i" />
              </span>
            </span>
            <span class="muted">{{ t(s.desc) }}</span>
          </span>
        </RouterLink>
      </section>
      <section class="panel section">
        <RouterLink to="/types" class="section-head">
          <span class="section-text">
            <span class="section-title-row">
              <span class="section-title font-display">{{ t('title.types') }} <span class="arrow">›</span></span>
              <span class="icons" aria-hidden="true">
                <TypeIcon type="fire" />
                <TypeIcon type="water" />
                <TypeIcon type="grass" />
              </span>
            </span>
            <span class="muted">{{ t('home.typesDesc') }}</span>
          </span>
        </RouterLink>
        <QuickLinks />
      </section>
    </template>
  </div>
</template>

<style scoped>
.home {
  max-width: 720px;
  margin: 0 auto;
  padding-top: 32px;
}
.intro {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: calc(48px * var(--display-scale, 1) * var(--text-scale));
  letter-spacing: -1px;
  line-height: 1.1;
}
.title span {
  color: var(--accent);
}
.intro p {
  max-width: 520px;
  margin: 0 auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--text);
}
.section-head:hover {
  text-decoration: none;
}
.section-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
/* Badges decorate the title rather than lead the card: a bit smaller than elsewhere, and on one row with it. */
.icons {
  --icon-scale: 1;
  display: flex;
  gap: 3px;
  flex: none;
}
.section-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.section-title {
  font-weight: bold;
  font-size: calc(20px * var(--display-scale, 1) * var(--text-scale));
  white-space: nowrap;
}
.section-head:hover .section-title {
  text-decoration: underline;
}
.arrow {
  color: var(--accent);
}

.search-box {
  margin: 16px 0 0;
}

@media (max-width: 560px) {
  .home {
    padding-top: 8px;
  }
  .title {
    font-size: calc(40px * var(--display-scale, 1) * var(--text-scale));
  }
  .icons {
    --icon-scale: 1.2;
  }
  /* Just the title and its icons; the description goes. */
  .section-text .muted {
    display: none;
  }
}
</style>
