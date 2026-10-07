import { computed, type Ref } from 'vue'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'
import { useFavorites } from '@/composables/useFavorites'

/** A Pokémon's name, or nothing for none. */
export const pokemonName = (id: PokemonId | null) => (id ? refName(pokemon(id)) : '')

/** A Pokémon in a picker's list: its name with the match marked, whether it's a favorite, and the heading it opens. */
export interface PokemonOption {
  id: PokemonId
  name: string
  parts: Marks
  fav: boolean
  /** Unique in the list, as a favorite browsed is in it twice. */
  key: string
  /** On the first of each group while browsing with favorites: the group it heads. */
  group?: 'favorites' | 'all'
}

/**
 * The Pokémon a search's text finds, by name, each with the match marked (`parts`, as `split` marks it): every one
 * (of `ids`, else the regulation's) while the text is empty or is the name of the one `picked`, to browse, the
 * reader's favorites first and again in their place among the rest; the favorites first among those found while
 * typing; none while it's not `open`. For the Pokémon pickers: the drop-down and the dialog's panel.
 */
export function usePokemonSearch(
  ids: () => readonly PokemonId[] | undefined,
  text: Ref<string>,
  picked: () => PokemonId | null,
  open: () => boolean = () => true,
) {
  const { isFavorite } = useFavorites()
  const all = computed(() =>
    (ids() ?? availableIds('pokemon'))
      .filter((id) => !POKEMON[id].cosmetic)
      .map((id) => ({ id, name: refName(pokemon(id)), fav: isFavorite(pokemon(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
  )
  /** The text shows the one picked as it is, not a search being typed. */
  const showsPicked = computed(() => !!picked() && text.value === pokemonName(picked()))
  const results = computed((): PokemonOption[] => {
    if (!open()) return []
    const q = fold(text.value.trim())
    if (!q || showsPicked.value) {
      const whole = (m: (typeof all.value)[number]) => ({ ...m, parts: [m.name] as Marks })
      const favs = all.value.filter((m) => m.fav)
      if (!favs.length) return all.value.map((m) => ({ ...whole(m), key: m.id }))
      return [
        ...favs.map((m, i) => ({ ...whole(m), key: `fav:${m.id}`, group: i ? undefined : ('favorites' as const) })),
        ...all.value.map((m, i) => ({ ...whole(m), key: m.id, group: i ? undefined : ('all' as const) })),
      ]
    }
    const found = all.value.flatMap((m) => {
      const parts = split(m.name, q)
      return parts ? [{ ...m, parts, key: m.id }] : []
    })
    return [...found.filter((m) => m.fav), ...found.filter((m) => !m.fav)]
  })
  return { results, showsPicked }
}
