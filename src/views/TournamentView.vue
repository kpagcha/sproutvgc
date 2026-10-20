<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, render, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { ability, item, move, pokemon } from '@/data/dex'
import { datasetDates, percent, regulationSnapshot } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureEffects, natureName } from '@/data/natures'
import { POKEMON, splitForme, spriteUrl } from '@/data/pokemon'
import { eventOf, listed, loadRounds, loadStandings, type Round, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { DAYS, decidedMatches, playersOf, pokemonStats, recordsOf, type Day } from '@/lib/tournamentStats'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import EffectTag from '@/components/EffectTag'
import FolderTabs from '@/components/FolderTabs.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SortHeader from '@/components/SortHeader.vue'
import TypeIcon from '@/components/TypeIcon'

// One official tournament: what it was (type, date, country, players, how many made Day 2), the way to its
// regulation's meta, and, under tabs for the day (the top cut, the default, Day 2, Day 1, then the whole event apart,
// in the URL as `?day=`), its standings (the whole event's in three parts, the top cut, the rest of Day 2 and Day 1;
// a day's its players with their record that day) and then its Pokémon (each one's share of the day's teams and how
// its teams did in the day's matches, by usage or win rate, the top ones or all, each leading to its meta page on its
// regulation's data).
// Each player's placing, name and country, record (marked when they dropped), and the six they brought, as icons;
// unfolded (one by one, or all at once), their whole sets, a card each, each entry leading to its meta page: its
// sprite and types in a band, its item after the types, then its ability and nature (the stats it raises and lowers
// on hover) on a line, and its moves two by two (on phones, one under another), each with its type's badge. A
// player whose team list isn't there has the Pokémon alone. Rows far down the field aren't laid out until near the screen.
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

/** The day shown, its tab, kept in the URL: the top cut unless another's picked. */
const day = computed<Day>(
  () => ((DAYS as readonly string[]).find((d) => d === route.query.day) as Day | undefined) ?? 'cut',
)
function setDay(d: Day) {
  void router.replace({ query: { ...route.query, day: d === 'cut' ? undefined : d } })
}

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
const allStats = ref(false)
const shownStats = computed(() => (allStats.value ? sortedStats.value : sortedStats.value.slice(0, TOP)))
/** What the day's numbers are of: its players, and its matches with a winner. */
const about = computed(() =>
  standings.value && rounds.value
    ? t('tournaments.statsAbout', {
        players: count(playersOf(standings.value, day.value).length),
        matches: count(decidedMatches(rounds.value, day.value)),
      })
    : '',
)
/** The way to its regulation's meta (its latest data; the default, for the current one, its URL left bare once it's
 * shown): the event's own Meta, and each Pokémon's meta page. */
const metaOf = computed(() => event.value && regulationSnapshot(event.value.regulation)?.id)
const monName = (pid: Parameters<typeof pokemon>[0]) => splitForme(pid, refName(pokemon(pid)))

// The rows unfolded, by placing; all of those shown at once with the toggle over them.
const open = ref(new Set<number>())
watch(id, () => (open.value = new Set()))
const shownPlacings = computed(() => shownParts.value.flatMap((p) => p.rows.map((s) => s.placing)))
const allOpen = computed(() => !!shownPlacings.value.length && shownPlacings.value.every((p) => open.value.has(p)))
function toggle(placing: number) {
  const next = new Set(open.value)
  if (next.has(placing)) next.delete(placing)
  else next.add(placing)
  open.value = next
}
function toggleAll() {
  open.value = allOpen.value ? new Set() : new Set(shownPlacings.value)
}

// The rows that have come near the screen (within about a screen of it), by placing: an unfolded row builds its sets
// only then, so unfolding a whole field (thousands of cards) builds the few on screen at once and the rest as they
// come. Once built, a row's sets stay, so scrolling back doesn't move the page; until then it keeps their room.
const near = ref(new Set<number>())
watch(id, () => (near.value = new Set()))
const observer = new IntersectionObserver(
  (entries) => {
    const come = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.placing))
    if (come.some((p) => !near.value.has(p))) near.value = new Set([...near.value, ...come])
  },
  { rootMargin: '100% 0px' },
)
/** Each row, watched for when it comes near (a function ref: called as rows render, observing one again is nothing). */
const watchRow = (el: unknown) => {
  if (el instanceof HTMLElement) observer.observe(el)
}
onBeforeUnmount(() => observer.disconnect())

/** The standings shown: the whole event's in their parts (the top cut, the rest of Day 2, and Day 1, those there are),
 * a day's its players alone. */
const shownParts = computed(() => {
  const all = standings.value ?? []
  if (day.value !== 'all') return [{ key: day.value, rows: playersOf(all, day.value) }]
  return [
    { key: 'topCut' as const, rows: all.filter((s) => s.topCut) },
    { key: 'day2' as const, rows: all.filter((s) => s.day2 && !s.topCut) },
    { key: 'day1' as const, rows: all.filter((s) => !s.day2 && !s.topCut) },
  ].filter((p) => p.rows.length)
})
/** Each player's record: the whole event's, or the day's. */
const dayRecords = computed(() => (day.value !== 'all' && rounds.value ? recordsOf(rounds.value, day.value) : null))
const recordOf = (s: Standing & { placing: number }) => dayRecords.value?.get(s.placing) ?? s

const count = (n: number) => n.toLocaleString(locale.value)
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
        <span>{{ t('tournaments.players', { n: count(event.players) }) }}</span>
        <span>{{ t('tournaments.day2', { n: count(event.day2) }) }}</span>
      </p>
      <p v-if="metaOf" class="links">
        <AppLink :to="{ name: 'rankings', query: { meta: metaOf } }">{{ t('tournaments.eventMeta') }} ›</AppLink>
      </p>
    </div>

    <!-- The day: tabs standing on the standings' band, the whole event apart at the end. -->

    <FolderTabs
      class="day-tabs"
      :model-value="day"
      :label="t('tournaments.days')"
      :options="DAYS.map((d) => ({ value: d, label: t(`tournaments.day.${d}`), apart: d === 'all' }))"
      @update:model-value="setDay"
    />
    <section class="panel banded">
      <div class="band">
        <h2 class="band-title">{{ t('tournaments.standings') }}</h2>
        <button v-if="standings?.length" type="button" class="btn on-band" :aria-pressed="allOpen" @click="toggleAll">
          <component :is="allOpen ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />{{
            t(allOpen ? 'tournaments.hideSets' : 'tournaments.showSets')
          }}
        </button>
      </div>
      <p v-if="!standings" class="muted">{{ t('tournaments.loading') }}</p>
      <ol v-else class="standings">
        <template v-for="part in shownParts" :key="part.key">
          <!-- Each part under its name, when there's more than one. -->
          <li v-if="shownParts.length > 1" class="part-head">{{ t(`tournaments.part.${part.key}`) }}</li>
          <li
            v-for="s in part.rows"
            :key="s.placing"
            :ref="watchRow"
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
                >{{ recordOf(s).wins }}–{{ recordOf(s).losses
                }}<span v-if="s.dropped" class="drop">{{ t('tournaments.drop') }}</span></span
              >
              <span v-if="s.team.length" class="team" aria-hidden="true">
                <PokemonIcon v-for="(slot, i) in s.team" :id="slot[0]" :key="i" />
              </span>
              <!-- Neither a team list nor its Pokémon: the standings didn't say. -->
              <span v-else class="team muted small">{{ t('tournaments.noList') }}</span>
              <component :is="open.has(s.placing) ? ChevronUp : ChevronDown" :size="16" class="chevron" />
            </button>
            <!-- Its whole sets, a card each, once it's come near the screen; their room until then. -->
            <p v-if="open.has(s.placing) && !s.team.length" class="muted small no-team">
              {{ t('tournaments.noTeam') }}
            </p>
            <div v-else-if="open.has(s.placing) && !near.has(s.placing)" class="sets-room" aria-hidden="true"></div>
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
      <!-- Where it's from, at the end of the page. -->
      <p class="muted note">
        {{ t('usage.from') }} <a :href="event.url" rel="noopener">{{ event.provider.name }}</a>
      </p>
    </section>

    <!-- The day's Pokémon, under its standings. -->
    <section class="panel banded stats-panel">
      <div class="band">
        <h2 class="band-title">
          {{ t('tournaments.pokemonStats') }} <span class="band-day">· {{ t(`tournaments.day.${day}`) }}</span>
        </h2>
      </div>
      <p class="muted small about">{{ about }}</p>
      <p v-if="!standings || !rounds" class="muted">{{ t('tournaments.loading') }}</p>
      <div v-else class="dex-table stats" role="table" :aria-label="t('tournaments.pokemonStats')">
        <div class="row head" role="row">
          <div role="columnheader" class="r">#</div>
          <div role="columnheader">{{ t('tournaments.col.pokemon') }}</div>
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
          <div role="columnheader" class="r wide-only">{{ t('tournaments.col.record') }}</div>
        </div>
        <div v-for="(s, i) in shownStats" :key="s.id" class="row" role="row">
          <div role="cell" class="r num muted">{{ i + 1 }}</div>
          <div role="cell" class="mon-cell">
            <AppLink :to="{ name: 'metaPokemon', params: { id: s.id }, query: { meta: metaOf } }" class="mon">
              <PokemonIcon :id="s.id" /><span class="mon-name"
                ><span>{{ monName(s.id).species }}</span
                ><span v-if="monName(s.id).forme" class="forme">{{ monName(s.id).forme }}</span></span
              >
            </AppLink>
          </div>
          <div role="cell" class="r num">{{ percent(s.usage) }}</div>
          <!-- Its win rate; on phones, its record under it, the record's column left out there. -->
          <div role="cell" class="r num" :class="{ muted: s.winRate === null }">
            {{ s.winRate === null ? '—' : percent(s.winRate)
            }}<span class="phone-record muted">{{ s.wins }}–{{ s.losses }}</span>
          </div>
          <div role="cell" class="r num muted wide-only">{{ s.wins }}–{{ s.losses }}</div>
        </div>
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
/* The day's tabs standing on the standings' band: the one shown in the band's color. */
.day-tabs {
  --tab-bg: var(--accent);
}
.day-tabs :deep(.tab.on) {
  color: var(--accent-text);
}
/* The day's Pokémon: its table as the rankings' (rank, Pokémon, usage, win rate, record), the top ones and a toggle
   for the rest; the day named on its band. */
.band-day {
  font-weight: normal;
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
  --cols: 2.5rem minmax(0, 1fr) 5rem 5.5rem 6rem;
}
/* On phones, four columns: the record under the win rate. */
.phone-record {
  display: none;
}
@media (max-width: 720px) {
  .dex-table.stats {
    --cols: 1.75rem minmax(0, 1fr) 4rem 4.5rem;
  }
  .phone-record {
    display: block;
    font-size: 0.8em;
  }
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
.links {
  margin: 8px 0 0;
  font-weight: bold;
}
.band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.band-title {
  margin: 0;
}
:root:root .on-band {
  gap: 4px;
  min-height: 0;
  padding: 2px 8px;
}
.standings {
  margin: 0;
  padding: 0;
  list-style: none;
}
.standing + .standing {
  border-top: 1px solid var(--border);
}
/* A part's name, over its players: the top cut, Day 2, Day 1. */
.part-head {
  padding: 12px 4px 4px;
  font-size: 0.8em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--border-strong);
}
.part-head:first-child {
  padding-top: 4px;
}
/* A player, a row to unfold (`player-row`: not `row`, which the Pokémon's table rows are, as every dex table's):
   placing, name and country, record, the six as icons, and the chevron. Far down the field, rows aren't laid out
   until near the screen. */
.standing {
  content-visibility: auto;
  contain-intrinsic-size: auto 42px;
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
/* A row too narrow for six icons after its padding and the name's indent (4px each side, 3em and a gap, 6 × 40px:
   about 301px on a phone): three by two. */
@container standing (max-width: 300px) {
  .team {
    grid-template-columns: repeat(3, 40px);
  }
}
/* Their room, before they're built: about as tall as they'll be (two rows of cards; three, then six, narrower). */
.sets-room {
  height: 440px;
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
  .sets-room {
    height: 860px;
  }
}
@media (max-width: 420px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
  .sets-room {
    height: 1720px;
  }
}
</style>
