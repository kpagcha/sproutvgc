<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { available, pokemon } from '@/data/dex'
import { datasetDates, percent, regulationSnapshot } from '@/data/meta'
import { splitForme } from '@/data/pokemon'
import { eventOf, loadRounds, loadStandings, type Round, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { passesGroups } from '@/lib/filterGroups'
import type { NamedLocation } from '@/lib/links'
import { fold } from '@/lib/search'
import type { Term, TermFilters } from '@/lib/searchTerms'
import {
  DAYS,
  decidedMatches,
  chartReach,
  MIN_MATCHES,
  pinned,
  playersOf,
  pokemonStats,
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
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortHeader from '@/components/SortHeader.vue'
import TeamSets from '@/components/TeamSets.vue'
import WinRateChart from '@/components/WinRateChart.vue'

// One official tournament: what it was (type, date, country, players, how many made Day 2), the way to its
// regulation's meta, and two tabs, a page each: its standings (`/meta/tournaments/:id`: the whole field in three
// parts, the top cut, the rest of Day 2 and Day 1, Day 1 folded away until asked for; searched by player and filtered
// by a Pokémon, item, ability or move a team has, `?f=`, every player found then shown) and its Pokémon
// (`/meta/tournaments/:id/pokemon`: the whole event's, Day 2's or the top cut's, `?day=`, each one's share of those
// teams and how they did in those rounds' matches, by usage or win rate, the top ones or all, each leading to the
// standings filtered to the teams with it, and to its meta page on its regulation's data).
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
const {
  sorted: sortedStats,
  key: statKey,
  desc: statDesc,
  toggle: sortStats,
} = useSort({
  rows: stats,
  value: (s, k: 'usage' | 'winRate') => (k === 'usage' ? s.teams : (s.winRate ?? -1)),
  initial: 'usage',
  startsDesc: () => true,
  locale,
})
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
// to filter them by, a team with it (`?f=`, `?fm=`; the Pokémon tab's rows link here with theirs).
type Placed = Standing & { placing: number }
const KINDS = ['pokemon', 'item', 'ability', 'move'] as const
const filters = useUrlFilters(() => KINDS)
const preview = shallowRef<TermFilters | null>(null)
const query = ref('')
watch(id, () => (query.value = ''))
function matches(s: Placed, f: Term) {
  if (f.kind === 'pokemon') return s.team.some(([p]) => p === f.id)
  if (f.kind === 'item') return s.team.some(([, it]) => it === f.id)
  if (f.kind === 'ability') return s.team.some(([, , ab]) => ab === f.id)
  if (f.kind === 'move') return s.team.some(([, , , , moves]) => (moves as string[]).includes(f.id))
  return false
}
const passes = (s: Placed, f: TermFilters) => passesGroups(f, (x) => matches(s, x))
const named = (s: Placed, q: string) => fold(s.player).includes(q)
const count = (f: TermFilters) => (standings.value ?? []).filter((s) => passes(s, f)).length
const nameCount = computed(() => {
  const q = fold(query.value.trim())
  return q ? (standings.value ?? []).filter((s) => named(s, q) && passes(s, filters.value)).length : 0
})
/** The Pokémon filtered by (not those filtered out), each with its numbers as the Pokémon tab's list has them, the whole
 * event's, and its place there by usage. */
const filteredStats = computed(() => {
  const ids = new Set(
    filters.value.groups.flatMap((g) => g.terms.filter((f) => f.kind === 'pokemon' && !f.not).map((f) => f.id)),
  )
  const all = standings.value && rounds.value ? pokemonStats(standings.value, rounds.value, 'all') : []
  return all.flatMap((s, i) => (ids.has(s.id) ? [{ s, rank: i + 1 }] : []))
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

const num = (n: number) => n.toLocaleString(locale.value)
const ordinal = (n: number) => `#${n}`
</script>

<template>
  <div v-if="event">
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
      <BandTabs :label="t('tournaments.tabs')" :current="tab" :tabs />
      <FilterSearch
        v-model:text="query"
        v-model:filters="filters"
        v-model:preview="preview"
        class="standings-search"
        :subject="t('filter.subject.players')"
        :name-count="nameCount"
        :kinds="KINDS"
        :count
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
        </div>
        <div v-for="{ s, rank } in filteredStats" :key="s.id" class="fs-row" role="row">
          <span role="cell">
            <AppLink :to="{ name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }" class="mon">
              <PokemonIcon :id="s.id" /><span class="mon-name"
                ><span>{{ monName(s.id).species }}</span
                ><span v-if="monName(s.id).forme" class="forme">{{ monName(s.id).forme }}</span></span
              >
            </AppLink>
          </span>
          <span role="cell" class="r num muted">{{ rank }}</span>
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
                ><AppLink :to="{ name: 'tournamentPlayer', params: { id, placing: String(s.placing) } }" class="name">{{
                  s.player
                }}</AppLink>
                <span class="muted small">{{ s.country }}</span
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
              <TeamSets :team="s.team" />
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
    <section v-else class="panel banded">
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
      <div v-if="standings && rounds" class="dex-table stats" role="table" :aria-label="t('tournaments.pokemonStats')">
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
          <div role="columnheader" :aria-label="t('tournaments.toMeta')"></div>
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
              <AppLink :to="{ name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }" class="to-meta"
                >{{ t('tournaments.toMeta') }} ›</AppLink
              >
            </div>
          </div>
        </template>
      </div>
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
  grid-template-columns: minmax(0, 1fr) 3rem 7rem 7rem 7rem;
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
.filtered-stats .meter,
.filtered-stats .wr {
  --inset: 0px;
}
@media (max-width: 720px) {
  .filtered-stats {
    grid-template-columns: minmax(0, 1fr) 2rem 4.5rem 4.5rem 5.5rem;
    column-gap: 8px;
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
  --cols: 2.5rem minmax(0, 1fr) 5rem 5.5rem 6rem 4rem;
}
/* On phones, each row two lines (the header's too), so the name has the width and each number room for its bar: its
   rank, its Pokémon and the way to its meta page, then its usage, win rate and record, a third of the width each. */
@media (max-width: 720px) {
  .dex-table.stats {
    --cols: 1.75rem repeat(3, minmax(0, 1fr));
  }
  .dex-table.stats .row {
    grid-template-areas: 'rank mon mon meta' 'rank usage wr record';
  }
  .dex-table.stats .row > :nth-child(1) {
    grid-area: rank;
    align-self: start;
  }
  .dex-table.stats .row > :nth-child(2) {
    grid-area: mon;
  }
  .dex-table.stats .row > :nth-child(3) {
    grid-area: usage;
  }
  .dex-table.stats .row > :nth-child(4) {
    grid-area: wr;
  }
  .dex-table.stats .row > :nth-child(5) {
    grid-area: record;
  }
  .dex-table.stats .row > :nth-child(6) {
    grid-area: meta;
  }
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
/* A record, muted, the larger of its wins and losses in the text's color and bold. */
.record-wl {
  color: var(--muted);
}
.record-wl .more {
  font-weight: bold;
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
  /* Room above it when a link scrolls to it. */
  scroll-margin-top: 12px;
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
  margin-left: 8px;
  padding: 0 5px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  vertical-align: 0.15em;
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
.player {
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
