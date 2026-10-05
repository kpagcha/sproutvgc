<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ability, item, move, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import {
  currentSnapshots,
  has,
  loadMeta,
  metaLabel,
  percent,
  players,
  type MetaData,
  type MetaSnapshot,
} from '@/data/meta'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'

// The regulation's Pokémon by usage, from the meta snapshot shown: the first of `VITE_META_SETS` for the regulation,
// or the one picked (`?set=`) when there are several. Columns come and go with what the snapshot has. Its links are
// `AppLink`s and its icons functional components, as in the other dex tables.
const router = useRouter()
const query = useActiveQuery()
const snapshots = computed(currentSnapshots)
const snapshot = computed<MetaSnapshot | undefined>(
  () => snapshots.value.find((s) => s.id === query.value.set) ?? snapshots.value[0],
)
function pick(id: string) {
  const set = id === snapshots.value[0]?.id ? undefined : id
  void router.replace({ query: { ...query.value, set } })
}

const data = shallowRef<MetaData | null>(null)
watch(
  snapshot,
  async (s) => {
    data.value = null
    if (!s) return
    const d = await loadMeta(s)
    if (snapshot.value === s) data.value = d
  },
  { immediate: true },
)

const can = (c: Parameters<typeof has>[1]) => computed(() => !!snapshot.value && has(snapshot.value, c))
const showUsage = can('usage')
const showBrought = can('brought')
const showItem = can('items')
const showAbility = can('abilities')
const showMoves = can('moves')
/** Brought covers every player, whatever the snapshot's cutoff: said under the table. */
const broughtAll = computed(
  () => showBrought.value && snapshot.value?.unweighted?.includes('brought') && !!snapshot.value.cutoff,
)

const rows = computed(() =>
  Object.entries(data.value ?? {}).map(([key, m]) => {
    const id = key as PokemonId
    const { species, forme } = splitForme(id, refName(pokemon(id)))
    return {
      id,
      species,
      forme,
      name: refName(pokemon(id)),
      rank: m!.rank,
      usage: m!.usage,
      brought: m!.brought,
      // Its most common set, at a glance: item, ability and moves.
      item: m!.items?.[0] && item(m!.items[0].id),
      ability: m!.abilities?.[0] && ability(m!.abilities[0].id),
      moves: (m!.moves ?? []).slice(0, 3).map((x) => move(x.id)),
    }
  }),
)
type Row = (typeof rows.value)[number]
type Key = 'rank' | 'name' | 'usage' | 'brought'

const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => (k === 'name' ? r.name : k === 'rank' ? r.rank : (r[k] ?? -1)),
  initial: 'rank',
  startsDesc: (k) => k === 'usage' || k === 'brought',
  locale,
  remember: 'usage',
})

const search = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
const shown = computed(() => {
  const q = fold(search.value.trim())
  return q ? sorted.value.filter((r) => fold(r.name).includes(q)) : sorted.value
})
/** The most used, the full length of the usage bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage ?? 0)))

const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
// The columns, as the snapshot has them, and their widths on wide screens, on narrower ones and on phones (null where
// they're left out). On wide screens each Pokémon's most common set fills the room, its moves taking what's left; on
// narrower ones the usage bar does.
const columns = computed(() => {
  const set = showItem.value || showAbility.value || showMoves.value
  const list: { cell: string; xl: string | null; md: string | null; sm: string | null }[] = [
    { cell: 'r', xl: 'var(--num)', md: 'var(--num)', sm: 'var(--num)' },
    { cell: 'grow', xl: 'var(--name)', md: 'var(--name)', sm: 'minmax(0, 1fr)' },
    { cell: '', xl: 'var(--types)', md: 'var(--types)', sm: 'var(--types)' },
  ]
  if (showItem.value) list.push({ cell: 'xl-only', xl: 'auto', md: null, sm: null })
  if (showAbility.value) list.push({ cell: 'xl-only', xl: 'var(--ability)', md: null, sm: null })
  if (showMoves.value) list.push({ cell: 'xl-only', xl: 'minmax(0, 1fr)', md: null, sm: null })
  if (showUsage.value)
    list.push({
      cell: 'r',
      xl: set ? 'var(--usage)' : 'minmax(var(--usage), 1fr)',
      md: 'minmax(var(--usage), 1fr)',
      sm: 'var(--usage-sm)',
    })
  if (showBrought.value) list.push({ cell: 'wide-only r', xl: 'var(--num)', md: 'var(--num)', sm: null })
  return list
})
const skeleton = computed(() => columns.value.map((c) => c.cell))
const widths = (size: 'xl' | 'md' | 'sm') =>
  columns.value
    .map((c) => c[size])
    .filter(Boolean)
    .join(' ')
const colVars = computed(() => ({ '--cols-xl': widths('xl'), '--cols-md': widths('md'), '--cols-sm': widths('sm') }))
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.usage') }}</h1>
    <p class="muted">{{ t('usage.intro', { reg: REGULATION }) }}</p>
    <template v-if="snapshot">
      <div class="source">
        <select
          v-if="snapshots.length > 1"
          class="search pick"
          :value="snapshot.id"
          :aria-label="t('usage.source')"
          @change="pick(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ metaLabel(s) }}</option>
        </select>
        <span v-else class="label">{{ metaLabel(snapshot) }}</span>
        <span v-if="snapshot.battles" class="muted">
          {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
        </span>
      </div>
      <SearchBox v-model="search" :placeholder="t('usage.search')" :aria-label="t('usage.search')" />
      <div v-if="!data || shown.length" class="dex-table" :class="{ restoring }" :style="colVars" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader
            :label="t('usage.rank')"
            :tip="t('usage.rankFull')"
            right
            :active="key === 'rank'"
            :desc="desc"
            @sort="toggle('rank')"
          />
          <SortHeader :label="t('usage.pokemon')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader">{{ t('pokedex.types') }}</div>
          <div v-if="showItem" role="columnheader" class="xl-only">{{ t('usage.item') }}</div>
          <div v-if="showAbility" role="columnheader" class="xl-only">{{ t('usage.ability') }}</div>
          <div v-if="showMoves" role="columnheader" class="xl-only">{{ t('usage.moves') }}</div>
          <SortHeader
            v-if="showUsage"
            :label="t('usage.usage')"
            :tip="t('usage.usageTip')"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
          <SortHeader
            v-if="showBrought"
            class="wide-only"
            :label="t('usage.brought')"
            :tip="t('usage.broughtTip')"
            right
            :active="key === 'brought'"
            :desc="desc"
            @sort="toggle('brought')"
          />
        </div>
        <SkeletonRows v-if="!entered || !data" :cells="skeleton" height="2.3em" />
        <template v-else>
          <div v-for="r in shown" :key="r.id" class="row" role="row">
            <div role="cell" class="r num muted">{{ r.rank }}</div>
            <div role="cell" class="grow">
              <AppLink :to="{ name: 'pokemon', params: { id: r.id } }" class="mon">
                <PokemonIcon :id="r.id" />
                <span class="label">
                  <span class="name">{{ r.species }}</span>
                  <span v-if="r.forme" class="forme">{{ r.forme }}</span>
                </span>
              </AppLink>
            </div>
            <div role="cell">
              <span class="types">
                <AppLink v-for="ty in POKEMON[r.id].types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
                  <TypeIcon :type="ty" />
                </AppLink>
              </span>
            </div>
            <div v-if="showItem" role="cell" class="xl-only">
              <AppLink
                v-if="r.item"
                v-tip:group="refName(r.item)"
                :to="{ name: 'item', params: { id: r.item.id } }"
                class="item"
                :aria-label="refName(r.item)"
              >
                <ItemIcon :id="r.item.id" />
              </AppLink>
            </div>
            <div v-if="showAbility" role="cell" class="xl-only clip">
              <DexRef v-if="r.ability" :to="r.ability" />
            </div>
            <div v-if="showMoves" role="cell" class="xl-only clip">
              <template v-for="(m, i) in r.moves" :key="m.id"
                ><span v-if="i" class="sep" aria-hidden="true"> · </span><DexRef :to="m"
              /></template>
            </div>
            <div v-if="showUsage" role="cell" class="r num usage">
              <span class="bar" aria-hidden="true"
                ><span :style="{ width: `${((r.usage ?? 0) / (top || 1)) * 100}%` }"></span
              ></span>
              {{ r.usage === undefined ? '—' : percent(r.usage) }}
            </div>
            <div v-if="showBrought" role="cell" class="wide-only r num">
              {{ r.brought === undefined ? '—' : percent(r.brought) }}
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('usage.noMatch') }}</p>
      <p v-if="broughtAll && snapshot.cutoff" class="muted note">
        {{ t('usage.broughtAll', { players: players(snapshot.cutoff) }) }}
      </p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </template>
    <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
/* Rank, name, types (room for two badges), the most common set on wide screens (item, ability, moves), usage (its
   bar and number) and brought; on phones without brought. The names don't size their column (the rows take the
   header's widths, see `.dex-table`), so it's as wide as most names, and the longest wrap their forme. */
.dex-table {
  --types: calc(64px * var(--icon-scale, 1) + 14px);
  --num: minmax(3em, auto);
  --name: 13em;
  --ability: 9em;
  --usage: 10em;
  --usage-sm: 6.5em;
  --bar-max: none;
  --row-height: 2.3em;
  --cols: var(--cols-md);
}
@media (min-width: 1100px) {
  .dex-table {
    --cols: var(--cols-xl);
    --bar-max: 4.5em;
  }
}
@media (max-width: 1099px) {
  .dex-table .xl-only {
    display: none;
  }
}
@media (max-width: 720px) {
  .dex-table {
    --icon-scale: 1.25;
    --cols: var(--cols-sm);
  }
}
.clip {
  overflow: hidden;
  text-overflow: ellipsis;
}
.sep {
  color: var(--muted);
}
.item {
  display: inline-flex;
  vertical-align: middle;
}
.source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 12px;
}
.source .label {
  font-weight: bold;
}
.pick {
  width: auto;
  margin: 0;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  /* The icon is taller than the row: let it into the cell's padding, but no further. */
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
.types {
  display: flex;
  gap: 2px;
}
.usage {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-weight: bold;
}
/* The share against the most used Pokémon's, so the top of the meta reads at a glance. */
.bar {
  flex: 1;
  max-width: var(--bar-max);
  height: 0.5em;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.bar > span {
  display: block;
  height: 100%;
  background: var(--accent);
}
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
