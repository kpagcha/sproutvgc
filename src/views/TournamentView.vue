<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { ability, item, move, pokemon } from '@/data/dex'
import { datasetDates } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureName } from '@/data/natures'
import { eventOf, loadStandings, tournamentSnapshot, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// One official tournament: what it was (type, date, country, players, how many teams are listed), the way to its meta
// (its teams alone, as the data card would pick it), and its standings: each listed player's placing, name and country,
// and the six they brought, as icons; unfolded (one by one, or all at once), their whole sets, a card each, each entry
// leading to its meta page, each move with its type's badge. Only the top placings' teams are published: the
// standings stop where they do.
const route = useRoute()
const id = computed(() => String(route.params.id))
const event = computed(() => eventOf(id.value))
const standings = shallowRef<(Standing & { placing: number })[] | null>(null)
watch(
  id,
  async (current) => {
    standings.value = null
    if (!eventOf(current)) return
    const s = await loadStandings(current)
    if (id.value === current) standings.value = s
  },
  { immediate: true },
)

/** The way to its meta: the snapshot of it alone. */
const meta = computed(() => event.value && tournamentSnapshot(event.value.regulation, [event.value.id])?.id)

// The rows unfolded, by placing; all of them at once with the toggle over them.
const open = ref(new Set<number>())
watch(id, () => (open.value = new Set()))
const allOpen = computed(() => !!standings.value?.length && open.value.size === standings.value.length)
function toggle(placing: number) {
  const next = new Set(open.value)
  if (next.has(placing)) next.delete(placing)
  else next.add(placing)
  open.value = next
}
function toggleAll() {
  open.value = allOpen.value ? new Set() : new Set(standings.value?.map((s) => s.placing))
}

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
      </p>
      <p class="muted small">
        {{ t('tournaments.listedNote', { n: count(event.teams), players: count(event.players) }) }}
      </p>
      <p v-if="meta" class="links">
        <AppLink :to="{ name: 'rankings', query: { meta } }">{{ t('tournaments.eventMeta') }} ›</AppLink>
      </p>
    </div>

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
        <li v-for="s in standings" :key="s.placing" class="standing" :class="{ open: open.has(s.placing) }">
          <button
            type="button"
            class="row"
            :aria-expanded="open.has(s.placing)"
            :aria-label="t('tournaments.rowLabel', { placing: s.placing, player: s.player })"
            @click="toggle(s.placing)"
          >
            <span class="placing num">{{ ordinal(s.placing) }}</span>
            <span class="player"
              >{{ s.player }} <span class="muted small">{{ s.country }}</span></span
            >
            <span class="team" aria-hidden="true">
              <PokemonIcon v-for="(slot, i) in s.team" :id="slot[0]" :key="i" />
            </span>
            <component :is="open.has(s.placing) ? ChevronUp : ChevronDown" :size="16" class="chevron" />
          </button>
          <!-- Its whole sets, a card each. -->
          <ul v-if="open.has(s.placing)" class="sets">
            <li v-for="([mon, it, ab, nature, moves], i) in s.team" :key="i" class="set">
              <span class="set-mon">
                <PokemonIcon :id="mon" />
                <DexRef :to="pokemon(mon)" meta />
              </span>
              <span class="set-item">
                <template v-if="it"><ItemIcon :id="it" /><DexRef :to="item(it)" meta /></template>
                <span v-else class="muted">{{ t('usageMon.noItem') }}</span>
              </span>
              <span class="set-traits">
                <DexRef v-if="ab" :to="ability(ab)" meta />
                <span v-if="nature" class="nature">{{ natureName(nature) }}</span>
              </span>
              <ul class="set-moves">
                <li v-for="mv in moves" :key="mv">
                  <TypeIcon v-if="MOVES[mv]" :type="MOVES[mv].type" /><DexRef :to="move(mv)" meta />
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ol>
      <!-- Where it's from, at the end of the page. -->
      <p class="muted note">
        {{ t('usage.from') }} <a :href="event.url" rel="noopener">{{ event.provider.name }}</a>
      </p>
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
/* A listed player, a row to unfold: placing, name and country, the six as icons, and the chevron. */
.row {
  display: grid;
  grid-template-columns: 3.5em minmax(0, 1fr) auto auto;
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
.row:hover {
  background: var(--hover);
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
.team {
  display: flex;
}
.chevron {
  color: var(--muted);
}
/* On phones, the team under the name. */
@media (max-width: 560px) {
  .row {
    grid-template-columns: 3em minmax(0, 1fr) auto;
    grid-template-areas: 'placing player chevron' 'placing team team';
  }
  .placing {
    grid-area: placing;
    align-self: start;
  }
  .player {
    grid-area: player;
  }
  .team {
    grid-area: team;
    flex-wrap: wrap;
  }
  .chevron {
    grid-area: chevron;
  }
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
.set {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.set-mon,
.set-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.set-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
}
.nature {
  font-weight: bold;
}
.set-moves {
  /* Type badges at their desktop size on phones too, as small as the text. */
  --icon-scale: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.set-moves li {
  display: flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 720px) {
  .sets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 420px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
