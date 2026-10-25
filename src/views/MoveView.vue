<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { available, move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { isSpread, MOVES, moveTag } from '@/data/moves'
import { POKEMON, loadLearnsets } from '@/data/pokemon'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { noFilters } from '@/lib/filterGroups'
import { passes } from '@/lib/pokemonFilters'
import { fold, split } from '@/lib/search'
import type { TermFilters } from '@/lib/searchTerms'
import CategoryIcon from '@/components/CategoryIcon'
import EntryTitle from '@/components/EntryTitle.vue'
import MoveTag, { moveTagTip } from '@/components/MoveTag'
import DexText from '@/components/DexText'
import PokemonChips from '@/components/PokemonChips.vue'
import RefInteractions from '@/components/RefInteractions.vue'
import FilterSearch from '@/components/FilterSearch.vue'
import TypeIcon from '@/components/TypeIcon'

// One move: its numbers, whom it hits, its description and flags, what it does to types beyond the chart, and the
// legal Pokémon that learn it.
const route = useRoute()
const id = computed(() => String(route.params.id) as MoveId)
const ref_ = computed(() => move(id.value))
const exists = computed(() => available(ref_.value))
const data = computed(() => MOVES[id.value])
const text = computed(() => description('move', id.value))
const tag = computed(() => moveTag(data.value))

const priority = computed(() => (data.value.priority > 0 ? `+${data.value.priority}` : String(data.value.priority)))

// The Pokémon that learn it, by species: formes a battle brings out (Megas) learn what their base forme does, and
// formes that only look different what their species does, so they'd only repeat it.
const learners = ref<PokemonId[]>([])
// Searched and filtered by type or ability, as the Pokémon list is (`FilterSearch`); cleared on another move's page.
const query = ref('')
const KINDS = ['type', 'ability'] as const
const filters = shallowRef<TermFilters>(noFilters())
const preview = shallowRef<TermFilters | null>(null)
const count = (f: TermFilters) => learners.value.filter((p) => passes(p, f, null)).length
const named = computed(() => {
  const q = fold(query.value.trim())
  return q ? learners.value.filter((p) => split(refName(pokemon(p)), q) && passes(p, filters.value, null)).length : 0
})
const shownLearners = computed(() => learners.value.filter((p) => passes(p, preview.value ?? filters.value, null)))
watchEffect(async () => {
  const current = id.value
  const sets = await loadLearnsets()
  if (id.value !== current) return
  query.value = ''
  filters.value = noFilters()
  learners.value = (Object.keys(sets) as PokemonId[]).filter(
    (p) => !POKEMON[p].battleOnly && !POKEMON[p].cosmetic && sets[p].includes(current),
  )
})
</script>

<template>
  <div class="panel">
    <template v-if="exists">
      <!-- Its meta page. -->
      <div class="title-row">
        <EntryTitle :to="ref_" />
        <RouterLink :to="{ name: 'metaMove', params: { id } }" class="other-page">{{ t('pokemon.meta') }} ›</RouterLink>
      </div>
      <div class="badges">
        <RouterLink :to="{ name: 'types', params: { type: data.type } }"
          ><TypeIcon :type="data.type" :scale="2"
        /></RouterLink>
        <RouterLink :to="{ name: 'moves', query: { f: `category:${data.category}` } }"
          ><CategoryIcon :category="data.category" :scale="2"
        /></RouterLink>
        <RouterLink v-if="tag?.of" v-tip="moveTagTip(tag)" :to="{ name: 'pokemon', params: { id: tag.of } }" class="tag"
          ><MoveTag :tag
        /></RouterLink>
        <MoveTag v-else-if="tag" v-tip="moveTagTip(tag)" class="tag" :tag />
      </div>
      <dl class="numbers">
        <div>
          <dt class="muted">{{ t('move.power') }}</dt>
          <dd class="num">{{ data.power || '—' }}</dd>
        </div>
        <div>
          <dt class="muted">{{ t('move.accuracy') }}</dt>
          <dd class="num">{{ data.accuracy === true ? '—' : `${data.accuracy}%` }}</dd>
        </div>
        <div>
          <dt class="muted">{{ t('move.pp') }}</dt>
          <dd class="num">{{ data.pp }}</dd>
        </div>
        <div>
          <dt class="muted">{{ t('move.priority') }}</dt>
          <dd class="num">{{ priority }}</dd>
        </div>
        <div class="target">
          <dt class="muted">{{ t('move.target') }}</dt>
          <dd>{{ t(`move.target.${data.target}`) }}</dd>
        </div>
      </dl>
      <p v-if="text"><DexText :text="text.long ?? text.short" /></p>
      <p v-if="isSpread(data)" class="muted">{{ t('move.spread') }}</p>
      <ul v-if="data.flags.length" class="flags">
        <li v-for="f in data.flags" :key="f" v-tip="t(`move.flagTip.${f}`)">
          <RouterLink :to="{ name: 'moves', query: { f: `flag:${f}` } }">{{ t(`move.flag.${f}`) }}</RouterLink>
        </li>
      </ul>

      <RefInteractions :to="ref_" />

      <section v-if="learners.length">
        <h2>{{ t('move.pokemon', { n: learners.length }) }}</h2>
        <FilterSearch
          v-model:text="query"
          v-model:filters="filters"
          v-model:preview="preview"
          class="list-search"
          :subject="t('filter.subject.pokemon')"
          :name-count="named"
          :kinds="KINDS"
          :count
        />
        <PokemonChips :ids="shownLearners" :query="preview ? '' : query" :class="{ previewing: preview }" />
      </section>
    </template>
    <p v-else>{{ t('move.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.list-search {
  margin-bottom: 12px;
}
.previewing {
  opacity: 0.75;
}
.badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
/* How few learn it: its tag, a size up with the badges. */
.tag {
  font-size: 1.15em;
}
.numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0 0 12px;
}
.numbers dd {
  margin: 0;
  font-weight: bold;
}
.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.flags a {
  display: block;
  padding: 1px 6px;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.flags a:hover {
  border-color: var(--accent);
  text-decoration: none;
}
section {
  margin-top: 16px;
}
</style>
