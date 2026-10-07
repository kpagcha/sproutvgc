<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { Funnel, Star } from '@lucide/vue'
import { t } from '@/i18n'
import type { ItemId, PokemonId } from '@/data/dex'
import { description, isDescribed } from '@/i18n/descriptions'
import type { SearchResults, SectionKind } from '@/composables/useSearch'
import { addFilter, isFilterKind, type Filters, type PokemonFilter } from '@/lib/pokemonFilters'
import TypeIcon from '@/components/TypeIcon'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import DexText from '@/components/DexText'

// The dex searched, grouped by category (`useSearch`), the reader's favorites first and starred: the home page's
// results, the search page's, and the Pokémon list's. On the Pokémon list (given its `filters`), types, abilities and moves filter it rather than open their pages.
const props = defineProps<{ query: string; results: SearchResults; filters?: Filters }>()

/** Where a result leads: its page, or on the Pokémon list, the list filtered by it. */
function target(kind: SectionKind | 'type', id: string, page: RouteLocationRaw): RouteLocationRaw {
  return props.filters && isFilterKind(kind) ? addFilter({ kind, id } as PokemonFilter, props.filters) : page
}
/** Whether a result filters the Pokémon list. */
const filtering = (kind: SectionKind | 'type') => !!props.filters && isFilterKind(kind)

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
          <span
            >{{ p.parts[0] }}<mark>{{ p.parts[1] }}</mark
            >{{ p.parts[2] }}</span
          >
          <span v-if="p.soon" class="soon">{{ t('soon.tag') }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
  <section v-for="s in results.sections" :key="s.kind" class="panel section">
    <RouterLink :to="{ path: s.list, query: { q: query } }" class="section-head">
      <span class="section-title font-display">{{ t(s.title) }} <span class="arrow">›</span></span>
    </RouterLink>
    <ul v-if="s.kind === 'pokemon'" class="chip-hits">
      <li v-for="h in s.hits" :key="h.id">
        <RouterLink :to="h.to" class="chip-hit">
          <PokemonIcon :id="h.id as PokemonId" />
          <span
            >{{ h.parts[0] }}<mark>{{ h.parts[1] }}</mark
            >{{ h.parts[2] }}</span
          ><Star v-if="h.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
    <dl v-else class="entries">
      <template v-for="h in s.hits" :key="h.id">
        <dt>
          <RouterLink :to="target(s.kind, h.id, h.to)" :replace="filtering(s.kind)" class="entry-name">
            <ItemIcon v-if="s.kind === 'item'" :id="h.id as ItemId" />
            <span
              >{{ h.parts[0] }}<mark>{{ h.parts[1] }}</mark
              >{{ h.parts[2] }}</span
            ><Star v-if="h.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" />
            <span v-if="filtering(s.kind)" class="btn chip"
              ><Funnel :size="12" :stroke-width="3" />{{ t('filter.add') }}</span
            >
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
        <RouterLink :to="target('type', ty.id, `/dex/types/${ty.id}`)" :replace="filtering('type')" class="chip-hit">
          <TypeIcon :type="ty.id" />
          <span
            >{{ ty.parts[0] }}<mark>{{ ty.parts[1] }}</mark
            >{{ ty.parts[2] }}</span
          >
          <span v-if="filtering('type')" class="btn chip"
            ><Funnel :size="12" :stroke-width="3" />{{ t('filter.add') }}</span
          >
        </RouterLink>
      </li>
    </ul>
  </section>
  <p v-if="!results.pages.length && !results.types.length && !results.sections.length" class="muted none">
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
/* The filter badge, a little apart from the name. */
.chip {
  margin-left: 4px;
  font-weight: normal;
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
