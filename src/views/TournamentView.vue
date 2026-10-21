<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { ability, available, item, move, pokemon, type PokemonId } from '@/data/dex'
import { datasetDates, loadRanks, metaLabel, percent, regulationSnapshot } from '@/data/meta'
import { splitForme } from '@/data/pokemon'
import {
  baselineOf,
  eventOf,
  loadEventUsage,
  loadRounds,
  loadStandings,
  type EventUsage,
  type Round,
  type Slot,
  type Standing,
} from '@/data/tournaments'
import { locale, t, tSplit } from '@/i18n'
import { refName } from '@/i18n/refName'
import { filterKey, passesGroups, positiveFilters } from '@/lib/filterGroups'
import type { NamedLocation } from '@/lib/links'
import { fold } from '@/lib/search'
import type { Detail, Term, TermFilters } from '@/lib/searchTerms'
import {
  cutAt,
  DAYS,
  decidedMatches,
  chartReach,
  MIN_MATCHES,
  NICHE_USAGE,
  OFF_META_RANK,
  pinned,
  playersOf,
  pokemonStats,
  pooledUsage,
  standouts,
  strength,
  type Day,
  type PokemonStat,
  medalOf,
} from '@/lib/tournamentStats'
import { useSort } from '@/composables/useSort'
import { useUrlFilters } from '@/composables/useUrlFilters'
import AppLink from '@/components/AppLink'
import BandTabs from '@/components/BandTabs.vue'
import CopyPaste from '@/components/CopyPaste.vue'
import FilterSearch from '@/components/FilterSearch.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SectionNav from '@/components/SectionNav.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortHeader from '@/components/SortHeader.vue'
import TeamSets from '@/components/TeamSets.vue'
import WinRateChart from '@/components/WinRateChart.vue'

// One official tournament: what it was (type, date, country, players, how many made Day 2), the way to its
// regulation's meta, and two tabs, a page each: its standings (`/meta/tournaments/:id`: the whole field in three
// parts, the top cut, the rest of Day 2 and Day 1, Day 1 folded away until asked for; searched by player and filtered
// by a Pokémon, item, ability or move a team has, `?f=`, a Pokémon narrowed to a build too, every player found then
// shown; the Pokémon filtered by with their numbers and the way to their meta page, on its regulation's data) and its
// Pokémon (`/meta/tournaments/:id/pokemon`: the whole event's, Day 2's or the top cut's, `?day=`, each one's share of
// those teams and how they did in those rounds' matches, by usage, win rate or best placing, the top ones or all, each
// leading to the standings filtered to the teams with it; under them, a panel each, those whose usage rose and fell the
// most against the events before, and the Pokémon off the meta that shone).
// Each player's placing, name and country, record (marked when they dropped), and the six they brought, as icons;
// unfolded, their whole sets (`TeamSets`), to copy as a paste (`CopyPaste`); their name leads to their page, their
// matches round by round.
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const event = computed(() => eventOf(id.value))
const standings = shallowRef<(Standing & { placing: number })[] | null>(null)
const rounds = shallowRef<Record<number, Round> | null>(null)
watch(
  id,
  async (current) => {
    standings.value = null
    rounds.value = null
    if (!eventOf(current)) return
    const [s, r] = await Promise.all([loadStandings(current), loadRounds(current)])
    if (id.value !== current) return
    standings.value = s
    rounds.value = r
  },
  { immediate: true },
)

/** The tab shown, a page each (`/meta/tournaments/:id`, `/meta/tournaments/:id/pokemon`): its standings, or its
 * Pokémon. */
const tab = computed(() => (route.params.tab === 'pokemon' ? 'pokemon' : 'standings'))
const tabs = computed((): { value: 'standings' | 'pokemon'; label: string; to: NamedLocation }[] => [
  {
    value: 'standings',
    label: t('tournaments.standings'),
    to: { name: 'tournament', params: { id: id.value } },
  },
  {
    value: 'pokemon',
    label: t('tournaments.pokemonStats'),
    to: { name: 'tournament', params: { id: id.value, tab: 'pokemon' } },
  },
])

/** The day the Pokémon are of, kept in the URL: the whole event unless another's picked. */
const day = computed<Day>({
  get: () => ((DAYS as readonly string[]).find((d) => d === route.query.day) as Day | undefined) ?? 'all',
  set: (d) => void router.replace({ query: { ...route.query, day: d === 'all' ? undefined : d } }),
})

// The day's Pokémon, sorted by usage or win rate; the top ones, or all of them.
const stats = computed(() =>
  standings.value && rounds.value ? pokemonStats(standings.value, rounds.value, day.value) : [],
)

// Each Pokémon's trend: its usage against the events before it (`baselineOf`), pooled, the same day's teams.
const eventUsage = shallowRef<Record<string, EventUsage> | null>(null)
// Loaded once the Pokémon tab is shown: the standings don't need it.
watch(
  tab,
  (t) => {
    if (t === 'pokemon' && !eventUsage.value) void loadEventUsage().then((u) => (eventUsage.value = u))
  },
  { immediate: true },
)
const baseline = computed(() => (event.value ? baselineOf(event.value) : null))
const baselineIds = computed(() => baseline.value?.events.map((e) => e.id) ?? [])
const pooled = computed(() => {
  if (!eventUsage.value || !baselineIds.value.length) return null
  const p = pooledUsage(eventUsage.value, baselineIds.value, day.value)
  return p.teams ? p : null
})
/** Under half a point either way, steady: neither rising nor falling. */
const STEADY = 0.005
const MOVERS = 8
/** The Pokémon whose usage rose and fell the most against the events before, in points, those there gone from it too
 * (at none); one on no team there is new. None without events before. */
const movers = computed(() => {
  const p = pooled.value
  if (!p) return null
  const now = new Map(stats.value.map((s) => [s.id, s.usage]))
  const rows = [...new Set([...now.keys(), ...p.share.keys()])].map((id) => {
    const before = p.share.get(id) ?? 0
    const usage = now.get(id) ?? 0
    return { id, before, usage, change: usage - before, fresh: !p.share.has(id) }
  })
  const by = (sign: 1 | -1) =>
    rows
      .filter((r) => sign * r.change >= STEADY)
      .sort((a, b) => sign * (b.change - a.change) || a.id.localeCompare(b.id))
      .slice(0, MOVERS)
  return { rising: by(1), falling: by(-1) }
})
/** The movers' bars' full length, both lists': the most usage any of them had, before or now, so they compare across. */
const moversMax = computed(() =>
  Math.max(
    0.01,
    ...[...(movers.value?.rising ?? []), ...(movers.value?.falling ?? [])].flatMap((r) => [r.before, r.usage]),
  ),
)
/** Where a mover's bar's parts end, 0 to 1 of the full length: what it kept (the lower of before and now), and what it
 * gained or lost (to the higher). */
const shiftStyle = (r: { before: number; usage: number }) => {
  const lo = Math.min(r.before, r.usage) / moversMax.value
  const hi = Math.max(r.before, r.usage) / moversMax.value
  return { '--lo': lo, '--hi': hi }
}
/** A change in usage, in percentage points: "+3.2", "−1.8". */
const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
/** What the movers are against: the day's teams, and the events before's. */
const moversAbout = computed(() => {
  const b = baseline.value
  if (!pooled.value || !b) return t('tournaments.moversNone')
  const before = b.regulation
    ? t('tournaments.trendBeforeReg', { reg: b.regulation })
    : b.events.length === 1
      ? b.events[0]!.name
      : t('tournaments.trendBefore', { n: b.events.length })
  return t('tournaments.moversAbout', {
    day: t(`tournaments.day.${day.value}`),
    before,
    teams: num(pooled.value.teams),
  })
})

// The Pokémon off the meta that shone (`standouts`): off it by their ranks on the ladder, its regulation's data (the
// snapshot its meta links open), loaded once the Pokémon tab is shown (the standings don't need them); a first top cut
// of the regulation by the events before, when they're of it.
const ladderSnapshot = computed(() => event.value && regulationSnapshot(event.value.regulation))
const ladder = shallowRef<Partial<Record<PokemonId, number>> | null>(null)
let ladderOf: string | null = null
watch(
  () => (tab.value === 'pokemon' ? ladderSnapshot.value : null),
  async (s) => {
    if (!s || s.id === ladderOf) return
    ladderOf = s.id
    ladder.value = null
    const ranks = await loadRanks(s)
    if (ladderOf === s.id) ladder.value = ranks
  },
  { immediate: true },
)
const standoutList = computed(() => {
  if (!standings.value || !ladder.value) return []
  const before =
    eventUsage.value && baselineIds.value.length && !baseline.value?.regulation
      ? cutAt(eventUsage.value, baselineIds.value)
      : null
  return standouts(standings.value, ladder.value, before)
})
const standoutsTip = computed(() =>
  t('tournaments.standoutsTip', {
    rank: OFF_META_RANK,
    meta: ladderSnapshot.value ? metaLabel(ladderSnapshot.value) : '',
    usage: percent(NICHE_USAGE),
  }),
)
/** The field's teams (those with a Pokémon known), a standout's share is of; and the share of them that made Day 2,
 * the one a standout's is against. */
const fieldTeams = computed(() => (standings.value ?? []).filter((s) => s.team.length).length)
const fieldDay2 = computed(
  () => (standings.value ?? []).filter((s) => s.team.length && s.day2).length / (fieldTeams.value || 1),
)
const playerAt = (placing: number) => standings.value?.find((s) => s.placing === placing)

const {
  sorted: sortedStats,
  key: statKey,
  desc: statDesc,
  toggle: sortStats,
} = useSort({
  rows: stats,
  value: (s, k: 'usage' | 'winRate' | 'best') => (k === 'usage' ? s.teams : k === 'best' ? s.best : (s.winRate ?? -1)),
  initial: 'usage',
  // The best placing from the first; the rest, the most first.
  startsDesc: (k) => k !== 'best',
  locale,
})
/** What a phone's list of them can be sorted by, picked over it. */
const STAT_SORTS = ['usage', 'winRate', 'best'] as const
/** In that list, a win rate's hint: the good color over even, the bad under, muted with too few matches. */
const wrHint = (s: PokemonStat) => (s.winRate === null || unsure(s) ? 'muted' : s.winRate >= 0.5 ? 'wr-up' : 'wr-down')
/** The words around the numbers in its line: after a win rate, and around a best placing's badge. */
const wonText = computed(() => tSplit('tournaments.line.winRate', 'n'))
const bestText = computed(() => tSplit('tournaments.line.best', 'placing'))
const TOP = 20
const minMatches = computed(() => MIN_MATCHES[day.value])
const enough = (s: PokemonStat) => s.wins + s.losses >= minMatches.value
/** The day's Pokémon as sorted, those with too few matches last when sorted by win rate. */
const rankedStats = computed(() =>
  statKey.value === 'winRate'
    ? [...sortedStats.value.filter(enough), ...stats.value.filter((s) => !enough(s))]
    : sortedStats.value,
)
/** The Pokémon with a win rate, the most used first; the chart's, the first of them. */
const chartable = computed(() => stats.value.filter((s) => s.winRate !== null))
/** How many of them the chart shows at fewest, and unless another's picked. */
const phone = useMediaQuery('(max-width: 720px)')
const CHART_MIN = 5
/** On a phone, fewer: more crowd its narrow chart. */
const chartDefault = computed(() => (phone.value ? 15 : 30))
/** How many of the most used the chart shows, kept in the URL (`?chart=`): 30 (15 on a phone) unless another's
 * picked, all of them when there are no more. */
const chartN = computed<number>({
  get: () => {
    const n = Number(route.query.chart)
    return Math.min(Number.isInteger(n) && n >= CHART_MIN ? n : chartDefault.value, chartable.value.length)
  },
  set: (n) =>
    void router.replace({ query: { ...route.query, chart: n === chartDefault.value ? undefined : String(n) } }),
})
/** The slider's value while it's dragged, the chart following only once it's let go. */
const draggedN = ref<number | null>(null)
function releaseN(e: Event) {
  chartN.value = Number((e.target as HTMLInputElement).value)
  draggedN.value = null
}
/** A number typed in its box, within the slider's range; one that isn't a number puts the box back. */
function typeN(e: Event) {
  const box = e.target as HTMLInputElement
  const n = Math.round(Number(box.value))
  if (box.value !== '' && Number.isFinite(n)) chartN.value = Math.min(Math.max(n, CHART_MIN), chartable.value.length)
  box.value = String(chartN.value)
}
const charted = computed(() => chartable.value.slice(0, chartN.value))
/** Where those with too few matches start, when sorted by win rate and some are, a line over them saying so. */
const fewFrom = computed(() => (statKey.value === 'winRate' ? rankedStats.value.findIndex((s) => !enough(s)) : -1))
/** How far from even a win rate's bar can reach, its half filled from there on: most sit close to even (a Pokémon on
 * many teams meets itself often, a win and a loss), so the bar's scale is that close range, not 0% to 100%. */
const WR_RANGE = 0.1
const wrStyle = (s: PokemonStat) =>
  s.winRate === null
    ? undefined
    : { '--dev': Math.min(Math.abs(s.winRate - 0.5) / WR_RANGE, 1), '--strength': strength(s, day.value) }
/** Whether a win rate has too few matches to go by, its number faint too. */
const unsure = (s: PokemonStat) => !enough(s)
/** The most used Pokémon's usage, the one its bars are against. */
const topUsage = computed(() => stats.value[0]?.usage ?? 0)
const allStats = ref(false)
const shownStats = computed(() => (allStats.value ? rankedStats.value : rankedStats.value.slice(0, TOP)))
/** What the day's numbers are of: its players, and its matches with a winner. */
const about = computed(() =>
  standings.value && rounds.value
    ? t('tournaments.statsAbout', {
        players: num(playersOf(standings.value, day.value).length),
        matches: num(decidedMatches(rounds.value, day.value)),
      })
    : '',
)
/** What the chart's marks say, after `about`: that they fade with fewer matches, when one does, and that those past its
 * scale are at its edge, when one is. */
const chartAbout = computed(() => {
  const reach = chartReach(charted.value, day.value)
  const faded = charted.value.some((s) => strength(s, day.value) < 1)
  const edge = charted.value.some((s) => pinned(s, reach))
  return faded && edge
    ? t('tournaments.chartNoteFadedEdge', { n: minMatches.value })
    : faded
      ? t('tournaments.chartNoteFaded')
      : ''
})
/** The way to its regulation's meta (its latest data; the default, for the current one, its URL left bare once it's
 * shown): the event's own Meta, and each Pokémon's meta page. */
const metaOf = computed(() => event.value && regulationSnapshot(event.value.regulation)?.id)
const monName = (pid: Parameters<typeof pokemon>[0]) => splitForme(pid, refName(pokemon(pid)))

// The rows unfolded, by placing, kept in the URL (`?open=3.12`), so a link opens on them.
const open = computed(
  () =>
    new Set(
      String(route.query.open ?? '')
        .split('.')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
)
/** A click on a player's row unfolds it, but on their name, the way to their page. */
function rowClick(e: MouseEvent, placing: number) {
  if (!(e.target as Element).closest('a')) toggle(placing)
}
function toggle(placing: number) {
  const next = new Set(open.value)
  if (next.has(placing)) next.delete(placing)
  else next.add(placing)
  const list = [...next].sort((a, b) => a - b)
  void router.replace({ query: { ...route.query, open: list.length ? list.join('.') : undefined } })
}

// The standings' search (`FilterSearch`): its text finds players by name, and the Pokémon, items, abilities and moves
// to filter them by, a team with it (`?f=`, `?fm=`; the Pokémon tab's rows link here with theirs). A Pokémon can be
// narrowed to a build, the one Pokémon with an item, ability or moves (`?f=pokemon:incineroar~item:sitrusberry`), from
// what its sets here run.
type Placed = Standing & { placing: number }
const KINDS = ['pokemon', 'item', 'ability', 'move'] as const
const filters = useUrlFilters(() => KINDS, true)
const preview = shallowRef<TermFilters | null>(null)
const query = ref('')
watch(id, () => (query.value = ''))
/** Whether a set has a detail: its item, ability, or among its moves. */
const hasDetail = ([, it, ab, , moves]: Slot, d: Detail) =>
  d.kind === 'item' ? it === d.id : d.kind === 'ability' ? ab === d.id : moves.includes(d.id as Slot[4][number])
/** Whether a set is a Pokémon filter's: that Pokémon, with every one of its details. */
const isBuild = (slot: Slot, f: Term) => slot[0] === f.id && (f.with ?? []).every((d) => hasDetail(slot, d))
function matches(s: Placed, f: Term) {
  if (f.kind === 'pokemon') return s.team.some((x) => isBuild(x, f))
  if (f.kind === 'item') return s.team.some(([, it]) => it === f.id)
  if (f.kind === 'ability') return s.team.some(([, , ab]) => ab === f.id)
  if (f.kind === 'move') return s.team.some(([, , , , moves]) => (moves as string[]).includes(f.id))
  return false
}
const passes = (s: Placed, f: TermFilters) => passesGroups(f, (x) => matches(s, x))
/** What a Pokémon's sets here run, to narrow its filter by: its items, abilities and moves, the most run first. */
function detailsOf(pid: PokemonId): Detail[] {
  const n = new Map<string, { d: Detail; n: number }>()
  const add = (d: Detail) => {
    const key = filterKey(d)
    const x = n.get(key)
    if (x) x.n++
    else n.set(key, { d, n: 1 })
  }
  for (const s of standings.value ?? [])
    for (const [p, it, ab, , moves] of s.team) {
      if (p !== pid) continue
      if (it) add(item(it))
      if (ab) add(ability(ab))
      for (const m of moves) add(move(m))
    }
  return [...n.values()].sort((a, b) => b.n - a.n).map((x) => x.d)
}
/** The sets the filters are of, a Pokémon's narrowed to a build: marked when its team unfolds. */
const builds = computed(() => positiveFilters(filters.value).filter((f) => f.kind === 'pokemon' && f.with?.length))
const marked = (slot: Slot) => builds.value.some((f) => isBuild(slot, f))
const named = (s: Placed, q: string) => fold(s.player).includes(q)
const count = (f: TermFilters) => (standings.value ?? []).filter((s) => passes(s, f)).length
const nameCount = computed(() => {
  const q = fold(query.value.trim())
  return q ? (standings.value ?? []).filter((s) => named(s, q) && passes(s, filters.value)).length : 0
})
/** The Pokémon filtered by (not those filtered out), each with its numbers as the Pokémon tab's list has them, the whole
 * event's, and its place there by usage; one narrowed to a build, that build's numbers, its sets alone counting, and no
 * place. */
const filteredStats = computed(() => {
  const terms = positiveFilters(filters.value).filter((f) => f.kind === 'pokemon')
  if (!terms.length || !standings.value || !rounds.value) return []
  const all = pokemonStats(standings.value, rounds.value, 'all')
  return terms.flatMap((f) => {
    if (!f.with?.length) {
      const i = all.findIndex((s) => s.id === f.id)
      return i < 0 ? [] : [{ key: filterKey(f), s: all[i]!, rank: (i + 1) as number | null, with: [] as Detail[] }]
    }
    const s = pokemonStats(standings.value!, rounds.value!, 'all', (x) => isBuild(x, f)).find((x) => x.id === f.id)
    return s ? [{ key: filterKey(f), s, rank: null, with: [...f.with] }] : []
  })
})
/** Whether the standings are narrowed, by a filter or the text: then every player found shows, Day 1's too. */
const narrowed = computed(() => !!query.value.trim() || filters.value.groups.length > 0 || !!preview.value)

/** Day 1's players, shown once asked for (or while narrowed): the top cut and Day 2 are what most come for. */
const day1Shown = ref(false)
watch(id, () => (day1Shown.value = false))
/** The standings shown, in their parts (the top cut, the rest of Day 2, and Day 1, those there are). */
const parts = computed(() => {
  const q = preview.value ? '' : fold(query.value.trim())
  const f = preview.value ?? filters.value
  const all = (standings.value ?? []).filter((s) => passes(s, f) && (!q || named(s, q)))
  return [
    { key: 'topCut' as const, rows: all.filter((s) => s.topCut) },
    { key: 'day2' as const, rows: all.filter((s) => s.day2 && !s.topCut) },
    { key: 'day1' as const, rows: all.filter((s) => !s.day2 && !s.topCut) },
  ].filter((p) => p.rows.length)
})
/** Day 1's players, while they're folded away: how many, for the way to them. */
const day1Folded = computed(() =>
  narrowed.value || day1Shown.value ? 0 : (parts.value.find((p) => p.key === 'day1')?.rows.length ?? 0),
)
const shownParts = computed(() => (day1Folded.value ? parts.value.filter((p) => p.key !== 'day1') : parts.value))

// Arriving on unfolded rows (a link shared), Day 1 shown if one's there, and the page scrolled to the first once its
// standings are in, after the router's own scrolling (to the top, a frame or two before). Not when the browser
// restores where the page was (a reload, going back).
const restoring = !!(window.history.state as { scroll?: unknown } | null)?.scroll
watch(standings, async (all) => {
  if (!all || !open.value.size || restoring) return
  if (all.some((s) => open.value.has(s.placing) && !s.day2 && !s.topCut)) day1Shown.value = true
  await nextTick()
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  document.querySelector(`.standing[data-placing="${Math.min(...open.value)}"]`)?.scrollIntoView({ block: 'start' })
})
/** A Pokémon's row on the Pokémon tab leads to the standings narrowed to the teams with it, if the dex has it. */
const teamsWith = (pid: PokemonStat['id']) =>
  available(pokemon(pid)) ? { name: 'tournament', params: { id: id.value }, query: { f: `pokemon:${pid}` } } : null

/** The Pokémon tab's panels, as the row of links at its top lists them: its table, the movers and the standouts, those
 * shown. */
const sections = computed(() => [
  { id: 'sec-pokemon', label: t('tournaments.pokemonStats') },
  ...(standings.value && rounds.value ? [{ id: 'sec-movers', label: t('tournaments.movers') }] : []),
  ...(standoutList.value.length ? [{ id: 'sec-standouts', label: t('tournaments.standouts') }] : []),
])

/** What's stuck to the top as the page scrolls: on the standings, the tabs' band; on the Pokémon, the row of links to
 * its panels (the tabs left in their panel, as the row spans them all). Its height, for the Pokémon's table's header to
 * stick under it and a player scrolled to to land under it. */
const bandTabs = useTemplateRef<{ $el: HTMLElement }>('bandTabs')
const sectionNav = useTemplateRef<{ $el: HTMLElement }>('sectionNav')
const { height: bandHeight } = useElementSize(
  () => (tab.value === 'pokemon' ? sectionNav.value?.$el : bandTabs.value?.$el),
  undefined,
  { box: 'border-box' },
)

const num = (n: number) => n.toLocaleString(locale.value)
const ordinal = (n: number) => `#${n}`
</script>

<template>
  <div v-if="event" :style="{ '--band-height': `${bandHeight}px` }">
    <div class="panel">
      <h1>{{ event.name }}</h1>
      <p class="facts">
        <span>{{ t(`tournaments.type.${event.type}`) }}</span>
        <span>{{ datasetDates({ from: event.date, to: event.date }) }}</span>
        <span>{{ event.country }}</span>
        <span>{{ t('meta.regulation', { reg: event.regulation }) }}</span>
        <span>{{ t('tournaments.players', { n: num(event.players) }) }}</span>
        <span>{{ t('tournaments.day2', { n: num(event.day2) }) }}</span>
      </p>
      <p v-if="metaOf" class="links">
        <AppLink :to="{ name: 'rankings', query: { meta: metaOf } }">{{ t('tournaments.eventMeta') }} ›</AppLink>
      </p>
    </div>

    <!-- Its standings and its Pokémon, a page each, as tabs on the panel's band. -->
    <section v-if="tab === 'standings'" class="panel banded">
      <BandTabs ref="bandTabs" sticky :label="t('tournaments.tabs')" :current="tab" :tabs />
      <FilterSearch
        v-model:text="query"
        v-model:filters="filters"
        v-model:preview="preview"
        class="standings-search"
        :subject="t('filter.subject.players')"
        :name-count="nameCount"
        :kinds="KINDS"
        :count
        :details="detailsOf"
        meta
      />
      <!-- The Pokémon filtered by, with their numbers in the whole event, as the Pokémon tab's list has them. -->
      <div v-if="filteredStats.length" class="filtered-stats" role="table" :aria-label="t('tournaments.pokemonStats')">
        <div class="fs-row fs-head" role="row">
          <span role="columnheader">{{ t('tournaments.col.pokemon') }}</span>
          <span role="columnheader" class="r">#</span>
          <span role="columnheader" class="r"
            ><span v-tip="t('tournaments.col.usageTip')" class="tipped">{{ t('tournaments.col.usage') }}</span></span
          >
          <span role="columnheader" class="r"
            ><span v-tip="t('tournaments.col.winRateTip')" class="tipped">{{
              t('tournaments.col.winRate')
            }}</span></span
          >
          <span role="columnheader" class="r">{{ t('tournaments.col.record') }}</span>
          <span role="columnheader" class="fs-meta" :aria-label="t('tournaments.toMeta')"></span>
        </div>
        <div v-for="{ key, s, rank, with: build } in filteredStats" :key class="fs-row" role="row">
          <span role="cell">
            <span class="mon">
              <PokemonIcon :id="s.id" /><span class="mon-name"
                ><span>{{ monName(s.id).species }}</span
                ><span v-if="monName(s.id).forme" class="forme">{{ monName(s.id).forme }}</span
                ><span v-if="build.length" class="build">{{ build.map((d) => refName(d)).join(' · ') }}</span></span
              >
            </span>
          </span>
          <span role="cell" class="r num muted">{{ rank ?? '' }}</span>
          <span role="cell" class="r num meter" :style="{ '--share': s.usage }">{{ percent(s.usage) }}</span>
          <span
            role="cell"
            class="r num"
            :class="
              s.winRate === null
                ? 'muted'
                : ['wr', s.winRate >= 0.5 ? 'up' : 'down', { unsure: s.wins + s.losses < MIN_MATCHES.all }]
            "
            :style="
              s.winRate === null
                ? undefined
                : { '--dev': Math.min(Math.abs(s.winRate - 0.5) / WR_RANGE, 1), '--strength': strength(s, 'all') }
            "
            >{{ s.winRate === null ? '—' : percent(s.winRate) }}</span
          >
          <span role="cell" class="r num record-wl"
            ><span :class="{ more: s.wins > s.losses }">{{ s.wins }}</span
            >–<span :class="{ more: s.losses > s.wins }">{{ s.losses }}</span></span
          >
          <span role="cell" class="fs-meta">
            <AppLink :to="{ name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }" class="to-meta"
              >{{ t('tournaments.toMeta') }} ›</AppLink
            >
          </span>
        </div>
      </div>
      <p v-if="!standings" class="muted">{{ t('tournaments.loading') }}</p>
      <p v-else-if="!shownParts.length" class="muted">{{ t('tournaments.noPlayers') }}</p>
      <ol v-else class="standings" :class="{ previewing: preview }">
        <template v-for="part in shownParts" :key="part.key">
          <!-- Each part under its name, when there's more than one. -->
          <li v-if="shownParts.length > 1" class="part-head">{{ t(`tournaments.part.${part.key}`) }}</li>
          <li
            v-for="s in part.rows"
            :key="s.placing"
            :data-placing="s.placing"
            class="standing"
            :class="{ open: open.has(s.placing), won: s.placing === 1 }"
          >
            <!-- The row unfolds on a click anywhere but the player's name, the way to their page; the chevron its button,
                 for the keyboard. -->
            <div class="player-row" @click="rowClick($event, s.placing)">
              <span class="placing num" :class="medalOf(s.placing)">{{ ordinal(s.placing) }}</span>
              <span class="player"
                ><span class="who"
                  ><AppLink
                    :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.placing) } }"
                    class="name"
                    >{{ s.player }}</AppLink
                  >
                  <span class="muted small">{{ s.country }}</span></span
                ><span v-if="s.placing === 1" class="champion">{{ t('tournaments.champion') }}</span></span
              >
              <span
                v-tip="s.dropped ? t('tournaments.droppedTip', { round: s.dropped }) : undefined"
                class="record num"
                :class="{ dropped: s.dropped }"
                >{{ s.wins }}–{{ s.losses }}<span v-if="s.dropped" class="drop">{{ t('tournaments.drop') }}</span></span
              >
              <span v-if="s.team.length" class="team" aria-hidden="true">
                <PokemonIcon v-for="(slot, i) in s.team" :id="slot[0]" :key="i" />
              </span>
              <!-- Neither a team list nor its Pokémon: the standings didn't say. -->
              <span v-else class="team none muted small">{{ t('tournaments.noList') }}</span>
              <button
                type="button"
                class="chevron"
                :aria-expanded="open.has(s.placing)"
                :aria-label="t('tournaments.rowLabel', { placing: s.placing, player: s.player })"
                @click.stop="toggle(s.placing)"
              >
                <component :is="open.has(s.placing) ? ChevronUp : ChevronDown" :size="16" />
              </button>
            </div>
            <!-- Its whole sets, a card each. -->
            <p v-if="open.has(s.placing) && !s.team.length" class="muted small no-team">
              {{ t('tournaments.noTeam') }}
            </p>
            <template v-else-if="open.has(s.placing)">
              <TeamSets :team="s.team" :marked="builds.length ? marked : undefined" />
              <!-- The way to copy the team as a paste, under its sets at their right. -->
              <p class="team-tools"><CopyPaste :team="s.team" /></p>
            </template>
          </li>
        </template>
      </ol>
      <!-- Day 1's players, folded away until asked for. -->
      <button v-if="day1Folded" type="button" class="more-toggle" @click="day1Shown = true">
        <ChevronDown :size="14" aria-hidden="true" />{{ t('tournaments.showDay1', { n: num(day1Folded) }) }}
      </button>
    </section>

    <!-- Its Pokémon: the day's, each one's usage, win rate and record. -->
    <template v-else>
      <!-- Its panels, a row of links stuck to the top, the one being read marked. -->
      <SectionNav ref="sectionNav" :sections />
      <section id="sec-pokemon" class="panel banded section">
        <BandTabs :label="t('tournaments.tabs')" :current="tab" :tabs />
        <div class="stats-controls">
          <SegmentedControl
            v-model="day"
            class="day-choice"
            :label="t('tournaments.teamsOf')"
            :options="DAYS.map((d) => ({ value: d, label: t(`tournaments.day.${d}`) }))"
          />
          <label v-if="chartable.length > CHART_MIN" class="chart-n">
            <span class="muted">{{ t('tournaments.chartShown') }}</span>
            <input
              type="range"
              :min="CHART_MIN"
              :max="chartable.length"
              :value="draggedN ?? chartN"
              @input="draggedN = Number(($event.target as HTMLInputElement).value)"
              @change="releaseN"
            />
            <span class="chart-n-value">
              <input
                type="number"
                class="chart-n-box"
                :min="CHART_MIN"
                :max="chartable.length"
                :value="draggedN ?? chartN"
                :aria-label="t('tournaments.chartShown')"
                @change="typeN"
              />
              {{ t('tournaments.chartOf', { of: chartable.length }) }}
            </span>
          </label>
        </div>
        <p class="muted small about">
          {{ about }}<template v-if="chartAbout"> · {{ chartAbout }}</template>
        </p>
        <p v-if="!standings || !rounds" class="muted">{{ t('tournaments.loading') }}</p>
        <WinRateChart
          v-if="standings && rounds && charted.length"
          :stats="charted"
          :day
          :to="(s) => teamsWith(s.id) ?? { name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }"
        />
        <div
          v-if="standings && rounds && !phone"
          class="dex-table stats"
          role="table"
          :aria-label="t('tournaments.pokemonStats')"
        >
          <div class="row head" role="row">
            <div role="columnheader" class="r">#</div>
            <div role="columnheader">
              <span v-tip="t('tournaments.teamsWithTip')" class="tipped">{{ t('tournaments.col.pokemon') }}</span>
            </div>
            <SortHeader
              :label="t('tournaments.col.usage')"
              :tip="t('tournaments.col.usageTip')"
              right
              :active="statKey === 'usage'"
              :desc="statDesc"
              @sort="sortStats('usage')"
            />
            <SortHeader
              :label="t('tournaments.col.winRate')"
              :tip="t('tournaments.col.winRateTip')"
              right
              :active="statKey === 'winRate'"
              :desc="statDesc"
              @sort="sortStats('winRate')"
            />
            <div role="columnheader" class="r">{{ t('tournaments.col.record') }}</div>
            <SortHeader
              :label="t('tournaments.col.best')"
              :tip="t('tournaments.col.bestTip')"
              right
              :active="statKey === 'best'"
              :desc="statDesc"
              @sort="sortStats('best')"
            />
          </div>
          <template v-for="(s, i) in shownStats" :key="s.id">
            <div v-if="i === fewFrom" class="few" role="row">
              <div role="cell">{{ t('tournaments.fewMatches', { n: minMatches }) }}</div>
            </div>
            <div class="row" role="row">
              <div role="cell" class="r num muted">{{ i + 1 }}</div>
              <div role="cell" class="mon-cell">
                <!-- The teams with it, in the standings; its meta page when the dex hasn't it to filter them by. -->
                <AppLink
                  :to="teamsWith(s.id) ?? { name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }"
                  class="mon"
                >
                  <PokemonIcon :id="s.id" /><span class="mon-name"
                    ><span>{{ monName(s.id).species }}</span
                    ><span v-if="monName(s.id).forme" class="forme">{{ monName(s.id).forme }}</span></span
                  >
                </AppLink>
              </div>
              <div role="cell" class="r num meter" :style="{ '--share': s.usage / (topUsage || 1) }">
                {{ percent(s.usage) }}
              </div>
              <div
                role="cell"
                class="r num"
                :class="s.winRate === null ? 'muted' : ['wr', s.winRate >= 0.5 ? 'up' : 'down', { unsure: unsure(s) }]"
                :style="wrStyle(s)"
              >
                {{ s.winRate === null ? '—' : percent(s.winRate) }}
              </div>
              <div role="cell" class="r num record-wl">
                <span :class="{ more: s.wins > s.losses }">{{ s.wins }}</span
                >–<span :class="{ more: s.losses > s.wins }">{{ s.losses }}</span>
              </div>
              <div role="cell" class="r">
                <AppLink
                  v-tip="playerAt(s.best)?.player"
                  :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.best) } }"
                  class="best num"
                  :class="medalOf(s.best)"
                  >{{ ordinal(s.best) }}</AppLink
                >
              </div>
            </div>
          </template>
        </div>
        <!-- On phones, a list rather than columns: what it's sorted by picked over it, and in each row that number at
             its end with its bar under the name, the rest a line of small text under them. -->
        <template v-else-if="standings && rounds">
          <div class="stat-sort" role="group" :aria-label="t('tournaments.sortBy')">
            <span class="muted">{{ t('tournaments.sortBy') }}</span>
            <span class="segments">
              <button
                v-for="k in STAT_SORTS"
                :key="k"
                type="button"
                :class="{ on: statKey === k }"
                :aria-pressed="statKey === k"
                @click="sortStats(k)"
              >
                {{ t(`tournaments.col.${k}`)
                }}<span v-if="statKey === k" class="arrow" :class="{ up: !statDesc }" aria-hidden="true">▾</span>
              </button>
            </span>
          </div>
          <ol class="stat-list" :aria-label="t('tournaments.pokemonStats')">
            <template v-for="(s, i) in shownStats" :key="s.id">
              <li v-if="i === fewFrom" class="few">{{ t('tournaments.fewMatches', { n: minMatches }) }}</li>
              <li class="stat-item">
                <span class="rank num muted">{{ i + 1 }}</span>
                <AppLink
                  :to="teamsWith(s.id) ?? { name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }"
                  class="mon"
                >
                  <PokemonIcon :id="s.id" /><span class="mon-name"
                    ><span>{{ monName(s.id).species }}</span
                    ><span v-if="monName(s.id).forme" class="forme">{{ monName(s.id).forme }}</span></span
                  >
                </AppLink>
                <AppLink
                  v-if="statKey === 'best'"
                  :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.best) } }"
                  class="lead best soft num"
                  :class="medalOf(s.best)"
                  >{{ ordinal(s.best) }}</AppLink
                >
                <!-- A win rate with its record beside it, what it's of. -->
                <span v-else-if="statKey === 'winRate'" class="lead num"
                  ><span :class="wrHint(s)">{{ s.winRate === null ? '—' : percent(s.winRate) }}</span>
                  <span class="record-wl"
                    >(<span :class="{ more: s.wins > s.losses }">{{ s.wins }}</span
                    >–<span :class="{ more: s.losses > s.wins }">{{ s.losses }}</span
                    >)</span
                  ></span
                >
                <span v-else class="lead num">{{ percent(s.usage) }}</span>
                <span
                  v-if="statKey === 'usage'"
                  class="lead-bar meter"
                  :style="{ '--share': s.usage / (topUsage || 1) }"
                  aria-hidden="true"
                ></span>
                <p class="line muted num">
                  <AppLink
                    v-if="statKey === 'best'"
                    :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.best) } }"
                    class="who"
                    >{{ playerAt(s.best)?.player }}</AppLink
                  >
                  <span v-if="statKey !== 'usage'">{{ t('tournaments.line.usage', { n: percent(s.usage) }) }}</span>
                  <span v-if="statKey !== 'winRate'"
                    ><template v-if="s.winRate !== null"
                      >{{ wonText[0] }}<span :class="wrHint(s)">{{ percent(s.winRate) }}</span
                      >{{ `${wonText[1]} ` }}</template
                    ><span class="record-wl"
                      >(<span :class="{ more: s.wins > s.losses }">{{ s.wins }}</span
                      >–<span :class="{ more: s.losses > s.wins }">{{ s.losses }}</span
                      >)</span
                    ></span
                  >
                  <span v-if="statKey !== 'best'"
                    >{{ bestText[0]
                    }}<AppLink
                      v-tip="playerAt(s.best)?.player"
                      :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.best) } }"
                      class="best soft num"
                      :class="medalOf(s.best)"
                      >{{ ordinal(s.best) }}</AppLink
                    >{{ bestText[1] }}</span
                  >
                </p>
              </li>
            </template>
          </ol>
        </template>
        <button
          v-if="stats.length > TOP"
          type="button"
          class="more-toggle"
          :aria-pressed="allStats"
          @click="allStats = !allStats"
        >
          <component :is="allStats ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />{{
            allStats ? t('tournaments.showTop', { n: TOP }) : t('tournaments.showAllMons', { n: stats.length })
          }}
        </button>
      </section>
      <!-- The Pokémon whose usage rose and fell the most against the events before, the day's teams: a table each, side
           by side (one under the other on phones). -->
      <section v-if="standings && rounds" id="sec-movers" class="panel banded section movers">
        <h2 class="band">{{ t('tournaments.movers') }}</h2>
        <p class="muted small about">{{ moversAbout }}</p>
        <div v-if="movers" class="movers-lists">
          <div
            v-for="group in [
              { key: 'rising', list: movers.rising, title: t('tournaments.rising') },
              { key: 'falling', list: movers.falling, title: t('tournaments.falling') },
            ]"
            :key="group.key"
          >
            <h3>{{ group.title }}</h3>
            <p v-if="!group.list.length" class="muted small">{{ t('tournaments.noMovers') }}</p>
            <div v-else class="dex-table moved" role="table" :aria-label="group.title">
              <div v-for="r in group.list" :key="r.id" class="row" role="row">
                <div role="cell" class="mon-cell">
                  <!-- The teams with it, in the standings; its meta page when none had it, or the dex hasn't it. -->
                  <AppLink
                    :to="
                      (r.usage && teamsWith(r.id)) || {
                        name: 'metaPokemon',
                        params: { id: r.id },
                        query: { meta: metaOf },
                      }
                    "
                    class="mon"
                  >
                    <PokemonIcon :id="r.id" /><span class="mon-name"
                      ><span>{{ monName(r.id).species }}</span
                      ><span v-if="monName(r.id).forme" class="forme">{{ monName(r.id).forme }}</span></span
                    >
                  </AppLink>
                </div>
                <!-- Its usage before and now, a bar with the numbers on it, then the change in points; one new to the
                     events, marked so. -->
                <div role="cell" class="shift" :class="r.change > 0 ? 'up' : 'down'" :style="shiftStyle(r)">
                  <span class="track">
                    <span class="kept"></span><span class="delta"></span>
                    <span class="num shift-label"
                      ><span v-if="r.fresh" v-tip="t('tournaments.newTip')" class="fresh">{{ t('usage.new') }}</span
                      ><template v-else>{{ percent(r.before) }}</template> → {{ percent(r.usage) }}</span
                    >
                  </span>
                </div>
                <div role="cell" class="r num change" :class="r.change > 0 ? 'up' : 'down'">
                  {{ points(r.change) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- The Pokémon off the meta that shone, a card each: its best placing and whose, or how often its teams made
           Day 2; its rank on the ladder and its teams here. -->
      <section v-if="standoutList.length" id="sec-standouts" class="panel banded section standouts">
        <h2 class="band">
          <!-- What makes one, to the heading's right on wide screens, over it on phones. -->
          <span v-if="phone" v-tip="standoutsTip" class="tipped">{{ t('tournaments.standouts') }}</span>
          <span v-else v-tip.right="standoutsTip" class="tipped">{{ t('tournaments.standouts') }}</span>
        </h2>
        <ul>
          <li v-for="o in standoutList" :key="o.id" class="standout">
            <!-- Its Pokémon, and across from it its share of the event's teams, how many on hover. -->
            <div class="standout-head">
              <AppLink
                :to="teamsWith(o.id) ?? { name: 'metaPokemon', params: { id: o.id }, query: { meta: metaOf } }"
                class="mon"
              >
                <PokemonIcon :id="o.id" /><span class="mon-name"
                  ><span>{{ monName(o.id).species }}</span
                  ><span v-if="monName(o.id).forme" class="forme">{{ monName(o.id).forme }}</span></span
                >
              </AppLink>
              <span
                v-tip="t('tournaments.shareTip', { n: num(o.teams), of: num(fieldTeams) })"
                class="share num muted small"
                >{{ percent(o.usage) }}</span
              >
            </div>
            <p v-if="o.cut" class="feat">
              <span class="placing num" :class="medalOf(o.best)">{{ ordinal(o.best) }}</span>
              <AppLink :to="{ name: 'tournamentPlayer', params: { id, placing: String(o.best) } }" class="who">{{
                playerAt(o.best)?.player
              }}</AppLink>
            </p>
            <p v-else class="feat small">
              {{
                t('tournaments.toDay2', {
                  k: o.day2,
                  n: o.teams,
                  rate: percent(o.day2 / o.teams),
                  field: percent(fieldDay2),
                })
              }}
            </p>
            <p class="muted small">
              {{ o.ladder === null ? t('tournaments.offLadder') : t('tournaments.ladderRank', { rank: o.ladder }) }}
            </p>
            <span v-if="o.firstCut" class="first-cut">{{ t('tournaments.firstCut', { reg: event.regulation }) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
  <div v-else class="panel">
    <p class="muted">{{ t('tournaments.unknown') }}</p>
    <AppLink :to="{ name: 'tournaments' }">{{ t('title.tournaments') }} ›</AppLink>
  </div>
</template>

<style scoped>
h1 {
  margin-bottom: 4px;
}
/* The tabs' band stuck to the top as the page scrolls (its standings and Pokémon are long): the Pokémon's table's
   header stuck under it, and a player scrolled to under it too. */
.dex-table.stats .head {
  top: var(--band-height, 0px);
}
/* What it was, on a line, dot-separated, wrapping between them: each dot ends the one before it, so a line never starts
   with one. */
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  margin: 0 0 6px;
}
.facts span {
  white-space: nowrap;
}
.facts span:not(:last-child)::after {
  content: '·';
  margin: 0 6px;
  color: var(--muted);
}
.small {
  font-size: 0.875em;
}
/* The standings' search, over them; the list faded while it shows what a filter highlighted would leave. */
.standings-search {
  margin-bottom: 12px;
}
/* The Pokémon filtered by, a row each under one head, their columns lined up as the Pokémon tab's table's are. */
.filtered-stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3rem 7rem 7rem 7rem 3.5rem;
  column-gap: 12px;
  margin: 0 0 12px;
}
.fs-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
.fs-head {
  padding: 0 0 4px;
  font-size: 0.75rem;
  color: var(--muted);
}
.filtered-stats .r {
  text-align: right;
}
/* Every cell its content centered over room for the bars along the bottom of the usage's and the win rate's, as the
   table's, so the numbers and names line up. */
.fs-row:not(.fs-head) > * {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 2px 0 8px;
}
.fs-row:not(.fs-head) > :first-child {
  justify-content: flex-start;
}
/* A build's details, under its Pokémon's name. */
.build {
  flex-basis: 100%;
  font-size: 0.8em;
  color: var(--muted);
}
.filtered-stats .meter,
.filtered-stats .wr {
  --inset: 0px;
}
@media (max-width: 720px) {
  .filtered-stats {
    grid-template-columns: minmax(0, 1fr) 2rem 4.5rem 4.5rem 5.5rem 3rem;
    column-gap: 8px;
  }
}
/* On phones, no room for the name beside the numbers: the Pokémon (and its build) across the row, the way to its meta
   page at its end, its numbers under, from the start; the head the numbers' alone. */
@media (max-width: 480px) {
  .filtered-stats {
    grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1fr) auto;
    column-gap: 12px;
  }
  .fs-head > :first-child,
  .fs-head > .fs-meta {
    display: none;
  }
  .fs-row:not(.fs-head) > :first-child {
    grid-row: 1;
    grid-column: 1 / -2;
    padding-bottom: 0;
  }
  .fs-row:not(.fs-head) > .fs-meta {
    grid-row: 1;
    grid-column: -2 / -1;
    padding-bottom: 0;
  }
}
.standings.previewing {
  opacity: 0.75;
}
/* The Pokémon: the day they're of, then their table as the rankings' (rank, Pokémon, usage, win rate, record, the way
   to its meta page), the top ones and a toggle for the rest. */
/* The day and how many the chart shows, on one row, wrapping on narrow screens. */
.stats-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 8px;
}
.chart-n {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chart-n input {
  width: 10rem;
}
/* As wide as its longest, so the slider doesn't shift as the number changes. */
.chart-n-value {
  min-width: 6ch;
  font-variant-numeric: tabular-nums;
}
.chart-n .chart-n-box {
  width: 4em;
  font: inherit;
}
.about {
  margin: 2px 0 8px;
}
/* Its rows laid out from the start, not when they come into view as dex tables' are: a few dozen at most, and laid out
   as the page scrolls into them, the page's length changed under the scroll, making it jump. */
.dex-table.stats .row {
  content-visibility: visible;
}
/* Its columns in rem, not em: the header row's text is smaller than the rows', and em widths would shrink with it,
   leaving the header out of line with the numbers under it. */
.dex-table.stats {
  --cols: 2.5rem minmax(0, 1fr) 5rem 5.5rem 6rem 3.75rem;
}
/* On phones, what the list is sorted by, its options joined in one outlined strip as `SegmentedControl`'s, tapped again
   to reverse it. */
.stat-sort {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 0.875em;
}
.stat-sort .segments {
  display: flex;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.stat-sort button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 10px;
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: none;
  cursor: pointer;
}
.stat-sort button + button {
  border-left: 2px solid var(--ink);
}
.stat-sort button.on {
  background: var(--sel);
}
.stat-sort .arrow {
  font-size: 0.8em;
}
.stat-sort .arrow.up {
  transform: scaleY(-1);
}
/* Each row its rank, its Pokémon, and the number it's sorted by at its end, usage's bar under the name (a win rate
   in the good or bad color instead), the rest a line of small text under them, every row the same height: the forme on the name's line, plain. */
.stat-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.stat-item {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) auto;
  grid-template-areas: 'rank mon lead' '. bar bar' '. line line';
  align-items: center;
  column-gap: 8px;
  padding: 8px 4px 6px;
  border-bottom: 1px solid var(--border);
}
.stat-item .rank {
  grid-area: rank;
  align-self: start;
  padding-top: 2px;
  font-size: 0.9em;
}
.stat-item .mon {
  grid-area: mon;
}
.stat-item .mon-name {
  flex-wrap: nowrap;
}
.stat-item .forme {
  padding: 0;
  border: none;
}
.stat-item .lead {
  grid-area: lead;
  font-weight: bold;
}
.stat-item .lead-bar {
  grid-area: bar;
  height: 10px;
  --inset: 0px;
}
.stat-item .line {
  grid-area: line;
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.4em;
  margin: 2px 0 0;
  font-size: 0.85em;
}
.stat-item .line > * + *::before {
  content: '·';
  margin-right: 0.4em;
}
.stat-item .who {
  color: inherit;
}
/* A win rate's hint, subtle: the text's color tinted toward the good or the bad. */
.wr-up {
  color: color-mix(in srgb, var(--good) 45%, var(--text));
}
.wr-down {
  color: color-mix(in srgb, var(--bad) 45%, var(--text));
}
/* Its record beside it as the lead, at the line's size and weight. */
.stat-item .lead .record-wl {
  font-size: 0.8em;
  font-weight: normal;
}
/* The Pokémon tab's panels, landed on from its row of links under that row. */
.section {
  scroll-margin-top: calc(var(--band-height, 0px) + 12px);
}
/* The movers, rising and falling side by side, one under the other on phones: their Pokémon, their usage before and
   now, and the change in points, up in the good color, down in the bad; one new to the events, the accent's. */
.movers-lists {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
}
@media (max-width: 720px) {
  .movers-lists {
    grid-template-columns: minmax(0, 1fr);
  }
}
.movers h3 {
  margin: 0 0 4px;
  font-size: 1em;
}
.movers p {
  margin: 0;
}
.movers .about {
  margin-bottom: 12px;
}
.dex-table.moved {
  --cols: minmax(0, 12rem) minmax(0, 1fr) 3.5rem;
  margin-inline: 0;
}
/* Its usage as a bar on a faint band, the both lists' most usage its full length, in soft tones so the numbers on it
   read in the text's color: grey to what it kept (its usage now when it rose, before when it fell), then what it gained,
   a wash of the good color, or lost, faintly hatched in the bad. Its numbers on it, from its start. */
.track {
  position: relative;
  display: block;
  min-width: 3rem;
  height: 18px;
  background: color-mix(in srgb, var(--border) 30%, transparent);
}
.kept,
.delta {
  position: absolute;
  top: 0;
  bottom: 0;
}
.kept {
  left: 0;
  width: calc(var(--lo) * 100%);
  background: color-mix(in srgb, var(--text) 16%, transparent);
}
.delta {
  left: calc(var(--lo) * 100%);
  width: calc((var(--hi) - var(--lo)) * 100%);
}
.up .delta {
  background: color-mix(in srgb, var(--good) 38%, transparent);
}
.down .delta {
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--bad) 30%, transparent) 0 2px,
    transparent 2px 5px
  );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bad) 55%, transparent);
}
/* The numbers across the bar, in the text's color. */
.shift-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 6px;
  font-size: 0.8em;
  line-height: 1;
  white-space: nowrap;
}
/* On phones, the name across the row with the change at its end, its bar under them, from where the name starts. */
@media (max-width: 480px) {
  .dex-table.moved {
    --cols: minmax(0, 1fr) 3.5rem;
  }
  .dex-table.moved .row {
    grid-template-areas: 'mon change' 'bar bar';
  }
  .dex-table.moved .row > :nth-child(1) {
    grid-area: mon;
  }
  .dex-table.moved .row > :nth-child(2) {
    grid-area: bar;
    padding: 0 6px 6px 50px;
  }
  .dex-table.moved .row > :nth-child(3) {
    grid-area: change;
  }
}
.change.up {
  color: var(--good);
}
.change.down {
  color: var(--bad);
}
.fresh {
  color: var(--accent);
  font-weight: bold;
}
/* Its best placing, the way to that player's page: a medal in the top 8, else plain. */
.best {
  color: inherit;
  font-size: 0.9em;
}
/* The Pokémon off the meta that shone: a card each, as many to a row as fit. */
.band {
  font-size: 1rem;
}
.standouts ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* On phones, one to a row, the screen's width each. */
@media (max-width: 720px) {
  .standouts ul {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
.standout {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--border-strong);
  background: var(--panel-alt);
}
.standout p {
  margin: 0;
}
.feat {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.feat .who {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.feat .who:hover {
  color: var(--accent);
}
/* Its Pokémon, its name cut short before its share, across from it. */
.standout-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.standout-head .share {
  flex: none;
}
/* Its first top cut of the regulation, a tag at its foot. */
.first-cut {
  align-self: flex-start;
  white-space: nowrap;
  padding: 0 5px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #141414;
  background: var(--gold);
  border: 1px solid var(--ink);
}
/* The line over those with too few matches to sort by their win rate. */
.few {
  padding: 10px 8px 4px;
  border-top: 1px dashed var(--border);
  color: var(--muted);
  font-size: 0.85em;
}
.mon-cell {
  overflow: hidden;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin: -3px 0;
  color: inherit;
  font-weight: bold;
}
/* Its name cut short where its room ends (never into the numbers); its forme a small tag after it, under it when it
   doesn't fit, as the rankings show it. */
.mon-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  min-width: 0;
}
.mon-name > :first-child {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.forme {
  padding: 0 5px;
  font-size: 0.85em;
  font-weight: normal;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 2px 6px 2px 2px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.more-toggle:hover {
  color: var(--text);
  background: var(--hover);
}
/* A header with a tooltip: underlined dotted, as `SortHeader`'s are. */
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
/* Usage as the rankings show it: a bar along the bottom of the cell, from the left, on a faint track the cell's width,
   against the most used Pokémon's (`--share`, 0 to 1), so the top of the event reads at a glance. */
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
/* Win rate: a bar from the middle of a faint track (even, marked), rightwards in the good color above it, leftwards
   in the bad below, as far as it's from even (`--dev`, 0 to 1, the half filled `WR_RANGE` from even), as solid as the
   matches behind it make it (`--strength`, 0 to 1); one under the day's minimum, its number faint too. */
.wr {
  --inset: 6px;
  position: relative;
}
.wr::before,
.wr::after {
  content: '';
  position: absolute;
}
.wr::before {
  right: var(--inset);
  bottom: 1px;
  left: var(--inset);
  height: 8px;
  background:
    linear-gradient(var(--muted), var(--muted)) 50% 0 / 1px 100% no-repeat,
    linear-gradient(var(--border), var(--border)) 0 calc(100% - 3px) / 100% 1px no-repeat;
}
.wr::after {
  bottom: 3px;
  width: calc((100% - 2 * var(--inset)) / 2 * var(--dev, 0));
  height: 3px;
  opacity: calc(0.25 + 0.75 * var(--strength, 1));
}
.wr.up::after {
  left: 50%;
  background: var(--good);
}
.wr.down::after {
  right: 50%;
  background: var(--bad);
}
.wr.unsure {
  color: var(--muted);
}
/* A record, muted, the larger of its wins and losses in the text's color. */
.record-wl {
  color: var(--muted);
}
.record-wl .more {
  color: var(--text);
}
.to-meta {
  font-size: 0.85em;
  font-weight: bold;
  white-space: nowrap;
}
.links {
  margin: 8px 0 0;
  font-weight: bold;
}
.standings {
  margin: 0;
  padding: 0;
  list-style: none;
}
.standing + .standing {
  border-top: 1px solid var(--border);
}
/* A part's name, over its players: the top cut, Day 2, Day 1, a strip in the panel's other shade between ink lines,
   set apart from the part before. */
.part-head {
  margin-top: 16px;
  padding: 5px 8px;
  font-size: 0.85em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--panel-alt);
  border-block: 2px solid var(--ink);
}
.part-head:first-child {
  margin-top: 0;
}
/* A player, a row to unfold (`player-row`: not `row`, which the Pokémon's table rows are, as every dex table's):
   placing, name and country, record, the six as icons, and the chevron. Every row laid out from the start, not when
   it comes into view: laid out as the page scrolls into them, their heights guessed until then (a phone's rows two
   lines, an unfolded one its sets), the page's length changed under the scroll, making it jump. */
.standing {
  /* Room above it when a link scrolls to it, under the tabs' band. */
  scroll-margin-top: calc(var(--band-height, 0px) + 12px);
  /* Its width, for its team's icons to be laid out by (below). */
  container: standing / inline-size;
}
.player-row {
  display: grid;
  grid-template-columns: 3.5em minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  cursor: pointer;
}
/* The player's name, the way to their page: underlined, in the text's color; apart from their country by a margin, the
   line break between the two in the template being no space. */
.player .name {
  margin-right: 0.35em;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.player .name:hover {
  color: var(--accent);
}
.player-row:hover {
  background: var(--hover);
}
/* The winner's row lit from the left in gold, a tag by their name (the medals are `main.css`'s). */
.standing.won .player-row {
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 26%, transparent), transparent 70%);
}
.standing.won .player-row:hover {
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 38%, transparent), var(--hover) 70%);
}
.standing.won .player {
  font-weight: bold;
}
.champion {
  flex: none;
  margin-left: 8px;
  padding: 0 5px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #141414;
  background: var(--gold);
  border: 1px solid var(--ink);
}
/* Unfolded: its row in the color of what's picked, ruled off from its sets. */
.standing.open .player-row {
  background: var(--sel);
  border-bottom: 1px solid var(--border-strong);
}
.placing {
  font-weight: bold;
  text-align: right;
}
/* The name and country cut short where they don't fit; the winner's tag after them whole or not at all: one line high,
   it wraps to a hidden second line when there's no room for it. */
.player {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  height: 1lh;
  overflow: hidden;
}
.who {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Six icons wide, whatever the team (five, or none known), so the records line up down the column. */
.team {
  display: flex;
  width: calc(6 * 40px);
}
.chevron {
  display: flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
/* Its record, wins–losses; a player who dropped, marked so. */
.record {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.record.dropped {
  color: var(--muted);
}
.drop {
  margin-left: 4px;
  padding: 0 3px;
  font-size: 0.75em;
  font-weight: bold;
  border: 1px solid var(--border-strong);
}
.team-tools {
  display: flex;
  justify-content: flex-end;
  margin: 0;
  padding: 0 4px 12px;
}
.no-team {
  margin: 0;
  padding: 4px 4px 12px 3.5em;
}
/* On phones, the team under the name: across the whole row, indented to the name, so its six fit on one line however
   wide the record is. */
@media (max-width: 560px) {
  .player-row {
    grid-template-columns: 3em minmax(0, 1fr) auto auto;
    grid-template-areas: 'placing player record chevron' 'team team team team';
  }
  .record {
    grid-area: record;
  }
  .placing {
    grid-area: placing;
    align-self: start;
  }
  .player {
    grid-area: player;
  }
  .team {
    /* Its icons at their desktop size: six in a row where they fit, else three by two (below, by the row's width). */
    --icon-scale: 1;
    grid-area: team;
    display: grid;
    grid-template-columns: repeat(6, 40px);
    width: auto;
    padding-left: calc(3em + 8px);
  }
  .chevron {
    grid-area: chevron;
  }
}
/* No team, a line of text where its icons would be: not in their grid, where it'd wrap a word to an icon's column. */
.team.none {
  display: block;
  white-space: nowrap;
}
/* A row too narrow for six icons after its padding and the name's indent (4px each side, 3em and a gap, 6 × 40px:
   about 301px on a phone): three by two. */
@container standing (max-width: 300px) {
  .team {
    grid-template-columns: repeat(3, 40px);
  }
}
</style>
