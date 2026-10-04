<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { ability, availableIds, available, item, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, loadLearnsets, movesOf, speciesOf, spriteUrl, total } from '@/data/pokemon'
import { t, tSlots, type MessageKey } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import DefenseResults from '@/components/DefenseResults.vue'
import DexRef from '@/components/DexRef'
import EntryTitle from '@/components/EntryTitle.vue'
import DexText, { hoverTip } from '@/components/DexText'
import ItemIcon from '@/components/ItemIcon.vue'
import MoveTable from '@/components/MoveTable.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// One Pokémon: its sprite, types, abilities and base stats, how it changes (Mega Evolution, other formes) and evolves,
// how types hit it, and its moves.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const ref_ = computed(() => pokemon(id.value))
const exists = computed(() => available(ref_.value))
const mon = computed(() => POKEMON[id.value])

const abilities = computed(() => mon.value.abilities.map(ability))

/** Showdown's color scale for stats: red for low, through yellow, to green and blue for high. */
const statColor = (v: number) => `hsl(${Math.min(Math.floor((v * 180) / 255), 360)}, 75%, 45%)`

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
  <template v-if="exists">
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
        <table class="stats">
          <tbody>
            <tr v-for="(s, i) in STATS" :key="s">
              <th class="muted">{{ t(`stat.${s}`) }}</th>
              <td class="r num">{{ mon.stats[i] }}</td>
              <td class="bar-cell">
                <span
                  class="bar"
                  :style="{
                    width: `${Math.min(100, (mon.stats[i]! / 200) * 100)}%`,
                    background: statColor(mon.stats[i]!),
                  }"
                ></span>
              </td>
            </tr>
            <tr class="total">
              <th v-tip="t('stat.bstFull')" class="muted">{{ t('stat.bst') }}</th>
              <td class="r num">{{ total(mon) }}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
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
  <div v-else class="panel">
    <p>{{ t('pokemon.notFound', { id, reg: REGULATION }) }}</p>
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
.bar {
  display: block;
  height: 10px;
  border-radius: 2px;
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
