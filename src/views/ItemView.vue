<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { available, item, pokemon, type ItemId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { ITEMS } from '@/data/items'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import DexText from '@/components/DexText.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon.vue'
import RefInteractions from '@/components/RefInteractions.vue'

// One item: its description, the Mega Evolutions it brings out or the Pokémon it's for, and what it does to types
// beyond the chart.
const route = useRoute()
const id = computed(() => String(route.params.id) as ItemId)
const ref_ = computed(() => item(id.value))
const exists = computed(() => available(ref_.value))
const data = computed(() => ITEMS[id.value])
const text = computed(() => description('item', id.value))
const megas = computed(() => Object.entries(data.value.megas ?? {}) as [PokemonId, PokemonId][])
</script>

<template>
  <div class="panel">
    <template v-if="exists">
      <div class="head">
        <ItemIcon :id="id" :scale="2" />
        <div>
          <h1>{{ refName(ref_) }}</h1>
          <span class="muted">{{ t(`items.kind1.${data.kind}`) }}</span>
        </div>
      </div>
      <p v-if="text"><DexText :text="text.long ?? text.short" /></p>

      <section v-if="megas.length">
        <h2>{{ t('item.megas') }}</h2>
        <ul class="megas">
          <li v-for="[from, to] in megas" :key="to">
            <RouterLink :to="{ name: 'pokemon', params: { id: from } }" class="mon">
              <PokemonIcon :id="from" />{{ refName(pokemon(from)) }}
            </RouterLink>
            <span class="muted" aria-hidden="true">→</span>
            <RouterLink :to="{ name: 'pokemon', params: { id: to } }" class="mon">
              <PokemonIcon :id="to" />{{ refName(pokemon(to)) }}
            </RouterLink>
          </li>
        </ul>
      </section>
      <section v-if="data.users?.length">
        <h2>{{ t('item.users') }}</h2>
        <PokemonChips :ids="data.users" />
      </section>

      <RefInteractions :to="ref_" />
    </template>
    <p v-else>{{ t('item.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.head h1 {
  margin: 0;
}
section {
  margin-top: 16px;
}
.megas {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.megas li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
</style>
