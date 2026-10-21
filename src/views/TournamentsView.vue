<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye } from '@lucide/vue'
import { regulationSnapshot } from '@/data/meta'
import { EVENTS, UPCOMING, type EventType, type TournamentEvent, type UpcomingEvent } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import AppLink from '@/components/AppLink'
import CountryFlag from '@/components/CountryFlag'
import PokemonIcon from '@/components/PokemonIcon'

// The official tournaments, as one timeline, the latest first: down a line by month and then by day (the events of one
// day at one mark), each a card leading to its standings (`TournamentView`): its name, type, country and players, and
// who won with what. The bigger events (Worlds, the Internationals) have a bigger mark. Each regulation's run of events
// starts at a divider across the line, with the way to its meta, every one of its events added up. A recent event's
// winner (`SPOILER_DAYS`) is blurred, so the list doesn't spoil it, until revealed, one event at a time, remembered.
// With `upcoming`, the events still to come instead (its own page, `/meta/tournaments/upcoming`), on the same timeline
// but the soonest first, each card leading to its official page (else its page on Limitless VGC), those whose
// regulation isn't announced yet a run of their own.
const props = defineProps<{ upcoming?: boolean }>()

type Listed = TournamentEvent | UpcomingEvent
const MAJOR: readonly (EventType | undefined)[] = ['worlds', 'international']
const major = (e: Listed) => MAJOR.includes(e.type)
const past = (e: Listed): e is TournamentEvent => 'id' in e

function months(events: Listed[]) {
  const byMonth = new Map<string, Map<string, Listed[]>>()
  for (const e of events) {
    const key = e.date.slice(0, 7)
    const month = byMonth.get(key) ?? new Map<string, Listed[]>()
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
  const out: { regulation: string | undefined; events: Listed[] }[] = []
  const events: Listed[] = props.upcoming ? [...UPCOMING] : [...EVENTS].sort((a, b) => b.date.localeCompare(a.date))
  for (const e of events) {
    const last = out.at(-1)
    if (last && last.regulation === e.regulation) last.events.push(e)
    else out.push({ regulation: e.regulation, events: [e] })
  }
  return out.map(({ regulation, events }, i) => ({
    key: `${regulation ?? '?'}-${i}`,
    regulation,
    months: months(events),
    meta: regulation ? regulationSnapshot(regulation)?.id : undefined,
  }))
})

/** How long after its start an event's winner stays hidden: the last week's events. */
const SPOILER_DAYS = 7
const DAY = 24 * 60 * 60 * 1000
const recent = (e: Listed) => Date.now() - Date.parse(`${e.date}T00:00:00Z`) < SPOILER_DAYS * DAY

/** The recent events whose winner the reader revealed, by ID, remembered (those no longer recent dropped). */
const KEY = 'sproutvgc.tournaments.revealed'
function readRevealed(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
const revealed = ref(new Set(readRevealed().filter((id) => EVENTS.some((e) => e.id === id && recent(e)))))
/** Whether an event's winner is hidden: recent, and not revealed. */
const hidden = (e: TournamentEvent) => recent(e) && !revealed.value.has(e.id)
function reveal(e: TournamentEvent) {
  revealed.value = new Set([...revealed.value, e.id])
  try {
    localStorage.setItem(KEY, JSON.stringify([...revealed.value]))
  } catch {
    // Revealed for this visit alone.
  }
}

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const monthName = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' })
const weekday = (date: string) => format(date, { weekday: 'short' })
const dayOf = (date: string) => format(date, { day: 'numeric' })
const count = (n: number) => n.toLocaleString(locale.value)
</script>

<template>
  <div>
    <div class="panel heading">
      <h1>{{ t(upcoming ? 'title.upcomingTournaments' : 'title.tournaments') }}</h1>
      <AppLink v-if="!upcoming" :to="{ name: 'upcomingTournaments' }" class="to-upcoming"
        >{{ t('tournaments.toUpcoming', { n: count(UPCOMING.length) }) }} ›</AppLink
      >
    </div>
    <p v-if="!runs.length" class="panel muted">
      {{ t(upcoming ? 'tournaments.noneUpcoming' : 'tournaments.none') }}
    </p>
    <section v-else class="panel">
      <ol class="timeline">
        <li v-for="r in runs" :key="r.key" class="run">
          <div class="regulation">
            <h2 class="regulation-name">
              {{ r.regulation ? t('meta.regulation', { reg: r.regulation }) : t('tournaments.regulationTba') }}
            </h2>
            <AppLink v-if="r.meta" :to="{ name: 'rankings', query: { meta: r.meta } }" class="to-meta"
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
                    <li v-for="e in d.events" :key="e.n">
                      <!-- An event to come: its official page, else Limitless VGC's, in a new tab. -->
                      <a
                        v-if="!past(e)"
                        :href="e.info ?? e.url"
                        target="_blank"
                        rel="noopener"
                        class="event"
                        :class="{ major: major(e) }"
                      >
                        <span class="what">
                          <span class="name">{{ e.name }}</span>
                          <span class="muted small"
                            ><template v-if="e.type">{{ t(`tournaments.type.${e.type}`) }} · </template
                            ><CountryFlag :code="e.country"
                          /></span>
                        </span>
                        <span class="small out">{{
                          e.info ? t('tournaments.officialPage') : t('tournaments.onLimitless')
                        }}</span>
                      </a>
                      <AppLink
                        v-else
                        :to="{ name: 'tournament', params: { id: e.id } }"
                        class="event"
                        :class="{ major: major(e) }"
                      >
                        <span class="what">
                          <span class="name">{{ e.name }}</span>
                          <span class="muted small"
                            >{{ t(`tournaments.type.${e.type}`) }} · <CountryFlag :code="e.country" /> ·
                            {{ t('tournaments.players', { n: count(e.players) }) }}</span
                          >
                        </span>
                        <!-- A recent event's winner blurred, a tap on it revealing it rather than following the card. -->
                        <span
                          v-if="e.winner && hidden(e)"
                          class="winner hidden"
                          role="button"
                          tabindex="0"
                          :aria-label="t('tournaments.revealWinner')"
                          @click.prevent.stop="reveal(e)"
                          @keydown.enter.prevent.stop="reveal(e)"
                          @keydown.space.prevent.stop="reveal(e)"
                        >
                          <span class="blurred" aria-hidden="true">
                            <span class="team"><PokemonIcon v-for="(p, i) in e.winner.team" :id="p" :key="i" /></span>
                            <span class="small"
                              ><span class="muted">{{ t('tournaments.winner') }}</span> {{ e.winner.player }}</span
                            >
                          </span>
                          <span class="reveal small"
                            ><Eye :size="14" aria-hidden="true" />{{ t('tournaments.reveal') }}</span
                          >
                        </span>
                        <span v-else-if="e.winner" class="winner">
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
.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}
.heading h1 {
  margin: 0;
}
.to-upcoming {
  font-weight: bold;
}
.out {
  font-weight: bold;
  white-space: nowrap;
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
/* A recent event's winner: blurred past reading, its label to reveal it over the middle. */
.winner.hidden {
  position: relative;
  cursor: pointer;
}
.blurred {
  display: flex;
  flex-direction: column;
  gap: 2px;
  filter: blur(7px);
  user-select: none;
}
.reveal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-weight: bold;
  white-space: nowrap;
}
.winner.hidden:hover .reveal,
.winner.hidden:focus-visible .reveal {
  text-decoration: underline;
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
