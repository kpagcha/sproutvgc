import { computed, type Ref } from 'vue'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'

/** A Pokémon's name, or nothing for none. */
export const pokemonName = (id: PokemonId | null) => (id ? refName(pokemon(id)) : '')

/**
 * The Pokémon a search's text finds, by name, each with the match marked (`parts`: before, match, after): every one
 * (of `ids`, else the regulation's) while the text is empty or is the name of the one `picked`, to browse; none while
 * it's not `open`. For the Pokémon pickers: the drop-down and the dialog's panel.
 */
export function usePokemonSearch(
  ids: () => readonly PokemonId[] | undefined,
  text: Ref<string>,
  picked: () => PokemonId | null,
  open: () => boolean = () => true,
) {
  const all = computed(() =>
    (ids() ?? availableIds('pokemon'))
      .filter((id) => !POKEMON[id].cosmetic)
      .map((id) => ({ id, name: refName(pokemon(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
  )
  /** The text shows the one picked as it is, not a search being typed. */
  const showsPicked = computed(() => !!picked() && text.value === pokemonName(picked()))
  const results = computed(() => {
    if (!open()) return []
    const q = fold(text.value.trim())
    if (!q || showsPicked.value) return all.value.map((m) => ({ ...m, parts: [m.name] as Marks }))
    return all.value.flatMap((m) => {
      const parts = split(m.name, q)
      return parts ? [{ ...m, parts }] : []
    })
  })
  return { results, showsPicked }
}
