<script setup lang="ts">
import { computed } from 'vue'
import type { Round, Standing } from '@/data/tournaments'
import { t } from '@/i18n'
import { medalOf } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CountryFlag from '@/components/CountryFlag'
import PokemonIcon from '@/components/PokemonIcon'

// A top cut match, a box of its two sides (`TournamentRounds`' bracket and play-in): each its player's name (the way to
// their page) and country across the box, under it their six as icons from the left, three a row where six don't fit,
// and their placing at the row's end, marked when they came through the play-in; the winner's name in bold, the loser's
// side faded; a bye's second side saying so.
type Placed = Standing & { placing: number }
const props = defineProps<{
  id: string
  match: Round['matches'][number]
  byPlacing: ReadonlyMap<number, Placed>
  /** The players who came through the play-in. */
  playedIn?: ReadonlySet<number>
}>()

const sides = computed(() =>
  ([props.match[0], props.match[1]] as const).map((p, i) => ({
    p,
    s: p === null ? undefined : props.byPlacing.get(p),
    won: props.match[2] === i + 1,
    lost: props.match[2] !== 0 && props.match[2] !== i + 1,
  })),
)
</script>

<template>
  <div class="match">
    <div v-for="side in sides" :key="side.p ?? 'bye'" class="side" :class="{ won: side.won, lost: side.lost }">
      <template v-if="side.s">
        <span class="who"
          ><AppLink :to="{ name: 'tournamentPlayer', params: { id, placing: String(side.s.placing) } }" class="name">{{
            side.s.player
          }}</AppLink>
          <CountryFlag :code="side.s.country"
        /></span>
        <span v-if="side.s.team.length" class="team" aria-hidden="true">
          <PokemonIcon v-for="(slot, i) in side.s.team" :id="slot[0]" :key="i" />
        </span>
        <span class="seed">
          <span class="placing num" :class="medalOf(side.s.placing)">#{{ side.s.placing }}</span>
          <span v-if="playedIn?.has(side.s.placing)" v-tip="t('tournaments.playedInTip')" class="played-in">{{
            t('tournaments.playIn')
          }}</span>
        </span>
      </template>
      <span v-else class="who muted">{{
        side.p === null ? t('tournaments.result.bye') : t('tournaments.goneOpponent')
      }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Its two sides in an ink-outlined box; its width, for its sides' icons to be laid out by. */
.match {
  container: match / inline-size;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
.side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'who who' 'team seed';
  align-items: start;
  gap: 2px 8px;
  padding: 4px 6px;
}
.side + .side {
  border-top: 1px solid var(--border);
}
.side.won .who {
  font-weight: bold;
}
.side.lost {
  background: var(--panel-alt);
}
.side.lost .team {
  opacity: 0.6;
}
.who {
  grid-area: who;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  margin-right: 0.35em;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.name:hover {
  color: var(--accent);
}
/* Three a row, from the left; six where they fit beside the placing (its padding, six icons, the gap and a placing's
   medal: about 300px). */
.team {
  --icon-scale: 1;
  grid-area: team;
  display: grid;
  grid-template-columns: repeat(3, 40px);
}
@container match (min-width: 304px) {
  .team {
    grid-template-columns: repeat(6, 40px);
  }
}
/* The placing at the icons' row's end, a medal in the top 8, and under it, for one who came through the play-in, a
   tag. */
.seed {
  grid-area: seed;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-top: 6px;
}
.placing {
  font-weight: bold;
}
.played-in {
  padding: 0 3px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1px solid var(--border-strong);
}
</style>
