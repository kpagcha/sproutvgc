<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { ability, availableIds, available, item, pokemon, type MoveId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, STATS, loadLearnsets, movesOf, speciesOf, spriteUrl, total, type AbilitySlot } from '@/data/pokemon'
import { t, tSlots, type MessageKey } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import DefenseResults from '@/components/DefenseResults.vue'
import DexRef from '@/components/DexRef.vue'
import DexText from '@/components/DexText.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import MoveTable from '@/components/MoveTable.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon.vue'
import TypeIcon from '@/components/TypeIcon.vue'

// One Pokémon: its sprite, types, abilities and base stats, how it changes (Mega Evolution, other formes) and evolves,
// how types hit it, and its moves.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const ref_ = computed(() => pokemon(id.value))
const exists = computed(() => available(ref_.value))
const mon = computed(() => POKEMON[id.value])

const SLOTS: AbilitySlot[] = ['0', '1', 'H']
const abilities = computed(() =>
  SLOTS.flatMap((slot) => {
    const a = mon.value.abilities[slot]
    return a ? [{ slot, ref: ability(a) }] : []
  }),
)

/** Showdown's color scale for stats: red for low, through yellow, to green and blue for high. */
const statColor = (v: number) => `hsl(${Math.min(Math.floor((v * 180) / 255), 360)}, 75%, 45%)`

const gender = computed(() => {
  const g = mon.value.gender
  if (g === 'N') return t('pokemon.genderless')
  if (g === 'M' || g === 1) return t('pokemon.maleOnly')
  if (g === 'F' || g === 0) return t('pokemon.femaleOnly')
  return t('pokemon.genderRatio', { m: g * 100, f: 100 - g * 100 })
})

// The species' other formes the regulation has (Megas, regional formes, Rotom's appliances), and the ones that only
// look different, apart.
const family = computed(() => {
  const species = speciesOf(id.value)
  return availableIds('pokemon').filter((p) => p !== id.value && speciesOf(p) === species)
})
const formes = computed(() => family.value.filter((p) => !POKEMON[p].cosmetic))
const looks = computed(() => family.value.filter((p) => POKEMON[p].cosmetic))

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
        <h1>{{ refName(ref_) }}</h1>
        <div class="types">
          <RouterLink v-for="ty in mon.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
            <TypeIcon :type="ty" :scale="2" />
          </RouterLink>
        </div>
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
        <dl class="misc">
          <dt class="muted">{{ t('pokemon.height') }}</dt>
          <dd class="num">{{ mon.height }} m</dd>
          <dt class="muted">{{ t('pokemon.weight') }}</dt>
          <dd class="num">{{ mon.weight }} kg</dd>
          <dt class="muted">{{ t('pokemon.gender') }}</dt>
          <dd>{{ gender }}</dd>
        </dl>
      </div>
    </div>

    <div class="cols">
      <div class="panel">
        <h2>{{ t('pokemon.abilities') }}</h2>
        <dl class="abilities">
          <template v-for="a in abilities" :key="a.slot">
            <dt>
              <DexRef :to="a.ref" />
              <span v-if="a.slot === 'H'" class="muted hidden">{{ t('pokemon.hidden') }}</span>
            </dt>
            <dd class="muted"><DexText :text="description('ability', a.ref.id)?.short ?? ''" /></dd>
          </template>
        </dl>
      </div>

      <div class="panel">
        <h2>{{ t('pokemon.stats') }}</h2>
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
              <th class="muted">{{ t('stat.total') }}</th>
              <td class="r num">{{ total(mon) }}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="formes.length || looks.length || mon.prevo || mon.evos" class="panel">
      <dl class="relations">
        <template v-if="mon.prevo">
          <dt class="muted">{{ t('pokemon.evolvesFrom') }}</dt>
          <dd><PokemonChips :ids="[mon.prevo]" /></dd>
        </template>
        <template v-if="mon.evos">
          <dt class="muted">{{ t('pokemon.evolvesInto') }}</dt>
          <dd><PokemonChips :ids="mon.evos" /></dd>
        </template>
        <template v-if="formes.length">
          <dt class="muted">{{ t('pokemon.formes') }}</dt>
          <dd><PokemonChips :ids="formes" /></dd>
        </template>
      </dl>
      <details v-if="looks.length">
        <summary class="muted">{{ t('pokemon.looks', { n: looks.length }) }}</summary>
        <PokemonChips :ids="looks" />
      </details>
    </div>

    <h2 class="section">{{ t('pokemon.defense') }}</h2>
    <DefenseResults :types="mon.types" />

    <div class="panel">
      <h2>{{ t('pokemon.moves') }}</h2>
      <MoveTable v-if="learnset" :ids="learnset" :placeholder="t('pokemon.searchMoves')" />
    </div>
  </template>
  <div v-else class="panel">
    <p>{{ t('pokemon.notFound', { id, reg: REGULATION }) }}</p>
  </div>
</template>

<style scoped>
.head {
  display: flex;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.facts h1 {
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
.misc {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 0;
}
.misc dd {
  margin: 0;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
.abilities {
  margin: 0;
}
.abilities dt {
  font-weight: bold;
}
.abilities dd {
  margin: 0 0 8px;
}
.hidden {
  font-weight: normal;
  font-size: 0.9em;
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
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
