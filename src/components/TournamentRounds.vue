<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
// round's they lead to, `BracketMatch`; a first round with byes a play-in, a stage of its own, its matches alone), a Swiss round as its pairings, the players' records going into it, the most wins first,
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
const matchKey = (m: Match) => `${m[0]}-${m[1]}`
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
      return { m, faces: after && (after[0] === w ? after[1] : after[0]), after: after && matchKey(after) }
    })
})
const columns = computed(() => (playIn.value ? bracket.value.slice(1) : bracket.value))
/** Those who came through the play-in, marked in the bracket. */
const playedIn = computed(() => new Set((playIn.value ?? []).flatMap(({ m }) => winnerOf(m) ?? [])))
const lastRound = computed(() => Math.max(...Object.keys(props.rounds).map(Number)))
/** The round shown, kept in the URL (`?round=`): a Swiss one by number, or a stage of the top cut, its play-in
 * (`playin`) or its bracket, the default (the last round, with no top cut). */
const round = computed<number | 'cut' | 'playin'>({
  get: () => {
    if (route.query.round === 'playin' && playIn.value) return 'playin'
    const n = Number(route.query.round)
    if (Number.isInteger(n) && props.rounds[n] && props.rounds[n].phase !== 3) return n
    return bracket.value.length ? 'cut' : lastRound.value
  },
  set: (r) => void router.replace({ query: { ...route.query, round: r === 'cut' ? undefined : String(r) } }),
})
/** The top cut's stages, as picked: its play-in when it has one, and its bracket. */
const stages = computed(() => [
  ...(playIn.value ? [{ value: 'playin' as const, label: t('tournaments.playIn') }] : []),
  { value: 'cut' as const, label: t('tournaments.bracket') },
])

// A match scrolled to and lit a moment: a play-in match's place in the next round, in the bracket, or one a player's
// page leads to (`?match=`, its two players' placings as paired), in the round it says, the query then dropped so going
// back doesn't light it again. A Swiss round's pairings are drawn a chunk a frame, so it's waited for, a few seconds at
// most; not found, the page goes to its top, as the router would have.
const lit = ref<string | null>(null)
let unlight = 0
let seeking = 0
const FRAMES = 180
async function light(key: string) {
  const mine = ++seeking
  await nextTick()
  let el: Element | null = null
  for (let i = 0; i < FRAMES && mine === seeking; i++) {
    el = document.querySelector(`[data-match="${key}"]`)
    if (el) break
    await new Promise(requestAnimationFrame)
  }
  if (mine !== seeking) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!el) return window.scrollTo({ top: 0 })
  el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  lit.value = key
  clearTimeout(unlight)
  unlight = window.setTimeout(() => (lit.value = null), 2000)
}
async function toBracket(key: string) {
  await router.replace({ query: { ...route.query, round: undefined } })
  void light(key)
}
watch(
  () => route.query.match,
  (key) => {
    if (typeof key !== 'string') return
    void light(key)
    void router.replace({ query: { ...route.query, match: undefined } })
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  clearTimeout(unlight)
  seeking++
})

// A player's path through the bracket, traced from their placing: their matches lit, and the lines from each they won
// to the next; again, untraced.
const traced = ref<number | null>(null)
const trace = (p: number) => (traced.value = traced.value === p ? null : p)
/** Its color: the medal's of a top 4 placing, else the accent. */
const traceColor = computed(() =>
  traced.value === 1
    ? 'var(--gold)'
    : traced.value === 2
      ? 'var(--silver)'
      : traced.value !== null && traced.value <= 4
        ? 'var(--bronze)'
        : 'var(--accent)',
)
const onPath = (m: Match) => traced.value !== null && (m[0] === traced.value || m[1] === traced.value)
const advanced = (m: Match, ci: number) => ci < columns.value.length - 1 && winnerOf(m) === traced.value && onPath(m)

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
const swiss = computed(() => (typeof round.value !== 'number' ? [] : (props.rounds[round.value]?.matches ?? [])))
const records = computed(() => (typeof round.value !== 'number' ? new Map() : recordsBefore(props.rounds, round.value)))
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
    record: p === null || typeof round.value !== 'number' ? undefined : records.value.get(p),
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
      <span class="group-label">{{ t('tournaments.part.topCut') }}</span>
      <span class="segments">
        <button
          v-for="st in stages"
          :key="st.value"
          type="button"
          :class="{ on: round === st.value }"
          :aria-pressed="round === st.value"
          @click="round = st.value"
        >
          {{ st.label }}
        </button>
      </span>
    </div>
  </nav>

  <!-- The top cut's play-in, when it has one: its matches alone, each with whom its winner faced. -->
  <section v-if="round === 'playin' && playIn" class="play-in">
    <h3 class="col-head">
      <span v-tip="t('tournaments.playInTip')" class="tipped">{{ t('tournaments.playIn') }}</span>
    </h3>
    <!-- Each match a bracket of its own: joined by a line to its place in the next round, a dashed box saying whom its
         winner faced there, the way to that match in the bracket. -->
    <div class="play-in-matches">
      <div
        v-for="{ m, faces, after } in playIn"
        :key="matchKey(m)"
        class="feed"
        :class="{ lit: lit === matchKey(m) }"
        :data-match="matchKey(m)"
      >
        <BracketMatch :id :match="m" :by-placing />
        <button
          v-if="faces && after"
          type="button"
          class="place num"
          :aria-label="t('tournaments.toBracketMatch', { n: faces })"
          @click="toBracket(after)"
        >
          {{ t('tournaments.playInVs', { n: faces }) }}
        </button>
      </div>
    </div>
  </section>

  <template v-else-if="round === 'cut'">
    <!-- The bracket: a column per round, each two matches side by side joined to the one they lead to. -->
    <div class="bracket" :style="{ '--cols': columns.length, '--trace': traceColor }">
      <div v-for="(r, ci) in columns" :key="r.round" class="col">
        <h3 class="col-head">{{ cutName(r.left) }}</h3>
        <div class="col-body">
          <div
            v-for="(_, pi) in Math.ceil(r.matches.length / 2)"
            :key="pi"
            class="pair"
            :class="{
              joined: ci < columns.length - 1 && r.matches[pi * 2 + 1],
              out: r.matches.slice(pi * 2, pi * 2 + 2).some((m) => advanced(m, ci)),
            }"
          >
            <div
              v-for="m in r.matches.slice(pi * 2, pi * 2 + 2)"
              :key="matchKey(m)"
              class="slot"
              :class="{ lit: lit === matchKey(m), advanced: advanced(m, ci) }"
              :data-match="matchKey(m)"
            >
              <BracketMatch
                :id
                :match="m"
                :by-placing
                :played-in="ci === 0 ? playedIn : undefined"
                :traced
                @trace="trace"
              />
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
        v-memo="[m, round, query, filters, id, locale, lit === matchKey(m), preview]"
        class="match swiss"
        :class="{ lit: lit === matchKey(m) }"
        :data-match="matchKey(m)"
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
/* The lines: from each match right, half the gap; from there to the pair's middle, each match's half of the line down
   it; and on to the next round's match. A traced player's, from each match they won, in their path's color, over the
   rest. */
.col:not(:last-child) .slot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 100%;
  width: calc(var(--gap) / 2);
  border-top: 2px solid var(--ink);
}
.pair.joined .slot::before {
  content: '';
  position: absolute;
  left: calc(100% + var(--gap) / 2 - 2px);
  border-right: 2px solid var(--ink);
}
.pair.joined .slot:first-child::before {
  top: 50%;
  bottom: 0;
}
.pair.joined .slot:last-child::before {
  top: 0;
  bottom: 50%;
}
.pair.joined::after {
  content: '';
  position: absolute;
  top: 50%;
  left: calc(100% + var(--gap) / 2);
  width: calc(var(--gap) / 2);
  border-top: 2px solid var(--ink);
}
.col .slot.advanced::after,
.pair.joined .slot.advanced::before,
.pair.out::after {
  z-index: 1;
  border-color: var(--trace);
}
/* The play-in, a stage of its own: its matches as many to a row as fit, each with its place in the next round. */
.play-in-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
}
/* A match and, a line away, its place in the next round: a dashed box, whom its winner faced, the way to that match. */
.feed {
  --line: 1.5rem;
  display: grid;
  grid-template-columns: 17rem auto;
  align-items: center;
  column-gap: var(--line);
}
.place {
  position: relative;
  padding: 4px 10px;
  font: inherit;
  font-weight: bold;
  color: inherit;
  white-space: nowrap;
  background: none;
  border: 2px dashed var(--border-strong);
  cursor: pointer;
}
.place:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.place::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  width: calc(var(--line) + 2px);
  border-top: 2px solid var(--ink);
}
/* A match led to, from the play-in or a player's page, lit a moment. */
.slot.lit :deep(.match),
.feed.lit :deep(.match),
.match.swiss.lit {
  animation: lit 2s ease-out;
}
@keyframes lit {
  0%,
  40% {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
    background: var(--sel);
  }
  100% {
    outline: 3px solid transparent;
    outline-offset: 2px;
  }
}
/* On phones, its place under the match, the line down to it. */
@media (max-width: 720px) {
  .play-in-matches {
    flex-direction: column;
  }
  .feed {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--line);
  }
  .place {
    justify-self: center;
  }
  .place::before {
    top: auto;
    right: auto;
    bottom: 100%;
    left: 50%;
    width: 0;
    height: calc(var(--line) + 2px);
    border-top: none;
    border-left: 2px solid var(--ink);
  }
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
  .col:not(:last-child) .slot::after,
  .pair.joined .slot::before,
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
