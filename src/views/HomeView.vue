<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { availableIds, type ItemId, type PokemonId, type Ref } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { TYPES } from '@/data/types'
import { description, isDescribed, loadDescriptions } from '@/i18n/descriptions'
import { loadDexNames, refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import TypeIcon from '@/components/TypeIcon.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon.vue'
import QuickLinks from '@/components/QuickLinks.vue'
import DexText from '@/components/DexText.vue'

// The search is kept in the URL (`?q=`), so coming back from a result brings the results back.
const route = useRoute()
const router = useRouter()
const query = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.query, q: q || undefined } }),
})

// The page itself shows no dex entries, so it doesn't wait for their names (or descriptions); they load in the
// background, ready to search by the time anyone types.
onMounted(() => {
  void loadDexNames()
  void loadDescriptions(['ability', 'move', 'item', 'condition'])
})

type SectionKind = 'pokemon' | 'move' | 'ability' | 'item' | 'condition'

/** The dex's sections, in the order the home page shows them: their list page, and their entries' pages' route. */
const SECTIONS: { kind: SectionKind; title: MessageKey; desc: MessageKey; list: string; route: string }[] = [
  { kind: 'pokemon', title: 'title.pokemon', desc: 'home.pokemonDesc', list: '/pokemon', route: 'pokemon' },
  { kind: 'move', title: 'title.moves', desc: 'home.movesDesc', list: '/moves', route: 'move' },
  { kind: 'ability', title: 'title.abilities', desc: 'home.abilitiesDesc', list: '/abilities', route: 'ability' },
  { kind: 'item', title: 'title.items', desc: 'home.itemsDesc', list: '/items', route: 'item' },
  {
    kind: 'condition',
    title: 'title.conditions',
    desc: 'home.conditionsDesc',
    list: '/conditions',
    route: 'condition',
  },
]

/** A section shows this many results at most, and links to its list, searched the same way, for the rest. */
const LIMIT = 8

interface Hit {
  id: string
  name: string
  parts: [string, string, string]
  to: RouteLocationRaw
}

/** Each category's entries matching the search, by name in the reader's language; categories without any left out. */
const results = computed(() => {
  const q = fold(query.value.trim())
  if (!q) return null
  const types = TYPES.flatMap((id) => {
    const parts = split(typeName(id), q)
    return parts ? [{ id, parts }] : []
  })
  // Names starting with the search first, then the rest, each alphabetically. Pokémon formes that only look different
  // are left to their species.
  const sections = SECTIONS.map((section) => {
    const ids: string[] = availableIds(section.kind)
    const hits = ids
      .filter((id) => section.kind !== 'pokemon' || !POKEMON[id as PokemonId].cosmetic)
      .flatMap((id): Hit[] => {
        const name = refName({ kind: section.kind, id } as Ref)
        const parts = split(name, q)
        return parts ? [{ id, name, parts, to: { name: section.route, params: { id } } }] : []
      })
      .sort((a, b) => +!!a.parts[0] - +!!b.parts[0] || a.name.localeCompare(b.name, locale.value))
    return { ...section, hits: hits.slice(0, LIMIT), more: Math.max(0, hits.length - LIMIT) }
  }).filter((s) => s.hits.length)
  return { types, sections }
})

/** The only result, if the search has exactly one: Enter opens it. */
const only = computed((): RouteLocationRaw | null => {
  const r = results.value
  if (!r) return null
  const hits = r.sections.flatMap((s) => s.hits)
  if (r.types.length === 1 && !hits.length) return `/types/${r.types[0]!.id}`
  if (hits.length === 1 && !r.types.length && !r.sections[0]!.more) return hits[0]!.to
  return null
})
function openOnly() {
  if (only.value) void router.push(only.value)
}

const short = (kind: SectionKind, id: string) => (isDescribed(kind) ? (description(kind, id)?.short ?? '') : '')

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
      <input
        v-model="query"
        type="search"
        class="search"
        :placeholder="t('home.search')"
        :aria-label="t('home.search')"
        @keydown.enter="openOnly"
      />
    </div>
    <template v-if="results">
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
              >
            </RouterLink>
          </li>
        </ul>
        <dl v-else class="entries">
          <template v-for="h in s.hits" :key="h.id">
            <dt>
              <RouterLink :to="h.to" class="entry-name">
                <ItemIcon v-if="s.kind === 'item'" :id="h.id as ItemId" />
                <span
                  >{{ h.parts[0] }}<mark>{{ h.parts[1] }}</mark
                  >{{ h.parts[2] }}</span
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
        <RouterLink to="/types" class="section-head">
          <span class="section-title font-display">{{ t('title.types') }} <span class="arrow">›</span></span>
        </RouterLink>
        <ul class="chip-hits">
          <li v-for="ty in results.types" :key="ty.id">
            <RouterLink :to="`/types/${ty.id}`" class="chip-hit">
              <TypeIcon :type="ty.id" />
              <span
                >{{ ty.parts[0] }}<mark>{{ ty.parts[1] }}</mark
                >{{ ty.parts[2] }}</span
              >
            </RouterLink>
          </li>
        </ul>
      </section>
      <p v-if="!results.types.length && !results.sections.length" class="muted none">{{ t('home.none') }}</p>
    </template>
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

.search {
  margin: 16px 0 0;
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
  .entries {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .entries dd {
    margin-bottom: 8px;
  }
}
</style>
