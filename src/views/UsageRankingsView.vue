<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { ability, item, pokemon, type AbilityId, type ItemId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { sinceLabel, has, percent } from '@/data/meta'
import { ranksOf, standings, usageOf, usersOf } from '@/lib/entryUsage'
import { usePreviousMeta } from '@/composables/usePreviousMeta'
import { locale, t, type MessageKey } from '@/i18n'
import { description, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { formatTerms, parseTerms, type Term } from '@/lib/searchTerms'
import { POKEMON } from '@/data/pokemon'
import { ITEMS } from '@/data/items'
import { ITEM_CATEGORIES, type ItemCategory } from '@/data/itemCategories'
import { useRouter } from 'vue-router'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexText from '@/components/DexText'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import RankingsTabs, { type RankingList } from '@/components/RankingsTabs.vue'
import TermSearch from '@/components/TermSearch.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'

// The abilities or items players run (`list`), by usage, from the meta snapshot shown (`useMeta`), as the Pokémon
// rankings: each with its short description, the Pokémon that run it most, and its usage, the teams running it: the
// usage of each Pokémon with it by the share of its sets that run it, summed. One page each, alike but for what's
// listed (`LISTS`).
type Listed = Exclude<RankingList, 'pokemon' | 'moves'>
type Id = AbilityId | ItemId
const props = defineProps<{ list: Listed }>()

const LISTS = {
  abilities: {
    kind: 'ability',
    ref: (id: Id) => ability(id as AbilityId),
    field: 'abilities',
    /** Where a row leads: an ability's meta page, as the Pokémon rankings' rows lead to theirs. */
    entry: 'metaAbility',
    dex: 'abilities',
    /** A Pokémon term leaves what it can have. */
    canHave: (mon: PokemonId, id: Id) => POKEMON[mon].abilities.includes(id as AbilityId),
    text: {
      title: 'title.abilityRankings',
      intro: 'abilityUsage.intro',
      search: 'abilityUsage.search',
      name: 'usage.ability',
      usersTip: 'abilityUsage.usersTip',
      userTip: 'abilityUsage.userTip',
      usageTip: 'abilityUsage.usageTip',
      monShareTip: 'abilityUsage.monShareTip',
      usageNote: 'abilityUsage.usageNote',
      noMatch: 'abilityUsage.noMatch',
    },
  },
  items: {
    kind: 'item',
    ref: (id: Id) => item(id as ItemId),
    field: 'items',
    entry: 'item',
    dex: 'items',
    /** Any Pokémon can hold any item: a Pokémon term leaves what its sets hold. */
    canHave: (mon: PokemonId, id: Id) => !!shareOf(mon, id),
    text: {
      title: 'title.itemRankings',
      intro: 'itemUsage.intro',
      search: 'itemUsage.search',
      name: 'usage.item',
      usersTip: 'itemUsage.usersTip',
      userTip: 'itemUsage.userTip',
      usageTip: 'itemUsage.usageTip',
      monShareTip: 'itemUsage.monShareTip',
      usageNote: 'itemUsage.usageNote',
      noMatch: 'itemUsage.noMatch',
    },
  },
} as const satisfies Record<Listed, { text: Record<string, MessageKey> } & Record<string, unknown>>
const cfg = computed(() => LISTS[props.list])
/** The page's text. */
const tx = (k: keyof (typeof LISTS)[Listed]['text'], params?: Record<string, string | number>) =>
  t(cfg.value.text[k], params)

const query = useActiveQuery()
const { snapshot, data, loading } = useMeta()
const hasList = computed(() => !!snapshot.value && has(snapshot.value, cfg.value.field))

/** The Pokémon shown with each entry: those whose teams run it most. */
const TOP = 5

// Trends, as the Pokémon rankings': against the dataset before the one shown (`previous`, the month before), each
// entry's rank then, a mark by its rank: up or down so many places, or new to it, filling in once its data is in.
const { previous, prevData } = usePreviousMeta(snapshot)
const before = computed(() => (prevData.value ? standings(prevData.value, cfg.value.field) : null))

const rows = computed(() => {
  const by = usersOf(data.value ?? {}, cfg.value.field)
  const ranks = ranksOf(by)
  const then = before.value
  return [...by].map(([key, users]) => {
    const id = key as Id
    const usage = usageOf(users)
    const rank = ranks.get(id)!
    const prevRank = then?.ranks.get(id)
    return {
      id,
      ref: cfg.value.ref(id),
      name: refName(cfg.value.ref(id)),
      rank,
      usage,
      users: users.sort((a, b) => b.usage - a.usage).slice(0, TOP),
      count: users.length,
      // Places gained (up) or lost since the previous dataset, or whether it's new to it.
      climb: prevRank === undefined ? undefined : prevRank - rank,
      fresh: !!then && prevRank === undefined,
    }
  })
})
type Row = (typeof rows.value)[number]
type Key = 'rank' | 'name' | 'usage'

const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => r[k],
  initial: 'rank',
  startsDesc: (k) => k === 'usage',
  locale,
  remember: `usage.${props.list}`,
})

// The search, as the Pokémon rankings': its text finds the list's entries by name or by what their short description
// says ("terrain", "Speed"), and its terms (`?f=`, picked from what the text finds, `TermSearch`) narrow it to those a
// Pokémon can have (`canHave`), each such Pokémon's share of its sets running each a column of its own. While a term is
// highlighted in the search's options (`preview`), the list shows it added, faded a little: what picking it would do.
const router = useRouter()
const TERM_KINDS = ['pokemon'] as const
const terms = computed({
  get: () => parseTerms(query.value.f, TERM_KINDS),
  set: (list: Term[]) => void router.replace({ query: { ...query.value, f: formatTerms(list) } }),
})
const preview = shallowRef<Term | null>(null)
const shownTerms = computed(() => (preview.value ? [...terms.value, preview.value] : terms.value))
type MonTerm = Extract<Term, { kind: 'pokemon' }>
const monTerms = computed(() => shownTerms.value.filter((x): x is MonTerm => x.kind === 'pokemon'))
const matches = (id: Id, term: Term) => term.kind === 'pokemon' && cfg.value.canHave(term.id, id)
const passesTerms = (id: Id, list: readonly Term[]) => list.every((x) => matches(id, x))

// Items narrowed by what they're for (`?cat=`, `ITEM_CATEGORIES`), a select beside the search, each choice with how
// many of the list (with the search's terms) it leaves.
const category = computed({
  get: (): ItemCategory | '' => {
    const c = query.value.cat
    return props.list === 'items' && ITEM_CATEGORIES.includes(c as ItemCategory) ? (c as ItemCategory) : ''
  },
  set: (c: ItemCategory | '') => void router.replace({ query: { ...query.value, cat: c || undefined } }),
})
const inCategory = (id: Id, c: ItemCategory | '' = category.value) => !c || ITEMS[id as ItemId].category === c
const categoryCount = (c: ItemCategory) =>
  rows.value.filter((r) => inCategory(r.id, c) && passesTerms(r.id, terms.value)).length

const passes = (id: Id, list: readonly Term[] = terms.value) => passesTerms(id, list) && inCategory(id)
/** How many of the list a term would leave, added to the others: offered with it. */
const termCount = (term: Term) => rows.value.filter((r) => passes(r.id, [...terms.value, term])).length
/** The share of a Pokémon's sets running an entry, when the snapshot has it. */
function shareOf(mon: PokemonId, id: Id): number | undefined {
  const list: readonly { id: string; share?: number }[] | undefined = data.value?.[mon]?.[cfg.value.field]
  return list?.find((x) => x.id === id)?.share
}

const termSearch = useTemplateRef('termSearch')
useSlashFocus(() => {
  if (!termSearch.value) return false
  termSearch.value.focus({ preventScroll: true })
})
// The home page's search links here with its query (`?q=`).
const search = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
/** What the text finds: an entry by name, or by its short description, where it's whole words ("rain" finds
 * "rain", not "terrain"). Null with no text. */
const finder = computed(() => {
  const q = fold(search.value.trim())
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const words = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u')
  return (r: Row) => !!split(r.name, q) || words.test(fold(shortText(r.ref) ?? ''))
})
/** How many the text finds, with the terms. */
const named = computed(() => {
  const found = finder.value
  return found ? sorted.value.filter((r) => found(r) && passes(r.id)).length : 0
})
const shown = computed(() => {
  if (preview.value) return sorted.value.filter((r) => passes(r.id, shownTerms.value))
  const found = finder.value
  return sorted.value.filter((r) => (!found || found(r)) && passes(r.id))
})
/** The most used, the full length of the usage bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage)))

const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
// The columns: rank, the entry, its Pokémon (not on phones, where they go under the row), usage, and each Pokémon
// term's share.
const columns = computed(() => {
  const list: { cell: string; wide: string; sm: string | null }[] = [
    { cell: 'r', wide: 'minmax(3em, auto)', sm: 'minmax(1.8em, auto)' },
    { cell: 'grow', wide: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr)' },
    { cell: 'wide-only', wide: 'var(--users)', sm: null },
    { cell: 'r', wide: '5em', sm: '4em' },
    ...monTerms.value.map(() => ({ cell: 'r', wide: '4.5em', sm: '4em' })),
  ]
  return list
})
const colVars = computed(() => ({
  '--cols-wide': columns.value.map((c) => c.wide).join(' '),
  '--cols-sm': columns.value.flatMap((c) => c.sm ?? []).join(' '),
}))
</script>

<template>
  <div>
    <div class="panel banded">
      <RankingsTabs :current="list" />
      <!-- The dex's list of them, as it links here. -->
      <div class="title-row">
        <h1>{{ tx('title') }}</h1>
        <AppLink :to="{ name: cfg.dex }" class="other-page">{{ t('lists.toDex') }} ›</AppLink>
      </div>
      <p class="muted intro">{{ tx('intro', { reg: snapshot?.regulation ?? REGULATION }) }}</p>
      <template v-if="hasList && snapshot">
        <div class="source">
          <MetaDialog />
          <span v-if="snapshot.battles" class="muted">
            {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
          </span>
        </div>
        <div class="find">
          <TermSearch
            ref="termSearch"
            v-model:text="search"
            hotkey="/"
            v-model:terms="terms"
            v-model:preview="preview"
            :name-count="named"
            :placeholder="tx('search')"
            :kinds="TERM_KINDS"
            :count="termCount"
          />
          <select
            v-if="list === 'items'"
            v-model="category"
            class="search select"
            :aria-label="t('itemUsage.category')"
          >
            <option value="">{{ t('itemUsage.anyCategory') }}</option>
            <option v-for="c in ITEM_CATEGORIES" :key="c" :value="c" :disabled="!categoryCount(c) && category !== c">
              {{ t(`itemCategory.${c}`) }} ({{ categoryCount(c) }})
            </option>
          </select>
        </div>
      </template>
      <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>
    <div
      v-if="hasList && snapshot"
      class="panel"
      :class="{ 'meta-stale': loading, previewing: preview }"
      :aria-busy="loading"
    >
      <div v-if="!data || shown.length" class="dex-table" :class="{ restoring }" :style="colVars" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader
            :label="t('usage.rank')"
            :tip="previous ? t('usage.rankSince', { dates: sinceLabel(previous, snapshot) }) : t('usage.rankFull')"
            :class="{ 'with-climb': previous }"
            right
            :active="key === 'rank'"
            :desc="desc"
            @sort="toggle('rank')"
          />
          <SortHeader :label="tx('name')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader" class="wide-only">
            <span v-tip="tx('usersTip')" class="tipped">{{ t('usage.topPokemon') }}</span>
          </div>
          <SortHeader
            :label="t('usage.usage')"
            :tip="tx('usageTip')"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
          <div
            v-for="x in monTerms"
            :key="x.id"
            v-tip="tx('monShareTip', { name: refName(x) })"
            role="columnheader"
            class="r"
          >
            <PokemonIcon :id="x.id" :scale="0.75" />
          </div>
        </div>
        <SkeletonRows v-if="!entered || !data" :cells="columns.map((c) => c.cell)" height="3.4em" />
        <template v-else>
          <div v-for="r in shown" :key="r.id" class="row" role="row">
            <div role="cell" class="r num muted rank">
              {{ r.rank
              }}<span
                v-if="previous"
                class="climb"
                :class="r.climb ? (r.climb > 0 ? 'up' : 'down') : r.fresh && 'fresh'"
                ><template v-if="r.climb"
                  ><span aria-hidden="true">{{ r.climb > 0 ? '▲' : '▼' }}</span
                  ><span class="visually-hidden">{{ t(r.climb > 0 ? 'usage.up' : 'usage.down') }}</span
                  >{{ Math.abs(r.climb) }}</template
                ><template v-else-if="r.fresh">{{ t('usage.new') }}</template></span
              >
            </div>
            <div role="cell" class="grow">
              <AppLink :to="{ name: cfg.entry, params: { id: r.id } }" class="name"
                ><ItemIcon v-if="list === 'items'" :id="r.id as ItemId" />{{ r.name }}</AppLink
              >
              <p class="muted text"><DexText :text="description(cfg.kind, r.id)?.short ?? ''" /></p>
            </div>
            <!-- Its Pokémon: a column of their own on wider screens, a line under the row on phones. -->
            <div role="cell" class="users">
              <AppLink
                v-for="u in r.users"
                :key="u.id"
                v-tip:group="tx('userTip', { name: refName(pokemon(u.id)), share: percent(u.share) })"
                :to="{ name: 'metaPokemon', params: { id: u.id } }"
                :aria-label="refName(pokemon(u.id))"
                class="user"
              >
                <PokemonIcon :id="u.id" />
              </AppLink>
              <span v-if="r.count > r.users.length" class="muted more">+{{ r.count - r.users.length }}</span>
            </div>
            <div role="cell" class="r num meter usage" :style="{ '--share': r.usage / (top || 1) }">
              {{ percent(r.usage) }}
            </div>
            <div
              v-for="x in monTerms"
              :key="x.id"
              role="cell"
              class="r num meter term-share"
              :style="{ '--share': shareOf(x.id, r.id) ?? 0 }"
            >
              {{ shareOf(x.id, r.id) === undefined ? '—' : percent(shareOf(x.id, r.id)!) }}
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ tx('noMatch') }}</p>
      <p class="muted note">{{ tx('usageNote') }}</p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* An item's icon before its name, lined up with it. */
.name:has(.sheet-icon) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
/* Rank, the entry (its name over its short description), its Pokémon (room for all five icons and the count after
   them: the rows take the header's widths), its usage and each Pokémon term's share (`columns`). On phones
   its Pokémon go on a line under the row. */
.dex-table {
  /* Five icons and their gaps, the count's slot (`.more`: its margin, and 3em of its smaller text), and the cell's
     padding, with as much again on the right, clear of the usage column. */
  --users: calc(5 * 40px + 4 * 2px + 6px + 0.85 * 3em + 2 * 6px + 6px);
  --cols: var(--cols-wide);
  --row-height: 3.4em;
}
/* The list with a term highlighted in the search's options: a preview, faded a little. */
.previewing .dex-table {
  opacity: 0.75;
}
/* A Pokémon term's share: its bar thinner and muted, as the Pokémon rankings' terms', so it doesn't vie with usage. */
.meter.term-share::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.dex-table .row > .grow {
  padding-block: 6px;
}
.text {
  margin: 2px 0 0;
  font-size: 0.85em;
}
.users {
  display: flex;
  align-items: center;
  gap: 2px;
}
.user {
  display: inline-flex;
}
.more {
  flex: none;
  min-width: 3em;
  margin-left: 6px;
  font-size: 0.85em;
}
@media (max-width: 720px) {
  .dex-table {
    --cols: var(--cols-sm);
  }
  .dex-table .row > :first-child {
    padding-inline: 6px 4px;
    text-align: left;
  }
  .dex-table .row:not(.head) > .users {
    grid-column: 2 / -1;
    grid-row: 2;
    padding-top: 0;
    padding-bottom: 6px;
  }
  .intro {
    display: none;
  }
}
.usage {
  font-weight: bold;
}
/* As the Pokémon rankings': the rank's mark, places gained or lost since the previous dataset or new to it, small after
   the rank in a slot as wide for every rank. */
.rank {
  white-space: nowrap;
}
.climb {
  display: inline-block;
  width: 2.4em;
  margin-left: 3px;
  font-size: 0.75em;
  text-align: left;
  white-space: nowrap;
}
.with-climb :deep(.sort) {
  margin-right: calc(3px + 1.8em);
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
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 12px;
}
/* The search, and for items the category beside it, wrapping under it where there's no room. */
.find {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.find > :first-child {
  flex: 0 1 480px;
  min-width: 0;
}
.select {
  width: auto;
  margin: 0;
}
/* As the Pokémon rankings' usage: a bar along the bottom of the cell, against the most used one's. */
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
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
