import { h, type FunctionalComponent } from 'vue'
import type { PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { cellStyle } from '@/lib/sprites'

// A Pokémon's icon, from the icon sheet: decorative, as its name is always beside it. Functional, as there can be
// hundreds on a page.
const PokemonIcon: FunctionalComponent<{ id: PokemonId; scale?: number }> = (props) =>
  h('span', {
    class: 'sheet-icon',
    style: cellStyle('pokemon', POKEMON[props.id].icon, props.scale ?? 1),
    'aria-hidden': 'true',
  })
PokemonIcon.props = ['id', 'scale']

export default PokemonIcon
