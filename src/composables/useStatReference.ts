import { ref, watch } from 'vue'
import { availableIds, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { percentiles, type Percentiles, type Sample } from '@/lib/statPercentiles'

// The sets of Pokémon base stats can be compared against, each with its percentiles (below), named by `stats.vs.<set>`
// and described by `stats.about.<set>`. For now every Pokémon equally; sets weighted by usage (a regulation's meta, a
// championship) join this list.
export const STAT_SETS = ['all'] as const
export type StatSet = (typeof STAT_SETS)[number]

// How the Pokémon list shows stats: on their own (`plain`), or marked against a set, or against the Pokémon it shows at
// the moment (`shown`).
export const LIST_STAT_MARKS = ['plain', ...STAT_SETS, 'shown'] as const
export type ListStatMarks = (typeof LIST_STAT_MARKS)[number]

// How a Pokémon's page draws its stats: on their own (`plain`), or set against one of the sets.
export const PAGE_STAT_BARS = ['plain', ...STAT_SETS] as const
export type PageStatBars = (typeof PAGE_STAT_BARS)[number]

// A choice among `values`, saved under `key`.
function stored<T extends string>(key: string, values: readonly T[]) {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(key)
  } catch {
    // Storage unavailable.
  }
  const choice = ref<T>(values.includes(saved as T) ? (saved as T) : values[0]!)
  watch(choice, (v) => {
    try {
      localStorage.setItem(key, v)
    } catch {
      // Storage unavailable: the choice lasts until the page is closed.
    }
  })
  return choice
}

const listMarks = stored('sproutvgc.statReference', LIST_STAT_MARKS)
const pageBars = stored('sproutvgc.pokemon.statBars', PAGE_STAT_BARS)

export const useListStatMarks = () => listMarks
export const usePageStatBars = () => pageBars

/** The reference's samples: Megas are left out, as one for nearly every species would lift every median. */
export const samples = (ids: readonly PokemonId[]): Sample[] =>
  ids.flatMap((id) => (POKEMON[id].mega ? [] : [{ stats: POKEMON[id].stats, weight: 1 }]))

const cache = new Map<StatSet, Percentiles>()
const SETS: Record<StatSet, () => Percentiles> = {
  // Every Pokémon the dex lists (not those that only look different).
  all: () => percentiles(samples(availableIds('pokemon').filter((id) => !POKEMON[id].cosmetic))),
}
/** A set's percentiles, worked out once. */
export function setPercentiles(set: StatSet): Percentiles {
  let p = cache.get(set)
  if (!p) cache.set(set, (p = SETS[set]()))
  return p
}
