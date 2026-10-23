<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { available, pokemon, type PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { POKEMON, splitForme } from '@/data/pokemon'
import { refName } from '@/i18n/refName'
import { META_LINKS } from '@/lib/links'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// A Pokémon's teammates, the most common first, in columns filling the space: each its place, name (its forme a tag),
// types and share of its teams, leading to its meta page on the data the page's links open (a tournament's
// regulation's), else the page's own. Those the dex hasn't, left out. On a Pokémon's meta page, and on a tournament's
// standings filtered by one.
const props = defineProps<{ mates: readonly { id: PokemonId; share?: number }[] }>()

const shown = computed(() =>
  props.mates
    .filter((x) => available(pokemon(x.id)))
    .map((x) => ({ ...x, ...splitForme(x.id, refName(pokemon(x.id))) })),
)
const route = useRoute()
const metaLinks = inject(META_LINKS, null)
const meta = computed(() => metaLinks?.() ?? route.query.meta)
</script>

<template>
  <ul class="shares mates">
    <li v-for="(x, i) in shown" :key="x.id">
      <span class="mate-rank muted">{{ i + 1 }}</span>
      <AppLink :to="{ name: 'metaPokemon', params: { id: x.id }, query: { meta } }" class="what mate">
        <PokemonIcon :id="x.id" /><span class="mate-name"
          ><span>{{ x.species }}</span
          ><span v-if="x.forme" class="forme">{{ x.forme }}</span></span
        >
      </AppLink>
      <span class="types">
        <AppLink v-for="ty in POKEMON[x.id].types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
          <TypeIcon :type="ty" />
        </AppLink>
      </span>
      <span class="num meter mate-share" :style="{ '--share': x.share ?? 0 }">{{
        x.share === undefined ? '—' : percent(x.share)
      }}</span>
    </li>
  </ul>
</template>

<style scoped>
.types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.meter {
  position: relative;
  padding-bottom: 5px;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
}
.meter::before {
  right: 0;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc(100% * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
.shares {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(40px, 1fr) auto;
  gap: 4px 10px;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shares li {
  display: contents;
}
/* The teammates in columns filling the panel, as many as fit (one on phones), the most common first, down each; each a
   row of its own: its name (its forme a tag, under it when it doesn't fit), its types, its share with its bar under it, its icons at
   their desktop size, phones' bigger ones leaving its name no room. */
.shares.mates {
  --icon-scale: 1;
  container-type: inline-size;
  display: block;
  columns: 360px;
  column-gap: 32px;
}
/* A row: its place, its name (as wide as the longest fits, so the types line up after it down the column), its types
   (as wide as two badges, so the shares line up too) and its share right after them: each column's rows held together,
   what's left of it empty at its right, rather than its shares out at its edge, nearer the next column's names. */
.shares.mates li {
  display: grid;
  break-inside: avoid;
  margin-bottom: 8px;
  grid-template-columns: 1.4em minmax(0, 14em) 58px 4.5em;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.shares.mates .num {
  grid-column: -2;
}
/* Its place among them, first, so they read in order down the columns. */
.mate-rank {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* On phones, one column: the name taking what's left, the types and the share after it. */
@media (max-width: 720px) {
  .shares.mates li {
    grid-template-columns: 1.4em minmax(0, 1fr) auto 4.5em;
  }
}
/* Very narrow, no types: the name has their room, rather than running under them. */
@container (max-width: 320px) {
  .shares.mates li {
    grid-template-columns: 1.4em minmax(0, 1fr) 4.5em;
  }
  .shares.mates .types {
    display: none;
  }
}
/* A name longer than its room breaks across lines rather than running into the share after it. */
.mate-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.mate-name > :first-child {
  min-width: 0;
}
/* Its forme as the usage list and the speed tiers show it: a small tag after its species' name, under it when it
   doesn't fit. */
.forme {
  padding: 0 5px;
  font-size: 0.85em;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.what {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}
</style>
