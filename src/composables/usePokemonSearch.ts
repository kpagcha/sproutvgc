import { computed, type Ref } from 'vue'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'
import { useFavorites } from '@/composables/useFavorites'
import { GROUP_CAP, usePickerGroups, type PickerGroup } from '@/composables/usePickerGroups'

/** A Pokémon's name, or nothing for none. */
export const pokemonName = (id: PokemonId | null) => (id ? refName(pokemon(id)) : '')

/** Usage ranks by Pokémon, from 1, for a picker to list by. */
export type Ranks = Partial<Record<PokemonId, number>>

/**
 * A group's heading while browsing: Recent and Favorites fold away (`folded`, their rows then left out); the rest (All,
 * or By usage given ranks) doesn't.
 */
export interface GroupHeading {
  group: PickerGroup | 'all' | 'usage'
  /** How many it has, all of them. */
  count: number
  folded: boolean
}
/** Under a group with more than it shows at first: the link showing them all, or back to the first few. */
export interface GroupMore {
  group: PickerGroup
  total: number
  all: boolean
}

/**
 * A Pokémon in a picker's list: its name with the match marked, whether it's a favorite, the headings before it (a
 * group's on its first; a folded group's, with no rows of its own, on the next one's) and the link after it (on a
 * group's last, when it has more).
 */
export interface PokemonOption {
  id: PokemonId
  name: string
  parts: Marks
  fav: boolean
  /** Unique in the list, as a Pokémon browsed can be in it under each group. */
  key: string
  headings?: GroupHeading[]
  more?: GroupMore
  /** Its usage rank, when the list goes by usage. */
  rank?: number
}

/**
 * The Pokémon a search's text finds, by name, each with the match marked (`parts`, as `split` marks it): every one
 * (of `ids`, else the regulation's) while the text is empty or is the name of the one `picked`, to browse, the ones
 * picked lately first (with `withRecent`), then the reader's favorites, each group its first `GROUP_CAP` unless asked
 * for all and folding away, then every one in its place; the favorites first among those found while typing; none
 * while it's not `open`. By name, or given `ranks` (the meta's usage ranks), by usage: the ranked first, most used
 * first, then the rest by name. For the Pokémon pickers: the drop-down and the dialog's panel.
 */
export function usePokemonSearch(
  ids: () => readonly PokemonId[] | undefined,
  text: Ref<string>,
  picked: () => PokemonId | null,
  open: () => boolean = () => true,
  ranks: () => Ranks | undefined = () => undefined,
  withRecent: () => boolean = () => false,
) {
  const { isFavorite } = useFavorites()
  const { recent, folded, expanded } = usePickerGroups()
  const all = computed(() => {
    const r = ranks()
    return (ids() ?? availableIds('pokemon'))
      .filter((id) => !POKEMON[id].cosmetic)
      .map((id) => ({ id, name: refName(pokemon(id)), fav: isFavorite(pokemon(id)), rank: r?.[id] }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name, locale.value))
  })
  const rest = computed(() => (ranks() ? ('usage' as const) : ('all' as const)))
  /** The text shows the one picked as it is, not a search being typed. */
  const showsPicked = computed(() => !!picked() && text.value === pokemonName(picked()))
  const results = computed((): PokemonOption[] => {
    if (!open()) return []
    const q = fold(text.value.trim())
    if (!q || showsPicked.value) {
      const whole = (m: (typeof all.value)[number]) => ({ ...m, parts: [m.name] as Marks })
      const byId = new Map(all.value.map((m) => [m.id, m]))
      const groups: { group: PickerGroup; list: (typeof all.value)[number][] }[] = []
      const picks = withRecent() ? recent.value.flatMap((id) => byId.get(id) ?? []) : []
      if (picks.length) groups.push({ group: 'recent', list: picks })
      const favs = all.value.filter((m) => m.fav)
      if (favs.length) groups.push({ group: 'favorites', list: favs })
      if (!groups.length) return all.value.map((m) => ({ ...whole(m), key: m.id }))
      const out: PokemonOption[] = []
      // Headings waiting for a row to go before: a folded group's, then the next group's own.
      let waiting: GroupHeading[] = []
      for (const { group, list } of groups) {
        const isFolded = folded.value.has(group)
        waiting.push({ group, count: list.length, folded: isFolded })
        if (isFolded) continue
        const showsAll = expanded.value.has(group)
        const shown = showsAll ? list : list.slice(0, GROUP_CAP)
        for (const m of shown) {
          out.push({ ...whole(m), key: `${group}:${m.id}`, headings: waiting.length ? waiting : undefined })
          waiting = []
        }
        if (list.length > GROUP_CAP) out[out.length - 1]!.more = { group, total: list.length, all: showsAll }
      }
      waiting.push({ group: rest.value, count: all.value.length, folded: false })
      return [...out, ...all.value.map((m, i) => ({ ...whole(m), key: m.id, headings: i ? undefined : waiting }))]
    }
    const found = all.value.flatMap((m) => {
      const parts = split(m.name, q)
      return parts ? [{ ...m, parts, key: m.id }] : []
    })
    return [...found.filter((m) => m.fav), ...found.filter((m) => !m.fav)]
  })
  return { results, showsPicked }
}
