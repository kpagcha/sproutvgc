<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { ability, item, move, pokemon } from '@/data/dex'
import { datasetDates } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureEffects, natureName } from '@/data/natures'
import { POKEMON, spriteUrl } from '@/data/pokemon'
import { eventOf, listed, loadStandings, tournamentSnapshot, type Standing } from '@/data/tournaments'
import { locale, t } from '@/i18n'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import EffectTag from '@/components/EffectTag'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// One official tournament: what it was (type, date, country, players, how many made Day 2), the way to its meta (its
// teams alone), and its standings, its whole field in three parts (the top cut, the rest of Day 2, and Day 1): each
// player's placing, name and country, record (marked when they dropped), and the six they brought, as icons; unfolded
// (one by one, or all at once), their whole sets, a card each, each entry leading to its meta page: its sprite and
// types over a band of its first type's color, its item, ability and nature (with the stats it raises and lowers) on
// rows of their own, and its moves two by two, each tinted with its type. A player whose team list isn't there has the
// Pokémon alone. Rows far down the field aren't laid out until near the screen.
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

// The rows that have come near the screen (within about a screen of it), by placing: an unfolded row builds its sets
// only then, so unfolding a whole field (thousands of cards) builds the few on screen at once and the rest as they come.
// Once built, a row's sets stay, so scrolling back doesn't move the page; until then it keeps their room.
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

/** The standings in their parts: the top cut, the rest of Day 2, and Day 1, those there are. */
const parts = computed(() => {
  const all = standings.value ?? []
  return [
    { key: 'topCut' as const, rows: all.filter((s) => s.topCut) },
    { key: 'day2' as const, rows: all.filter((s) => s.day2 && !s.topCut) },
    { key: 'day1' as const, rows: all.filter((s) => !s.day2 && !s.topCut) },
  ].filter((p) => p.rows.length)
})

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
        <template v-for="part in parts" :key="part.key">
          <!-- Each part under its name, when there's more than one. -->
          <li v-if="parts.length > 1" class="part-head">{{ t(`tournaments.part.${part.key}`) }}</li>
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
              class="row"
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
                >{{ s.wins }}–{{ s.losses }}<span v-if="s.dropped" class="drop">{{ t('tournaments.drop') }}</span></span
              >
              <span class="team" aria-hidden="true">
                <PokemonIcon v-for="(slot, i) in s.team" :id="slot[0]" :key="i" />
              </span>
              <component :is="open.has(s.placing) ? ChevronUp : ChevronDown" :size="16" class="chevron" />
            </button>
            <!-- Its whole sets, a card each, once it's come near the screen; their room until then. -->
            <div v-if="open.has(s.placing) && !near.has(s.placing)" class="sets-room" aria-hidden="true"></div>
            <ul v-else-if="open.has(s.placing)" class="sets">
              <li
                v-for="([mon, it, ab, nature, moves], i) in s.team"
                :key="i"
                class="set"
                :data-type="POKEMON[mon]?.types[0]"
              >
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
                    </span>
                  </span>
                </div>
                <p v-if="!listed([mon, it, ab, nature, moves])" class="muted small no-list">
                  {{ t('tournaments.noList') }}
                </p>
                <dl v-else class="set-facts">
                  <dt>{{ t('tournaments.set.item') }}</dt>
                  <dd>
                    <template v-if="it"><ItemIcon :id="it" /><DexRef :to="item(it)" meta /></template>
                    <span v-else class="muted">{{ t('usageMon.noItem') }}</span>
                  </dd>
                  <template v-if="ab">
                    <dt>{{ t('tournaments.set.ability') }}</dt>
                    <dd><DexRef :to="ability(ab)" meta /></dd>
                  </template>
                  <template v-if="nature">
                    <dt>{{ t('tournaments.set.nature') }}</dt>
                    <dd class="set-nature">
                      <strong>{{ natureName(nature) }}</strong>
                      <template v-if="natureEffects(nature)">
                        <EffectTag effect="up" :stat="natureEffects(nature)!.plus" class="up" />
                        <EffectTag effect="down" :stat="natureEffects(nature)!.minus" class="down" />
                      </template>
                    </dd>
                  </template>
                </dl>
                <ul v-if="moves.length" class="set-moves">
                  <li v-for="mv in moves" :key="mv" class="set-move" :data-type="MOVES[mv]?.type">
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
/* A player, a row to unfold: placing, name and country, record, the six as icons, and the chevron. Far down the field,
   rows aren't laid out until near the screen. */
.standing {
  content-visibility: auto;
  contain-intrinsic-size: auto 42px;
}
.row {
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
/* On phones, the team under the name. */
@media (max-width: 560px) {
  .row {
    grid-template-columns: 3em minmax(0, 1fr) auto auto;
    grid-template-areas: 'placing player record chevron' 'placing team team team';
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
    grid-area: team;
    flex-wrap: wrap;
  }
  .chevron {
    grid-area: chevron;
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
/* A set: an ink-framed card with a hard shadow, its Pokémon's first type its color (`--tc`, from `data-type`). */
.set {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--ink);
  box-shadow: var(--hard-sm);
}
/* Its head: a band of its type's color, washed toward the panel, the sprite at the left wholly inside it, its name and
   types beside it. */
.set-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 10px 2px 6px;
  background: color-mix(in srgb, var(--tc, var(--accent)) 28%, var(--panel));
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
  gap: 4px;
}
/* Its item, ability and nature, a row each: a small label, then what it is. */
.set-facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  padding: 8px 10px 6px;
}
.set-facts dt {
  font-size: 0.72em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.set-facts dd {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin: 0;
  font-weight: bold;
}
.set-nature {
  flex-wrap: wrap;
  column-gap: 8px;
}
.set-nature :deep(.nature-effect) {
  display: inline-flex;
  align-items: center;
  font-size: 0.85em;
}
.set-nature .up {
  color: var(--good);
}
.set-nature .down {
  color: var(--bad);
}
/* Its moves, two by two: each a chip of its type, its badge and name over a wash of its color, edged in it. */
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
  background: color-mix(in srgb, var(--tc) 14%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--tc) 55%, var(--border));
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
  .sets-room {
    height: 670px;
  }
}
@media (max-width: 420px) {
  .sets {
    grid-template-columns: minmax(0, 1fr);
  }
  .sets-room {
    height: 1340px;
  }
}
</style>
