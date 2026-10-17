<script setup lang="ts">
import Marked from '@/components/Marked'
import { Star } from '@lucide/vue'
import { t } from '@/i18n'
import type { ItemId, PokemonId } from '@/data/dex'
import { description, isDescribed } from '@/i18n/descriptions'
import type { SearchResults, SectionKind } from '@/composables/useSearch'
import TypeIcon from '@/components/TypeIcon'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import DexText from '@/components/DexText'

// The dex searched, grouped by category (`useSearch`), after the site's pages and the meta pages (on the home page), the
// reader's favorites first and starred: the home page's results, and an area's.
defineProps<{ query: string; results: SearchResults }>()

const short = (kind: SectionKind, id: string) => (isDescribed(kind) ? (description(kind, id)?.short ?? '') : '')
</script>

<template>
  <!-- The site's pages the search names ("moves", "damage calc"), each after its area. -->
  <section v-if="results.pages.length" class="panel section">
    <span class="section-title font-display">{{ t('search.pages') }}</span>
    <ul class="chip-hits">
      <li v-for="p in results.pages" :key="p.key">
        <RouterLink :to="p.to" class="chip-hit">
          <span v-if="p.area" class="muted">{{ t(p.area) }} ›</span>
          <span><Marked :p="p.parts" /></span>
          <span v-if="p.soon" class="soon">{{ t('soon.tag') }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
  <!-- The meta pages of the Pokémon found, in the meta shown (the home page's), each with its usage rank. -->
  <section v-if="results.meta.hits.length" class="panel section">
    <RouterLink :to="{ name: 'rankings', query: { q: query } }" class="section-head">
      <span class="section-title font-display">{{ t('search.meta') }} <span class="arrow">›</span></span>
    </RouterLink>
    <ul class="chip-hits">
      <li v-for="h in results.meta.hits" :key="h.id">
        <RouterLink :to="h.to" class="chip-hit">
          <PokemonIcon :id="h.id as PokemonId" />
          <span><Marked :p="h.parts" /></span
          ><Star v-if="h.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" />
          <span class="muted">#{{ h.rank }}</span>
        </RouterLink>
      </li>
    </ul>
    <RouterLink v-if="results.meta.more" :to="{ name: 'rankings', query: { q: query } }" class="more">
      {{ t('home.more', { n: results.meta.more }) }}
    </RouterLink>
  </section>
  <section v-for="s in results.sections" :key="s.kind" class="panel section">
    <RouterLink :to="{ path: s.list, query: { q: query } }" class="section-head">
      <span class="section-title font-display">{{ t(s.title) }} <span class="arrow">›</span></span>
    </RouterLink>
    <ul v-if="s.kind === 'pokemon'" class="chip-hits">
      <li v-for="h in s.hits" :key="h.id">
        <RouterLink :to="h.to" class="chip-hit">
          <PokemonIcon :id="h.id as PokemonId" />
          <span><Marked :p="h.parts" /></span
          ><Star v-if="h.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
    <dl v-else class="entries">
      <template v-for="h in s.hits" :key="h.id">
        <dt>
          <RouterLink :to="h.to" class="entry-name">
            <ItemIcon v-if="s.kind === 'item'" :id="h.id as ItemId" />
            <span><Marked :p="h.parts" /></span
            ><Star v-if="h.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" />
          </RouterLink>
        </dt>
        <dd class="muted"><DexText :text="short(s.kind, h.id)" /></dd>
      </template>
    </dl>
    <RouterLink v-if="s.more" :to="{ path: s.list, query: { q: query } }" class="more">
      {{ t('home.more', { n: s.more }) }}
    </RouterLink>
  </section>
  <section v-if="results.types.length" class="panel section">
    <RouterLink to="/dex/types" class="section-head">
      <span class="section-title font-display">{{ t('title.types') }} <span class="arrow">›</span></span>
    </RouterLink>
    <ul class="chip-hits">
      <li v-for="ty in results.types" :key="ty.id">
        <RouterLink :to="`/dex/types/${ty.id}`" class="chip-hit">
          <TypeIcon :type="ty.id" />
          <span><Marked :p="ty.parts" /></span>
        </RouterLink>
      </li>
    </ul>
  </section>
  <p
    v-if="!results.pages.length && !results.meta.hits.length && !results.types.length && !results.sections.length"
    class="muted none"
  >
    {{ t('home.none') }}
  </p>
</template>

<style scoped>
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

.chip-hits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip-hit {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}
.chip-hit .muted {
  font-weight: normal;
}
/* A page not built yet. */
.soon {
  padding: 0 6px;
  font-size: 0.7em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  background: var(--sel);
}
/* As on the abilities page: each name beside its description. */
.entries {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}
.entries dt {
  font-weight: bold;
}
.entries dd {
  margin: 0;
}
.entry-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.more {
  align-self: flex-start;
}
.none {
  text-align: center;
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
