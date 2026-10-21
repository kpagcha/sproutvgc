<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { datasetDates } from '@/data/meta'
import { eventOf, loadRounds, loadStandings, type Round, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { medalOf, playerMatches, type PlayerMatch } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CopyPaste from '@/components/CopyPaste.vue'
import CountryFlag from '@/components/CountryFlag'
import PokemonIcon from '@/components/PokemonIcon'
import SectionNav from '@/components/SectionNav.vue'
import TeamSets from '@/components/TeamSets.vue'

// A player of an official tournament (`/meta/tournaments/:id/players/:placing`): who they are, their placing (a medal
// in the top 8), record and how far they made it, the event they played; their team, its whole sets (`TeamSets`), to copy as a paste under them (`CopyPaste`); and
// their matches round by round, by day (Day 1, Day 2, the top cut, each with their record that day), each its round
// (the top cut's by name: Quarterfinals, Semifinals, Final), its result, and their opponent (placing, name, record and
// six as icons), leading to the opponent's own page. Its sections, the team and the matches, a row of links stuck to the
// top, the one being read marked (`SectionNav`).
const route = useRoute()
const id = computed(() => String(route.params.id))
const placing = computed(() => Number(route.params.placing))
const event = computed(() => eventOf(id.value))

type Placed = Standing & { placing: number }
const standings = shallowRef<Placed[] | null>(null)
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
const byPlacing = computed(() => new Map((standings.value ?? []).map((s) => [s.placing, s])))
const player = computed(() => byPlacing.value.get(placing.value))

/** How far they made it: the top cut, Day 2, or Day 1. */
const reached = computed(() => (player.value?.topCut ? 'topCut' : player.value?.day2 ? 'day2' : 'day1'))

const PARTS = [
  { phase: 1, key: 'day1' },
  { phase: 2, key: 'day2' },
  { phase: 3, key: 'topCut' },
] as const
/** Their matches by day, those there are, each with the opponent's standing, and each day with their record in it (byes counting as wins, as the standings
 * count them). */
const days = computed(() => {
  const all = rounds.value ? playerMatches(rounds.value, placing.value) : []
  return PARTS.map(({ phase, key }) => {
    const matches = all
      .filter((m) => m.phase === phase)
      .map((m) => ({ ...m, opp: m.opponent === null ? undefined : byPlacing.value.get(m.opponent) }))
    const wins = matches.filter((m) => m.result === 'win' || m.result === 'bye').length
    const losses = matches.filter((m) => m.result === 'loss').length
    const ties = matches.filter((m) => m.result === 'tie').length
    return { key, matches, wins, losses, ties }
  }).filter((d) => d.matches.length)
})
/** Their record over the Swiss, Day 1 and Day 2 together, for those who played Day 2 (a Day 1's alone is its own). */
const swiss = computed(() => {
  const parts = days.value.filter((d) => d.key !== 'topCut')
  if (!parts.some((d) => d.key === 'day2')) return undefined
  const sum = (k: 'wins' | 'losses' | 'ties') => parts.reduce((n, d) => n + d[k], 0)
  return { wins: sum('wins'), losses: sum('losses'), ties: sum('ties') }
})

/** A round's name: the top cut's by how many were left after it, the Swiss' by number. */
function roundName(m: PlayerMatch) {
  if (m.left === undefined) return t('tournaments.round', { n: m.round })
  return m.left <= 2
    ? t(`tournaments.cutRound.${m.left as 0 | 1 | 2}`)
    : t('tournaments.cutRound.n', { n: 2 ** (m.left + 1) })
}

// Its sections, as the row of links at its top lists them.
const sections = computed(() => [
  { id: 'sec-team', label: t('tournaments.team') },
  { id: 'sec-matches', label: t('tournaments.matches') },
])

const num = (n: number) => n.toLocaleString(locale.value)
const record = (w: number, l: number, ties = 0) => `${w}–${l}${ties ? `–${ties}` : ''}`
</script>

<template>
  <div v-if="event && standings && !player" class="panel">
    <p class="muted">{{ t('tournaments.noPlayer') }}</p>
    <AppLink :to="{ name: 'tournament', params: { id } }">{{ t('tournaments.standings') }} ›</AppLink>
  </div>
  <div v-else-if="event">
    <!-- Its sections, a row of links stuck to the top, the one being read marked. -->
    <SectionNav v-if="player" :sections="sections" />
    <div class="panel">
      <p v-if="!player" class="muted">{{ t('tournaments.loading') }}</p>
      <template v-else>
        <div class="title">
          <span class="placing num" :class="medalOf(player.placing)">#{{ player.placing }}</span>
          <h1>{{ player.player }}</h1>
          <CountryFlag :code="player.country" />
          <span v-if="player.placing === 1" class="champion">{{ t('tournaments.champion') }}</span>
        </div>
        <p class="facts">
          <span class="record num">{{ record(player.wins, player.losses) }}</span>
          <span v-tip="t('tournaments.reachedTip')">{{ t(`tournaments.reached.${reached}`) }}</span>
          <span v-if="player.dropped" class="muted">{{
            t('tournaments.droppedAfter', { round: player.dropped })
          }}</span>
        </p>
        <p class="facts muted">
          <AppLink :to="{ name: 'tournament', params: { id } }" class="event">{{ event.name }}</AppLink>
          <span>{{ datasetDates({ from: event.date, to: event.date }) }}</span>
          <span>{{ t('meta.regulation', { reg: event.regulation }) }}</span>
          <span>{{ t('tournaments.players', { n: num(event.players) }) }}</span>
        </p>
      </template>
    </div>

    <section v-if="player" id="sec-team" class="panel">
      <h2>{{ t('tournaments.team') }}</h2>
      <TeamSets v-if="player.team.length" :team="player.team" />
      <!-- The way to copy it as a paste, under its sets at their right. -->
      <p v-if="player.team.length" class="team-tools"><CopyPaste :team="player.team" /></p>
      <p v-else class="muted">{{ t('tournaments.noTeam') }}</p>
    </section>

    <section v-if="player" id="sec-matches" class="panel">
      <h2>{{ t('tournaments.matches') }}</h2>
      <p v-if="!rounds" class="muted">{{ t('tournaments.loading') }}</p>
      <ol v-else class="matches">
        <template v-for="d in days" :key="d.key">
          <li class="part-head">
            <span>{{ t(`tournaments.part.${d.key}`) }}</span>
            <span class="num">{{ record(d.wins, d.losses, d.ties) }}</span>
          </li>
          <li v-for="m in d.matches" :key="m.round" class="match">
            <!-- Leading to the opponent's page; a bye, or an opponent since disqualified, leading nowhere. -->
            <AppLink
              v-if="m.opp"
              :to="{ name: 'tournamentPlayer', params: { id, placing: String(m.opp.placing) } }"
              class="match-row linked"
            >
              <span class="round">{{ roundName(m) }}</span>
              <span v-tip="t(`tournaments.resultTip.${m.result}`)" class="result" :class="m.result">{{
                t(`tournaments.result.${m.result}`)
              }}</span>
              <span class="opponent"
                ><span class="muted num">#{{ m.opp.placing }}</span> {{ m.opp.player }}
                <CountryFlag :code="m.opp.country"
              /></span>
              <span class="opp-record num muted">{{ record(m.opp.wins, m.opp.losses) }}</span>
              <span v-if="m.opp.team.length" class="team" aria-hidden="true">
                <PokemonIcon v-for="(slot, i) in m.opp.team" :id="slot[0]" :key="i" />
              </span>
              <span v-else class="team none muted small">{{ t('tournaments.noList') }}</span>
            </AppLink>
            <div v-else class="match-row">
              <span class="round">{{ roundName(m) }}</span>
              <span v-tip="t(`tournaments.resultTip.${m.result}`)" class="result" :class="m.result">{{
                t(`tournaments.result.${m.result}`)
              }}</span>
              <span class="opponent muted">{{
                m.result === 'bye' ? t('tournaments.byeOpponent') : t('tournaments.goneOpponent')
              }}</span>
            </div>
          </li>
          <!-- After Day 2's matches, their record over the whole Swiss, before the top cut. -->
          <li v-if="d.key === 'day2' && swiss" class="part-total">
            <span v-tip="t('tournaments.swissRecordTip')">{{ t('tournaments.swissRecord') }}</span>
            <span class="num">{{ record(swiss.wins, swiss.losses, swiss.ties) }}</span>
          </li>
        </template>
      </ol>
    </section>
  </div>
  <div v-else class="panel">
    <p class="muted">{{ t('tournaments.unknown') }}</p>
    <AppLink :to="{ name: 'tournaments' }">{{ t('title.tournaments') }} ›</AppLink>
  </div>
</template>

<style scoped>
/* Their placing, name, country and, for the winner, a tag, on one line, wrapping on narrow screens. */
.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-bottom: 6px;
}
.title h1 {
  margin: 0;
}
.placing {
  font-weight: bold;
}
.champion {
  padding: 0 5px;
  font-size: 0.75em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #141414;
  background: var(--gold);
  border: 1px solid var(--ink);
}
/* What they did, then the event they played, each a line, dot-separated, wrapping between them: each dot ends the one
   before it, so a line never starts with one. */
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  margin: 0 0 4px;
}
.facts > * {
  white-space: nowrap;
}
.facts > :not(:last-child)::after {
  content: '·';
  margin: 0 6px;
  color: var(--muted);
}
.facts .record {
  font-weight: bold;
}
.event {
  font-weight: bold;
}
h2 {
  margin: 0 0 8px;
}
/* Room above a section scrolled to for the row of links stuck to the top. */
section {
  scroll-margin-top: 48px;
}
.team-tools {
  display: flex;
  justify-content: flex-end;
  margin: 0;
  padding: 0 4px;
}
.small {
  font-size: 0.875em;
}
.matches {
  margin: 0;
  padding: 0;
  list-style: none;
}
.match + .match {
  border-top: 1px solid var(--border);
}
/* A day's name and their record that day, over its matches: a strip in the panel's other shade between ink lines, as
   the standings' parts are. */
.part-head {
  display: flex;
  justify-content: space-between;
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
/* Their record over the Swiss, closing Day 2: its strip's look, under a thinner line. */
.part-total {
  display: flex;
  justify-content: space-between;
  padding: 5px 8px;
  font-size: 0.85em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--panel-alt);
  border-top: 1px solid var(--ink);
}
/* A match: its round, its result, the opponent and their record, their six as icons. */
.match-row {
  display: grid;
  grid-template-columns: 8.5em 3em minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  color: inherit;
}
.match-row.linked:hover {
  background: var(--hover);
  text-decoration: none;
}
.round {
  font-weight: bold;
  white-space: nowrap;
}
/* The result as a square badge: won in the good color, lost in the bad, a tie or a bye plain. */
.result {
  justify-self: start;
  min-width: 2.2em;
  padding: 1px 4px;
  font-size: 0.85em;
  font-weight: bold;
  text-align: center;
  border: 1px solid var(--ink);
}
.result.win {
  color: #fff;
  background: var(--good);
}
.result.loss {
  color: #fff;
  background: var(--bad);
}
.result.tie,
.result.bye {
  background: var(--panel-alt);
}
.opponent {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: bold;
}
.opponent .muted {
  font-weight: normal;
}
.opp-record {
  white-space: nowrap;
}
/* Six icons wide, whatever the team, so the records line up down the column, as the standings'. */
.team {
  display: flex;
  width: calc(6 * 40px);
}
.team.none {
  display: block;
  white-space: nowrap;
}
/* On phones, three lines: the match (the result, a smaller badge, and its round, a smaller label, after it), the
   opponent with their record at the end, then their six, the opponent having the row's width; three a row, in two,
   where six don't fit. A bye's or a gone opponent's line is the opponent's. */
@media (max-width: 560px) {
  .match {
    container: match / inline-size;
  }
  .match-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'result round round' 'opponent opponent record' 'team team team';
    gap: 2px 8px;
    padding: 8px 4px;
  }
  .round {
    grid-area: round;
    font-size: 0.85em;
  }
  .result {
    grid-area: result;
    min-width: 2em;
    padding: 0 3px;
    font-size: 0.75em;
  }
  .opponent {
    grid-area: opponent;
  }
  .opp-record {
    grid-area: record;
  }
  .team {
    --icon-scale: 1;
    grid-area: team;
    display: grid;
    grid-template-columns: repeat(6, 40px);
    width: auto;
  }
}
/* The row's padding leaves under six icons' width. */
@container match (max-width: 247px) {
  .team {
    grid-template-columns: repeat(3, 40px);
  }
}
</style>
