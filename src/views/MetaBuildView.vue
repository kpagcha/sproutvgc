<script setup lang="ts">
import { computed, provide, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { available, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { percent, regulationSnapshot } from '@/data/meta'
import {
  buildOfParam,
  eventsOf,
  isSetOf,
  listed,
  loadStandings,
  type Slot,
  type Standing,
  type TournamentEvent,
} from '@/data/tournaments'
import { locale, t, tSlots } from '@/i18n'
import { refName } from '@/i18n/refName'
import { META_LINKS } from '@/lib/links'
import { useUnfolded } from '@/composables/useUnfolded'
import { useGradualRows } from '@/composables/useGradualRows'
import { useMeta } from '@/composables/useMeta'
import AppLink from '@/components/AppLink'
import MoreToggle from '@/components/MoreToggle.vue'
import PokemonIcon from '@/components/PokemonIcon'
import StandingRow from '@/components/StandingRow.vue'
import TeamSets from '@/components/TeamSets.vue'

// One of a Pokémon's builds (`/meta/pokemon/:id/build?b=`, `buildParam`: the same item, ability, nature and moves), at
// the official tournaments of the regulation of the data shown, every event's, as its meta page's builds are: the build
// as a set's card, how its players did set against all the Pokémon's (how many teams, their share of its teams, how
// many made the top cut, their win rate), and every team that ran it, the best finishes first (the top cut by placing,
// then by record, the latest event first), each a standings row (`StandingRow`) naming its event, unfolding to its
// whole sets, the build marked; the first `TOP` until unfolded. Not among the pages meant to be found: there are
// thousands. No picker of the data shown: nothing here is of it but the regulation, which its link names.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const build = computed(() => buildOfParam(String(route.query.b ?? '')))
const exists = computed(() => available(pokemon(id.value)) && !!build.value)
const { snapshot } = useMeta()
// The regulation its link names (`?reg=`, the builds' on the meta page that led here: a build is one regulation's), else
// the data shown's.
const regulation = computed(() =>
  typeof route.query.reg === 'string' && route.query.reg ? route.query.reg : (snapshot.value?.regulation ?? REGULATION),
)

// Its links to meta pages open on the regulation's data, the one its teams were played on.
provide(META_LINKS, () => regulationSnapshot(regulation.value)?.id)

type Placed = Standing & { placing: number }
/** Every event of the regulation with its standings, once they're all in. */
const loaded = shallowRef<{ regulation: string; events: { event: TournamentEvent; standings: Placed[] }[] } | null>(
  null,
)
watch(
  regulation,
  async (r) => {
    loaded.value = null
    const events = eventsOf(r)
    const standings = await Promise.all(events.map((e) => loadStandings(e.id)))
    if (regulation.value === r)
      loaded.value = { regulation: r, events: events.map((event, i) => ({ event, standings: standings[i]! })) }
  },
  { immediate: true },
)

const marked = (slot: Slot) => !!build.value && isSetOf(slot, id.value, build.value)
const rate = (s: Placed) => s.wins / (s.wins + s.losses || 1)

interface Row {
  key: string
  event: TournamentEvent
  s: Placed
}
/** The teams with the Pokémon from a team list, and those with the build among them, the furthest first. */
const teams = computed(() => {
  const b = build.value
  const all: Row[] = []
  const ran: Row[] = []
  for (const { event, standings } of loaded.value?.events ?? [])
    for (const s of standings) {
      const slot = s.team.find((x) => x[0] === id.value && listed(x))
      if (!slot) continue
      const row = { key: `${event.id}:${s.placing}`, event, s }
      all.push(row)
      if (b && isSetOf(slot, id.value, b)) ran.push(row)
    }
  ran.sort(
    (x, y) =>
      Number(!!y.s.topCut) - Number(!!x.s.topCut) ||
      (x.s.topCut ? x.s.placing - y.s.placing : 0) ||
      rate(y.s) - rate(x.s) ||
      y.s.wins - x.s.wins ||
      y.event.date.localeCompare(x.event.date) ||
      x.s.placing - y.s.placing,
  )
  return { all, ran }
})

/** How a set of teams did: how many made the top cut, and their win rate over every match. */
function howTheyDid(rows: readonly Row[]) {
  const n = rows.length || 1
  const wins = rows.reduce((a, r) => a + r.s.wins, 0)
  const games = rows.reduce((a, r) => a + r.s.wins + r.s.losses, 0)
  const topCut = rows.filter((r) => r.s.topCut).length
  return {
    topCut,
    topCutRate: topCut / n,
    winRate: games ? wins / games : 0,
  }
}
// A block each: how many players brought it, how many made the top cut, and their win rate; under each, the same for
// the Pokémon with any build. The counts with their share of those players after them.
const numbers = computed(() => {
  const { all, ran } = teams.value
  if (!ran.length) return null
  const own = howTheyDid(ran)
  const overall = howTheyDid(all)
  const count = (n: number) => n.toLocaleString(locale.value)
  return [
    {
      label: t('metaBuild.players'),
      value: count(ran.length),
      share: percent(ran.length / all.length),
      any: count(all.length),
    },
    {
      label: t('metaBuild.topCut'),
      value: count(own.topCut),
      share: percent(own.topCutRate),
      any: `${count(overall.topCut)} · ${percent(overall.topCutRate)}`,
    },
    { label: t('metaBuild.winRate'), value: percent(own.winRate), any: percent(overall.winRate) },
  ]
})

/** The build as a set's card. */
const slot = computed<Slot | null>(() =>
  build.value ? [id.value, build.value.item, build.value.ability, build.value.nature, build.value.moves] : null,
)

// The teams, the first `TOP` until unfolded; unfolded, drawn a chunk a frame. A team unfolded to its sets by its key.
const TOP = 20
const showAll = useUnfolded(() => `buildTeams:${id.value}:${String(route.query.b ?? '')}`)
const shown = computed(() => (showAll.value ? teams.value.ran : teams.value.ran.slice(0, TOP)))
const drawn = useGradualRows(shown)
const open = shallowRef(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}
</script>

<template>
  <template v-if="exists">
    <div class="panel">
      <h1 class="title">
        <PokemonIcon :id="id" />
        <span
          ><template v-for="(part, i) in tSlots('metaBuild.title')" :key="i"
            ><template v-if="typeof part === 'string'">{{ part }}</template
            ><AppLink
              v-else
              :to="{ name: 'metaPokemon', params: { id }, query: { meta: regulationSnapshot(regulation)?.id } }"
              >{{ refName(pokemon(id)) }}</AppLink
            ></template
          ></span
        >
      </h1>
      <p class="muted">{{ t('metaBuild.of', { regulation }) }}</p>
      <div class="build-head">
        <div class="build-card"><TeamSets v-if="slot" :team="[slot]" /></div>
        <p v-if="!loaded" class="muted">{{ t('metaBuild.loading') }}</p>
        <p v-else-if="!numbers" class="muted">{{ t('metaBuild.none') }}</p>
        <dl v-else class="numbers">
          <div v-for="x in numbers" :key="x.label" class="number">
            <dt>{{ x.label }}</dt>
            <dd>
              <strong class="num">{{ x.value }}</strong
              ><span v-if="x.share" class="muted num"> · {{ x.share }}</span>
            </dd>
            <dd class="any num">{{ t('metaBuild.vs', { value: x.any }) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <section v-if="teams.ran.length" class="panel">
      <h2>{{ t('metaBuild.teams') }}</h2>
      <p class="muted small intro">{{ t('metaBuild.teamsIntro') }}</p>
      <ol class="teams">
        <li v-for="r in drawn" :key="r.key" v-memo="[r, open.has(r.key), build, locale]" class="team-row">
          <StandingRow
            :s="r.s"
            :event="r.event.id"
            :open="open.has(r.key)"
            :marked
            show-event
            @toggle="toggle(r.key)"
          />
        </li>
      </ol>
      <MoreToggle v-model:all="showAll" :n="teams.ran.length" :top="TOP" />
    </section>
  </template>
  <div v-else class="panel">
    <p>{{ t('metaBuild.none') }}</p>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title a {
  color: inherit;
}
/* The build's card, and beside it (on phones, under it) how its players did. */
.build-head {
  display: grid;
  grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  margin-top: 8px;
}
.build-card :deep(.sets) {
  grid-template-columns: minmax(0, 1fr);
  padding: 0 0 4px;
}
/* A block per number, as many to a row as fit; each of its lines whole, never broken. */
.numbers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 12px 16px;
  margin: 0;
}
.number dt {
  font-size: 0.85em;
  color: var(--muted);
}
.number dt,
.number dd {
  margin: 0;
  white-space: nowrap;
}
.number strong {
  font-size: 1.4em;
}
/* The same for the Pokémon with any build, there to compare against: quieter than anything else in the block. */
.any {
  font-size: 0.8em;
  color: color-mix(in srgb, var(--muted) 65%, transparent);
}
.intro {
  margin: -4px 0 8px;
}
.teams {
  margin: 0;
  padding: 0;
  list-style: none;
}
.team-row + .team-row {
  border-top: 1px solid var(--border);
}
@media (max-width: 720px) {
  .build-head {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
