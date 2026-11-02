<script setup lang="ts">
import { computed } from 'vue'
import { ability as abilityRef, item as itemRef, move, pokemon, type PokemonId } from '@/data/dex'
import { natureName } from '@/data/natures'
import { splitForme } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { Placed, Side } from '@/lib/teamBalance'
import AppLink from '@/components/AppLink'
import CategoryIcon from '@/components/CategoryIcon'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A side's tier list of bulk or power (the rankings' overview's other view, `MetaOverview`), after the speed tiers'
// ladder (`SpeedOdds`): the meta's Pokémon strongest first, each at its most common set (`metaLadder`), a row each:
// its place in a column at the left, its icon and name with what it's placed by under it (the stats its value is
// made of, its nature, ability and item, attacking with moves the move), a bar along an axis shared with the other
// side's list (`lo`, `hi`) to its value, the meta's median a line down the bars, and at the end the share of the meta
// it beats. The reader's picks (`found`) marked; those under `rare` usage faded. Folded (`all` false), its first `top` and the picks wherever they
// are, a gap marked where places are skipped.
const props = defineProps<{
  side: Side
  kind: 'defense' | 'offense'
  rows: Placed[]
  lo: number
  hi: number
  median: number | null
  found: readonly PokemonId[]
  all: boolean
  top: number
  /** Under this usage a row is faded, as the rankings' are: its set comes from a handful of teams. */
  rare: number
}>()

const at = (v: number) => `${(Math.max(0, Math.min(1, (v - props.lo) / (props.hi - props.lo || 1))) * 100).toFixed(2)}%`
const pct = (x: number) => `${Math.round(x * 100)}%`
const foundSet = computed(() => new Set(props.found))

/** The rows shown, each with its place, and whether places were skipped before it. */
const shown = computed(() => {
  const list = props.rows.map((p, i) => ({
    p,
    pos: i + 1,
    found: foundSet.value.has(p.pokemon),
    ...splitForme(p.pokemon, refName(pokemon(p.pokemon))),
  }))
  const kept = props.all ? list : list.filter((r) => r.pos <= props.top || r.found)
  return kept.map((r, i) => ({ ...r, gap: i > 0 && r.pos - kept[i - 1]!.pos > 1 }))
})

/** The stats its value is made of, as the game shows them: HP and its defending stat, or its attacking stat. */
function statsOf(p: Placed): string {
  const names =
    props.kind === 'defense'
      ? ['stat.hp', props.side === 'physical' ? 'stat.def' : 'stat.spd']
      : [props.side === 'physical' ? 'stat.atk' : 'stat.spa']
  return p.stats.map((v, i) => `${t(names[i] as 'stat.hp')} ${Math.round(v)}`).join(' · ')
}
const beatsTip = computed(() =>
  props.kind === 'defense'
    ? t('overview.beatsBulkTip')
    : t(props.side === 'physical' ? 'overview.beatsPhysTip' : 'overview.beatsSpecTip'),
)
const sideName = computed(() => t(props.side === 'physical' ? 'builder.balance.physical' : 'builder.balance.special'))
const ends = computed(() =>
  props.kind === 'defense'
    ? [t('builder.balance.frailer'), t('builder.balance.bulkier')]
    : [t('builder.balance.softer'), t('builder.balance.harder')],
)
</script>

<template>
  <div class="ladder" :data-side="side">
    <h4 class="ladder-name"><CategoryIcon :category="side" :tip="false" />{{ sideName }}</h4>
    <div class="head" aria-hidden="true">
      <span class="pos">#</span>
      <span class="who"></span>
      <span class="track"
        ><span>{{ ends[0] }}</span
        ><span>{{ ends[1] }}</span></span
      >
      <span v-tip="beatsTip" class="beats tipped" tabindex="0">{{ t('overview.beats') }}</span>
    </div>
    <ol class="rows">
      <template v-for="r in shown" :key="r.p.pokemon">
        <li v-if="r.gap" class="gap" aria-hidden="true">⋯</li>
        <li class="row" :class="{ found: r.found, rare: r.p.usage < rare }">
          <span class="pos num">{{ r.pos }}</span>
          <span class="who">
            <AppLink :to="{ name: 'metaPokemon', params: { id: r.p.pokemon } }" class="icon" tabindex="-1">
              <PokemonIcon :id="r.p.pokemon" />
            </AppLink>
            <AppLink :to="{ name: 'metaPokemon', params: { id: r.p.pokemon } }" class="mon">
              <span class="name">{{ r.species }}</span>
              <span v-if="r.forme" class="forme">{{ r.forme }}</span>
            </AppLink>
            <span class="set">
              <span class="set-line">
                <span v-tip="t('overview.statsTip')" class="stats">{{ statsOf(r.p) }}</span>
                <span v-if="r.p.nature">{{ natureName(r.p.nature) }}</span>
              </span>
              <span class="set-line">
                <DexRef v-if="r.p.ability" :to="abilityRef(r.p.ability)" meta />
                <span v-if="r.p.item" class="item"
                  ><ItemIcon :id="r.p.item" :scale="0.67" /><DexRef :to="itemRef(r.p.item)" meta
                /></span>
                <DexRef v-if="r.p.move" :to="move(r.p.move)" meta class="move" />
              </span>
            </span>
          </span>
          <span class="track" aria-hidden="true">
            <span class="bar" :style="{ width: at(r.p.value) }"></span>
            <span v-if="median !== null" class="median" :style="{ left: at(median) }"></span>
          </span>
          <span class="beats num">{{ r.p.rank === null ? '—' : pct(r.p.rank) }}</span>
        </li>
      </template>
    </ol>
  </div>
</template>

<style scoped>
[data-side='physical'] {
  --c: var(--physical);
}
[data-side='special'] {
  --c: var(--special);
}
.ladder {
  --cols: 2.2em minmax(14em, 1.8fr) minmax(4em, 1fr) 3.2em;
  min-width: 0;
  /* The size container the narrow layout asks (its rows, not itself). */
  container-type: inline-size;
}
.ladder-name {
  --icon-scale: 1.1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
}
/* The heads over the rows, in their columns, as the speed tiers' ladder has them. */
.head,
.row {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'pos who track beats';
  align-items: center;
  gap: 2px 10px;
}
.head {
  padding: 2px 4px 4px;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
.head .track {
  display: flex;
  justify-content: space-between;
  font-weight: normal;
}
.pos {
  grid-area: pos;
  text-align: right;
  color: var(--muted);
}
/* Its icon, centered beside its name and the set's lines under it. */
.who {
  grid-area: who;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 4px;
  min-width: 0;
}
.who .icon {
  grid-row: 1 / span 2;
  line-height: 0;
}
.track {
  grid-area: track;
  position: relative;
}
.beats {
  grid-area: beats;
  text-align: right;
}
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  padding: 3px 4px;
  border-bottom: 1px solid var(--border);
}
.num {
  font-variant-numeric: tabular-nums;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: inherit;
  font-weight: bold;
}
.forme {
  font-weight: normal;
  font-size: 0.85em;
  color: var(--muted);
}
.set {
  display: flex;
  flex-direction: column;
  font-size: 0.8em;
  color: var(--muted);
}
/* Its stats and nature on one line, its ability, item and move on the next. */
.set-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
}
.item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.stats {
  cursor: help;
}
/* Its value along the axis: a bar in its side's color, the meta's median a line down the bars. */
.track {
  height: 10px;
  background: color-mix(in srgb, var(--c) 8%, transparent);
}
.bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: color-mix(in srgb, var(--c) 70%, transparent);
}
.median {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 0;
  margin-left: -1px;
  border-left: 2px dashed var(--text);
  opacity: 0.55;
}
.head .track {
  height: auto;
  background: none;
}
/* A pick: on a wash of its side's color, a bar of it at its start. */
.row.found {
  background: color-mix(in srgb, var(--c) 14%, transparent);
  box-shadow: inset 3px 0 0 var(--c);
}
/* Rare, its set from a handful of teams: faded, as the rankings' rows are (but a pick). */
.row.rare:not(.found) > * {
  opacity: 0.55;
}
.row.found .bar {
  background: var(--c);
}
/* Places skipped, folded. */
.gap {
  padding: 0 4px;
  line-height: 1;
  text-align: center;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
/* Narrow: the bar under the name, across the row. */
@container (max-width: 420px) {
  .head,
  .row {
    grid-template-columns: 2em minmax(0, 1fr) 3em;
    grid-template-areas: 'pos who beats' '. track track';
    row-gap: 3px;
  }
  .row {
    padding-block: 2px 4px;
  }
  .row .track {
    height: 5px;
  }
  .set {
    line-height: 1.3;
  }
  .head .track {
    display: none;
  }
}
</style>
