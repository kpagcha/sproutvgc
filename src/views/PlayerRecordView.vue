<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { pokemon as pokemonRef, type PokemonId } from '@/data/dex'
import { datasetDates } from '@/data/meta'
import { loadStandings, type Slot } from '@/data/tournaments'
import { loadPlayers, type PlayerRun, type TournamentPlayer } from '@/data/tournamentPlayers'
import { locale, t } from '@/i18n'
import { medalOf } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CopyPaste from '@/components/CopyPaste.vue'
import CountryFlag from '@/components/CountryFlag'
import DexRef from '@/components/DexRef'
import OpenInBuilder from '@/components/OpenInBuilder.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SectionNav from '@/components/SectionNav.vue'
import TeamSets from '@/components/TeamSets.vue'

// A player of the official tournaments, across every event generated (`/meta/tournaments/players/:player`, from the
// Players tab, `TournamentPlayersList`): who they are, their numbers over every event (events, record and the share won,
// Day 2s, top cuts, best placing); their tournaments, the latest first, a row each: its placing (a medal in the top 8),
// the event (leading to their page there, `TournamentPlayerView`, with their matches), its date and regulation, how far
// they made it, their record and six, unfolding to their whole sets (`TeamSets`, the event's standings loaded then) with
// the ways to copy them as a paste and open them in the team builder; and the Pokémon they brought, by how many of their
// events, each leading to its meta page. Its two sections a row of links stuck to the top (`SectionNav`).
const route = useRoute()
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

// The Pokémon on their teams, by how many of their events they brought it to, then by how recently.
const mons = computed(() => {
  const counts = new Map<PokemonId, number>()
  for (const r of player.value?.runs ?? []) for (const p of new Set(r.team)) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }))
})

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
      <ol class="runs">
        <li v-for="r in player.runs" :key="r.event.id" class="run" :class="{ open: open.has(r.event.id) }">
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
      <p class="muted small about">{{ t('players.pokemonAbout') }}</p>
      <ul class="mons">
        <li v-for="m in mons" :key="m.id" class="mon">
          <PokemonIcon :id="m.id" />
          <DexRef :to="pokemonRef(m.id)" meta class="mon-name" />
          <span class="muted small num">{{
            t('players.timesBrought', { n: num(m.n), of: num(player.runs.length) })
          }}</span>
          <span class="bar" :style="{ '--share': m.n / player.runs.length }" aria-hidden="true" />
        </li>
      </ul>
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
.chevron {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
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
/* The Pokémon they brought: two columns, each its icon, name, how often and a bar of it. */
.mons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 4px 24px;
}
.mon {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 8px;
}
.mon-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  grid-column: 2 / -1;
  height: 4px;
  background: linear-gradient(to right, var(--accent) calc(var(--share) * 100%), var(--border) 0);
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
