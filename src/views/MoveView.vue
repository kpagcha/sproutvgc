<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { available, move, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { isSpread, MOVES } from '@/data/moves'
import { POKEMON, loadLearnsets } from '@/data/pokemon'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import CategoryIcon from '@/components/CategoryIcon'
import DexText from '@/components/DexText'
import PokemonChips from '@/components/PokemonChips.vue'
import RefInteractions from '@/components/RefInteractions.vue'
import SearchBox from '@/components/SearchBox.vue'
import TypeIcon from '@/components/TypeIcon'

// One move: its numbers, whom it hits, its description and flags, what it does to types beyond the chart, and the
// legal Pokémon that learn it.
const route = useRoute()
const id = computed(() => String(route.params.id) as MoveId)
const ref_ = computed(() => move(id.value))
const exists = computed(() => available(ref_.value))
const data = computed(() => MOVES[id.value])
const text = computed(() => description('move', id.value))

const priority = computed(() => (data.value.priority > 0 ? `+${data.value.priority}` : String(data.value.priority)))

// The Pokémon that learn it, by species: formes a battle brings out (Megas) learn what their base forme does, and
// formes that only look different what their species does, so they'd only repeat it.
const learners = ref<PokemonId[]>([])
const query = ref('')
watchEffect(async () => {
  const current = id.value
  const sets = await loadLearnsets()
  if (id.value !== current) return
  query.value = ''
  learners.value = (Object.keys(sets) as PokemonId[]).filter(
    (p) => !POKEMON[p].battleOnly && !POKEMON[p].cosmetic && sets[p].includes(current),
  )
})
</script>

<template>
  <div class="panel">
    <template v-if="exists">
      <h1>{{ refName(ref_) }}</h1>
      <div class="badges">
        <RouterLink :to="{ name: 'types', params: { type: data.type } }"
          ><TypeIcon :type="data.type" :scale="2"
        /></RouterLink>
        <CategoryIcon :category="data.category" :scale="2" />
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
        <li v-for="f in data.flags" :key="f" v-tip="t(`move.flagTip.${f}`)">{{ t(`move.flag.${f}`) }}</li>
      </ul>

      <RefInteractions :to="ref_" />

      <section v-if="learners.length">
        <h2>{{ t('move.pokemon', { n: learners.length }) }}</h2>
        <SearchBox v-model="query" :placeholder="t('pokedex.search')" :aria-label="t('pokedex.search')" />
        <PokemonChips :ids="learners" :query />
      </section>
    </template>
    <p v-else>{{ t('move.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
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
.flags li {
  padding: 1px 6px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: help;
}
section {
  margin-top: 16px;
}
</style>
