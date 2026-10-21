<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Round, Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { passesGroups } from '@/lib/filterGroups'
import { fold } from '@/lib/search'
import type { TermFilters } from '@/lib/searchTerms'
import { detailsIn, teamHas, TEAM_KINDS } from '@/lib/teamFilters'
import { bracketOf, recordsBefore } from '@/lib/tournamentStats'
import { useGradualRows } from '@/composables/useGradualRows'
import { useUrlFilters } from '@/composables/useUrlFilters'
import AppLink from '@/components/AppLink'
import BracketMatch from '@/components/BracketMatch.vue'
import CountryFlag from '@/components/CountryFlag'
import FilterSearch from '@/components/FilterSearch.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A tournament's rounds (`TournamentView`'s Rounds tab, `/meta/tournaments/:id/rounds`): picked from a row of them by
// day (`?round=`), the top cut, the default, as a bracket (each round a column, its matches lined up with the next
// round's they lead to, `BracketMatch`; a first round with byes a play-in over it, its matches alone), a Swiss round as its pairings, the players' records going into it, the most wins first,
// searched by player and filtered by what a team has as the standings are (`?f=`; a match found when either team is,
// its side marked). Each match its two players, their placing, name (the way to their page), country and six as icons,
// the winner's in bold, a bye's second side saying so ("Bye" in the bracket).
type Placed = Standing & { placing: number }
const props = defineProps<{ id: string; standings: readonly Placed[]; rounds: Record<number, Round> }>()

const route = useRoute()
const router = useRouter()
const byPlacing = computed(() => new Map(props.standings.map((s) => [s.placing, s])))

const PHASES = [
  { phase: 1, key: 'day1' },
  { phase: 2, key: 'day2' },
] as const
/** The Swiss rounds by day, for the row they're picked from. */
const groups = computed(() =>
  PHASES.map(({ phase, key }) => ({
    key,
    rounds: Object.entries(props.rounds)
      .filter(([, r]) => r.phase === phase)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b),
  })).filter((g) => g.rounds.length),
)
const bracket = computed(() => bracketOf(props.rounds))
type Match = Round['matches'][number]
const winnerOf = (m: Match) => (m[2] === 1 ? m[0] : m[2] === 2 ? m[1] : null)
/** The top cut's first round, when it has byes (the cut not a power of two, the top seeds skipping it): a play-in, its
 * matches played alone, each with whom its winner faced in the round after, over the bracket, which starts there. */
const playIn = computed(() => {
  const [first, next] = bracket.value
  if (!first || !next || !first.matches.some((m) => m[1] === null)) return null
  return first.matches
    .filter((m) => m[1] !== null)
    .map((m) => {
      const w = winnerOf(m)
      const after = w === null ? undefined : next.matches.find(([a, b]) => a === w || b === w)
      return { m, faces: after && (after[0] === w ? after[1] : after[0]) }
    })
})
const columns = computed(() => (playIn.value ? bracket.value.slice(1) : bracket.value))
/** Those who came through the play-in, marked in the bracket. */
const playedIn = computed(() => new Set((playIn.value ?? []).flatMap(({ m }) => winnerOf(m) ?? [])))
const lastRound = computed(() => Math.max(...Object.keys(props.rounds).map(Number)))
/** The round shown, kept in the URL (`?round=`): a Swiss one by number; the top cut unless one's picked (the last
 * round, with no top cut). */
const round = computed<number | 'cut'>({
  get: () => {
    const n = Number(route.query.round)
    if (Number.isInteger(n) && props.rounds[n] && props.rounds[n].phase !== 3) return n
    return bracket.value.length ? 'cut' : lastRound.value
  },
  set: (r) => void router.replace({ query: { ...route.query, round: r === 'cut' ? undefined : String(r) } }),
})

/** A top cut round's name, by how many were left after it, as a player's matches name it. */
const cutName = (left: number) =>
  left <= 2 ? t(`tournaments.cutRound.${left as 0 | 1 | 2}`) : t('tournaments.cutRound.n', { n: 2 ** (left + 1) })

// The search, a Swiss round's: its text finds players by name, its filters teams, a match found when either side is.
const filters = useUrlFilters(() => TEAM_KINDS, true)
const preview = shallowRef<TermFilters | null>(null)
const query = ref('')
const detailsOf = (pid: Parameters<typeof detailsIn>[1]) => detailsIn(props.standings, pid)
const sideOf = (p: number | null) => (p === null ? undefined : byPlacing.value.get(p))
const passes = (s: Placed | undefined, f: TermFilters) => !!s && passesGroups(f, (x) => teamHas(s.team, x))
const named = (s: Placed | undefined, q: string) => !!s && fold(s.player).includes(q)
/** Whether a side is one the search found, to mark it: only while it's narrowed. */
const hit = (s: Placed | undefined) => {
  const q = fold(query.value.trim())
  const f = filters.value
  if (!q && !f.groups.length) return false
  return (!q || named(s, q)) && (!f.groups.length || passes(s, f))
}
const swiss = computed(() => (round.value === 'cut' ? [] : (props.rounds[round.value]?.matches ?? [])))
const records = computed(() => (round.value === 'cut' ? new Map() : recordsBefore(props.rounds, round.value)))
const wins = (p: number | null) => (p === null ? -1 : (records.value.get(p)?.[0] ?? 0))
/** The round's pairings, the most wins going in first, then the better placed. */
const pairings = computed(() =>
  [...swiss.value].sort(
    (x, y) =>
      Math.max(wins(y[0]), wins(y[1])) - Math.max(wins(x[0]), wins(x[1])) ||
      Math.min(x[0], x[1] ?? Infinity) - Math.min(y[0], y[1] ?? Infinity),
  ),
)
const found = (m: Match, f: TermFilters, q: string) =>
  [sideOf(m[0]), sideOf(m[1])].some((s) => passes(s, f) && (!q || named(s, q)))
const count = (f: TermFilters) => swiss.value.filter((m) => found(m, f, '')).length
const nameCount = computed(() => {
  const q = fold(query.value.trim())
  return q ? swiss.value.filter((m) => found(m, filters.value, q)).length : 0
})
const shownPairings = computed(() => {
  const q = preview.value ? '' : fold(query.value.trim())
  const f = preview.value ?? filters.value
  return q || f.groups.length ? pairings.value.filter((m) => found(m, f, q)) : pairings.value
})
const drawn = useGradualRows(shownPairings)

/** A match's two sides: each its player (none for a bye's second, or one since disqualified), whether they won, and
 * their record going in, on a Swiss round. */
const sides = (m: Match) =>
  ([m[0], m[1]] as const).map((p, i) => ({
    p,
    s: sideOf(p),
    won: m[2] === i + 1,
    lost: m[2] !== 0 && m[2] !== i + 1,
    record: p === null || round.value === 'cut' ? undefined : records.value.get(p),
  }))

const num = (n: number) => n.toLocaleString(locale.value)
const recordText = (r: [number, number, number] | undefined) => (r ? `${r[0]}–${r[1]}${r[2] ? `–${r[2]}` : ''}` : '0–0')
</script>

<template>
  <!-- The rounds, by day, then the top cut. -->
  <nav class="round-picker" :aria-label="t('tournaments.roundsPick')">
    <div v-for="g in groups" :key="g.key" class="round-group">
      <span class="group-label">{{ t(`tournaments.part.${g.key}`) }}</span>
      <span class="segments">
        <button
          v-for="n in g.rounds"
          :key="n"
          type="button"
          :class="{ on: round === n }"
          :aria-pressed="round === n"
          :aria-label="t('tournaments.round', { n })"
          @click="round = n"
        >
          {{ n }}
        </button>
      </span>
    </div>
    <div v-if="bracket.length" class="round-group">
      <span class="segments">
        <button type="button" :class="{ on: round === 'cut' }" :aria-pressed="round === 'cut'" @click="round = 'cut'">
          {{ t('tournaments.part.topCut') }}
        </button>
      </span>
    </div>
  </nav>

  <template v-if="round === 'cut'">
    <!-- Its play-in, when it has one: its matches alone, each with whom its winner faced. -->
    <section v-if="playIn" class="play-in">
      <h3 class="col-head">
        <span v-tip="t('tournaments.playInTip')" class="tipped">{{ t('tournaments.playIn') }}</span>
      </h3>
      <div class="play-in-matches">
        <div v-for="{ m, faces } in playIn" :key="`${m[0]}-${m[1]}`">
          <BracketMatch :id :match="m" :by-placing />
          <p v-if="faces" class="faces muted small">{{ t('tournaments.playInFaces', { n: faces }) }}</p>
        </div>
      </div>
    </section>
    <!-- The bracket: a column per round, each two matches side by side joined to the one they lead to. -->
    <div class="bracket" :style="{ '--cols': columns.length }">
      <div v-for="(r, ci) in columns" :key="r.round" class="col">
        <h3 class="col-head">{{ cutName(r.left) }}</h3>
        <div class="col-body">
          <div
            v-for="(_, pi) in Math.ceil(r.matches.length / 2)"
            :key="pi"
            class="pair"
            :class="{ joined: ci < columns.length - 1 && r.matches[pi * 2 + 1] }"
          >
            <div v-for="m in r.matches.slice(pi * 2, pi * 2 + 2)" :key="`${m[0]}-${m[1]}`" class="slot">
              <BracketMatch :id :match="m" :by-placing :played-in="ci === 0 ? playedIn : undefined" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- A Swiss round: its pairings, searched and filtered. -->
  <template v-else>
    <FilterSearch
      v-model:text="query"
      v-model:filters="filters"
      v-model:preview="preview"
      class="rounds-search"
      :subject="t('filter.subject.matches')"
      :name-count="nameCount"
      :kinds="TEAM_KINDS"
      :count
      :details="detailsOf"
      meta
    />
    <p class="muted small about">
      {{ t('tournaments.roundAbout', { n: num(swiss.length) }) }}
    </p>
    <p v-if="!shownPairings.length" class="muted">{{ t('tournaments.noMatches') }}</p>
    <ol v-else class="pairings" :class="{ previewing: preview }">
      <li
        v-for="m in drawn"
        :key="`${m[0]}-${m[1]}`"
        v-memo="[m, round, query, filters, id, locale]"
        class="match swiss"
      >
        <div
          v-for="side in sides(m)"
          :key="side.p ?? 'bye'"
          class="side"
          :class="{ won: side.won, lost: side.lost, hit: hit(side.s) }"
        >
          <template v-if="side.s">
            <span
              v-tip="t(`tournaments.resultTip.${side.won ? 'win' : side.lost ? 'loss' : 'tie'}`)"
              class="result"
              :class="side.won ? (m[1] === null ? 'bye' : 'win') : side.lost ? 'loss' : 'tie'"
              >{{
                t(`tournaments.result.${side.won ? (m[1] === null ? 'bye' : 'win') : side.lost ? 'loss' : 'tie'}`)
              }}</span
            >
            <span class="who"
              ><span class="placing num muted">#{{ side.s.placing }}</span>
              <AppLink
                :to="{ name: 'tournamentPlayer', params: { id, placing: String(side.s.placing) } }"
                class="name"
                >{{ side.s.player }}</AppLink
              >
              <CountryFlag :code="side.s.country"
            /></span>
            <span v-tip="t('tournaments.recordBeforeTip')" class="record num muted">{{ recordText(side.record) }}</span>
            <span v-if="side.s.team.length" class="team" aria-hidden="true">
              <PokemonIcon v-for="(slot, i) in side.s.team" :id="slot[0]" :key="i" />
            </span>
            <span v-else class="team none muted small">{{ t('tournaments.noList') }}</span>
          </template>
          <span v-else class="who muted">{{
            side.p === null ? t('tournaments.byeOpponent') : t('tournaments.goneOpponent')
          }}</span>
        </div>
      </li>
    </ol>
  </template>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
/* The rounds, a strip of numbers per day under its name, its segments joined in one outlined strip as
   `SegmentedControl`'s, wrapping where they don't fit; the top cut a strip of its own after them. */
.round-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
  margin-bottom: 16px;
}
.round-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.group-label {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.segments {
  display: flex;
  flex-wrap: wrap;
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.segments button {
  min-width: 2.2em;
  padding: 2px 8px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: inherit;
  background: var(--panel-alt);
  border: none;
  cursor: pointer;
}
.segments button + button {
  border-left: 2px solid var(--ink);
}
.segments button:hover {
  background: var(--hover);
}
.segments button.on {
  font-weight: bold;
  background: var(--sel);
}
/* The bracket: a column per round, each the same height, its matches spread down it so each pair's middle is where the
   next round's match is; each pair joined by a line to it. */
.bracket {
  --gap: 2rem;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  column-gap: var(--gap);
}
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
/* Each round's name, the play-in's too, on a subtle solid ground. */
.col-head {
  margin: 0 0 4px;
  padding: 4px 8px;
  font-size: 0.85em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--panel-alt);
}
.col-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pair {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.slot {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  padding: 6px 0;
}
.slot .match {
  width: 100%;
}
/* The lines: from each match right, half the gap; down the pair's middles; and on to the next round's match. */
.col:not(:last-child) .slot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 100%;
  width: calc(var(--gap) / 2);
  border-top: 2px solid var(--ink);
}
.pair.joined::before {
  content: '';
  position: absolute;
  top: 25%;
  bottom: 25%;
  left: calc(100% + var(--gap) / 2 - 2px);
  border-right: 2px solid var(--ink);
}
.pair.joined::after {
  content: '';
  position: absolute;
  top: 50%;
  left: calc(100% + var(--gap) / 2);
  width: calc(var(--gap) / 2);
  border-top: 2px solid var(--ink);
}
/* The play-in, over the bracket: its matches compact, not stretched to the row, their icons three a row, so three or
   more fit to a row; each with whom its winner faced under it. Ruled off from the bracket under it. */
.play-in {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--ink);
}
.play-in-matches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 17rem));
  gap: 10px 16px;
}
.faces {
  margin: 4px 0 0;
}
/* A match: its two sides in an ink-outlined box, the winner's in bold, the loser's faded. */
.match {
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.side {
  display: grid;
  align-items: center;
  column-gap: 10px;
}
.side + .side {
  border-top: 1px solid var(--border);
}
.side.won .who {
  font-weight: bold;
}
.side.lost {
  background: var(--panel-alt);
}
.side.lost .team {
  opacity: 0.6;
}
.who {
  grid-area: who;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  margin-right: 0.35em;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.name:hover {
  color: var(--accent);
}
.team {
  grid-area: team;
  display: flex;
  flex-wrap: wrap;
}
/* On phones, the rounds one under the other, each under its name, their matches stacked, with no lines. */
@media (max-width: 720px) {
  .bracket {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 16px;
  }
  /* The rounds' names spaced from the matches over them; the play-in's rule left to its name's ground. */
  .col-head {
    margin-bottom: 8px;
  }
  .play-in {
    padding-bottom: 0;
    border-bottom: none;
  }
  .col:not(:last-child) .slot::after,
  .pair.joined::before,
  .pair.joined::after {
    display: none;
  }
}
/* A Swiss round's pairings: a box each, as many to a row as fit, each side a line: its result, placing, name and
   country, record going in, and six as icons; one the search found tinted. */
.rounds-search {
  margin-bottom: 4px;
}
.about {
  margin: 0 0 8px;
}
.pairings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pairings.previewing {
  opacity: 0.75;
}
.match.swiss {
  container: side / inline-size;
}
.swiss .side {
  grid-template-columns: 2.6em minmax(0, 1fr) auto calc(6 * 40px);
  grid-template-areas: 'result who record team';
  padding: 2px 6px;
}
.swiss .side.hit {
  background: var(--sel);
}
.swiss .placing {
  margin-right: 0.5em;
  font-weight: normal;
}
.record {
  grid-area: record;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.team.none {
  display: block;
  white-space: nowrap;
}
/* The result as a square badge, as a player's matches have it: won in the good color, lost in the bad. */
.result {
  grid-area: result;
  justify-self: start;
  min-width: 2.2em;
  padding: 0 4px;
  font-size: 0.8em;
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
/* Too narrow for the six beside the name: under it. */
@container side (max-width: 460px) {
  .swiss .side {
    grid-template-columns: 2.6em minmax(0, 1fr) auto;
    grid-template-areas: 'result who record' '. team team';
    padding: 4px 6px;
  }
}
</style>
