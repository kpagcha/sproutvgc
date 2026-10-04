<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ability, available, type AbilityId, type PokemonId } from '@/data/dex'
import HOLDERS from '@/data/generated/abilities.holders.json'
import { REGULATION } from '@/data/format'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import EntryTitle from '@/components/EntryTitle.vue'
import DexText from '@/components/DexText'
import PokemonChips from '@/components/PokemonChips.vue'
import RefInteractions from '@/components/RefInteractions.vue'

// One ability: its description, what it does to types beyond the chart, and the legal Pokémon that can have it.
const route = useRoute()
const id = computed(() => String(route.params.id))
const ref = computed(() => ability(id.value as AbilityId))
const exists = computed(() => available(ref.value))

const text = computed(() => description('ability', id.value))
const holders = computed(() => (HOLDERS as Record<string, PokemonId[]>)[id.value] ?? [])
</script>

<template>
  <div class="panel">
    <template v-if="exists">
      <EntryTitle :to="ref" />
      <!-- The long description; the short one is for the list, and stands in when there's nothing more to say. -->
      <p v-if="text"><DexText :text="text.long ?? text.short" /></p>

      <RefInteractions :to="ref" />

      <section v-if="holders.length">
        <h2>{{ t('ability.pokemon') }}</h2>
        <PokemonChips :ids="holders" />
      </section>
    </template>
    <p v-else>{{ t('ability.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
section {
  margin-top: 16px;
}
</style>
