<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { eventOf, underWay, type Slot, type Standing } from '@/data/tournaments'
import { t } from '@/i18n'
import { medalOf } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CopyPaste from '@/components/CopyPaste.vue'
import CountryFlag from '@/components/CountryFlag'
import OpenInBuilder from '@/components/OpenInBuilder.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TeamSets from '@/components/TeamSets.vue'

// A player of an official tournament, a row to unfold: their placing (a medal in the top 8), name (the way to their
// page) and country, record (marked when they dropped), and the six they brought, as icons; unfolded (`open`, the row
// clicked anywhere but a link, or its chevron: `toggle`), their whole sets (`TeamSets`, those `marked` marked) and the
// way to copy them as a paste (`CopyPaste`) or open them in the team builder (`OpenInBuilder`). One whose team isn't known at all (at an event under way, before its
// team lists are out) has nothing where it'd be, and nothing to unfold. On a tournament's standings, and on a build's page, where the event is
// named under the player (`showEvent`), leading to its standings.
const props = defineProps<{
  s: Standing & { placing: number }
  /** The event's ID. */
  event: string
  open: boolean
  marked?: (slot: Slot) => boolean
  showEvent?: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()

function rowClick(e: MouseEvent) {
  if (props.s.team.length && !(e.target as Element).closest('a')) emit('toggle')
}
const ordinal = (n: number) => `#${n}`
const eventName = () => eventOf(props.event)?.name
/** Its first placing has won it: not while it's under way, when they only lead. */
const champion = () => props.s.placing === 1 && !underWay(props.event)
</script>

<template>
  <div class="standing-row" :class="{ open, won: champion() }">
    <!-- The row unfolds on a click anywhere but a link; the chevron its button, for the keyboard. -->
    <div class="player-row" :class="{ bare: !s.team.length }" @click="rowClick">
      <span class="placing num" :class="medalOf(s.placing, !underWay(event))">{{ ordinal(s.placing) }}</span>
      <span class="player-col">
        <span class="player"
          ><span class="who"
            ><AppLink
              :to="{ name: 'tournamentPlayer', params: { id: event, placing: String(s.placing) } }"
              class="name"
              >{{ s.player }}</AppLink
            >
            <CountryFlag :code="s.country" /></span
          ><span v-if="champion()" class="champion">{{ t('tournaments.champion') }}</span></span
        >
        <AppLink v-if="showEvent" :to="{ name: 'tournament', params: { id: event } }" class="event-name small">{{
          eventName()
        }}</AppLink>
      </span>
      <span
        v-tip="s.dropped ? t('tournaments.droppedTip', { round: s.dropped }) : undefined"
        class="record num"
        :class="{ dropped: s.dropped }"
        >{{ s.wins }}–{{ s.losses }}<span v-if="s.dropped" class="drop">{{ t('tournaments.drop') }}</span></span
      >
      <span v-if="s.team.length" class="team" aria-hidden="true">
        <PokemonIcon v-for="(slot, i) in s.team" :id="slot[0]" :key="i" />
      </span>
      <!-- Neither a team list nor its Pokémon (the standings didn't say, or an event under way hasn't yet): nothing to
           show, nor to unfold, their places kept. -->
      <span v-else class="team" />
      <button
        v-if="s.team.length"
        type="button"
        class="chevron"
        :aria-expanded="open"
        :aria-label="t('tournaments.rowLabel', { placing: s.placing, player: s.player })"
        @click.stop="emit('toggle')"
      >
        <component :is="open ? ChevronUp : ChevronDown" :size="16" />
      </button>
      <span v-else class="chevron" aria-hidden="true"><span class="chevron-room" /></span>
    </div>
    <!-- Their whole sets, a card each. -->
    <template v-if="open && s.team.length">
      <TeamSets :team="s.team" :marked />
      <!-- The ways to copy the team as a paste or open it in the team builder, under its sets at their right. -->
      <p class="team-tools">
        <OpenInBuilder
          :team="s.team"
          :name="t('builder.fromTournament', { player: s.player, event: eventName() ?? '' })"
        />
        <CopyPaste :team="s.team" />
      </p>
    </template>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
/* A player, a row to unfold (`player-row`: not `row`, which the Pokémon's table rows are, as every dex table's):
   placing, name and country, record, the six as icons, and the chevron. Every row laid out from the start, not when
   it comes into view: laid out as the page scrolls into them, their heights guessed until then (a phone's rows two
   lines, an unfolded one its sets), the page's length changed under the scroll, making it jump. */
.standing-row {
  /* Its width, for its team's icons to be laid out by (below). */
  container: standing / inline-size;
}
.player-row {
  display: grid;
  grid-template-columns: 3.5em minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  cursor: pointer;
}
/* The player's name, the way to their page: underlined, in the text's color; apart from their country by a margin, the
   line break between the two in the template being no space. */
.player .name {
  margin-right: 0.35em;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.player .name:hover {
  color: var(--accent);
}
.player-row:not(.bare):hover {
  background: var(--hover);
}
/* The winner's row lit from the left in gold, a tag by their name (the medals are `main.css`'s). */
.standing-row.won .player-row {
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 26%, transparent), transparent 70%);
}
.standing-row.won .player-row:hover {
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 38%, transparent), var(--hover) 70%);
}
.standing-row.won .player {
  font-weight: bold;
}
.champion {
  flex: none;
  margin-left: 8px;
  padding: 0 5px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #141414;
  background: var(--gold);
  border: 1px solid var(--ink);
}
/* Unfolded: its row in the color of what's picked, ruled off from its sets. */
.standing-row.open .player-row {
  background: var(--sel);
  border-bottom: 1px solid var(--border-strong);
}
.placing {
  font-weight: bold;
  text-align: right;
}
/* The player's column: their name, and under it, where shown, the event. */
.player-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.event-name {
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-name:hover {
  color: var(--accent);
}
/* The name and country cut short where they don't fit; the winner's tag after them whole or not at all: one line high,
   it wraps to a hidden second line when there's no room for it. */
.player {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  height: 1lh;
  overflow: hidden;
}
.who {
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
  display: flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
/* A row with nothing to unfold: not a button, its chevron's room kept for the columns to line up. */
.player-row.bare {
  cursor: default;
}
.chevron-room {
  width: 16px;
  height: 16px;
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
.team-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 0;
  padding: 0 4px 12px;
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
  .player-col {
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
</style>
