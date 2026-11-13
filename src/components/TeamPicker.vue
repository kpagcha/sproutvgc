<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Star, X } from '@lucide/vue'
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
import { has, percent, type MetaData, type MetaSnapshot, type PokemonMeta, type Spread } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { NATURE_IDS, natureEffects, natureName } from '@/data/natures'
import { loadLearnsets, movesOf, POKEMON } from '@/data/pokemon'
import { RULES } from '@/data/rules'
import { t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { allFilters, noFilters, passesGroups } from '@/lib/filterGroups'
import { monMatches, MON_TERM_KINDS, SET_LIST } from '@/lib/monTerms'
import { parseDexText } from '@/lib/dexText'
import { fold, split, type Marks } from '@/lib/search'
import type { TermFilters } from '@/lib/searchTerms'
import { clashesOf, pickedAs, setsAs, type Field, type Member } from '@/lib/team'
import { useFavorites } from '@/composables/useFavorites'
import { GROUP_CAP, usePickerGroups, type PickerGroup } from '@/composables/usePickerGroups'
import FilterSearch from '@/components/FilterSearch.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import Marked from '@/components/Marked'
import MoveTable from '@/components/MoveTable.vue'
import PointsPicker from '@/components/PointsPicker.vue'
import StepBack from '@/components/StepBack.vue'
import PokemonIcon from '@/components/PokemonIcon'
import TypeIcon from '@/components/TypeIcon'

// What fills one part of a slot in the team builder, searched as the meta's pages search it, each entry with its share
// of the Pokémon's sets where the meta shown has them, the most used first: a Pokémon from the rankings' list (by usage,
// searched by name and filtered by type, ability, move or item, `monTerms.ts`; a Mega a row of its own, apart from the
// Pokémon it changes from, the one the slot is marked), then every other one the regulation has, the Pokémon picked lately and the reader's favorites
// a group over them while there's no text; a move from its whole movepool (`MoveTable`, its sets' moves first); an item,
// searched by name and filtered by category, its sets' first; an ability it can have; a nature, each with what it raises
// and lowers. Picking one hands it on (`pick`). What would break the team's rules with the other slots (`others`): a
// Pokémon whose species is on the team, an item another holds, a Mega or its stone past the most Megas, faded with a
// note saying so, still there to pick.
const props = defineProps<{
  member: Member
  others: readonly Member[]
  field: Field
  data: MetaData | null
  snapshot: MetaSnapshot | undefined
  /** For its stat points (`points`): the Pokémon its stats are of (its Mega while it Mega Evolves), its common
   * spreads, and whether it can be at every set (the damage calculator's), is, and its pooled points and stats. */
  battler?: PokemonId | null
  spreads?: readonly Spread[]
  canPool?: boolean
  atSets?: boolean
  pooled?: { points: readonly number[]; stats: readonly number[] }
  /** There's a step before this one to go back to (`back`). */
  canBack?: boolean
}>()
const emit = defineEmits<{
  pick: [value: string]
  close: []
  back: []
  /** Its stat points' step: the set changed in place, at every set or not, its nature to be picked again. */
  change: [patch: Partial<Member>]
  sets: [on: boolean]
  nature: []
}>()

const shown = computed(() => setsAs(props.member))
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
/** Why a Pokémon would clash with the team, if it would: its species is on it, or it's a Mega past the most Megas. */
const monClash = (id: PokemonId): string | undefined => {
  if (clash.value.species(id)) return t('builder.taken')
  if (clash.value.megasFull && pickedAs(id).item) return t('builder.megasFull', { max: RULES.megas })
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

// Each Pokémon the meta shown has, a Mega apart from the Pokémon it changes from, as the meta counts them, each at its
// own usage, the most used first; then every other one the regulation has, by name. A Mega picked is that Pokémon
// holding its stone (`pickedAs`), so one more Mega than the team takes clashes as its stone would.
const monRows = computed(() => {
  const d = props.data
  const listable = (id: PokemonId) => POKEMON[id] && !POKEMON[id].cosmetic
  const row = (id: PokemonId) => ({ id, name: refName(pokemon(id)), usage: d?.[id]?.usage || undefined })
  const ranked = (d ? (Object.keys(d) as PokemonId[]) : [])
    .filter((id) => d![id]?.usage && listable(id))
    .sort((x, y) => d![y]!.usage! - d![x]!.usage!)
  const seen = new Set(ranked)
  const rest = availableIds('pokemon')
    .filter((id) => !seen.has(id) && listable(id))
    .map(row)
    .sort((x, y) => x.name.localeCompare(y.name))
  return [...ranked.map(row), ...rest]
})
const monKinds = computed(() =>
  MON_TERM_KINDS.filter((k) => k === 'type' || k === 'ability' || (props.snapshot && has(props.snapshot, SET_LIST[k]))),
)
// Filtering Pokémon by move needs every learnset, loaded once there's a move to filter by, or text that could find one.
const allLearnsets = shallowRef<Record<PokemonId, MoveId[]> | null>(null)
watch(
  [q, filters],
  async () => {
    if (!allLearnsets.value && (q.value || allFilters(filters.value).some((f) => f.kind === 'move')))
      allLearnsets.value = await loadLearnsets()
  },
  { immediate: true },
)
const monPasses = (id: PokemonId, f: TermFilters) =>
  passesGroups(f, (x) => monMatches(props.data, id, x, allLearnsets.value))
const monCount = (f: TermFilters) => monRows.value.filter((r) => monPasses(r.id, f)).length
const monShown = computed(() => {
  const f = preview.value ?? filters.value
  const named = !!q.value && !preview.value
  return monRows.value.flatMap((r) => {
    if (!monPasses(r.id, f)) return []
    const parts = named ? split(r.name, q.value) : null
    return !named || parts ? [{ ...r, parts }] : []
  })
})
// The reader's favorite Pokémon (its dex entry starred, or its meta entry) lead the list while there's no text, those
// passing the filters: a group over it, as the other pickers have theirs and folded with them (`usePickerGroups`: its
// first `GROUP_CAP` until asked for all). Each is in its place in the list too, a star after its name.
const { isFavoritePokemon } = useFavorites()
const { recent, folded, expanded, toggleFold, toggleExpanded, recordPick } = usePickerGroups()
const favRows = computed(() => {
  if (q.value) return []
  const f = preview.value ?? filters.value
  return monRows.value.filter((r) => isFavoritePokemon(r.id) && monPasses(r.id, f)).map((r) => ({ ...r, parts: null }))
})
// The Pokémon picked lately, in this picker or any other with `recent` (the speed pages'), most recent first: a group
// over the favorites while there's no text, those passing the filters, folding as they do. A Pokémon picked here is
// recorded for them.
const recentRows = computed(() => {
  if (q.value) return []
  const f = preview.value ?? filters.value
  const byId = new Map(monRows.value.map((r) => [r.id, r]))
  return recent.value.flatMap((id) => {
    const r = byId.get(id)
    return r && monPasses(id, f) ? [{ ...r, parts: null }] : []
  })
})
function pickRow(id: PokemonId) {
  recordPick(id)
  emit('pick', id)
}
/** A group's heading in the list: the favorites', a toggle folding them, or the rest's. */
interface Head {
  group: 'recent' | 'favorites' | 'usage' | 'all'
  count?: number
  folded?: boolean
}
const GROUPS = {
  recent: 'picker.recent',
  favorites: 'favorites.title',
  usage: 'picker.byUsage',
  all: 'picker.all',
} as const
/** A Pokémon's row: whether it's the one the slot has (`on`: its Mega's while it holds its stone), with the headings
 * before it (a group's on its first; the favorites' folded, on the list's first) and, on the favorites' last when there
 * are more, the link to them all (`mark`: both, for the row's memo). */
interface MonRow {
  id: PokemonId
  name: string
  usage: number | undefined
  parts: Marks | null
  clash: string | undefined
  fav: boolean
  on: boolean
  key: string
  heads?: Head[]
  more?: { total: number; all: boolean; group: PickerGroup }
  mark: string
}
const monList = computed((): MonRow[] => {
  const listed = (
    r: Pick<MonRow, 'id' | 'name' | 'usage' | 'parts'>,
    key: string,
    heads?: Head[],
    more?: MonRow['more'],
  ): MonRow => ({
    ...r,
    clash: monClash(r.id),
    fav: isFavoritePokemon(r.id),
    on: shown.value === r.id,
    key,
    heads,
    more,
    mark: heads || more ? JSON.stringify([heads, more]) : '',
  })
  const main = monShown.value
  // Each group leading the list (Recent, then Favorites): its heading, folding it, over its first `GROUP_CAP` (or all
  // of them); a folded one's heading carried on to the next row drawn, so it's still there to unfold.
  const out: MonRow[] = []
  let pending: Head[] = []
  for (const [group, rows] of [
    ['recent', recentRows.value],
    ['favorites', favRows.value],
  ] as const) {
    if (!rows.length) continue
    const isFolded = folded.value.has(group)
    const all = expanded.value.has(group)
    const led = isFolded ? [] : all ? rows : rows.slice(0, GROUP_CAP)
    const head: Head = { group, count: rows.length, folded: isFolded }
    const more = rows.length > GROUP_CAP ? { total: rows.length, all, group } : undefined
    if (isFolded) pending.push(head)
    led.forEach((r, i) => {
      const heads = i ? undefined : [...pending, head]
      if (!i) pending = []
      out.push(listed(r, `${group}:${r.id}`, heads, i === led.length - 1 ? more : undefined))
    })
  }
  if (!out.length && !pending.length) return main.map((r) => listed(r, r.id))
  const rest: Head = { group: props.data ? 'usage' : 'all' }
  return [...out, ...main.map((r, i) => listed(r, r.id, i ? undefined : [...pending, rest]))]
})
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

// The spot in the list for its search's options, as its first rows (`FilterSearch`'s `rowsAt`).
const termRows = useId()
</script>

<template>
  <div ref="root" class="picker">
    <div class="picker-head">
      <StepBack v-if="canBack" @back="emit('back')" />
      <h2>{{ title }}</h2>
      <button type="button" class="close" :aria-label="t('builder.closePicker')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
    <slot />

    <PointsPicker
      v-if="field === 'points'"
      :member
      :pokemon="battler ?? member.pokemon!"
      :spreads="spreads ?? []"
      :can-pool
      :at-sets
      :pooled
      @change="emit('change', $event)"
      @sets="emit('sets', $event)"
      @nature="emit('nature')"
      @done="emit('close')"
    />

    <template v-else-if="field === 'pokemon'">
      <FilterSearch
        :rows-at="termRows"
        v-model:text="text"
        v-model:filters="filters"
        v-model:preview="preview"
        :subject="t('filter.subject.pokemon')"
        :name-count="monNamed"
        :kinds="monKinds"
        :count="monCount"
      />
      <div :id="termRows" class="term-rows"></div>
      <ul class="rows" :class="{ previewing: preview }">
        <li
          v-for="r in monList"
          :key="r.key"
          v-memo="[r.id, r.name, r.parts?.join(' '), r.usage, r.clash, r.fav, r.on, r.mark]"
        >
          <!-- Its group's heading (Recent's and the favorites' fold them away when tapped, with how many they are),
               and before it those of the groups folded. -->
          <template v-for="h in r.heads" :key="h.group">
            <button
              v-if="h.group === 'favorites' || h.group === 'recent'"
              type="button"
              class="group foldable"
              :aria-expanded="!h.folded"
              @click="toggleFold(h.group)"
            >
              <span class="fold" aria-hidden="true">{{ h.folded ? '▸' : '▾' }}</span
              >{{ t(GROUPS[h.group]) }}<span class="count">{{ h.count }}</span>
            </button>
            <div v-else class="group">{{ t(GROUPS[h.group]) }}</div>
          </template>
          <button type="button" class="row" :class="{ on: r.on, clash: r.clash }" @click="pickRow(r.id)">
            <PokemonIcon :id="r.id" />
            <span class="row-name"
              ><Marked v-if="r.parts" :p="r.parts" /><template v-else>{{ r.name }}</template
              ><Star v-if="r.fav" class="fav-star" :size="12" :stroke-width="2.5" aria-hidden="true" /><span
                v-if="r.clash"
                class="clash-note"
                >{{ r.clash }}</span
              ></span
            >
            <span class="types"><TypeIcon v-for="ty in POKEMON[r.id].types" :key="ty" :type="ty" /></span>
            <span class="share">{{ r.usage === undefined ? '' : percent(r.usage) }}</span>
          </button>
          <!-- After a group's last shown, when there are more: all of them, or back to the first few. -->
          <button v-if="r.more" type="button" class="more-link" @click="toggleExpanded(r.more.group)">
            <component :is="r.more.all ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />{{
              r.more.all ? t('picker.showFewer') : t('picker.showAll', { n: r.more.total })
            }}
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
      :pick-none="() => emit('pick', '')"
      :picked="pickedMoves"
      :current="member.moves[field]"
      under="—"
      descriptions
      stacked
      no-pp
    />

    <template v-else-if="field === 'item'">
      <FilterSearch
        :rows-at="termRows"
        v-model:text="text"
        v-model:filters="filters"
        v-model:preview="preview"
        :subject="t('filter.subject.items')"
        :name-count="itemNamed"
        :kinds="ITEM_KINDS"
        :count="itemCount"
      />
      <div :id="termRows" class="term-rows"></div>
      <ul class="rows" :class="{ previewing: preview }">
        <!-- Always there: no item is a pick of its own, going on to the next part, as any item does. -->
        <li>
          <!-- As an item's row: a blank where its icon goes, its name, what it means. -->
          <button type="button" class="row stacked" @click="emit('pick', '')">
            <span class="no-icon" aria-hidden="true"></span>
            <span class="row-name">{{ t('builder.noItem') }}</span>
            <span class="share"></span>
            <span class="desc muted">{{ t('builder.noItemDesc') }}</span>
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
  flex: 1;
  margin: 0;
  font-size: calc(13px * var(--display-scale, 1) * var(--text-scale));
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
/* No item's blank, an item icon's size. */
.no-icon {
  width: 24px;
  height: 24px;
}
.row-name {
  font-weight: bold;
  color: var(--link);
  overflow-wrap: anywhere;
}
/* A favorite's star, after its name. */
.row-name .fav-star {
  margin-left: 4px;
  vertical-align: -1px;
}
/* A group's heading, while the reader's favorites lead the list: small and muted, as the other pickers' are. */
.group {
  display: block;
  width: 100%;
  padding: 10px 6px 4px;
  font: inherit;
  font-size: 0.75em;
  font-weight: bold;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: none;
  border: 0;
  border-bottom: 1px solid var(--border);
}
/* The favorites': a toggle folding them, how many they are after its name. */
.group.foldable {
  cursor: pointer;
  user-select: none;
}
.group.foldable:hover,
.group.foldable:focus-visible {
  color: var(--text);
}
.fold {
  display: inline-block;
  width: 1em;
}
.count {
  margin-left: 6px;
  font-weight: normal;
}
/* Showing every favorite, or the first few: a row after the last shown, quiet as the headings are. */
.more-link {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 4px 6px 6px;
  font: inherit;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.more-link:hover,
.more-link:focus-visible {
  color: var(--text);
  background: var(--hover);
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
