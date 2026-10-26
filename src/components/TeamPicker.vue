<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronsDown, ChevronsUp, X } from '@lucide/vue'
import {
  ability,
  availableIds,
  item,
  pokemon,
  type AbilityId,
  type ItemId,
  type MoveId,
  type PokemonId,
} from '@/data/dex'
import { ITEMS } from '@/data/items'
import { has, percent, type MetaData, type MetaSnapshot, type PokemonMeta } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { NATURE_IDS, natureEffects, natureName } from '@/data/natures'
import { loadLearnsets, movesOf, POKEMON } from '@/data/pokemon'
import { RULES } from '@/data/rules'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { noFilters, passesGroups } from '@/lib/filterGroups'
import { monMatches, MON_TERM_KINDS, SET_LIST } from '@/lib/monTerms'
import { parseDexText } from '@/lib/dexText'
import { fold, split } from '@/lib/search'
import type { TermFilters } from '@/lib/searchTerms'
import { clashesOf, shownAs, type Field, type Member } from '@/lib/team'
import FilterSearch from '@/components/FilterSearch.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import Marked from '@/components/Marked'
import MoveTable from '@/components/MoveTable.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// What fills one part of a slot in the team builder, searched as the meta's pages search it, each entry with its share
// of the Pokémon's sets where the meta shown has them, the most used first: a Pokémon from the rankings' list (by usage,
// searched by name and filtered by type, ability, move or item, `monTerms.ts`), then every other one the regulation has;
// a move from its whole movepool (`MoveTable`, its sets' moves first); an item, searched by name and filtered by
// category, its sets' first; an ability it can have; a nature, each with what it raises and lowers. Picking one hands
// it on (`pick`). What would break the team's rules with the other slots (`others`): a Pokémon whose species is on the
// team, a Mega past the most it takes, an item another holds, faded with a note saying so, still there to pick.
const props = defineProps<{
  member: Member
  others: readonly Member[]
  field: Field
  data: MetaData | null
  snapshot: MetaSnapshot | undefined
}>()
const emit = defineEmits<{ pick: [value: string]; close: [] }>()

const shown = computed(() => shownAs(props.member))
/** Its sets in the meta: the Mega's when it holds its stone (the meta counts a Mega apart), else its own. */
const sets = computed((): PokemonMeta | undefined =>
  shown.value ? (props.data?.[shown.value] ?? props.data?.[props.member.pokemon!]) : undefined,
)
/** A description as plain text, its entries by name: it's inside the button picking the row, so no links. */
const plain = (text: string | undefined) =>
  parseDexText(text ?? '')
    .map((p) => ('ref' in p ? refName(p.ref) : p.text))
    .join('')
const shareMap = <T extends string>(list: readonly { id: T; share?: number }[] | undefined) =>
  Object.fromEntries((list ?? []).map((x) => [x.id, x.share])) as Partial<Record<T, number>>

const clash = computed(() => clashesOf(props.others))
/** Why a Pokémon would clash with the team, if it would. */
const monClash = (id: PokemonId): string | undefined => {
  const on = clash.value.species(id)
  if (on) return t('builder.taken')
  if (clash.value.megasFull && POKEMON[id].mega && POKEMON[id].battleOnly)
    return t('builder.megasFull', { max: RULES.megas })
}
/** Why an item would clash with the team, if it would: another holds it, or it's a Mega Stone past the most Megas. */
const itemClash = (id: ItemId): string | undefined => {
  const by = clash.value.item(id)
  if (by) return t('builder.heldBy', { name: refName(pokemon(by)) })
  if (clash.value.megasFull && ITEMS[id].megas && props.member.pokemon && ITEMS[id].megas[props.member.pokemon])
    return t('builder.megasFull', { max: RULES.megas })
}

// Its search box focused as it opens and as it moves on to the next part, to type in at once; where there's a mouse
// only, so a phone's keyboard doesn't come up over the list.
const root = useTemplateRef<HTMLElement>('root')
const typing = window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches
async function focusSearch() {
  if (!typing) return
  await nextTick()
  root.value?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
}
onMounted(focusSearch)
watch(() => props.field, focusSearch)

const title = computed(() => {
  const f = props.field
  if (typeof f === 'number') return t('builder.pickMove', { n: f + 1 })
  return t(`builder.pick.${f}`)
})

// The search's text and filters, started afresh for each part picked.
const text = shallowRef('')
const filters = shallowRef<TermFilters>(noFilters())
const preview = shallowRef<TermFilters | null>(null)
watch(
  () => [props.field, props.member.pokemon],
  () => {
    text.value = ''
    filters.value = noFilters()
    preview.value = null
  },
)
const q = computed(() => fold(text.value.trim()))

// Pokémon: the meta's by usage, then the rest by name; a Mega among them, picked as the Pokémon holding its stone.
const monRows = computed(() => {
  const d = props.data
  const ranked = d
    ? (Object.keys(d) as PokemonId[]).filter((id) => POKEMON[id] && d[id]?.rank).sort((a, b) => d[a]!.rank - d[b]!.rank)
    : []
  const seen = new Set(ranked)
  const rest = availableIds('pokemon')
    .filter((id) => !seen.has(id) && !POKEMON[id].cosmetic)
    .map((id) => ({ id, name: refName(pokemon(id)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...ranked.map((id) => ({ id, name: refName(pokemon(id)) })), ...rest]
})
const monKinds = computed(() =>
  MON_TERM_KINDS.filter((k) => k === 'type' || k === 'ability' || (props.snapshot && has(props.snapshot, SET_LIST[k]))),
)
const monPasses = (id: PokemonId, f: TermFilters) => passesGroups(f, (x) => monMatches(props.data, id, x))
const monCount = (f: TermFilters) => monRows.value.filter((r) => monPasses(r.id, f)).length
const monShown = computed(() =>
  monRows.value.flatMap((r) => {
    if (!monPasses(r.id, preview.value ?? filters.value)) return []
    const parts = q.value && !preview.value ? split(r.name, q.value) : null
    return !q.value || preview.value || parts
      ? [{ ...r, parts, usage: props.data?.[r.id]?.usage, clash: monClash(r.id) }]
      : []
  }),
)
/** How many the text finds by name, with the filters picked: not the preview's, which the options show over it. */
const monNamed = computed(() =>
  q.value ? monRows.value.filter((r) => split(r.name, q.value) && monPasses(r.id, filters.value)).length : 0,
)

// Moves: its sets' first, then the rest of its movepool.
const MOVE_KINDS = ['type', 'category', 'flag', 'reach', 'priority'] as const
const learnset = shallowRef<MoveId[] | null>(null)
watch(
  () => props.member.pokemon,
  async (id) => {
    learnset.value = null
    if (!id) return
    const all = await loadLearnsets()
    if (props.member.pokemon === id) learnset.value = movesOf(all, id)
  },
  { immediate: true },
)
const moveShares = computed(() => shareMap(sets.value?.moves))
const moveIds = computed(() => {
  const used = (sets.value?.moves ?? []).map((x) => x.id).filter((x) => MOVES[x])
  const seen = new Set(used)
  return [...used, ...(learnset.value ?? []).filter((x) => !seen.has(x) && MOVES[x])]
})
const pickedMoves = computed(() => props.member.moves.filter((x): x is MoveId => !!x))

// Items: its sets' first, then every other one it can use by name (no other Pokémon's Mega Stone or mask); filtered by
// category. As its meta page counts them: the meta counts a Mega apart, its stone only on the Mega's sets, so the
// Pokémon's items count its Megas' teams too, each holding its stone (every share out of both's usage added up).
const itemSets = computed((): { id: ItemId; share?: number }[] => {
  const id = props.member.pokemon
  const d = props.data
  if (!id || !d) return []
  const own = d[id]?.items ?? []
  const base = d[id]?.usage ?? 0
  const stones = (Object.keys(ITEMS) as ItemId[]).flatMap((i) => {
    const mega = ITEMS[i].megas?.[id]
    const usage = mega ? d[mega]?.usage : undefined
    return usage ? [{ id: i, usage }] : []
  })
  const total = base + stones.reduce((a, x) => a + x.usage, 0)
  if (!stones.length || !total) return own
  return [
    ...own.map((x) => ({ id: x.id, share: x.share === undefined ? undefined : (x.share * base) / total })),
    ...stones.map((x) => ({ id: x.id, share: x.usage / total })),
  ].sort((a, b) => (b.share ?? -1) - (a.share ?? -1))
})
const itemShares = computed(() => shareMap(itemSets.value))
const usable = (x: ItemId) => {
  const it = ITEMS[x]
  const id = props.member.pokemon
  if (it.megas) return !!id && !!it.megas[id]
  return !it.users || (!!id && it.users.includes(id))
}
const itemRows = computed(() => {
  const used = itemSets.value.map((x) => x.id).filter((x) => ITEMS[x])
  const seen = new Set(used)
  const rest = availableIds('item')
    .filter((x) => !seen.has(x) && usable(x))
    .sort((a, b) => refName(item(a)).localeCompare(refName(item(b))))
  return [...used, ...rest].map((id) => ({ id, name: refName(item(id)) }))
})
const ITEM_KINDS = ['itemCategory'] as const
const itemPasses = (id: ItemId, f: TermFilters) =>
  passesGroups(f, (x) => x.kind === 'itemCategory' && ITEMS[id].category === x.id)
const itemCount = (f: TermFilters) => itemRows.value.filter((r) => itemPasses(r.id, f)).length
const itemShown = computed(() =>
  itemRows.value.flatMap((r) => {
    if (!itemPasses(r.id, preview.value ?? filters.value)) return []
    const parts = q.value && !preview.value ? split(r.name, q.value) : null
    return !q.value || preview.value || parts ? [{ ...r, parts, clash: itemClash(r.id) }] : []
  }),
)
/** How many the text finds by name, with the filters picked (as the Pokémon's). */
const itemNamed = computed(() =>
  q.value ? itemRows.value.filter((r) => split(r.name, q.value) && itemPasses(r.id, filters.value)).length : 0,
)

// Abilities: those it can have, by share: the Pokémon's own sets', its Mega's having its Mega's ability.
const abilityRows = computed(() => {
  const id = props.member.pokemon
  const shares = shareMap((id && props.data?.[id]?.abilities) || sets.value?.abilities)
  return (id ? POKEMON[id].abilities : [])
    .map((a: AbilityId) => ({ id: a, share: shares[a] }))
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1))
})

// Natures: its sets' by share, then the rest by name.
const natureRows = computed(() => {
  const shares = shareMap(sets.value?.natures)
  return [...NATURE_IDS]
    .sort((a, b) => (shares[b] ?? -1) - (shares[a] ?? -1) || natureName(a).localeCompare(natureName(b)))
    .map((id) => ({ id, share: shares[id], effects: natureEffects(id) }))
})
</script>

<template>
  <div ref="root" class="picker">
    <div class="picker-head">
      <h2>{{ title }}</h2>
      <button type="button" class="close" :aria-label="t('builder.closePicker')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>

    <template v-if="field === 'pokemon'">
      <FilterSearch
        v-model:text="text"
        v-model:filters="filters"
        v-model:preview="preview"
        :subject="t('filter.subject.pokemon')"
        :name-count="monNamed"
        :kinds="monKinds"
        :count="monCount"
      />
      <ul class="rows" :class="{ previewing: preview }">
        <li v-for="r in monShown" :key="r.id" v-memo="[r.id, r.name, r.parts?.join(' '), r.usage, r.clash]">
          <button type="button" class="row" :class="{ clash: r.clash }" @click="emit('pick', r.id)">
            <PokemonIcon :id="r.id" />
            <span class="row-name"
              ><Marked v-if="r.parts" :p="r.parts" /><template v-else>{{ r.name }}</template
              ><span v-if="r.clash" class="clash-note">{{ r.clash }}</span></span
            >
            <span class="types"><TypeIcon v-for="ty in POKEMON[r.id].types" :key="ty" :type="ty" /></span>
            <span class="share">{{ r.usage === undefined ? '' : percent(r.usage) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <MoveTable
      v-else-if="typeof field === 'number'"
      :ids="moveIds"
      :shares="moveShares"
      :kinds="MOVE_KINDS"
      :pick="(id) => emit('pick', id)"
      :picked="pickedMoves"
      under="—"
      descriptions
      stacked
      no-pp
    />

    <template v-else-if="field === 'item'">
      <FilterSearch
        v-model:text="text"
        v-model:filters="filters"
        v-model:preview="preview"
        :subject="t('filter.subject.items')"
        :name-count="itemNamed"
        :kinds="ITEM_KINDS"
        :count="itemCount"
      />
      <ul class="rows" :class="{ previewing: preview }">
        <li v-if="member.item">
          <button type="button" class="row" @click="emit('pick', '')">
            <span class="row-name muted">{{ t('builder.noItem') }}</span>
          </button>
        </li>
        <li
          v-for="r in itemShown"
          :key="r.id"
          v-memo="[r.id, r.name, r.parts?.join(' '), itemShares[r.id], r.clash, member.item === r.id]"
        >
          <button
            type="button"
            class="row stacked"
            :class="{ on: member.item === r.id, clash: r.clash }"
            @click="emit('pick', r.id)"
          >
            <ItemIcon :id="r.id" />
            <span class="row-name"
              ><Marked v-if="r.parts" :p="r.parts" /><template v-else>{{ r.name }}</template
              ><span v-if="r.clash" class="clash-note">{{ r.clash }}</span></span
            >
            <span class="share">{{ itemShares[r.id] === undefined ? '' : percent(itemShares[r.id]!) }}</span>
            <span class="desc muted">{{ plain(description('item', r.id)?.short) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <ul v-else-if="field === 'ability'" class="rows">
      <li v-for="r in abilityRows" :key="r.id">
        <button type="button" class="row stacked" :class="{ on: member.ability === r.id }" @click="emit('pick', r.id)">
          <span class="row-name">{{ refName(ability(r.id)) }}</span>
          <span class="share">{{ r.share === undefined ? '' : percent(r.share) }}</span>
          <span class="desc muted">{{ plain(description('ability', r.id)?.short) }}</span>
        </button>
      </li>
    </ul>

    <ul v-else-if="field === 'nature'" class="rows">
      <li v-for="r in natureRows" :key="r.id">
        <button type="button" class="row" :class="{ on: member.nature === r.id }" @click="emit('pick', r.id)">
          <span class="row-name">{{ natureName(r.id) }}</span>
          <span v-if="r.effects" class="effects"
            ><span class="up"><ChevronsUp :size="12" :stroke-width="3" />{{ t(`stat.${r.effects.plus}`) }}</span
            ><span class="down"
              ><ChevronsDown :size="12" :stroke-width="3" />{{ t(`stat.${r.effects.minus}`) }}</span
            ></span
          >
          <span v-else class="effects muted">{{ t('builder.neutral') }}</span>
          <span class="share">{{ r.share === undefined ? '' : percent(r.share) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.picker-head h2 {
  margin: 0;
}
.close {
  padding: 2px;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.rows {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rows.previewing {
  opacity: 0.75;
}
.row {
  --icon-scale: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 2px 8px;
  width: 100%;
  padding: 4px 6px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.row:hover,
.row:focus-visible {
  background: var(--panel-alt);
}
.row.on {
  box-shadow: inset 3px 0 0 var(--accent);
}
/* Ability and nature rows have no icon: their name starts the row. */
.rows > li > .row > .row-name:first-child {
  grid-column: 1 / 3;
}
.row-name {
  font-weight: bold;
  color: var(--link);
  overflow-wrap: anywhere;
}
/* What would break the team's rules: faded, a note under its name saying why. */
.row.clash > :not(.row-name) {
  opacity: 0.45;
}
.row.clash .row-name {
  color: var(--muted);
}
.clash-note {
  display: block;
  font-size: 0.8em;
  font-weight: normal;
  color: var(--bad);
}
.types {
  display: inline-flex;
  gap: 3px;
}
.share {
  min-width: 3.4em;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.desc {
  grid-column: 2 / -1;
  font-size: 0.85em;
}
.rows > li > .row > .row-name:first-child ~ .desc {
  grid-column: 1 / -1;
}
.effects {
  display: inline-flex;
  gap: 8px;
  font-size: 0.85em;
}
.up,
.down {
  display: inline-flex;
  align-items: center;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
</style>
