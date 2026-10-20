<script setup lang="ts">
import { computed } from 'vue'
import { regulationSnapshot } from '@/data/meta'
import { EVENTS, type EventType, type TournamentEvent } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// The official tournaments, as one timeline, the latest first: down a line by month and then by day (the events of one
// day at one mark), each a card leading to its standings (`TournamentView`): its name, type, country and players, and
// who won with what. The bigger events (Worlds, the Internationals) have a bigger mark. Each regulation's run of events
// starts at a divider across the line, with the way to its meta, every one of its events added up.
const MAJOR: readonly EventType[] = ['worlds', 'international']
const major = (e: TournamentEvent) => MAJOR.includes(e.type)

function months(events: TournamentEvent[]) {
  const byMonth = new Map<string, Map<string, TournamentEvent[]>>()
  for (const e of events) {
    const key = e.date.slice(0, 7)
    const month = byMonth.get(key) ?? new Map<string, TournamentEvent[]>()
    byMonth.set(key, month)
    month.set(e.date, [...(month.get(e.date) ?? []), e])
  }
  return [...byMonth].map(([month, days]) => ({
    month,
    days: [...days].map(([date, events]) => ({ date, events, major: events.some(major) })),
  }))
}

// The events by date, cut into each regulation's runs.
const runs = computed(() => {
  const out: { regulation: string; events: TournamentEvent[] }[] = []
  for (const e of [...EVENTS].sort((a, b) => b.date.localeCompare(a.date))) {
    const last = out.at(-1)
    if (last?.regulation === e.regulation) last.events.push(e)
    else out.push({ regulation: e.regulation, events: [e] })
  }
  return out.map(({ regulation, events }, i) => ({
    key: `${regulation}-${i}`,
    regulation,
    months: months(events),
    meta: regulationSnapshot(regulation)?.id,
  }))
})

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const monthName = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' })
const weekday = (date: string) => format(date, { weekday: 'short' })
const dayOf = (date: string) => format(date, { day: 'numeric' })
const count = (n: number) => n.toLocaleString(locale.value)
</script>

<template>
  <div>
    <div class="panel">
      <h1>{{ t('title.tournaments') }}</h1>
    </div>
    <p v-if="!runs.length" class="panel muted">{{ t('tournaments.none') }}</p>
    <section v-else class="panel">
      <ol class="timeline">
        <li v-for="r in runs" :key="r.key" class="run">
          <div class="regulation">
            <h2 class="regulation-name">{{ t('meta.regulation', { reg: r.regulation }) }}</h2>
            <AppLink :to="{ name: 'rankings', query: { meta: r.meta } }" class="to-meta"
              >{{ t('tournaments.toMeta') }} ›</AppLink
            >
          </div>
          <ol class="months">
            <li v-for="m in r.months" :key="m.month" class="month">
              <h3 class="month-name">{{ monthName(m.month) }}</h3>
              <ol class="days">
                <li v-for="d in m.days" :key="d.date" class="day" :class="{ major: d.major }">
                  <span class="mark" aria-hidden="true" />
                  <time class="when" :datetime="d.date">
                    <span class="weekday muted">{{ weekday(d.date) }}</span>
                    <span class="date">{{ dayOf(d.date) }}</span>
                  </time>
                  <ul class="events">
                    <li v-for="e in d.events" :key="e.id">
                      <AppLink
                        :to="{ name: 'tournament', params: { id: e.id } }"
                        class="event"
                        :class="{ major: major(e) }"
                      >
                        <span class="what">
                          <span class="name">{{ e.name }}</span>
                          <span class="muted small"
                            >{{ t(`tournaments.type.${e.type}`) }} · {{ e.country }} ·
                            {{ t('tournaments.players', { n: count(e.players) }) }}</span
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
                  </ul>
                </li>
              </ol>
            </li>
          </ol>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
/* Each regulation's run starts at a divider across the line: its name, a rule, and the way to its meta. */
.regulation {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
  padding: 4px 0;
  background: var(--panel);
}
.regulation::after {
  content: '';
  order: 1;
  flex: 1;
  height: 0;
  border-top: 2px dashed var(--border);
}
.run + .run .regulation {
  margin-top: 20px;
}
.regulation-name {
  margin: 0;
  font-size: 1em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.regulation .to-meta {
  order: 2;
}
.to-meta {
  color: inherit;
  font-weight: bold;
  white-space: nowrap;
}
.timeline,
.months,
.days,
.events {
  margin: 0;
  padding: 0;
  list-style: none;
}
/* The line, down the rail at the left, through every month. */
.timeline {
  --rail: 28px;
  position: relative;
  padding: 4px 0;
}
.timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--rail) / 2 - 1.5px);
  width: 3px;
  background: var(--ink);
}
/* Each month a tag on the line. */
.month + .month {
  margin-top: 12px;
}
.month-name {
  position: relative;
  display: inline-block;
  margin: 0 0 4px;
  padding: 2px 8px;
  font-size: 0.875em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
/* A day: its mark on the line, its date, and its events, a card each. */
.day {
  display: grid;
  grid-template-columns: var(--rail) 2.5em minmax(0, 1fr);
  align-items: start;
  gap: 0 8px;
  padding: 6px 0;
}
.mark {
  position: relative;
  justify-self: center;
  width: 14px;
  height: 14px;
  margin-top: 15px;
  background: var(--panel);
  border: 3px solid var(--ink);
}
.day.major .mark {
  width: 20px;
  height: 20px;
  margin-top: 12px;
  background: var(--accent);
  transform: rotate(45deg);
}
.when {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 6px;
  line-height: 1.1;
}
.weekday {
  font-size: 0.75em;
  text-transform: uppercase;
}
.date {
  font-size: 1.25em;
  font-weight: bold;
}
.events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* An event, a card: its name with what it is under it, and who won with what, their six on one line. */
.event {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 16px;
  padding: 8px 10px;
  color: inherit;
  text-decoration: none;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
/* A major event's stripe inside its outline, square at its ends (a border of another color would meet the outline at
   a slant). */
.event.major {
  padding-left: 16px;
  box-shadow:
    inset 6px 0 0 var(--accent),
    var(--hard-sm);
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
/* Narrower: who won under the event's name, its team first. */
@media (max-width: 720px) {
  .event {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Narrower still: the date over the cards, beside its mark. */
@media (max-width: 480px) {
  .timeline {
    --rail: 22px;
  }
  .day {
    grid-template-columns: var(--rail) minmax(0, 1fr);
  }
  .when {
    flex-direction: row;
    align-items: baseline;
    gap: 6px;
    padding: 0 0 6px;
  }
  .mark {
    margin-top: 4px;
  }
  .day.major .mark {
    margin-top: 2px;
  }
  .events {
    grid-column: 2;
  }
}
</style>
