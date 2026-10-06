<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { ability, item, move, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { has, percent, players } from '@/data/meta'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'

// The regulation's Pokémon by usage, from the meta snapshot shown (`useMeta`: the one picked, on this page or another,
// when there are several). Columns come and go with what the snapshot has. Its links are `AppLink`s and its icons
// functional components, as in the other dex tables.
const query = useActiveQuery()
const { snapshot, data } = useMeta()

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

// Each Pokémon's most common set, where its columns don't fit (under 1100px), shows on a line of its own under the
// row only when the reader asks for it (`Sets`, remembered), so the list stays easy to scan down.
const hasSets = computed(() => showItem.value || showAbility.value || showMoves.value)
const SETS_KEY = 'sproutvgc.usage.sets'
function savedSets(): boolean {
  try {
    return localStorage.getItem(SETS_KEY) === '1'
  } catch {
    return false
  }
}
const showSets = shallowRef(savedSets())
function toggleSets() {
  showSets.value = !showSets.value
  try {
    localStorage.setItem(SETS_KEY, showSets.value ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}

const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
// The columns, as the snapshot has them, and their widths on wide screens, on narrower ones and on phones (null where
// they're left out). On wide screens each Pokémon's most common set fills the room, its moves taking what's left; on
// narrower ones the names do.
const columns = computed(() => {
  const set = showItem.value || showAbility.value || showMoves.value
  const list: { cell: string; xl: string | null; md: string | null; sm: string | null }[] = [
    { cell: 'r', xl: 'var(--num)', md: 'var(--num)', sm: 'var(--num)' },
    { cell: 'grow', xl: 'var(--name)', md: 'minmax(var(--name), 1fr)', sm: 'minmax(0, 1fr)' },
    { cell: '', xl: 'var(--types)', md: 'var(--types)', sm: 'var(--types)' },
  ]
  if (showItem.value) list.push({ cell: 'xl-only', xl: 'auto', md: null, sm: null })
  if (showAbility.value) list.push({ cell: 'xl-only', xl: 'var(--ability)', md: null, sm: null })
  if (showMoves.value) list.push({ cell: 'xl-only', xl: 'minmax(0, 1fr)', md: null, sm: null })
  if (showUsage.value)
    list.push({
      cell: 'r',
      xl: set ? 'var(--usage)' : 'minmax(var(--usage), 1fr)',
      md: 'var(--usage)',
      sm: 'var(--usage)',
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
  <!-- The controls and the table in panels of their own. -->
  <div>
    <div class="panel">
      <h1>{{ t('title.usage') }}</h1>
      <p class="muted intro">{{ t('usage.intro', { reg: REGULATION }) }}</p>
      <template v-if="snapshot">
        <div class="source">
          <MetaPicker />
          <span v-if="snapshot.battles" class="muted">
            {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
          </span>
        </div>
        <!-- The search, and beside it, where the set columns don't fit, the switch that shows sets. -->
        <div class="find-row">
          <div class="find">
            <SearchBox v-model="search" :placeholder="t('usage.search')" :aria-label="t('usage.search')" />
          </div>
          <template v-if="hasSets">
            <label class="btn switch sets-switch" :class="{ on: showSets }">
              <input type="checkbox" :checked="showSets" @change="toggleSets" />
              {{ t('usage.sets') }}
            </label>
            <span class="muted sets-desc">{{ t('usage.setsDesc') }}</span>
          </template>
        </div>
      </template>
      <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>
    <div v-if="snapshot" class="panel">
      <div
        v-if="!data || shown.length"
        class="dex-table"
        :class="{ restoring, 'with-sets': showSets && hasSets }"
        :style="colVars"
        role="table"
      >
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
            <div v-if="showAbility" role="cell" class="xl-only grow">
              <DexRef v-if="r.ability" :to="r.ability" />
            </div>
            <div v-if="showMoves" role="cell" class="xl-only grow">
              <template v-for="(m, i) in r.moves" :key="m.id"
                ><span v-if="i" class="sep" aria-hidden="true"> · </span><DexRef :to="m"
              /></template>
            </div>
            <div
              v-if="showUsage"
              role="cell"
              class="r num meter usage"
              :style="{ '--share': (r.usage ?? 0) / (top || 1) }"
            >
              {{ r.usage === undefined ? '—' : percent(r.usage) }}
            </div>
            <div
              v-if="showBrought"
              role="cell"
              class="wide-only r num meter brought"
              :style="{ '--share': r.brought ?? 0 }"
            >
              {{ r.brought === undefined ? '—' : percent(r.brought) }}
            </div>
            <!-- Under xl, what the set columns hold, on a line of its own, as chips, when the reader shows sets: the
                 item (told by its icon) and the ability, then the moves. On phones, the moves on a line of their own,
                 and how often it's brought at the end of the first, under its usage: the column doesn't fit. -->
            <div v-if="showSets && hasSets" role="cell" class="set-line">
              <AppLink v-if="r.item" :to="{ name: 'item', params: { id: r.item.id } }" class="part">
                <ItemIcon :id="r.item.id" :scale="0.67" />{{ refName(r.item) }}
              </AppLink>
              <span v-if="r.ability" class="part"><DexRef :to="r.ability" /></span>
              <span v-if="showBrought && r.brought !== undefined" class="brought-sm"
                >{{ percent(r.brought) }} {{ t('usage.broughtShort') }}</span
              >
              <span v-if="r.moves.length" class="moves">
                <span v-for="m in r.moves" :key="m.id" class="part"><DexRef :to="m" /></span>
              </span>
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('usage.noMatch') }}</p>
      <p class="muted note phone-only-block">
        {{ t('usage.usage') }}: {{ t('usage.usageTip') }}.
        <template v-if="showSets && showBrought">{{ t('usage.brought') }}: {{ t('usage.broughtTip') }}.</template>
        <template v-if="hasSets">{{ t('usage.sets') }}: {{ t('usage.setsDesc') }}.</template>
      </p>
      <p v-if="broughtAll && snapshot.cutoff" class="muted note">
        {{ t('usage.broughtAll', { players: players(snapshot.cutoff) }) }}
      </p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Rank, name, types (room for two badges), the most common set on wide screens (item, ability, moves), usage (its
   number, with its bar under it) and brought. Narrower, the set goes on a line under the row, and on phones brought joins it. The names don't size their column (the rows take the
   header's widths, see `.dex-table`), so it's as wide as most names, and the longest wrap their forme. */
.dex-table {
  --types: calc(64px * var(--icon-scale, 1) + 14px);
  --num: minmax(3em, auto);
  --name: 13em;
  --ability: 9em;
  --usage: 4.5em;
  --row-height: 2.3em;
  --cols: var(--cols-md);
}
@media (min-width: 1100px) {
  .dex-table {
    --cols: var(--cols-xl);
  }
}
@media (max-width: 1099px) {
  .dex-table .xl-only {
    display: none;
  }
}
/* Phones: the rank and usage columns as narrow as their numbers. */
@media (max-width: 720px) {
  .dex-table {
    --icon-scale: 1.25;
    --cols: var(--cols-sm);
    --num: minmax(1.8em, auto);
    --usage: 4em;
  }
  /* The rank from the panel's edge: left-aligned, so a short one leaves no gap before it. */
  .dex-table .row > :first-child {
    padding-inline: 0 4px;
    text-align: left;
  }
  .dex-table .row > :nth-child(2) {
    padding-left: 4px;
  }
  /* The set's line across the whole row. */
  .dex-table .set-line {
    grid-column: 1 / -1;
    padding-left: 0;
  }
}
/* The set's line: under the row, from the name's column on, when the set columns don't fit. */
.dex-table .set-line {
  display: none;
  grid-column: 2 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  /* Clear of the name over it, which reaches into its cell's padding (the icon's room) when its forme wraps. */
  padding-top: 4px;
  padding-bottom: 6px;
  font-size: 0.85em;
  white-space: normal;
}
/* The moves together, a little apart from the item and the ability. */
.set-line .moves {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}
/* Brought, on phones only. */
.set-line .brought-sm {
  display: none;
}
/* Each part of the set a chip: the item (its icon before its name), the ability, each move. */
.set-line .part {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  white-space: nowrap;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.set-line .part:has(.sheet-icon) {
  padding-left: 2px;
}
.phone-only-block {
  display: none;
}
@media (max-width: 1099px) {
  .dex-table .set-line {
    display: flex;
  }
  /* Two lines a row: the size the skipped rows are laid out at until they're seen. */
  .dex-table.with-sets {
    --row-height: 3.6em;
  }
}
@media (max-width: 720px) {
  .phone-only-block {
    display: block;
  }
  /* The set's lines across the whole row: the item, the ability and, at the end, how often it's brought (under its
     usage); then the moves, on a line of their own. */
  .dex-table .set-line {
    grid-column: 1 / -1;
    padding-left: 0;
  }
  .set-line .brought-sm {
    display: inline;
    margin-left: auto;
    color: var(--muted);
    white-space: nowrap;
  }
  .set-line .moves {
    flex-basis: 100%;
    margin-left: 0;
  }
  /* Three lines a row (here, after the rule for narrower screens, to win over it). */
  .dex-table.with-sets {
    --row-height: 5.4em;
  }
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
  font-weight: bold;
}
/* The search and the Sets switch in a row; the switch and what it does only where the set columns don't fit. */
.find-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 12px;
}
.find {
  flex: 0 1 320px;
  min-width: 0;
}
.find :deep(.search-box) {
  margin: 0;
}
@media (min-width: 1100px) {
  .sets-switch,
  .sets-desc {
    display: none;
  }
}
/* Phones: the switch beside the search, its description with the notes under the table; no intro. */
@media (max-width: 720px) {
  .find {
    flex: 1 1 0;
  }
  .sets-desc,
  .intro {
    display: none;
  }
  .source {
    margin-bottom: 8px;
  }
  .find-row {
    margin-bottom: 8px;
  }
}
.switch {
  flex: none;
  justify-content: flex-start;
  gap: 6px;
  font-weight: bold;
}
.switch.on {
  background: var(--sel);
}
.switch input {
  margin: 0;
}
/* As the dex's stats, a bar along the bottom of the cell, from the left, on a faint track the cell's width (`--share`,
   0 to 1). Usage's, solid, against the most used Pokémon's, so the top of the meta reads at a glance; brought's, a
   rate of its own, out of every team that had it, thinner and in the muted color, so the two don't read as one. */
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
.brought::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
