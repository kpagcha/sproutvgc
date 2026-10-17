<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { ability, available, pokemon, type AbilityId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { datasetDates, has, percent } from '@/data/meta'
import { POKEMON, splitForme } from '@/data/pokemon'
import { locale, t, typeName } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { points, ranksOf, standings, STEADY, usageOf, usersOf } from '@/lib/entryUsage'
import { useMeta } from '@/composables/useMeta'
import { usePreviousMeta } from '@/composables/usePreviousMeta'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexText from '@/components/DexText'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'
import SortHeader from '@/components/SortHeader.vue'

// An ability's meta page, its dex entry's sibling (each links to the other): how it's used in the meta snapshot shown
// (`useMeta`): its rank among the abilities and its usage, the teams running it (`entryUsage.ts`, as the ability
// rankings count it), with their change since the dataset before; then every Pokémon whose sets run it, with how often
// they do and the usage they bring it; and those that can have it but whose sets don't.
const route = useRoute()
const id = computed(() => String(route.params.id) as AbilityId)
const ref = computed(() => ability(id.value))
const exists = computed(() => available(ref.value))
const text = computed(() => description('ability', id.value))

const { snapshot, data, loading } = useMeta()
const hasAbilities = computed(() => !!snapshot.value && has(snapshot.value, 'abilities'))
const { previous, prevData } = usePreviousMeta(snapshot)

const all = computed(() => usersOf(data.value ?? {}, 'abilities'))
const users = computed(() => all.value.get(id.value) ?? [])
const usage = computed(() => usageOf(users.value))
const rank = computed(() => ranksOf(all.value).get(id.value))
/** Its rank and usage in the dataset before, and their change: undefined until that's in, or with none. */
const then = computed(() => {
  if (!prevData.value) return undefined
  const s = standings(prevData.value, 'abilities')
  const prevRank = s.ranks.get(id.value)
  return {
    climb: prevRank === undefined || rank.value === undefined ? undefined : prevRank - rank.value,
    fresh: prevRank === undefined,
    change: usage.value - (s.usage.get(id.value) ?? 0),
  }
})

const rows = computed(() =>
  users.value.map((u) => {
    const { species, forme } = splitForme(u.id, refName(pokemon(u.id)))
    return { ...u, species, forme, name: refName(pokemon(u.id)) }
  }),
)
type Row = (typeof rows.value)[number]
type Key = 'name' | 'share' | 'usage'
const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => r[k],
  initial: 'usage',
  startsDesc: (k) => k !== 'name',
  locale,
  remember: 'metaAbility',
})
/** The most it brings, the full length of the bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage)))

/** The Pokémon in the data that can have it but whose sets don't run it, by usage. */
const idle = computed(() =>
  Object.entries(data.value ?? {})
    .filter(([mon]) => POKEMON[mon as PokemonId].abilities.includes(id.value))
    .filter(([mon]) => !users.value.some((u) => u.id === mon))
    .sort((a, b) => a[1]!.rank - b[1]!.rank)
    .map(([mon]) => mon as PokemonId),
)

useRowColumns(useTemplateRef('head'))
</script>

<template>
  <template v-if="exists">
    <!-- The data shown, on the row of the way back: what the whole page is of. -->
    <Teleport to="#back-actions-metaAbility" defer>
      <MetaDialog />
    </Teleport>

    <!-- The heading: its name and the way to its dex entry, what it does, and how much it's used. -->
    <div class="panel" :class="{ 'meta-stale': loading }">
      <div class="title-row">
        <h1>{{ refName(ref) }}</h1>
        <AppLink :to="{ name: 'ability', params: { id } }" class="other-page">{{ t('pokemon.dex') }} ›</AppLink>
      </div>
      <p v-if="text" class="muted desc"><DexText :text="text.short" /></p>
      <p v-if="hasAbilities && rank !== undefined" class="used">
        <span class="used-part"
          >{{ t('usage.rank') }}<b class="num">{{ rank }}</b
          ><span
            v-if="then?.climb"
            class="climb"
            :class="then.climb > 0 ? 'up' : 'down'"
            :aria-label="t(then.climb > 0 ? 'usage.up' : 'usage.down')"
            >{{ then.climb > 0 ? '▲' : '▼' }}{{ Math.abs(then.climb) }}</span
          ><span v-else-if="then?.fresh" class="climb fresh">{{ t('usage.new') }}</span></span
        >
        <span class="used-part"
          >{{ t('usage.usage') }} <b v-tip="t('abilityUsage.usageTip')" class="num">{{ percent(usage) }}</b
          ><span
            v-if="then && previous"
            v-tip="t('usage.changeTip', { dates: datasetDates(previous) })"
            class="change num"
            :class="Math.abs(then.change) >= STEADY && (then.change > 0 ? 'up' : 'down')"
            >{{ points(then.change) }}</span
          ></span
        >
        <span class="used-part muted">{{ t('metaAbility.runBy', { n: users.length }) }}</span>
      </p>
      <p v-else-if="hasAbilities && data" class="muted">{{ t('metaAbility.none', { name: refName(ref) }) }}</p>
      <p v-else-if="!hasAbilities" class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>

    <!-- The Pokémon whose sets run it. -->
    <div v-if="hasAbilities && rows.length" class="panel" :class="{ 'meta-stale': loading }" :aria-busy="loading">
      <h2>{{ t('metaAbility.pokemon') }}</h2>
      <div class="dex-table" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader :label="t('usage.pokemon')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader" class="wide-only">{{ t('pokedex.types') }}</div>
          <SortHeader
            :label="t('metaAbility.share')"
            :tip="t('metaAbility.shareTip', { name: refName(ref) })"
            right
            :active="key === 'share'"
            :desc="desc"
            @sort="toggle('share')"
          />
          <SortHeader
            :label="t('metaAbility.brings')"
            :tip="t('metaAbility.bringsTip', { name: refName(ref) })"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
        </div>
        <div v-for="r in sorted" :key="r.id" class="row" role="row">
          <div role="cell" class="grow">
            <AppLink :to="{ name: 'metaPokemon', params: { id: r.id } }" class="mon">
              <PokemonIcon :id="r.id" />
              <span class="label">
                <span class="name">{{ r.species }}</span>
                <span v-if="r.forme" class="forme">{{ r.forme }}</span>
              </span>
            </AppLink>
          </div>
          <div role="cell" class="wide-only">
            <span class="types">
              <AppLink v-for="ty in POKEMON[r.id].types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
                <TypeIcon v-tip:group="typeName(ty)" :type="ty" />
              </AppLink>
            </span>
          </div>
          <div role="cell" class="r num meter faint" :style="{ '--share': r.share }">{{ percent(r.share) }}</div>
          <div role="cell" class="r num meter brings" :style="{ '--share': r.usage / (top || 1) }">
            {{ percent(r.usage) }}
          </div>
        </div>
      </div>
      <!-- Those that could, but don't. -->
      <template v-if="idle.length">
        <p class="muted note">{{ t('metaAbility.idle') }}</p>
        <div class="idle">
          <AppLink
            v-for="mon in idle"
            :key="mon"
            v-tip:group="refName(pokemon(mon))"
            :to="{ name: 'metaPokemon', params: { id: mon } }"
            :aria-label="refName(pokemon(mon))"
          >
            <PokemonIcon :id="mon" />
          </AppLink>
        </div>
      </template>
      <p v-if="snapshot" class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </template>
  <div v-else class="panel">
    <p>{{ t('ability.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.desc {
  margin: 0 0 8px;
}
/* How much it's used: its rank, usage and how many Pokémon run it, on a line. */
.used {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 0;
}
.used-part b {
  margin-left: 4px;
}
.climb,
.change {
  margin-left: 4px;
  font-size: 0.8em;
}
.change {
  color: var(--muted);
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
.fresh {
  color: var(--accent);
  font-weight: bold;
}
/* The Pokémon, its types (room for two badges), the share of its sets running it and what it brings it. The names'
   column as wide as most names (the longest wrap their forme), the types right after it, taking the room left, so
   they stay by the names rather than the numbers. */
.dex-table {
  --types: calc(64px * var(--icon-scale, 1) + 14px);
  --cols: minmax(0, 15em) minmax(var(--types), 1fr) 6em 6em;
  --row-height: 2.3em;
}
@media (max-width: 720px) {
  .dex-table {
    --cols: minmax(0, 1fr) minmax(4.2em, auto) minmax(4.2em, auto);
  }
}
.types {
  display: flex;
  gap: 2px;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin: -3px 0;
}
.label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
}
.forme {
  padding: 0 5px;
  font-size: 0.85em;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
/* As the rankings': a bar along the bottom of the cell (`--share`, 0 to 1); what it brings solid, against the most a
   Pokémon brings it; the share of its sets, a rate of its own, thinner and muted. */
.meter {
  --inset: 6px;
  position: relative;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: var(--inset);
}
.meter::before {
  right: var(--inset);
  bottom: 4px;
  height: 1px;
  background: var(--border);
}
.meter::after {
  bottom: 3px;
  width: calc((100% - 2 * var(--inset)) * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
.meter.faint::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.brings {
  font-weight: bold;
}
.idle {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
}
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
