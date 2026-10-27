<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, shallowRef, useTemplateRef } from 'vue'
import tippy, { type Instance } from 'tippy.js'
import { useRouter } from 'vue-router'
import { ability, item, move, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { sinceLabel, GENERATED_SNAPSHOTS, has, percent, players } from '@/data/meta'
import { baselineOf, eventsOf, loadEventUsage, type EventUsage } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { passesGroups, positiveFilters, allFilters } from '@/lib/filterGroups'
import { formatTermFilters, parseTermFilters, type Term, type TermFilters } from '@/lib/searchTerms'
import { pooledUsage } from '@/lib/tournamentStats'
import { isSetTerm, MIN_SHARE, monMatches, MON_TERM_KINDS, setShare, SET_LIST, type SetTerm } from '@/lib/monTerms'
import { useUnfolded } from '@/composables/useUnfolded'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useGradualRows } from '@/composables/useGradualRows'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import { useSlashFocus } from '@/composables/useSlashFocus'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import MetaDialog from '@/components/MetaDialog.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'
import FilterSearch from '@/components/FilterSearch.vue'
import RankingsHead from '@/components/RankingsHead.vue'
import MoreToggle from '@/components/MoreToggle.vue'
import MetaOverview from '@/components/MetaOverview.vue'
import RankingTrends from '@/components/RankingTrends.vue'
import RankingsTabs from '@/components/RankingsTabs.vue'

// The regulation's Pokémon by usage, from the meta snapshot shown (`useMeta`: the one picked, on this page or another,
// when there are several, of any regulation and month generated, `MetaDialog`). Columns come and go with what the snapshot has. Its links are `AppLink`s and its icons
// functional components, as in the other dex tables.
const query = useActiveQuery()
const { snapshot, data, loading } = useMeta()

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

// Trends: against the dataset before the one shown (`previous`, the month before), each Pokémon's rank and usage then: a
// mark by its rank (up, down or new), and the panel of those that rose and fell the most (`RankingTrends`). None for the
// first dataset there is.
const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
/** The trends' panel, once the data before is in. */
const trendsShown = computed(() => !!(snapshot.value && previous.value && data.value))

// The tournaments' trends: the latest weekend of the regulation's official events (its latest event and those within
// `WEEKEND_DAYS` of it) against the events before it, pooled (the regulation's, or for its first weekend the one
// before's, `baselineOf`), every player's teams: each Pokémon's share of them, from every event's few numbers
// (`loadEventUsage`), so no standings load. Of the Pokémon the list's search and filters leave, as the trends' panel.
const WEEKEND_DAYS = 3
/** New to the events: on none of the teams before, and on at least this share now (fewer is a team or two). */
const NEW_MIN = 0.005
const eventUsage = shallowRef<Record<string, EventUsage> | null>(null)
void loadEventUsage().then((u) => (eventUsage.value = u))
const tournamentTrends = computed(() => {
  const u = eventUsage.value
  const reg = snapshot.value?.regulation
  if (!u || !reg) return null
  const events = eventsOf(reg)
  const latest = events[0]
  if (!latest) return null
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000
  const weekend = events.filter((e) => day(latest.date) - day(e.date) <= WEEKEND_DAYS)
  const base = baselineOf(weekend.at(-1)!)
  if (!base.events.length) return null
  const now = pooledUsage(
    u,
    weekend.map((e) => e.id),
    'all',
  )
  const before = pooledUsage(
    u,
    base.events.map((e) => e.id),
    'all',
  )
  if (!now.teams || !before.teams) return null
  const q = fold(search.value.trim())
  const rows = [...new Set([...now.share.keys(), ...before.share.keys()])].flatMap((id) => {
    const name = refName(pokemon(id))
    if (!POKEMON[id] || (q && !split(name, q)) || !passes(id)) return []
    const usage = now.share.get(id) ?? 0
    const was = before.share.get(id) ?? 0
    return [
      {
        id,
        ...splitForme(id, name),
        to: { name: 'metaPokemon', params: { id } },
        usage,
        change: was ? usage - was : undefined,
        fresh: !was && usage >= NEW_MIN,
      },
    ]
  })
  const named = (list: readonly { name: string }[]) =>
    list.length === 1 ? list[0]!.name : t('trends.tournamentEvents', { n: list.length })
  const against = base.regulation
    ? t('tournaments.trendBeforeReg', { reg: base.regulation })
    : base.events.length === 1
      ? base.events[0]!.name
      : t('tournaments.trendBefore', { n: base.events.length })
  return { rows, about: t('trends.tournamentAbout', { now: named(weekend), before: against }) }
})
const tournamentTips = computed(() => ({
  points: t('trends.tournamentPointsTip'),
  new: t('trends.tournamentNewTip'),
  none: t('trends.tournamentSteady'),
}))
/** The page's panels, as the row of links under the tabs lists them. */
const sections = computed(() => [
  { id: 'sec-list', label: t('trends.list') },
  ...(trendsShown.value ? [{ id: 'sec-trends', label: t('trends.title') }] : []),
  ...(tournamentTrends.value ? [{ id: 'sec-tournament-trends', label: t('trends.tournamentTitle') }] : []),
  ...(snapshot.value ? [{ id: 'sec-overview', label: t('overview.section') }] : []),
])
const since = computed(() => (previous.value ? sinceLabel(previous.value, snapshot.value) : ''))
/** The rank's mark's tooltip: the places gained or lost since the dataset before, or new to it. */
const markTip = (r: { climb?: number; fresh: boolean }) =>
  r.climb
    ? t(r.climb > 0 ? 'usage.markUp' : 'usage.markDown', { n: Math.abs(r.climb), dates: since.value })
    : r.fresh
      ? t('usage.markNew', { dates: since.value })
      : ''

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
      to: { name: 'metaPokemon', params: { id } },
      // Places and usage gained (up) or lost since the previous dataset, or whether it's new to it.
      climb: m!.prev ? m!.prev.rank - m!.rank : undefined,
      change: m!.usage !== undefined && m!.prev?.usage !== undefined ? m!.usage - m!.prev.usage : undefined,
      fresh: !!previous.value && !m!.prev,
      brought: m!.brought,
      // Its most common set, at a glance: item, ability and moves, each with the share of its sets that run it (a bar
      // under it, `shared`).
      item: m!.items?.[0] && { ...item(m!.items[0].id), share: m!.items[0].share },
      ability: m!.abilities?.[0] && { ...ability(m!.abilities[0].id), share: m!.abilities[0].share },
      moves: (m!.moves ?? []).slice(0, 3).map((x) => ({ ...move(x.id), share: x.share })),
    }
  }),
)
type Row = (typeof rows.value)[number]
type Key = 'rank' | 'name' | 'usage' | 'brought'

const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => (k === 'name' ? r.name : k === 'rank' ? r.rank : (r[k] ?? -Infinity)),
  initial: 'rank',
  startsDesc: (k) => k === 'usage' || k === 'brought',
  locale,
  remember: 'usage',
})

// The search and filters (`FilterSearch`): its text finds the list's Pokémon by name, and its filters (`?f=`, `?fm=`)
// narrow it to those of a type, that can have an ability, or whose sets run a move or item, on at least `MIN_SHARE` of
// them (`monTerms.ts`: what a few sets run doesn't make it one that runs it). With a filter of what sets run (an ability, a move, an
// item), not negated, each Pokémon's share of its sets running it is a column of its own. The list stays by usage.
// While a term is highlighted in the search's options (`preview`), the list shows it added, rather than the text's
// search by name, faded a little: what picking it would do.
const router = useRouter()
/** The kinds the snapshot can search by: types and abilities always; moves and items with its sets. */
const termKinds = computed(() =>
  MON_TERM_KINDS.filter((k) => k === 'type' || k === 'ability' || (snapshot.value && has(snapshot.value, SET_LIST[k]))),
)
const filters = computed<TermFilters>({
  get: () => parseTermFilters(query.value.f, query.value.fm, termKinds.value),
  set: (f) => void router.replace({ query: { ...query.value, ...formatTermFilters(f) } }),
})
const preview = shallowRef<TermFilters | null>(null)
/** The filters the list shows: the search's, or with the term highlighted in its options. */
const shownFilters = computed(() => preview.value ?? filters.value)
const shareOf = (id: PokemonId, term: Term) => setShare(data.value, id, term)
const matches = (id: PokemonId, term: Term) => monMatches(data.value, id, term)
const passes = (id: PokemonId, f: TermFilters = filters.value) => passesGroups(f, (x) => matches(id, x))
/** How many of the list these filters would leave: offered with each term. */
const count = (f: TermFilters) => rows.value.filter((r) => passes(r.id, f)).length
/** The filters whose share of each Pokémon's sets shows, a column each. */
const shareTerms = computed(() =>
  positiveFilters(shownFilters.value).filter(
    (x): x is SetTerm => isSetTerm(x) && !!snapshot.value && has(snapshot.value, SET_LIST[x.kind]),
  ),
)

// "/" focuses the search, as on the home page.
const termSearch = useTemplateRef('termSearch')
useSlashFocus(() => {
  if (!termSearch.value) return false
  termSearch.value.focus({ preventScroll: true })
})
const search = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
/** How many the text finds by name, with the terms. */
const named = computed(() => {
  const q = fold(search.value.trim())
  return q ? sorted.value.filter((r) => split(r.name, q) && passes(r.id)).length : 0
})
const shown = computed(() => {
  if (preview.value) return sorted.value.filter((r) => passes(r.id, preview.value!))
  const q = fold(search.value.trim())
  return sorted.value.filter((r) => (!q || split(r.name, q)) && passes(r.id))
})
// Pointing at a part of the most common set (its name or icon, or its bar) names it with its share, "Miracle Seed ·
// 62.5%", where there's a pointer to point with. One tooltip for the whole table, placed by hand on the part pointed
// at, its pointer followed by one listener on the table, rather than one per part: a list holds hundreds.
const canHover = window.matchMedia('(hover: hover)').matches
let shareTip: Instance | undefined
let pointed: HTMLElement | null = null
function onBarMove(e: PointerEvent) {
  if (!canHover || e.pointerType !== 'mouse') return
  const at = (e.target as Element).closest<HTMLElement>('.shared')
  if (at === pointed) return
  pointed = at
  if (!at) return void shareTip?.hide()
  const table = e.currentTarget as HTMLElement
  if (shareTip?.reference !== table) {
    shareTip?.destroy()
    shareTip = tippy(table, {
      trigger: 'manual',
      appendTo: () => document.body,
      getReferenceClientRect: () => (pointed ?? table).getBoundingClientRect(),
    })
  }
  const { kind, id, share } = at.dataset
  shareTip.setContent(`${refName({ kind, id } as never)} · ${percent(Number(share))}`)
  shareTip.show()
  void shareTip.popperInstance?.update()
}
function hideBarTip() {
  pointed = null
  shareTip?.hide()
}
onDeactivated(hideBarTip)
onBeforeUnmount(() => shareTip?.destroy())

/** Under this usage a Pokémon is on few teams, and its sets come from a handful of them: its row faded, said under the
 * table. */
const RARE = 0.01
const rare = (r: Row) => r.usage !== undefined && r.usage < RARE
const anyRare = computed(() => shown.value.some(rare))
/** The most used, the full length of the usage bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage ?? 0)))

// Each Pokémon's most common set, where its columns don't fit (under 1100px), shows on a line of its own under the
// row only when the reader asks for it (`Sets`, remembered), so the list stays easy to scan down; never on phones,
// where it's the Pokémon's usage page's to show.
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
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhone))
/** The sets' lines are shown. */
const setsShown = computed(() => hasSets.value && showSets.value && !phone.value)
function toggleSets() {
  showSets.value = !showSets.value
  try {
    localStorage.setItem(SETS_KEY, showSets.value ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}

const { entered, restoring } = usePageEntered()
/** The list folded to its first rows, so what's after it (the trends) is there to be found; unfolded on asking. */
const FOLDED = 20
// Unfolded, remembered for the visit (`useUnfolded`).
const allRows = useUnfolded('rankings:pokemon')
const listed = computed(() => (allRows.value ? shown.value : shown.value.slice(0, FOLDED)))
const drawn = useGradualRows(listed)
useRowColumns(useTemplateRef('head'))
// The columns, as the snapshot has them, and their widths on wide screens, on narrower ones and on phones (null where
// they're left out). On wide screens each Pokémon's most common set fills the room, its moves taking what's left; on
// narrower ones the names do.
const columns = computed(() => {
  const set = showItem.value || showAbility.value || showMoves.value
  const list: { cell: string; xl: string | null; md: string | null; sm: string | null }[] = [
    { cell: 'r', xl: 'var(--num)', md: 'var(--num)', sm: 'var(--num)' },
    { cell: 'grow', xl: 'var(--name)', md: 'minmax(var(--name), 1fr)', sm: 'minmax(0, 1fr)' },
    { cell: 'wide-only', xl: 'var(--types)', md: 'var(--types)', sm: null },
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
  list.push(...shareTerms.value.map(() => ({ cell: 'r', xl: 'var(--usage)', md: 'var(--usage)', sm: 'var(--usage)' })))
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
  <!-- The tabs to the other usage lists, stuck to the top, then the controls and the table in panels of their own. -->
  <div>
    <RankingsTabs current="pokemon" :sections />
    <div id="sec-list" class="panel section">
      <!-- The data shown, and on its line, where the set columns don't fit (but on phones), the switch that shows sets. -->
      <RankingsHead
        :title="t('title.pokemonRankings')"
        :intro="t('usage.intro', { reg: snapshot?.regulation ?? REGULATION })"
      >
        <div v-if="snapshot" class="source">
          <MetaDialog />
          <template v-if="hasSets && !phone">
            <label class="btn switch sets-switch" :class="{ on: showSets }">
              <input type="checkbox" :checked="showSets" @change="toggleSets" />
              {{ t('usage.sets') }}
            </label>
            <span class="muted sets-desc">{{ t('usage.setsDesc') }}</span>
          </template>
        </div>
      </RankingsHead>
      <template v-if="snapshot">
        <div class="find-row">
          <div class="find">
            <FilterSearch
              ref="termSearch"
              v-model:text="search"
              v-model:filters="filters"
              v-model:preview="preview"
              hotkey="/"
              :subject="t('filter.subject.pokemon')"
              :name-count="named"
              :kinds="termKinds"
              :count
            />
          </div>
        </div>
      </template>
      <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>
    <div v-if="snapshot" class="panel" :class="{ 'meta-stale': loading, previewing: preview }" :aria-busy="loading">
      <div
        v-if="!data || shown.length"
        class="dex-table"
        :class="{ restoring, 'with-sets': setsShown }"
        :style="colVars"
        role="table"
        @pointermove="onBarMove"
        @pointerleave="hideBarTip"
      >
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
          <SortHeader :label="t('usage.pokemon')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader" class="wide-only">{{ t('pokedex.types') }}</div>
          <div v-if="showItem" role="columnheader" class="xl-only">
            <span v-tip="t('usage.itemTip')" class="tipped">{{ t('usage.item') }}</span>
          </div>
          <div v-if="showAbility" role="columnheader" class="xl-only">
            <span v-tip="t('usage.abilityTip')" class="tipped">{{ t('usage.ability') }}</span>
          </div>
          <div v-if="showMoves" role="columnheader" class="xl-only">
            <span v-tip="t('usage.movesTip')" class="tipped">{{ t('usage.moves') }}</span>
          </div>
          <SortHeader
            v-if="showUsage"
            :label="t('usage.usage')"
            :tip="t('usage.usageTip')"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
          <div
            v-for="x in shareTerms"
            :key="`${x.kind}:${x.id}`"
            v-tip="t('usage.termShareTip', { name: refName(x) })"
            role="columnheader"
            class="r term-head"
          >
            <ItemIcon v-if="x.kind === 'item'" :id="x.id" :scale="0.67" /><span v-else class="term-name">{{
              refName(x)
            }}</span>
          </div>
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
          <!-- Each row drawn again only when what it shows changes, not with every change to the page (the search's text, its
               options, the count it shows): hundreds of rows take a while. -->
          <div
            v-for="r in drawn"
            :key="r.id"
            v-memo="[
              r,
              previous,
              showItem,
              showAbility,
              showMoves,
              showUsage,
              showBrought,
              setsShown,
              shareTerms,
              top,
              locale,
            ]"
            class="row"
            :class="{ rare: rare(r) }"
            role="row"
          >
            <div role="cell" class="r num muted rank">
              {{ r.rank
              }}<span
                v-if="previous"
                v-tip:group="markTip(r)"
                class="climb"
                :class="r.climb ? (r.climb > 0 ? 'up' : 'down') : r.fresh && 'fresh'"
                ><template v-if="r.climb || r.fresh"
                  ><span aria-hidden="true">{{ r.climb ? (r.climb > 0 ? '▲' : '▼') : '✦' }}</span
                  ><span class="visually-hidden">{{ markTip(r) }}</span></template
                ></span
              >
            </div>
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
                  <TypeIcon :type="ty" />
                </AppLink>
              </span>
            </div>
            <div v-if="showItem" role="cell" class="xl-only">
              <AppLink
                v-if="r.item"
                v-tip:group="!canHover && refName(r.item)"
                :to="{ name: 'metaItem', params: { id: r.item.id } }"
                class="item shared"
                :style="{ '--share': r.item.share ?? 0 }"
                :data-share="r.item.share ?? 0"
                :data-kind="r.item.kind"
                :data-id="r.item.id"
                :aria-label="refName(r.item)"
              >
                <ItemIcon :id="r.item.id" />
              </AppLink>
            </div>
            <div v-if="showAbility" role="cell" class="xl-only grow">
              <ul v-if="r.ability" class="chips">
                <li>
                  <span
                    class="shared"
                    :style="{ '--share': r.ability.share ?? 0 }"
                    :data-share="r.ability.share ?? 0"
                    :data-kind="r.ability.kind"
                    :data-id="r.ability.id"
                    ><DexRef :to="r.ability" meta
                  /></span>
                </li>
              </ul>
            </div>
            <div v-if="showMoves" role="cell" class="xl-only grow">
              <ul class="chips">
                <li v-for="m in r.moves" :key="m.id">
                  <span
                    class="shared"
                    :style="{ '--share': m.share ?? 0 }"
                    :data-share="m.share ?? 0"
                    :data-kind="m.kind"
                    :data-id="m.id"
                    ><DexRef :to="m" meta
                  /></span>
                </li>
              </ul>
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
              v-for="x in shareTerms"
              :key="`${x.kind}:${x.id}`"
              role="cell"
              class="r num meter term-share"
              :style="{ '--share': shareOf(r.id, x) ?? 0 }"
            >
              {{ shareOf(r.id, x) === undefined ? '—' : percent(shareOf(r.id, x)!) }}
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
                 item (told by its icon) and the ability, then the moves. -->
            <div v-if="setsShown" role="cell" class="set-line">
              <AppLink
                v-if="r.item"
                :to="{ name: 'metaItem', params: { id: r.item.id } }"
                class="part shared"
                :style="{ '--share': r.item.share ?? 0 }"
                :data-share="r.item.share ?? 0"
                :data-kind="r.item.kind"
                :data-id="r.item.id"
              >
                <ItemIcon :id="r.item.id" :scale="0.67" />{{ refName(r.item) }}
              </AppLink>
              <span
                v-if="r.ability"
                class="part shared"
                :style="{ '--share': r.ability.share ?? 0 }"
                :data-share="r.ability.share ?? 0"
                :data-kind="r.ability.kind"
                :data-id="r.ability.id"
                ><DexRef :to="r.ability" meta
              /></span>
              <span v-if="r.moves.length" class="moves">
                <span
                  v-for="m in r.moves"
                  :key="m.id"
                  class="part shared"
                  :style="{ '--share': m.share ?? 0 }"
                  :data-share="m.share ?? 0"
                  :data-kind="m.kind"
                  :data-id="m.id"
                  ><DexRef :to="m" meta
                /></span>
              </span>
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('usage.noMatch') }}</p>
      <MoreToggle v-if="data" v-model:all="allRows" :n="shown.length" :top="FOLDED" />
      <p class="muted note phone-only-block">{{ t('usage.usage') }}: {{ t('usage.usageTip') }}.</p>
      <p v-if="anyRare" class="muted note">{{ t('usage.rare', { share: percent(RARE) }) }}</p>
      <p v-if="allFilters(filters).some((x) => x.kind === 'move' || x.kind === 'item')" class="muted note">
        {{ t('usage.termSets', { share: percent(MIN_SHARE) }) }}
      </p>
      <p v-if="broughtAll && snapshot.cutoff" class="muted note">
        {{ t('usage.broughtAll', { players: players(snapshot.cutoff) }) }}
      </p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
    <RankingTrends v-if="trendsShown" id="sec-trends" class="section" :rows="shown" :since remember="trends:pokemon">
      <template #entry="{ row }"
        ><PokemonIcon :id="row.id" /><span>{{ row.species }}</span
        ><span v-if="row.forme" class="forme">{{ row.forme }}</span></template
      >
    </RankingTrends>
    <!-- The tournaments' trends: the latest weekend of official events against the events before it. -->
    <RankingTrends
      v-if="tournamentTrends"
      id="sec-tournament-trends"
      class="section"
      :rows="tournamentTrends.rows"
      :title="t('trends.tournamentTitle')"
      :about="tournamentTrends.about"
      :tips="tournamentTips"
      remember="trends:tournaments"
    >
      <template #entry="{ row }"
        ><PokemonIcon :id="row.id" /><span>{{ row.species }}</span
        ><span v-if="row.forme" class="forme">{{ row.forme }}</span></template
      >
    </RankingTrends>
    <!-- The meta's physical and special side at a glance: its bulk and attack, its most used Pokémon on them. -->
    <MetaOverview v-if="snapshot" id="sec-overview" class="section" :snapshot :data />
  </div>
</template>

<style scoped>
/* A panel scrolled to from the row of links lands under what's stuck to the top. */
.section {
  scroll-margin-top: calc(var(--stuck-h, 0px) + 12px);
}
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
/* Phones: the rank and usage columns as narrow as their numbers, and no types column, which leaves the names no room
   (a Pokémon's types are on its page). */
@media (max-width: 720px) {
  .dex-table {
    --icon-scale: 1.25;
    --cols: var(--cols-sm);
    --num: minmax(1.8em, auto);
    --usage: 4em;
  }
  /* The rank in line with the panel's text: left-aligned, so a short one leaves no gap before it. */
  .dex-table .row > :first-child {
    padding-inline: 6px 4px;
    text-align: left;
  }
  .dex-table .row > :nth-child(2) {
    padding-left: 4px;
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
}
/* The list with a term highlighted in the search's options: a preview, faded a little. */
.previewing .dex-table {
  opacity: 0.75;
}
/* A Pokémon on few teams: faded, so its numbers and set don't read as firmly as the rest's. */
.row.rare > [role='cell'] {
  opacity: 0.55;
}
/* The share of its sets each part of the most common set has (`--share`, 0 to 1): a thin bar along its foot, on a
   faint track its width, as the usage columns' bars, in the muted color so it doesn't vie with usage's; pointed at,
   the part's name and share in a tooltip. */
.shared {
  position: relative;
  display: inline-block;
  padding-bottom: 3px;
}
.shared::before,
.shared::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
}
.shared::before {
  right: 0;
  height: 1px;
  background: var(--border);
}
.shared::after {
  width: calc(100% * var(--share, 0));
  height: 2px;
  background: var(--muted);
}
/* A chip's along its inside foot, clear of its border. */
.set-line .part.shared::before,
.set-line .part.shared::after {
  left: 2px;
  bottom: 1px;
}
.set-line .part.shared::before {
  right: 2px;
}
.set-line .part.shared::after {
  width: calc((100% - 4px) * var(--share, 0));
}
.item {
  display: inline-flex;
  vertical-align: middle;
}
/* The ability and the top moves as plain names divided by a dot, each with its share's bar along its foot, as the
   item has: no box around each, so the columns read as text rather than a wall of chips. */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chips li {
  white-space: nowrap;
}
.chips li + li::before {
  content: '·';
  padding: 0 6px;
  color: var(--muted);
}
/* A quarter of the way to muted: a step back from the names in the Pokémon column. */
.chips a {
  color: color-mix(in srgb, var(--text) 85%, var(--muted));
}
/* A header with a tooltip: underlined dotted, as `SortHeader`'s are. */
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
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
/* The rank's mark: places gained or lost since the previous dataset, or new to it, small after the rank, in a slot as
   wide for every rank. */
.climb {
  display: inline-block;
  width: 1em;
  margin-left: 3px;
  font-size: 0.75em;
  text-align: left;
  white-space: nowrap;
}
/* Every rank its mark's room after it, empty or not, so the ranks line up, and "#" over them rather than the marks. */
.with-climb :deep(.sort) {
  margin-right: calc(3px + 0.75em);
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
.rank {
  white-space: nowrap;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* The search, on a line of its own; the Sets switch and what it does (on the data's line) only where the set columns
   don't fit. */
.find-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 12px;
}
.find {
  flex: 1 1 0;
  min-width: 0;
}
@media (min-width: 1100px) {
  .sets-switch,
  .sets-desc {
    display: none;
  }
}
/* Phones: tighter. */
@media (max-width: 720px) {
  .find-row {
    margin-bottom: 8px;
  }
}
/* A term's column: its name (an item's icon) over each Pokémon's share of its sets running it, its bar as brought's. */
.term-head {
  overflow: hidden;
  text-overflow: ellipsis;
}
.term-name {
  font-size: 0.85em;
}
.term-share::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.switch {
  flex: none;
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
