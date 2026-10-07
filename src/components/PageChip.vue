<script lang="ts">
import type { PageVisit } from '@/composables/useRecent'
import { router } from '@/router'
import { POKEMON } from '@/data/pokemon'
import type { PokemonId } from '@/data/dex'
import { isType, type TypeId } from '@/data/types'

/** The Pokémon a query names, if the regulation has it. */
const mon = (id: string | undefined) => (id && id in POKEMON ? (id as PokemonId) : null)
const typesOf = (v: string | undefined, max: number): TypeId[] =>
  [...new Set((v ?? '').split(',').filter(isType)).values()].slice(0, max)

/** What a page visited shows of itself: its route, and the Pokémon or types that tell it apart. */
function view(visit: PageVisit) {
  const to = router.resolve({ path: visit.path, query: visit.query })
  const q = visit.query
  const name = String(to.name ?? '')
  return {
    to,
    titleKey: to.meta.titleKey,
    pair: name === 'speedCompare' ? ([mon(q.a), mon(q.b)] as const) : null,
    mine: name === 'speedTiers' ? mon(q.mine) : null,
    types: name.startsWith('matchups') ? (typesOf(q.def, 2).length ? typesOf(q.def, 2) : typesOf(q.atk, 4)) : [],
  }
}

/** Whether a page visited can still be shown: a page that still exists, a comparison of two the regulation has. */
export function shownVisit(visit: PageVisit) {
  const v = view(visit)
  return !!v.titleKey && (!v.pair || (!!v.pair[0] && !!v.pair[1]))
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { pokemon } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { follow } from '@/lib/links'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// A page the reader left with a view of its own (in its URL), as a chip reopening it as it was: the home page's
// recently viewed, beside the dex entries' chips (`EntryChip`), in their style. A comparison is its two Pokémon; any
// other page its name, with the Pokémon picked on it (the speed tiers' yours) or its types (the type matchups').
const props = defineProps<{ visit: PageVisit }>()
const v = computed(() => view(props.visit))
</script>

<template>
  <a :href="v.to.href" class="page-chip" @click="follow">
    <template v-if="v.pair"
      ><PokemonIcon :id="v.pair[0]!" />{{ refName(pokemon(v.pair[0]!)) }}<span class="muted">vs</span
      ><PokemonIcon :id="v.pair[1]!" />{{ refName(pokemon(v.pair[1]!)) }}</template
    >
    <template v-else>
      {{ t(v.titleKey!) }}
      <PokemonIcon v-if="v.mine" :id="v.mine" />
      <TypeIcon v-for="ty in v.types" :key="ty" :type="ty" />
    </template>
  </a>
</template>

<style scoped>
/* As `EntryChip`'s: type badges at their desktop size on phones too, the chip's height the icons'. */
.page-chip {
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.page-chip:hover {
  text-decoration: none;
  background: var(--hover);
  border-color: var(--border-strong);
}
.page-chip :deep(.sheet-icon) {
  margin: -4px 0;
}
</style>
