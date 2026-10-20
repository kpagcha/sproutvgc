<script setup lang="ts">
import { computed, h, nextTick, ref, render, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { ability, available, item, move, pokemon } from '@/data/dex'
import { datasetDates, percent, regulationSnapshot } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureEffects, natureName } from '@/data/natures'
import { POKEMON, splitForme, spriteUrl } from '@/data/pokemon'
import { eventOf, listed, loadRounds, loadStandings, type Round, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { passesGroups } from '@/lib/filterGroups'
import type { NamedLocation } from '@/lib/links'
import { fold } from '@/lib/search'
import type { Term, TermFilters } from '@/lib/searchTerms'
import { DAYS, decidedMatches, playersOf, pokemonStats, type Day, type PokemonStat } from '@/lib/tournamentStats'
import { useSort } from '@/composables/useSort'
import { useUrlFilters } from '@/composables/useUrlFilters'
import AppLink from '@/components/AppLink'
import BandTabs from '@/components/BandTabs.vue'
import DexRef from '@/components/DexRef'
import EffectTag from '@/components/EffectTag'
import FilterSearch from '@/components/FilterSearch.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'

// One official tournament: what it was (type, date, country, players, how many made Day 2), the way to its
// regulation's meta, and two tabs, a page each: its standings (`/meta/tournaments/:id`: the whole field in three
// parts, the top cut, the rest of Day 2 and Day 1, Day 1 folded away until asked for; searched by player and filtered
// by a Pokémon, item, ability or move a team has, `?f=`, every player found then shown) and its Pokémon
// (`/meta/tournaments/:id/pokemon`: the whole event's, Day 2's or the top cut's, `?day=`, each one's share of those
// teams and how they did in those rounds' matches, by usage or win rate, the top ones or all, each leading to the
// standings filtered to the teams with it, and to its meta page on its regulation's data).
// Each player's placing, name and country, record (marked when they dropped), and the six they brought, as icons;
// unfolded, their whole sets, a card each, each entry leading to its meta page: its sprite and types in a band, its item after the types, then its ability and nature (the stats it raises and lowers
// on hover) on a line, and its moves two by two (on phones, one under another), each with its type's badge. A
// player whose team list isn't there has the Pokémon alone.
// A nature says what it does on hover, or tapped, as on a Pokémon's meta page: the stat it raises and the one it
// lowers, each with its chevron. Drawn once per nature, the tooltips sharing it.
const natureTips = new Map<string, Element>()
function natureTip(id: string) {
  const e = natureEffects(id)
  if (!e) return t('usageMon.natureNeutral')
  let el = natureTips.get(id)
  if (!el) {
    el = document.createElement('span')
    render(
      h('span', [h(EffectTag, { effect: 'up', stat: e.plus }), ' ', h(EffectTag, { effect: 'down', stat: e.minus })]),
      el,
    )
    natureTips.set(id, el)
  }
  return el
}
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
/** The fewest matches a win rate is worth sorting by, per day: Pokémon with fewer go after the rest, by usage, whichever
 * way the win rates run, so a 2–0 doesn't top the list. Less for the smaller days: the top cut's most played Pokémon
 * often have under 20. */
const MIN_MATCHES: Record<Day, number> = { all: 20, day2: 10, cut: 5 }
const minMatches = computed(() => MIN_MATCHES[day.value])
const enough = (s: PokemonStat) => s.wins + s.losses >= minMatches.value
/** The day's Pokémon as sorted, those with too few matches last when sorted by win rate. */
const rankedStats = computed(() =>
  statKey.value === 'winRate'
    ? [...sortedStats.value.filter(enough), ...stats.value.filter((s) => !enough(s))]
    : sortedStats.value,
)
/** Where those with too few matches start, when sorted by win rate and some are, a line over them saying so. */
const fewFrom = computed(() => (statKey.value === 'winRate' ? rankedStats.value.findIndex((s) => !enough(s)) : -1))
/** How far from even a win rate's bar can reach, its half filled from there on: most sit close to even (a Pokémon on
 * many teams meets itself often, a win and a loss), so the bar's scale is that close range, not 0% to 100%. */
const WR_RANGE = 0.1
/** How far from even a win rate is in standard errors, (wins − losses) / √matches: how much it can be gone by, a
 * small gap over many matches counting for more than a large one over a few. Its bar is faint up to 1, solid from 2. A
 * guide, not a test: a team's six share each result, and a team plays every round. */
const evidence = (s: PokemonStat) => Math.abs(s.wins - s.losses) / Math.sqrt(s.wins + s.losses)
const strength = (s: PokemonStat) => Math.min(Math.max(evidence(s) - 1, 0), 1)
const wrStyle = (s: PokemonStat) =>
  s.winRate === null
    ? undefined
    : { '--dev': Math.min(Math.abs(s.winRate - 0.5) / WR_RANGE, 1), '--strength': strength(s) }
/** Whether a win rate could be chance, its number faint too. */
const unsure = (s: PokemonStat) => evidence(s) < 1
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
            :class="{ open: open.has(s.placing) }"
          >
            <button
              type="button"
              class="player-row"
              :aria-expanded="open.has(s.placing)"
              :aria-label="t('tournaments.rowLabel', { placing: s.placing, player: s.player })"
              @click="toggle(s.placing)"
            >
              <span class="placing num">{{ ordinal(s.placing) }}</span>
              <span class="player"
                >{{ s.player }} <span class="muted small">{{ s.country }}</span></span
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
              <component :is="open.has(s.placing) ? ChevronUp : ChevronDown" :size="16" class="chevron" />
            </button>
            <!-- Its whole sets, a card each. -->
            <p v-if="open.has(s.placing) && !s.team.length" class="muted small no-team">
              {{ t('tournaments.noTeam') }}
            </p>
            <ul v-else-if="open.has(s.placing)" class="sets">
              <li v-for="([mon, it, ab, nature, moves], i) in s.team" :key="i" class="set">
                <div class="set-head">
                  <img
                    v-if="!POKEMON[mon]?.noSprite"
                    class="pixel set-sprite"
                    :src="spriteUrl(mon)"
                    alt=""
                    width="96"
                    height="96"
                    loading="lazy"
                    draggable="false"
                  />
                  <span v-else class="set-sprite icon-sprite"><PokemonIcon :id="mon" /></span>
                  <span class="set-who">
                    <DexRef :to="pokemon(mon)" meta class="set-name" />
                    <span class="set-types">
                      <TypeIcon v-for="ty in POKEMON[mon]?.types ?? []" :key="ty" :type="ty" />
                      <span v-if="listed([mon, it, ab, nature, moves])" class="set-item">
                        <template v-if="it"><ItemIcon :id="it" /><DexRef :to="item(it)" meta /></template>
                        <span v-else class="muted">{{ t('usageMon.noItem') }}</span>
                      </span>
                    </span>
                  </span>
                </div>
                <p v-if="!listed([mon, it, ab, nature, moves])" class="muted small no-list">
                  {{ t('tournaments.noList') }}
                </p>
                <div v-else-if="ab || nature" class="set-facts">
                  <DexRef v-if="ab" :to="ability(ab)" meta />
                  <span v-if="ab && nature" class="muted" aria-hidden="true">·</span>
                  <span v-if="nature" v-tip:group="natureTip(nature)" class="muted">{{ natureName(nature) }}</span>
                </div>
                <ul v-if="moves.length" class="set-moves">
                  <li v-for="mv in moves" :key="mv" class="set-move">
                    <TypeIcon v-if="MOVES[mv]" :type="MOVES[mv].type" /><DexRef :to="move(mv)" meta />
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </template>
      </ol>
      <!-- Day 1's players, folded away until asked for. -->
      <button v-if="day1Folded" type="button" class="more-toggle" @click="day1Shown = true">
        <ChevronDown :size="14" aria-hidden="true" />{{ t('tournaments.showDay1', { n: num(day1Folded) }) }}
      </button>
      <!-- Where it's from, at the end of the page. -->
      <p class="muted note">
        {{ t('usage.from') }} <a :href="event.url" rel="noopener">{{ event.provider.name }}</a>
      </p>
    </section>

    <!-- Its Pokémon: the day's, each one's usage, win rate and record. -->
    <section v-else class="panel banded">
      <BandTabs :label="t('tournaments.tabs')" :current="tab" :tabs />
      <SegmentedControl
        v-model="day"
        class="day-choice"
        :label="t('tournaments.teamsOf')"
        :options="DAYS.map((d) => ({ value: d, label: t(`tournaments.day.${d}`) }))"
      />
      <p class="muted small about">{{ about }}</p>
      <p v-if="!standings || !rounds" class="muted">{{ t('tournaments.loading') }}</p>
      <div v-else class="dex-table stats" role="table" :aria-label="t('tournaments.pokemonStats')">
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
.note {
  margin: 12px 0 0;
}
/* The standings' search, over them; the list faded while it shows what a filter highlighted would leave. */
.standings-search {
  margin-bottom: 12px;
}
.standings.previewing {
  opacity: 0.75;
}
/* The Pokémon: the day they're of, then their table as the rankings' (rank, Pokémon, usage, win rate, record, the way
   to its meta page), the top ones and a toggle for the rest. */
.day-choice {
  margin-bottom: 8px;
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
   in the bad below, as far as it's from even (`--dev`, 0 to 1, the half filled `WR_RANGE` from even), as solid as it
   can be gone by (`--strength`, 0 to 1); one that could be chance, its number faint too. */
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
  width: 100%;
  padding: 6px 4px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.player-row:hover {
  background: var(--hover);
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
  color: var(--muted);
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
.no-list {
  margin: 0;
  padding: 8px 10px;
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
/* Its whole sets, a card each: three to a row, a team in two even rows; two, then one, on narrower screens. */
.sets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 4px 4px 12px;
  list-style: none;
}
/* A set: an ink-framed card with a hard shadow. */
.set {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--ink);
  box-shadow: var(--hard-sm);
}
/* Its head: a band in the panel's other shade, the sprite at the left wholly inside it, its name and types beside
   it. */
.set-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 10px 2px 6px;
  background: var(--panel-alt);
  border-bottom: 1px solid var(--ink);
}
.set-sprite {
  flex: none;
  /* Half its size: an even scale, so its pixels stay even. */
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.set-who {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.set-name {
  font-size: 1.05em;
  font-weight: bold;
}
.set-types {
  /* Type badges at their desktop size on phones too, as small as the text. */
  --icon-scale: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
/* Its item after the type badges, at their height, a little apart from them. */
.set-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-left: 6px;
  font-size: 0.92em;
  font-weight: bold;
}
.set-item :deep(a) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Its ability and, muted, its nature, on one line. */
.set-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  padding: 8px 10px 4px;
  font-weight: bold;
}
/* Its moves, two by two: each a chip, its type's badge and its name. */
.set-moves {
  --icon-scale: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
  padding: 4px 8px 8px;
  list-style: none;
}
.set-move {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 3px 5px 3px 3px;
  font-size: 0.9em;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.set-move :deep(a) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .sets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* Its moves one under another, the cards being narrow. */
  .set-moves {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 420px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
