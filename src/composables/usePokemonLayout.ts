import { stored } from '@/composables/stored'

// How a Pokémon's page lays it out: as the games' summary screen (`PokemonSummary`), or as the dex page it was before,
// everything on one page (`PokemonClassic`).
export const POKEMON_LAYOUTS = ['summary', 'classic'] as const
export type PokemonLayout = (typeof POKEMON_LAYOUTS)[number]

const layout = stored('sproutvgc.pokemon.layout', POKEMON_LAYOUTS)

export const usePokemonLayout = () => layout
