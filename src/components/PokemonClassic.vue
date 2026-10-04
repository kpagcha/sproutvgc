<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ability, availableIds, item, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { POKEMON, STATS, loadLearnsets, movesOf, speciesOf, spriteUrl, total } from '@/data/pokemon'
import { t, tSlots, type MessageKey } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { PAGE_STAT_BARS, setPercentiles, usePageStatBars } from '@/composables/useStatReference'
import { refName } from '@/i18n/refName'
import DefenseResults from '@/components/DefenseResults.vue'
import DexRef from '@/components/DexRef'
import EntryTitle from '@/components/EntryTitle.vue'
import DexText, { hoverTip } from '@/components/DexText'
import ItemIcon from '@/components/ItemIcon.vue'
import MoveTable from '@/components/MoveTable.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TypeIcon from '@/components/TypeIcon'

// One Pokémon: its sprite, types, abilities and base stats, how it changes (Mega Evolution, other formes) and evolves,
// how types hit it, and its moves.
const props = defineProps<{ id: PokemonId }>()
const id = computed(() => props.id)
const ref_ = computed(() => pokemon(id.value))
const mon = computed(() => POKEMON[id.value])

const abilities = computed(() => mon.value.abilities.map(ability))

// Each stat's bar, out of 200 (the few above it fill it). Plain (`usePageStatBars`), colored by Showdown's scale for
// stats: red for low, through yellow, to green and blue for high. Set against a set of Pokémon: a tick at its median, a
// band over its middle half, the bar blue above the median and red below, and on hover how many it beats.
const bars = usePageStatBars()
const statColor = (v: number) => `hsl(${Math.min(Math.floor((v * 180) / 255), 360)}, 75%, 45%)`
const at = (v: number) => Math.min(100, v / 2)
const along = (v: number) => `${at(v)}%`
const stats = computed(() => {
  const p = bars.value === 'plain' ? null : setPercentiles(bars.value)
  return STATS.map((s, i) => {
    const v = mon.value.stats[i]!
    const rank = p?.rank(i, v) ?? null
    const median = p?.quantile(i, 0.5) ?? null
    const low = p?.quantile(i, 0.25) ?? null
    const high = p?.quantile(i, 0.75) ?? null
    return {
      s,
      v,
      side: rank === null ? null : rank >= 0.5 ? 'hi' : 'lo',
      color: p ? undefined : statColor(v),
      tip: rank === null ? undefined : t('pokemon.statRank', { pct: Math.round(rank * 100) }),
      median: median === null ? null : along(median),
      band: low === null || high === null ? null : { left: along(low), width: `${at(high) - at(low)}%` },
    }
  })
})

// The species' formes the regulation has (Megas, regional formes, Rotom's appliances), this one among them, and the
// ones that only look different, apart. Each list is shown only when it has others.
const family = computed(() => {
  const species = speciesOf(id.value)
  return availableIds('pokemon').filter((p) => speciesOf(p) === species)
})
const formes = computed(() => family.value.filter((p) => !POKEMON[p].cosmetic))
const looks = computed(() => family.value.filter((p) => POKEMON[p].cosmetic))
const others = (ids: PokemonId[]) => ids.some((p) => p !== id.value)

/** How it comes about, for formes a battle brings out: a Mega Evolution, or another change (Aegislash's Blade). */
const origin = computed((): { key: MessageKey; from: PokemonId } | null => {
  const from = mon.value.battleOnly
  if (!from) return null
  return { key: mon.value.mega ? 'pokemon.megaFrom' : 'pokemon.changesFrom', from }
})

const learnset = ref<MoveId[] | null>(null)
watchEffect(async () => {
  const current = id.value
  const sets = await loadLearnsets()
  if (id.value === current) learnset.value = movesOf(sets, current)
})
</script>

<template>
  <div class="panel head">
    <img
      v-if="!mon.noSprite"
      class="pixel sprite"
      :src="spriteUrl(id)"
      :alt="refName(ref_)"
      width="96"
      height="96"
      draggable="false"
    />
    <span v-else class="sprite icon-sprite"><PokemonIcon :id="id" :scale="2" /></span>
    <div class="facts">
      <EntryTitle :to="ref_" />
      <div class="types">
        <RouterLink v-for="ty in mon.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
          <TypeIcon :type="ty" :scale="2" />
        </RouterLink>
      </div>
      <dl class="abilities">
        <template v-for="a in abilities" :key="a.id">
          <dt><DexRef :to="a" :tip="hoverTip(a)" /></dt>
          <dd class="muted"><DexText :text="description('ability', a.id)?.short ?? ''" /></dd>
        </template>
      </dl>
      <p v-if="origin" class="origin">
        <template v-for="(part, i) in tSlots(origin.key)" :key="i">
          <template v-if="typeof part === 'string'">{{ part }}</template>
          <DexRef v-else-if="part.slot === 'pokemon'" :to="pokemon(origin.from)" />
          <span v-else-if="part.slot === 'item' && mon.item" class="with-icon"
            ><ItemIcon :id="mon.item" /><DexRef :to="item(mon.item)"
          /></span>
        </template>
      </p>
      <p v-else-if="mon.item" class="origin">
        <template v-for="(part, i) in tSlots('pokemon.holds')" :key="i">
          <template v-if="typeof part === 'string'">{{ part }}</template>
          <span v-else class="with-icon"><ItemIcon :id="mon.item" /><DexRef :to="item(mon.item)" /></span>
        </template>
      </p>
    </div>
    <div class="stats-col">
      <SegmentedControl
        v-model="bars"
        class="bars-mode"
        :label="t('pokemon.statBars')"
        :options="
          PAGE_STAT_BARS.map((b) => ({ value: b, label: b === 'plain' ? t('stats.plain') : t(`stats.vs.${b}`) }))
        "
      />
      <table class="stats">
        <tbody>
          <tr v-for="st in stats" :key="st.s" v-tip="st.tip">
            <th class="muted">{{ t(`stat.${st.s}`) }}</th>
            <td class="r num">{{ st.v }}</td>
            <td class="bar-cell">
              <span class="track" :class="{ plain: bars === 'plain' }">
                <span v-if="st.band" class="band" :style="st.band"></span>
                <span class="bar" :class="st.side" :style="{ width: along(st.v), background: st.color }"></span>
                <span v-if="st.median" class="median" :style="{ left: st.median }"></span>
              </span>
            </td>
          </tr>
          <tr class="total">
            <th v-tip="t('stat.bstFull')" class="muted">{{ t('stat.bst') }}</th>
            <td class="r num">{{ total(mon) }}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <p v-if="bars !== 'plain'" class="legend muted">{{ t(`stats.about.${bars}`) }} {{ t('pokemon.statLegend') }}</p>
      <p class="weight muted">
        {{ t('pokemon.weight') }} <span class="num">{{ mon.weight }} kg</span>
      </p>
    </div>
  </div>

  <div v-if="others(formes) || others(looks) || mon.prevo || mon.evos" class="panel">
    <dl class="relations">
      <template v-if="mon.prevo">
        <dt class="muted">{{ t('pokemon.evolvesFrom') }}</dt>
        <dd><PokemonChips :ids="[mon.prevo]" /></dd>
      </template>
      <template v-if="mon.evos">
        <dt class="muted">{{ t('pokemon.evolvesInto') }}</dt>
        <dd><PokemonChips :ids="mon.evos" /></dd>
      </template>
      <template v-if="others(formes)">
        <dt class="muted">{{ t('pokemon.formes') }}</dt>
        <dd><PokemonChips :ids="formes" :current="id" /></dd>
      </template>
    </dl>
    <details v-if="others(looks)">
      <summary class="muted">{{ t('pokemon.looks', { n: looks.length }) }}</summary>
      <PokemonChips :ids="looks" :current="id" />
    </details>
  </div>

  <h2 class="section">{{ t('pokemon.defense') }}</h2>
  <DefenseResults :types="mon.types" />

  <div class="panel">
    <h2>{{ t('pokemon.moves') }}</h2>
    <MoveTable v-if="learnset" :ids="learnset" descriptions :placeholder="t('pokemon.searchMoves')" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.sprite {
  flex: none;
  width: 192px;
  height: 192px;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.facts {
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.facts .entry-title {
  margin: 0;
}
.types {
  display: flex;
  gap: 4px;
}
.origin {
  margin: 0;
}
.with-icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  vertical-align: middle;
}
.abilities {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 10px;
  align-items: baseline;
  margin: 0;
}
.abilities dt {
  font-weight: bold;
}
.abilities dd {
  margin: 0;
}
/* Where there's hover, the descriptions are in the abilities' tooltips. */
@media (hover: hover) {
  .abilities {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }
  .abilities dd {
    display: none;
  }
}
.stats-col {
  flex: 1 1 260px;
  min-width: 0;
  max-width: 420px;
  margin-left: auto;
}
.stats {
  width: 100%;
  border-collapse: collapse;
}
.stats th {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}
.stats td.r {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: right;
}
.bar-cell {
  width: 100%;
}
/* A bullet chart: on a faint track, the middle half of every Pokémon's values as a band, the stat's bar over it,
   thinner, and the median as a tick through both. */
.bars-mode {
  justify-content: flex-end;
  margin-bottom: 8px;
}
.track {
  position: relative;
  display: block;
  height: 12px;
  background: color-mix(in srgb, var(--border) 40%, transparent);
}
.band,
.bar,
.median {
  position: absolute;
  left: 0;
}
.band {
  top: 0;
  bottom: 0;
  background: var(--border);
}
.bar {
  top: 3px;
  bottom: 3px;
  background: var(--muted);
}
.bar.hi {
  background: var(--stat-hi);
}
.bar.lo {
  background: var(--stat-lo);
}
/* Plain, the bar as it was before the comparison: on its own, its full height. */
.track.plain {
  height: 10px;
  background: none;
}
.plain .bar {
  top: 0;
  bottom: 0;
  border-radius: 2px;
}
.median {
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--text);
}
.legend {
  margin: 6px 0 0;
  font-size: 0.8em;
}
.stats .total td,
.stats .total th {
  padding-top: 6px;
  font-weight: bold;
}
.weight {
  margin: 6px 0 0;
  font-size: 0.85em;
  text-align: right;
}
.relations {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 10px;
  align-items: baseline;
  margin: 0;
}
.relations dd {
  margin: 0;
}
details {
  margin-top: 8px;
}
.section {
  margin: 4px 0 8px;
}
@media (max-width: 560px) {
  .sprite {
    width: 96px;
    height: 96px;
  }
  .icon-sprite :deep(.sheet-icon) {
    zoom: 0.5;
  }
  .abilities {
    grid-template-columns: minmax(0, 1fr);
  }
  .abilities dd {
    margin-bottom: 4px;
  }
}
</style>
