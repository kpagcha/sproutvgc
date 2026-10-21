<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { move, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { has, percent, sinceLabel } from '@/data/meta'
import { MOVES, priorityLabel, reachOf } from '@/data/moves'
import { loadLearnsets, movesOf } from '@/data/pokemon'
import { locale, t, typeName } from '@/i18n'
import { description, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { ranksOf, scaleOf, standings, usageOf, usersOf } from '@/lib/entryUsage'
import { fold, split } from '@/lib/search'
import { passesGroups, positiveFilters } from '@/lib/filterGroups'
import { formatTermFilters, parseTermFilters, type Term, type TermFilters } from '@/lib/searchTerms'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import { usePreviousMeta } from '@/composables/usePreviousMeta'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import CategoryIcon from '@/components/CategoryIcon'
import DexText from '@/components/DexText'
import FilterSearch from '@/components/FilterSearch.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import RankingsTabs from '@/components/RankingsTabs.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'

// The moves players run, by usage, from the meta snapshot shown (`useMeta`), as the ability and item rankings: each
// its name with its priority (only when it has one) and whom it reaches (`reachOf`, its full target on hover), its
// short description under them; its type, category, power, accuracy and PP, a column each; where there's room, the two
// Pokémon that run it most; and its usage: the share of all Pokémon on teams whose sets run it (`scaleOf`: four moves
// a set, so not per team, as abilities and items are). Its description is a line of its own under the row, from the
// name's column on. On phones, PP and the top Pokémon are left out (both on its meta page), and each move is three
// rows: its name, priority and reach across the width, then its type, category, power, accuracy and usage, then what
// it does (whom it reaches, a chip, leading it), its rank beside the first two.
// Its tags are its meta page's, where each row leads.
const query = useActiveQuery()
const router = useRouter()
const { snapshot, data, loading } = useMeta()
const hasMoves = computed(() => !!snapshot.value && has(snapshot.value, 'moves'))

/** The Pokémon shown with each move, where there's room: those whose teams run it most. */
const TOP = 2

// Trends: against the dataset before the one shown (`previous`), each move's rank then, a mark by its rank.
const { previous, prevData } = usePreviousMeta(snapshot)
const before = computed(() => (prevData.value ? standings(prevData.value, 'moves') : null))

const rows = computed(() => {
  const d = data.value ?? {}
  const by = usersOf(d, 'moves')
  const ranks = ranksOf(by)
  const scale = scaleOf(d, 'moves')
  const then = before.value
  return [...by].map(([key, users]) => {
    const id = key as MoveId
    const rank = ranks.get(id)!
    const prevRank = then?.ranks.get(id)
    const m = MOVES[id]
    return {
      id,
      ref: move(id),
      name: refName(move(id)),
      data: m,
      reach: reachOf(m),
      priority: priorityLabel(m),
      rank,
      usage: usageOf(users) / scale,
      users: users.sort((a, b) => b.usage - a.usage).slice(0, TOP),
      // Places gained (up) or lost since the previous dataset, or whether it's new to it.
      climb: prevRank === undefined ? undefined : prevRank - rank,
      fresh: !!then && prevRank === undefined,
    }
  })
})
type Row = (typeof rows.value)[number]
type Key = 'rank' | 'name' | 'usage' | 'power' | 'accuracy' | 'pp'
const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  // Moves that never miss, sorted as the most accurate.
  value: (r, k) =>
    k === 'power' || k === 'pp'
      ? r.data[k]
      : k === 'accuracy'
        ? r.data.accuracy === true
          ? 101
          : r.data.accuracy
        : r[k],
  initial: 'rank',
  startsDesc: (k) => k !== 'rank' && k !== 'name',
  locale,
  remember: 'usage.moves',
})

// The search and filters (`FilterSearch`): the text finds moves by name or by what their short description says (whole
// words: "rain" isn't "terrain"), and finds what to filter them by too: a type, a category, a tag, a reach, or a
// Pokémon (the moves it learns, its learnset loaded on demand), kept in the URL (`?f=`, `?fm=`). Each Pokémon filtered
// by (not negated) adds a column of its sets' share running each move. While a term is highlighted in the search's
// options (`preview`), the list shows it added, faded a little: what picking it would do.
type MoveFilter = Extract<Term, { kind: 'type' | 'category' | 'flag' | 'reach' | 'pokemon' }>
const FILTER_KINDS = ['type', 'category', 'flag', 'reach', 'pokemon'] as const
const filters = computed<TermFilters>({
  get: () => parseTermFilters(query.value.f, query.value.fm, FILTER_KINDS),
  set: (f) => void router.replace({ query: { ...query.value, ...formatTermFilters(f) } }),
})
const preview = shallowRef<TermFilters | null>(null)
/** The filters the list shows: the URL's, or with the term highlighted in the search's options. */
const shownFilters = computed(() => preview.value ?? filters.value)

const learnsets = shallowRef<Record<PokemonId, MoveId[]> | null>(null)
void loadLearnsets().then((sets) => (learnsets.value = sets))
/** Whether a move matches a filter: one of a Pokémon's can't tell until the learnsets are in. */
function matches(r: Row, f: Term): boolean | null {
  if (f.kind === 'type') return r.data.type === f.id
  if (f.kind === 'category') return r.data.category === f.id
  if (f.kind === 'flag') return r.data.flags.includes(f.id)
  if (f.kind === 'reach') return r.reach === f.id
  if (f.kind === 'pokemon') return learnsets.value ? movesOf(learnsets.value, f.id).includes(r.id) : null
  return false
}
const passes = (r: Row, f: TermFilters = filters.value) => passesGroups(f, (x) => matches(r, x))
/** How many of the list these filters would leave: offered with each term. */
const count = (f: TermFilters) => rows.value.filter((r) => passes(r, f)).length
/** The Pokémon filtered by (not negated), a column each of their sets' share running each move. */
const monTerms = computed(() =>
  positiveFilters(shownFilters.value).filter(
    (x): x is Extract<MoveFilter, { kind: 'pokemon' }> => x.kind === 'pokemon',
  ),
)
/** The share of a Pokémon's sets running a move, when the snapshot has it. */
const shareOf = (mon: PokemonId, id: MoveId) => data.value?.[mon]?.moves?.find((x) => x.id === id)?.share

const termSearch = useTemplateRef('termSearch')
useSlashFocus(() => {
  if (!termSearch.value) return false
  termSearch.value.focus({ preventScroll: true })
})
// The home page's search links here with its query (`?q=`).
const search = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
const finder = computed(() => {
  const q = fold(search.value.trim())
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const words = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u')
  return (r: Row) => !!split(r.name, q) || words.test(fold(shortText(r.ref) ?? ''))
})
/** How many the text finds, with the filters. */
const named = computed(() => {
  const found = finder.value
  return found ? sorted.value.filter((r) => found(r) && passes(r)).length : 0
})
const shown = computed(() => {
  if (preview.value) return sorted.value.filter((r) => passes(r, shownFilters.value))
  const found = finder.value
  return sorted.value.filter((r) => (!found || found(r)) && passes(r))
})
/** The most used, the full length of the usage bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage)))

// Phones, for the shorter header.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhone))

const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
/** The rank's column: its digits, its mark (`.climb`'s width and margin) and the cell's padding, on wide screens and on
 * phones. */
const rankRoom = computed(() => {
  const digits = `${String(rows.value.length).length}ch`
  const room = (min: string) => `minmax(max(3em, ${min}), auto)`
  return previous.value
    ? { wide: room(`${digits} + 3px + 1.8em + 12px`), sm: room(`${digits} + 1px + 1.7em + 10px`) }
    : { wide: room(`${digits} + 12px`), sm: room(`${digits} + 10px`) }
})
// The columns, and their widths on wide screens, on narrower ones and on phones (null where they're left out): rank,
// the move, its type, category, power, accuracy and PP (not on phones), its top Pokémon (only on wide screens), usage,
// and each Pokémon term's share. The description, under them, is no column.
const columns = computed(() => {
  const list: { cell: string; xl: string; md: string | null; sm: string | null }[] = [
    // Room for the longest rank and its mark beside it (as `.climb` has them, with the cell's padding), so every row's
    // the same: the header's "#" alone is narrower.
    { cell: 'r', xl: rankRoom.value.wide, md: rankRoom.value.wide, sm: rankRoom.value.sm },
    // On phones the move is a row of its own over the others, not a column.
    { cell: 'grow', xl: 'minmax(0, 1fr)', md: 'minmax(0, 1fr)', sm: null },
    { cell: '', xl: 'var(--badge)', md: 'var(--badge)', sm: 'var(--badge)' },
    { cell: '', xl: 'var(--badge)', md: 'var(--badge)', sm: 'var(--badge)' },
    // On phones, power takes the room left, so the numbers stay together at the row's end.
    { cell: 'r', xl: 'var(--num)', md: 'var(--num)', sm: 'minmax(2.6em, 1fr)' },
    // The rows take the header's widths: accuracy's room for "100%", wider than its header.
    { cell: 'r', xl: 'var(--num)', md: 'var(--num)', sm: '3.6em' },
    { cell: 'wide-only r', xl: 'var(--num)', md: 'var(--num)', sm: null },
    { cell: 'xl-only', xl: 'var(--users)', md: null, sm: null },
    { cell: 'r', xl: '5em', md: '5em', sm: '4.6em' },
    ...monTerms.value.map(() => ({ cell: 'r', xl: '4.5em', md: '4.5em', sm: '4em' })),
  ]
  return list
})
const widths = (size: 'xl' | 'md' | 'sm') =>
  columns.value
    .map((c) => c[size])
    .filter(Boolean)
    .join(' ')
const colVars = computed(() => ({ '--cols-xl': widths('xl'), '--cols-md': widths('md'), '--cols-sm': widths('sm') }))
</script>

<template>
  <div>
    <div class="panel banded">
      <RankingsTabs current="moves" />
      <div class="title-row">
        <h1>{{ t('title.moveRankings') }}</h1>
      </div>
      <p class="muted intro">{{ t('moveUsage.intro', { reg: snapshot?.regulation ?? REGULATION }) }}</p>
      <template v-if="hasMoves && snapshot">
        <div class="source">
          <MetaDialog />
          <span v-if="snapshot.battles" class="muted">
            {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
          </span>
        </div>
        <div class="find">
          <FilterSearch
            ref="termSearch"
            v-model:text="search"
            v-model:filters="filters"
            v-model:preview="preview"
            hotkey="/"
            :subject="t('filter.subject.moves')"
            :match="['name', 'effect']"
            :name-count="named"
            :kinds="FILTER_KINDS"
            :count
            meta
          />
        </div>
      </template>
      <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>
    <div
      v-if="hasMoves && snapshot"
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
          <SortHeader
            class="wide-only"
            :label="t('moveUsage.move')"
            :active="key === 'name'"
            :desc="desc"
            @sort="toggle('name')"
          />
          <!-- On phones, no names over the badges (they say what they are) and power's short, for the move's room. -->
          <div role="columnheader">
            <span class="wide-label">{{ t('move.type') }}</span>
          </div>
          <div role="columnheader">
            <span v-tip="t('move.category')" class="tipped wide-label">{{ t('move.categoryShort') }}</span>
          </div>
          <SortHeader
            :label="t(phone ? 'move.powerShort' : 'move.power')"
            :tip="phone ? t('move.power') : undefined"
            right
            :active="key === 'power'"
            :desc="desc"
            @sort="toggle('power')"
          />
          <SortHeader
            :label="t('move.accuracy')"
            right
            :active="key === 'accuracy'"
            :desc="desc"
            @sort="toggle('accuracy')"
          />
          <SortHeader
            class="wide-only"
            :label="t('move.pp')"
            right
            :active="key === 'pp'"
            :desc="desc"
            @sort="toggle('pp')"
          />
          <div role="columnheader" class="xl-only">
            <span v-tip="t('moveUsage.usersTip')" class="tipped">{{ t('usage.topPokemon') }}</span>
          </div>
          <SortHeader
            :label="t('usage.usage')"
            :tip="t('moveUsage.usageTip')"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
          <div
            v-for="x in monTerms"
            :key="x.id"
            v-tip="t('moveUsage.monShareTip', { name: refName(x) })"
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
            <!-- The move: its name, priority and reach. -->
            <div role="cell" class="grow">
              <div class="move-line">
                <AppLink :to="{ name: 'metaMove', params: { id: r.id } }" class="name">{{ r.name }}</AppLink>
                <span v-if="r.priority" v-tip:group="t('move.priority')" class="priority num">{{ r.priority }}</span>
                <span v-tip:group="t(`move.target.${r.data.target}`)" class="reach muted">{{
                  t(`move.reach.${r.reach}`)
                }}</span>
              </div>
            </div>
            <div role="cell">
              <TypeIcon v-tip:group="typeName(r.data.type)" :type="r.data.type" />
            </div>
            <div role="cell">
              <CategoryIcon v-tip:group="t(`move.category.${r.data.category}`)" :category="r.data.category" />
            </div>
            <div role="cell" class="r num">{{ r.data.power || '—' }}</div>
            <div role="cell" class="r num">
              {{ r.data.accuracy === true ? '—' : `${r.data.accuracy}%` }}
            </div>
            <div role="cell" class="wide-only r num">{{ r.data.pp }}</div>
            <!-- The two Pokémon that run it most, where there's room. -->
            <div role="cell" class="xl-only users">
              <AppLink
                v-for="u in r.users"
                :key="u.id"
                v-tip:group="t('moveUsage.userTip', { name: refName(pokemon(u.id)), share: percent(u.share) })"
                :to="{ name: 'metaPokemon', params: { id: u.id } }"
                :aria-label="refName(pokemon(u.id))"
                class="user"
              >
                <PokemonIcon :id="u.id" />
              </AppLink>
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
            <!-- What it does: a line of its own under the row, from the name's column on. -->
            <div role="cell" class="text muted">
              <span v-tip:group="t(`move.target.${r.data.target}`)" class="phone-reach">{{
                t(`move.reach.${r.reach}`)
              }}</span>
              <DexText :text="description('move', r.id)?.short ?? ''" />
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('moveUsage.noMatch') }}</p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Rank, the move (its line over its short description), its type and category (a badge's room), power, accuracy, PP,
   its top two Pokémon (only on wide screens), its usage and each Pokémon term's share (`columns`). */
.dex-table {
  --badge: calc(32px * var(--icon-scale, 1) + 12px);
  --num: minmax(3.2em, auto);
  --users: calc(2 * 40px + 2px + 2 * 6px);
  --cols: var(--cols-md);
  --row-height: 3.4em;
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

.dex-table .row > .grow {
  padding-top: 6px;
}
/* The list with a term highlighted in the search's options: a preview, faded a little. */
.previewing .dex-table {
  opacity: 0.75;
}
.move-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
}
/* Whom it reaches: small, after its name. */
.reach {
  font-size: 0.8em;
}
/* On phones, whom it reaches leads what it does, rather than sitting on the name's row over the columns. */
.phone-reach {
  display: none;
}
/* A move's priority: a small badge after its name, only for the moves that have one. */
.priority {
  padding: 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  line-height: 1.4;
  border: 1px solid currentColor;
  border-radius: 3px;
}
/* The description: under the row, from the name's column to its end. */
.dex-table .row > .text {
  grid-column: 2 / -1;
  padding-top: 0;
  padding-bottom: 6px;
  font-size: 0.85em;
  white-space: normal;
}
.users {
  display: flex;
  align-items: center;
  gap: 2px;
}
.user {
  display: inline-flex;
}
@media (max-width: 720px) {
  .dex-table {
    --cols: var(--cols-sm);
  }
  .dex-table .row > :first-child {
    padding-inline: 6px 4px;
  }
  /* Every column on a phone's width: the badges smaller than the page's phone scale (1.5), the cells closer. */
  .dex-table {
    --icon-scale: 1.2;
    --badge: calc(32px * var(--icon-scale) + 6px);
    --num: minmax(2.6em, auto);
    --row-height: 4.4em;
  }
  .dex-table .row > * {
    padding-inline: 3px;
  }
  /* Its three rows some room around and between them. */
  .dex-table .row:not(.head) {
    row-gap: 4px;
    padding-block: 6px;
  }
  /* Each move three rows: its name over the columns, the rank beside both, what it does under them. */
  .dex-table .row:not(.head) > .rank {
    grid-row: span 2;
  }
  .dex-table .row:not(.head) > .grow {
    grid-column: 2 / -1;
    padding-bottom: 0;
  }
  .dex-table .row > .usage {
    padding-left: 8px;
  }
  .reach {
    display: none;
  }
  /* A chip before what it does. */
  .phone-reach {
    display: inline-block;
    margin-right: 6px;
    padding: 0 5px;
    line-height: 1.4;
    color: var(--text);
    background: var(--panel-alt);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  /* The rank's mark tighter, and the header's room for it with it (more specific than the rules after this block,
     which would win otherwise). */
  .rank .climb {
    width: 2.6em;
    margin-left: 1px;
    font-size: 0.65em;
  }
  .dex-table .with-climb :deep(.sort) {
    margin-right: calc(1px + 1.7em);
  }
  .wide-label {
    display: none;
  }
  .intro {
    display: none;
  }
}
.usage {
  font-weight: bold;
}
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
/* As the other rankings' usage: a bar along the bottom of the cell, against the most used one's. */
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
.meter.term-share::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.note {
  margin: 12px 0 0;
}
</style>
