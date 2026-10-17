<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ability,
  available,
  item,
  move,
  pokemon,
  type AbilityId,
  type ItemId,
  type MoveId,
  type PokemonId,
} from '@/data/dex'
import { REGULATION } from '@/data/format'
import { sinceLabel, has, percent } from '@/data/meta'
import { MOVES, priorityLabel, reachOf } from '@/data/moves'
import { loadLearnsets, movesOf, POKEMON, splitForme } from '@/data/pokemon'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { points, ranksOf, scaleOf, standings, STEADY, usageOf, usersOf } from '@/lib/entryUsage'
import { fold, split } from '@/lib/search'
import { useMeta } from '@/composables/useMeta'
import { usePreviousMeta } from '@/composables/usePreviousMeta'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import CategoryIcon from '@/components/CategoryIcon'
import DexText from '@/components/DexText'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import TypeIcon from '@/components/TypeIcon'
import SortHeader from '@/components/SortHeader.vue'

// An ability's, item's or move's meta page (`kind`), its dex entry's sibling (which links here): how it's used
// in the meta snapshot shown (`useMeta`): its rank among its kind and its usage (`entryUsage.ts`, as its rankings count
// it: the teams running an ability or item, the share of all Pokémon running a move), with their change since the
// dataset before; then every Pokémon whose sets run it, searchable, with how often they do and the usage they bring it;
// and those that could run it but whose sets don't: for an ability, those that can have it; for a move, those that
// learn it (the first `IDLE_MAX`); none for an item, any Pokémon able to hold any. A move's heading has its type,
// category and priority (only when it has one), its numbers, whom it reaches and its tags, each leading to the move
// rankings narrowed by it. One view for the three, alike but for what's in `KINDS`.
type Kind = 'ability' | 'item' | 'move'
const props = defineProps<{ kind: Kind }>()

const KINDS = {
  ability: {
    ref: (id: string) => ability(id as AbilityId),
    field: 'abilities',
    text: {
      usageTip: 'abilityUsage.usageTip',
      runBy: 'metaAbility.runBy',
      none: 'metaAbility.none',
      pokemon: 'metaAbility.pokemon',
      shareTip: 'metaAbility.shareTip',
      bringsTip: 'metaAbility.bringsTip',
      notFound: 'ability.notFound',
    },
  },
  item: {
    ref: (id: string) => item(id as ItemId),
    field: 'items',
    text: {
      usageTip: 'itemUsage.usageTip',
      runBy: 'metaItem.runBy',
      none: 'metaItem.none',
      pokemon: 'metaItem.pokemon',
      shareTip: 'metaItem.shareTip',
      bringsTip: 'metaItem.bringsTip',
      notFound: 'item.notFound',
    },
  },
  move: {
    ref: (id: string) => move(id as MoveId),
    field: 'moves',
    text: {
      usageTip: 'moveUsage.usageTip',
      runBy: 'metaAbility.runBy',
      none: 'metaAbility.none',
      pokemon: 'metaAbility.pokemon',
      shareTip: 'metaAbility.shareTip',
      bringsTip: 'metaAbility.bringsTip',
      notFound: 'move.notFound',
    },
  },
} as const satisfies Record<Kind, { text: Record<string, MessageKey> } & Record<string, unknown>>
const cfg = computed(() => KINDS[props.kind])
/** The page's text. */
const tx = (k: keyof (typeof KINDS)[Kind]['text'], params?: Record<string, string | number>) =>
  t(cfg.value.text[k], params)

const route = useRoute()
const id = computed(() => String(route.params.id))
const ref = computed(() => cfg.value.ref(id.value))
const exists = computed(() => available(ref.value))
const text = computed(() => description(props.kind, id.value))

const { snapshot, data, loading } = useMeta()
const hasList = computed(() => !!snapshot.value && has(snapshot.value, cfg.value.field))
const { previous, prevData } = usePreviousMeta(snapshot)

const all = computed(() => usersOf(data.value ?? {}, cfg.value.field))
const users = computed(() => all.value.get(id.value) ?? [])
const usage = computed(() => usageOf(users.value) / scaleOf(data.value ?? {}, cfg.value.field))
const rank = computed(() => ranksOf(all.value).get(id.value))
/** Its rank and usage in the dataset before, and their change: undefined until that's in, or with none. */
const then = computed(() => {
  if (!prevData.value) return undefined
  const s = standings(prevData.value, cfg.value.field)
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
// The Pokémon running it, searched by name; cleared on another entry's page.
const search = shallowRef('')
watch(id, () => (search.value = ''))
type Row = (typeof rows.value)[number]
type Key = 'name' | 'share' | 'usage'
const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => r[k],
  initial: 'usage',
  startsDesc: (k) => k !== 'name',
  locale,
  remember: `meta.${props.kind}`,
})
/** The most it brings, the full length of the bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage)))

const shown = computed(() => {
  const q = fold(search.value.trim())
  return q ? sorted.value.filter((r) => split(r.name, q)) : sorted.value
})

// A move's numbers and reach, for its heading.
const moveData = computed(() => (props.kind === 'move' ? MOVES[id.value as MoveId] : undefined))

// The Pokémon in the data that could run it but whose sets don't, by usage: those that can have an ability, or learn
// a move (the learnsets loaded for it).
const learnsets = shallowRef<Record<PokemonId, MoveId[]> | null>(null)
watch(
  () => props.kind,
  (kind) => {
    if (kind === 'move') void loadLearnsets().then((sets) => (learnsets.value = sets))
  },
  { immediate: true },
)
const could = (mon: PokemonId) =>
  props.kind === 'ability'
    ? POKEMON[mon].abilities.includes(id.value as AbilityId)
    : props.kind === 'move' && !!learnsets.value && movesOf(learnsets.value, mon).includes(id.value as MoveId)
const idle = computed(() =>
  Object.entries(data.value ?? {})
    .filter(([mon]) => could(mon as PokemonId) && !users.value.some((u) => u.id === mon))
    .sort((a, b) => a[1]!.rank - b[1]!.rank)
    .map(([mon]) => mon as PokemonId),
)
/** The most of them shown: a move can have hundreds. */
const IDLE_MAX = 30

useRowColumns(useTemplateRef('head'))
</script>

<template>
  <template v-if="exists">
    <!-- The data shown, on the row of the way back: what the whole page is of. -->
    <Teleport :to="`#back-actions-${String(route.name)}`" defer>
      <MetaDialog />
    </Teleport>

    <!-- The heading: its name and the way to its dex entry, what it does, and how much it's used. -->
    <div class="panel" :class="{ 'meta-stale': loading }">
      <div class="title-row">
        <h1 class="entry-name">
          <ItemIcon v-if="kind === 'item'" :id="id as ItemId" />
          <template v-if="moveData">
            <AppLink :to="{ name: 'types', params: { type: moveData.type } }" class="badge-link"
              ><TypeIcon v-tip="typeName(moveData.type)" :type="moveData.type"
            /></AppLink>
            <AppLink :to="{ name: 'moveRankings', query: { f: `category:${moveData.category}` } }" class="badge-link"
              ><CategoryIcon v-tip="t(`move.category.${moveData.category}`)" :category="moveData.category"
            /></AppLink>
          </template>
          {{ refName(ref) }}
          <span v-if="moveData && priorityLabel(moveData)" v-tip="t('move.priority')" class="priority num">{{
            priorityLabel(moveData)
          }}</span>
        </h1>
      </div>
      <p v-if="text" class="muted desc"><DexText :text="text.short" /></p>
      <!-- A move's numbers, whom it reaches (the move rankings narrowed to it) and its tags (likewise). -->
      <p v-if="moveData" class="move-facts">
        <span
          >{{ t('move.power') }} <b class="num">{{ moveData.power || '—' }}</b></span
        >
        <span
          >{{ t('move.accuracy') }}
          <b class="num">{{ moveData.accuracy === true ? '—' : `${moveData.accuracy}%` }}</b></span
        >
        <span
          >{{ t('move.pp') }} <b class="num">{{ moveData.pp }}</b></span
        >
        <span class="chips">
          <AppLink
            v-tip="t(`move.target.${moveData.target}`)"
            :to="{ name: 'moveRankings', query: { f: `reach:${reachOf(moveData)}` } }"
            class="chip"
            >{{ t(`move.reach.${reachOf(moveData)}`) }}</AppLink
          >
          <AppLink
            v-for="f in moveData.flags"
            :key="f"
            v-tip="t(`move.flagTip.${f}`)"
            :to="{ name: 'moveRankings', query: { f: `flag:${f}` } }"
            class="chip"
            >{{ t(`move.flag.${f}`) }}</AppLink
          >
        </span>
      </p>
      <p v-if="hasList && rank !== undefined" class="used">
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
          >{{ t('usage.usage') }} <b v-tip="tx('usageTip')" class="num">{{ percent(usage) }}</b
          ><span
            v-if="then && previous"
            v-tip="t('usage.changeTip', { dates: sinceLabel(previous, snapshot) })"
            class="change num"
            :class="Math.abs(then.change) >= STEADY && (then.change > 0 ? 'up' : 'down')"
            >{{ points(then.change) }}</span
          ></span
        >
        <span class="used-part muted">{{ tx('runBy', { n: users.length }) }}</span>
      </p>
      <p v-else-if="hasList && data" class="muted">{{ tx('none', { name: refName(ref) }) }}</p>
      <p v-else-if="!hasList" class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>

    <!-- The Pokémon whose sets run it. -->
    <div v-if="hasList && rows.length" class="panel" :class="{ 'meta-stale': loading }" :aria-busy="loading">
      <div class="table-head">
        <h2>{{ tx('pokemon') }}</h2>
        <div v-if="rows.length > 8" class="table-search">
          <SearchBox v-model="search" :placeholder="t('pokedex.search')" :aria-label="t('pokedex.search')" />
        </div>
      </div>
      <div v-if="shown.length" class="dex-table" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader :label="t('usage.pokemon')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader" class="wide-only">{{ t('pokedex.types') }}</div>
          <SortHeader
            :label="t('metaAbility.share')"
            :tip="tx('shareTip', { name: refName(ref) })"
            right
            :active="key === 'share'"
            :desc="desc"
            @sort="toggle('share')"
          />
          <SortHeader
            :label="t('metaAbility.brings')"
            :tip="tx('bringsTip', { name: refName(ref) })"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
        </div>
        <div v-for="r in shown" :key="r.id" class="row" role="row">
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
      <p v-else class="muted">{{ t('metaEntry.noMatch') }}</p>
      <!-- Those that could, but don't. -->
      <template v-if="idle.length">
        <p class="muted note">{{ t(kind === 'move' ? 'metaMove.idle' : 'metaAbility.idle') }}</p>
        <div class="idle">
          <AppLink
            v-for="mon in idle.slice(0, IDLE_MAX)"
            :key="mon"
            v-tip:group="refName(pokemon(mon))"
            :to="{ name: 'metaPokemon', params: { id: mon } }"
            :aria-label="refName(pokemon(mon))"
          >
            <PokemonIcon :id="mon" />
          </AppLink>
          <span v-if="idle.length > IDLE_MAX" class="muted more">+{{ idle.length - IDLE_MAX }}</span>
        </div>
      </template>
      <p v-if="snapshot" class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </template>
  <div v-else class="panel">
    <p>{{ tx('notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.desc {
  margin: 0 0 8px;
}
/* A move's priority: a small badge after its name, only for the moves that have one. */
.priority {
  align-self: center;
  padding: 0 5px;
  font-size: 0.6em;
  line-height: 1.4;
  border: 1px solid currentColor;
  border-radius: 3px;
}
.badge-link {
  display: inline-flex;
  align-self: center;
}
/* A move's numbers, then whom it reaches and its tags as chips. */
.move-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin: 0 0 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  padding: 1px 6px;
  font-size: 0.9em;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.chip:hover {
  text-decoration: none;
  border-color: var(--accent);
}
/* The table's heading, with the search beside it as there's room. */
.table-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 8px;
}
.table-head h2 {
  margin: 0;
}
.table-search {
  flex: 0 1 280px;
}
.more {
  align-self: center;
  margin-left: 6px;
  font-size: 0.85em;
}
/* An item's icon before its name, centered on it. The name aligns by its baseline, so the heading's baseline is the
   name's (not the icon's foot, a flex box's first item's), and the link after it on the row lines up with it. */
.entry-name {
  /* A move's type and category badges at their desktop size, on phones too: beside a heading, not in a list. */
  --icon-scale: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.entry-name > :deep(.sheet-icon),
.entry-name > :deep(.type-icon),
.entry-name > :deep(.category-icon) {
  align-self: center;
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
