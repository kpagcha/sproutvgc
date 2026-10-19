<script setup lang="ts">
import { computed } from 'vue'
import { REGULATION } from '@/data/format'
import { datasetDates } from '@/data/meta'
import { regulationSnapshot } from '@/data/meta'
import { EVENTS, type TournamentEvent } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// The official tournaments: each regulation's events, the current regulation's first, the latest first, each a row
// leading to its standings (`TournamentView`): its date, name, type, country and players, how many made Day 2, and who
// won with what. Each regulation's band has the way to its meta, every one of its
// events added up, and the last, where it's all from.
const groups = computed(() => {
  const byRegulation = new Map<string, TournamentEvent[]>()
  for (const e of EVENTS) byRegulation.set(e.regulation, [...(byRegulation.get(e.regulation) ?? []), e])
  return [...byRegulation]
    .sort(
      ([a, ea], [b, eb]) =>
        Number(b === REGULATION) - Number(a === REGULATION) || eb[0]!.date.localeCompare(ea[0]!.date),
    )
    .map(([regulation, events]) => ({ regulation, events, meta: regulationSnapshot(regulation)?.id }))
})
const day = (date: string) => datasetDates({ from: date, to: date })
const count = (n: number) => n.toLocaleString(locale.value)
</script>

<template>
  <div>
    <div class="panel">
      <h1>{{ t('title.tournaments') }}</h1>
    </div>
    <p v-if="!groups.length" class="panel muted">{{ t('tournaments.none') }}</p>
    <section v-for="(g, gi) in groups" :key="g.regulation" class="panel banded">
      <div class="band">
        <h2 class="band-title">{{ t('meta.regulation', { reg: g.regulation }) }}</h2>
        <AppLink :to="{ name: 'rankings', query: { meta: g.meta } }" class="to-meta"
          >{{ t('tournaments.toMeta') }} ›</AppLink
        >
      </div>
      <ol class="events">
        <li v-for="e in g.events" :key="e.id">
          <AppLink :to="{ name: 'tournament', params: { id: e.id } }" class="event">
            <span class="when muted">{{ day(e.date) }}</span>
            <span class="what">
              <span class="name">{{ e.name }}</span>
              <span class="muted small"
                >{{ t(`tournaments.type.${e.type}`) }} · {{ e.country }} ·
                {{ t('tournaments.players', { n: count(e.players) }) }} ·
                {{ t('tournaments.day2', { n: count(e.day2) }) }}</span
              >
            </span>
            <span v-if="e.winner" class="winner">
              <span class="team" :aria-label="t('tournaments.winnerTeam', { player: e.winner.player })">
                <PokemonIcon v-for="(p, i) in e.winner.team" :id="p" :key="i" />
              </span>
              <span class="small"
                ><span class="muted">{{ t('tournaments.winner') }}</span> {{ e.winner.player }}</span
              >
            </span>
          </AppLink>
        </li>
      </ol>
      <!-- Where it's from, at the end of the page. -->
      <p v-if="gi === groups.length - 1" class="muted note">
        {{ t('usage.from') }} <a :href="g.events[0]!.provider.url" rel="noopener">{{ g.events[0]!.provider.name }}</a>
      </p>
    </section>
  </div>
</template>

<style scoped>
.note {
  margin: 12px 0 0;
}
.small {
  font-size: 0.875em;
}
.band {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.band-title {
  margin: 0;
}
.to-meta {
  color: inherit;
  font-weight: bold;
  white-space: nowrap;
}
.events {
  margin: 0;
  padding: 0;
  list-style: none;
}
.events li + li {
  border-top: 1px solid var(--border);
}
/* An event, a row: its date, its name with what it is under it (how many teams are listed too), and who won with what,
   their six on one line. */
.event {
  display: grid;
  grid-template-columns: 7.5em minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 16px;
  padding: 8px 4px;
  color: inherit;
  text-decoration: none;
}
.event:hover {
  background: var(--hover);
}
.what {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: bold;
  color: var(--link);
}
.winner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.team {
  display: flex;
}
/* Narrower: the date over the name, and who won under them, its team first. */
@media (max-width: 720px) {
  .event {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
