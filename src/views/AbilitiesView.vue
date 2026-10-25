<script setup lang="ts">
import Marked from '@/components/Marked'
import { computed, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { ability, availableIds, type AbilityId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { REGULATION } from '@/data/format'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, marksKey, split } from '@/lib/search'
import { passesGroups } from '@/lib/filterGroups'
import type { Term, TermFilters } from '@/lib/searchTerms'
import { useGradualRows } from '@/composables/useGradualRows'
import { useUrlFilters } from '@/composables/useUrlFilters'
import AppLink from '@/components/AppLink'
import DexText from '@/components/DexText'
import FilterSearch from '@/components/FilterSearch.vue'

// Every ability the regulation has, by name in the reader's language, with its short description.
const abilities = computed(() =>
  availableIds('ability')
    .map((id) => ({ id, name: refName(ability(id)), text: description('ability', id)?.short ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
)

// The search (`FilterSearch`): its text finds abilities by name (the home page's search links here with it, `?q=`),
// and the Pokémon to filter them by, those it can have (`?f=`, `?fm=`).
const initial = useRoute().query.q
const query = ref(typeof initial === 'string' ? initial : '')
const KINDS = ['pokemon'] as const
const filters = useUrlFilters(() => KINDS)
const preview = shallowRef<TermFilters | null>(null)
const matches = (id: AbilityId, f: Term) => f.kind === 'pokemon' && POKEMON[f.id].abilities.includes(id)
const passes = (id: AbilityId, f: TermFilters) => passesGroups(f, (x) => matches(id, x))
const count = (f: TermFilters) => abilities.value.filter((a) => passes(a.id, f)).length
const named = computed(() => {
  const q = fold(query.value.trim())
  return q ? abilities.value.filter((a) => split(a.name, q) && passes(a.id, filters.value)).length : 0
})
const shown = computed(() => {
  const q = preview.value ? '' : fold(query.value.trim())
  return abilities.value.flatMap((a) => {
    if (!passes(a.id, preview.value ?? filters.value)) return []
    const parts = q ? split(a.name, q) : null
    return !q || parts ? [{ ...a, parts }] : []
  })
})
const drawn = useGradualRows(shown)
</script>

<template>
  <!-- The heading and the search, and the list, in panels of their own on phones, one panel on wider screens. -->
  <div class="panels">
    <div class="panel">
      <!-- Their usage rankings, as they link here. -->
      <div class="title-row">
        <h1>{{ t('title.abilities') }}</h1>
        <RouterLink :to="{ name: 'abilityRankings' }" class="other-page">{{ t('lists.toMeta') }} ›</RouterLink>
      </div>
      <p class="muted">{{ t('abilities.intro', { reg: REGULATION }) }}</p>
      <FilterSearch
        v-model:text="query"
        v-model:filters="filters"
        v-model:preview="preview"
        class="list-search"
        :subject="t('filter.subject.abilities')"
        :name-count="named"
        :kinds="KINDS"
        :count
      />
    </div>
    <div class="panel" :class="{ previewing: preview }">
      <!-- Hidden while it's empty, not taken out: its rows' memo (`v-memo`) outlives it, and taken out and put back, they'd be drawn from rows already gone. -->
      <dl v-show="shown.length" class="entries">
        <!-- Each entry drawn again only when what it shows changes, not with every change to the page (the search's text,
             its options, the count it shows). -->
        <div v-for="a in drawn" :key="a.id" class="entry" v-memo="[a.id, a.name, a.text, marksKey(a.parts)]">
          <dt>
            <AppLink :to="{ name: 'ability', params: { id: a.id } }">
              <Marked v-if="a.parts" :p="a.parts" />
              <template v-else>{{ a.name }}</template>
            </AppLink>
          </dt>
          <dd class="muted"><DexText :text="a.text" /></dd>
        </div>
      </dl>
      <p v-if="!shown.length" class="muted">{{ t('abilities.none') }}</p>
    </div>
  </div>
</template>

<style scoped>
.list-search {
  margin-bottom: 12px;
}
.previewing .entries {
  opacity: 0.75;
}
.entries {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}
/* Each entry its name and what it does, laid out by the list's grid. */
.entry {
  display: contents;
}
.entries dt {
  font-weight: bold;
}
.entries dd {
  margin: 0;
}
/* One column on phones: the name above its description. */
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
