<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { locale, t, typeName } from '@/i18n'
import { GAME_NAME, REGULATION } from '@/data/format'
import { ability, availableIds } from '@/data/dex'
import { TYPES } from '@/data/types'
import { description, loadDescriptions } from '@/i18n/descriptions'
import { loadDexNames, refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import TypeIcon from '@/components/TypeIcon.vue'
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
  void loadDescriptions(['ability'])
})

/** Each category's entries matching the search, by name in the reader's language; categories without any left out. */
const results = computed(() => {
  const q = fold(query.value.trim())
  if (!q) return null
  const types = TYPES.flatMap((id) => {
    const name = typeName(id)
    const parts = split(name, q)
    return parts ? [{ id, parts }] : []
  })
  // Names starting with the search first, then the rest, each alphabetically.
  const abilities = availableIds('ability')
    .flatMap((id) => {
      const name = refName(ability(id))
      const parts = split(name, q)
      return parts ? [{ id, name, parts, text: description('ability', id)?.short ?? '' }] : []
    })
    .sort((a, b) => +!!a.parts[0] - +!!b.parts[0] || a.name.localeCompare(b.name, locale.value))
  return { types, abilities }
})

/** The only result, if the search has exactly one: Enter opens it. */
const only = computed((): RouteLocationRaw | null => {
  const r = results.value
  if (!r) return null
  if (r.types.length === 1 && !r.abilities.length) return `/types/${r.types[0]!.id}`
  if (r.abilities.length === 1 && !r.types.length) return { name: 'ability', params: { id: r.abilities[0]!.id } }
  return null
})
function openOnly() {
  if (only.value) void router.push(only.value)
}
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
      <section v-if="results.types.length" class="panel section">
        <RouterLink to="/types" class="section-head">
          <span class="section-title font-display">{{ t('title.types') }} <span class="arrow">›</span></span>
        </RouterLink>
        <ul class="type-hits">
          <li v-for="ty in results.types" :key="ty.id">
            <RouterLink :to="`/types/${ty.id}`" class="type-hit">
              <TypeIcon :type="ty.id" />
              <span
                >{{ ty.parts[0] }}<mark>{{ ty.parts[1] }}</mark
                >{{ ty.parts[2] }}</span
              >
            </RouterLink>
          </li>
        </ul>
      </section>
      <section v-if="results.abilities.length" class="panel section">
        <RouterLink to="/abilities" class="section-head">
          <span class="section-title font-display">{{ t('title.abilities') }} <span class="arrow">›</span></span>
        </RouterLink>
        <dl class="entries">
          <template v-for="a in results.abilities" :key="a.id">
            <dt>
              <RouterLink :to="{ name: 'ability', params: { id: a.id } }"
                >{{ a.parts[0] }}<mark>{{ a.parts[1] }}</mark
                >{{ a.parts[2] }}</RouterLink
              >
            </dt>
            <dd class="muted"><DexText :text="a.text" /></dd>
          </template>
        </dl>
      </section>
      <p v-if="!results.types.length && !results.abilities.length" class="muted none">{{ t('home.none') }}</p>
    </template>
    <template v-else>
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
      <section class="panel section">
        <RouterLink to="/abilities" class="section-head">
          <span class="section-text">
            <span class="section-title font-display">{{ t('title.abilities') }} <span class="arrow">›</span></span>
            <span class="muted">{{ t('home.abilitiesDesc') }}</span>
          </span>
        </RouterLink>
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
.type-hits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.type-hit {
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
