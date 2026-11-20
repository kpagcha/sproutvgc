<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp, X } from '@lucide/vue'
import { pokemon as pokemonRef, type PokemonId } from '@/data/dex'
import { datasetDates } from '@/data/meta'
import { loadStandings, type Slot } from '@/data/tournaments'
import { loadPlayers, type PlayerRun, type TournamentPlayer } from '@/data/tournamentPlayers'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { medalOf } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CopyPaste from '@/components/CopyPaste.vue'
import CountryFlag from '@/components/CountryFlag'
import OpenInBuilder from '@/components/OpenInBuilder.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SectionNav from '@/components/SectionNav.vue'
import TeamSets from '@/components/TeamSets.vue'

// A player of the official tournaments, across every event generated (`/meta/tournaments/players/:player`, from the
// Players tab, `TournamentPlayersList`): who they are, their numbers over every event (events, record and the share won,
// Day 2s, top cuts, best placing); their tournaments, the latest first, a row each: its placing (a medal in the top 8),
// the event (leading to their page there, `TournamentPlayerView`, with their matches), its date and regulation, how far
// they made it, their record and six, unfolding to their whole sets (`TeamSets`, the event's standings loaded then) with
// the ways to copy them as a paste and open them in the team builder; and, after them, the Pokémon they brought, their
// icons alone on shelves by how many of their events (`shelves`), a tap narrowing the tournaments to those they brought
// it to (`?mon=`, one at a time: tapped again, or another, undoing it; the filter named atop the tournaments, its chip
// undoing it too). Its two sections a row of links stuck to the top (`SectionNav`).
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.player))

const player = shallowRef<TournamentPlayer | null>(null)
const missing = shallowRef(false)
watch(
  slug,
  async (current) => {
    player.value = null
    missing.value = false
    const all = await loadPlayers().catch(() => new Map<string, TournamentPlayer>())
    if (slug.value !== current) return
    player.value = all.get(current) ?? null
    missing.value = !player.value
  },
  { immediate: true },
)

// Their teams' whole sets, by event, as each one's standings load (on unfolding it).
const sets = reactive(new Map<string, Slot[]>())
const open = reactive(new Set<string>())
async function toggle(r: PlayerRun) {
  const id = r.event.id
  if (open.has(id)) return void open.delete(id)
  open.add(id)
  if (sets.has(id)) return
  const standings = await loadStandings(id).catch(() => [])
  sets.set(id, standings.find((s) => s.placing === r.placing)?.team ?? [])
}
const teamOf = (r: PlayerRun): Slot[] | undefined => sets.get(r.event.id)

const rate = computed(() => {
  const p = player.value
  return p && p.wins + p.losses ? p.wins / (p.wins + p.losses) : 0
})

// The Pokémon on their teams, by how many of their events they brought it to, then by how recently: a shelf per count,
// the most first, each with its share of their events as pips (a bar past `PIPS` events), the Pokémon on half their
// teams or more drawn bigger.
const PIPS = 12
const shelves = computed(() => {
  const counts = new Map<PokemonId, number>()
  for (const r of player.value?.runs ?? []) for (const p of new Set(r.team)) counts.set(p, (counts.get(p) ?? 0) + 1)
  const total = player.value?.runs.length ?? 0
  const byCount = new Map<number, PokemonId[]>()
  for (const [id, n] of counts) byCount.set(n, [...(byCount.get(n) ?? []), id])
  return [...byCount]
    .sort((a, b) => b[0] - a[0])
    .map(([n, ids]) => ({ n, ids, share: total ? n / total : 0, big: total > 1 && n * 2 >= total }))
})
const countOf = (id: PokemonId) => shelves.value.find((s) => s.ids.includes(id))?.n ?? 0

// The Pokémon the tournaments are narrowed to, if any, kept in the URL.
const picked = computed((): PokemonId | null => {
  const m = route.query.mon
  return typeof m === 'string' && shelves.value.some((s) => s.ids.includes(m as PokemonId)) ? (m as PokemonId) : null
})
const pick = (id: PokemonId | null) =>
  void router.replace({ query: { ...route.query, mon: id && id !== picked.value ? id : undefined } })
const runs = computed(() => {
  const all = player.value?.runs ?? []
  const m = picked.value
  return m ? all.filter((r) => r.team.includes(m)) : all
})
const canHover = window.matchMedia('(hover: hover)').matches
const monTip = (id: PokemonId) =>
  `${refName(pokemonRef(id))} · ${t('players.timesBrought', { n: num(countOf(id)), of: num(player.value?.runs.length ?? 0) })}`

const sections = computed(() => [
  { id: 'sec-history', label: t('players.history') },
  { id: 'sec-pokemon', label: t('players.pokemon') },
])

const num = (n: number) => n.toLocaleString(locale.value)
const pct = (x: number) => x.toLocaleString(locale.value, { style: 'percent', maximumFractionDigits: 0 })
const dateOf = (r: PlayerRun) => datasetDates({ from: r.event.date, to: r.event.date })
</script>

<template>
  <div v-if="missing" class="panel">
    <p class="muted">{{ t('players.notFound') }}</p>
    <AppLink :to="{ name: 'tournamentPlayers' }">{{ t('players.allPlayers') }} ›</AppLink>
  </div>
  <div v-else-if="!player" class="panel">
    <p class="muted">{{ t('players.loading') }}</p>
  </div>
  <div v-else>
    <SectionNav :sections />
    <div class="panel">
      <div class="title">
        <h1>{{ player.name }}</h1>
        <CountryFlag :code="player.country" />
      </div>
      <ul class="facts">
        <li>
          <strong class="num">{{ num(player.runs.length) }}</strong> {{ t('players.col.events').toLowerCase() }}
        </li>
        <li>
          <strong class="num">{{ player.wins }}–{{ player.losses }}</strong>
          <span class="muted"> ({{ pct(rate) }})</span>
        </li>
        <li>
          <strong class="num">{{ num(player.day2s) }}</strong> {{ t('players.col.day2s') }}
        </li>
        <li>
          <strong class="num">{{ num(player.topCuts) }}</strong> {{ t('players.col.topCuts').toLowerCase() }}
        </li>
        <li>
          {{ t('players.col.best') }}
          <span class="placing num" :class="medalOf(player.best.placing)">#{{ player.best.placing }}</span>
          <AppLink
            :to="{
              name: 'tournamentPlayer',
              params: { id: player.best.event.id, placing: String(player.best.placing) },
            }"
            >{{ player.best.event.name }}</AppLink
          >
        </li>
      </ul>
    </div>

    <section id="sec-history" class="panel">
      <h2>{{ t('players.history') }}</h2>
      <p class="muted small about">{{ t('players.historyAbout') }}</p>
      <p v-if="picked" class="picked">
        <button type="button" class="btn chip" @click="pick(null)">
          <PokemonIcon :id="picked" />
          {{ refName(pokemonRef(picked)) }}
          <X :size="12" aria-hidden="true" />
        </button>
      </p>
      <ol class="runs">
        <li v-for="r in runs" :key="r.event.id" class="run" :class="{ open: open.has(r.event.id) }">
          <div class="run-row" @click="(e) => !(e.target as Element).closest('a') && toggle(r)">
            <span class="placing num" :class="medalOf(r.placing)">#{{ r.placing }}</span>
            <span class="what">
              <AppLink
                v-tip="t('players.toEventPage')"
                :to="{ name: 'tournamentPlayer', params: { id: r.event.id, placing: String(r.placing) } }"
                class="event"
                >{{ r.event.name }}</AppLink
              >
              <span class="muted small"
                >{{ dateOf(r) }} · {{ t('meta.regulation', { reg: r.event.regulation }) }} ·
                {{ t('tournaments.players', { n: num(r.event.players) }) }}</span
              >
            </span>
            <span class="stage small" :class="r.stage">{{ t(`tournaments.reached.${r.stage}`) }}</span>
            <span class="record num">{{ r.wins }}–{{ r.losses }}</span>
            <span class="team" :aria-label="t('players.eventRow', { event: r.event.name })">
              <PokemonIcon v-for="(p, i) in r.team" :id="p" :key="i" />
            </span>
            <button
              v-if="r.team.length"
              type="button"
              class="chevron"
              :aria-expanded="open.has(r.event.id)"
              :aria-label="t('players.eventRow', { event: r.event.name })"
              @click.stop="toggle(r)"
            >
              <component :is="open.has(r.event.id) ? ChevronUp : ChevronDown" :size="16" />
            </button>
          </div>
          <div v-if="open.has(r.event.id)" class="sets">
            <p v-if="!sets.has(r.event.id)" class="muted">{{ t('tournaments.loading') }}</p>
            <template v-else-if="teamOf(r)?.length">
              <TeamSets :team="teamOf(r)!" />
              <p class="team-tools">
                <CopyPaste :team="teamOf(r)!" />
                <OpenInBuilder
                  :team="teamOf(r)!"
                  :name="t('builder.fromTournament', { player: player.name, event: r.event.name })"
                />
              </p>
            </template>
            <p v-else class="muted">{{ t('tournaments.noTeam') }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section id="sec-pokemon" class="panel">
      <h2>{{ t('players.pokemon') }}</h2>
      <ol class="shelves">
        <li v-for="sh in shelves" :key="sh.n" class="shelf" :class="{ big: sh.big }">
          <span
            class="shelf-label"
            :aria-label="t('players.timesBrought', { n: num(sh.n), of: num(player.runs.length) })"
          >
            <strong class="num">{{ sh.n }}×</strong>
            <span v-if="player.runs.length <= PIPS" class="pips" aria-hidden="true"
              ><span v-for="i in player.runs.length" :key="i" class="pip" :class="{ on: i <= sh.n }"
            /></span>
            <span v-else class="meter" :style="{ '--share': sh.share }" aria-hidden="true" />
          </span>
          <span class="shelf-mons">
            <button
              v-for="id in sh.ids"
              :key="id"
              v-tip="canHover && monTip(id)"
              type="button"
              class="mon"
              :class="{ on: picked === id, off: picked && picked !== id }"
              :aria-pressed="picked === id"
              :aria-label="monTip(id)"
              @click="pick(id)"
            >
              <PokemonIcon :id :scale="sh.big ? 1.5 : 1" />
            </button>
          </span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.title h1 {
  margin: 0;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.facts li {
  display: flex;
  align-items: center;
  gap: 6px;
}
h2 {
  margin: 0 0 2px;
}
.about {
  margin: 0 0 10px;
}
.placing {
  display: inline-block;
  min-width: 2.75em;
  padding: 0 4px;
  text-align: center;
}
.runs,
.mons {
  margin: 0;
  padding: 0;
  list-style: none;
}
.run {
  border-bottom: 1px solid var(--border);
}
.run:last-child {
  border-bottom: none;
}
/* A run: its placing, the event, how far they made it, their record and six, and the chevron unfolding their sets. */
.run-row {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr) 5.5em 3.5em auto 28px;
  align-items: center;
  gap: 4px 10px;
  padding: 6px 4px;
  cursor: pointer;
}
.run-row:hover {
  background: var(--hover);
}
.what {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.event {
  font-weight: bold;
}
.stage {
  justify-self: start;
  padding: 0 6px;
  border: 2px solid var(--border);
}
.stage.topCut {
  font-weight: bold;
  border-color: var(--accent);
}
.stage.day1 {
  color: var(--muted);
}
.record {
  text-align: right;
}
.team {
  display: flex;
}
/* Quiet, as the standings' rows' (`StandingRow`): the chevron alone, the row itself what's clicked. */
.chevron {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--muted);
  background: none;
  border: none;
  box-shadow: none;
  cursor: pointer;
}
.run-row:hover .chevron,
.run.open .chevron {
  color: var(--text);
}
.sets {
  padding: 4px 4px 12px;
}
.team-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 8px 0 0;
}
/* The Pokémon they brought: a shelf per count, its label (the count over its pips) at its left, the icons after it,
   each a button narrowing the tournaments to it; the one picked outlined, the rest faded meanwhile. */
.shelves {
  margin: 0;
  padding: 0;
  list-style: none;
}
.shelf {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
  border-bottom: 1px dashed var(--border);
}
.shelf:last-child {
  border-bottom: none;
}
.shelf-label {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 3px;
  width: 3.5em;
}
.shelf.big .shelf-label strong {
  font-size: 1.25em;
}
.pips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.pip {
  width: 5px;
  height: 5px;
  background: var(--border);
}
.pip.on {
  background: var(--accent);
}
.meter {
  height: 5px;
  background: linear-gradient(to right, var(--accent) calc(var(--share) * 100%), var(--border) 0);
}
.shelf-mons {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
}
.mon {
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 2px solid transparent;
  box-shadow: none;
  cursor: pointer;
  transition: opacity 0.12s;
}
.mon:hover {
  background: var(--hover);
}
.mon.on {
  background: var(--sel);
  border-color: var(--accent);
}
.mon.off {
  opacity: 0.35;
}
/* The Pokémon the tournaments are narrowed to, its chip undoing it. */
.picked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0 0 8px;
}
.picked .btn.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
}
/* Narrower: the event over its stage, record and six. */
@media (max-width: 720px) {
  .run-row {
    grid-template-columns: 3em minmax(0, 1fr) auto 28px;
    grid-template-areas:
      'placing what what chevron'
      '. stage record chevron'
      '. team team team';
  }
  .run-row > .placing {
    grid-area: placing;
  }
  .what {
    grid-area: what;
  }
  .stage {
    grid-area: stage;
  }
  .record {
    grid-area: record;
  }
  .team {
    grid-area: team;
  }
  .chevron {
    grid-area: chevron;
  }
}
</style>
