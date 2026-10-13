// Hand-picked data for `gen-data.ts`, where its sources are wrong or have nothing to give.

import type { Locale } from '../src/i18n/locales.ts'

/** The categories `gen-data.ts` generates, as named in its output files. */
export type CategoryKey = 'abilities' | 'moves' | 'items' | 'pokemon'

/**
 * Official names by locale and Showdown ID, overriding PokéAPI: names it doesn't have yet (it lags new releases),
 * names it has outdated, and names for entries the games don't name on their own. The script stops and lists any name
 * an entry of the regulation is missing, and says when an override matches PokéAPI again. The links are where each
 * name was checked.
 */
export const NAMES: { [L in Exclude<Locale, 'en'>]?: { [C in CategoryKey]?: Record<string, string> } } = {}

/**
 * Moves every Pokémon can use, though none learns them, so learnsets can't make them available: Struggle, which a
 * Pokémon uses once out of PP (or locked out of its moves). Still subject to the game having them and the format's bans.
 */
export const MOVES_EVERYONE_USES: string[] = ['struggle']
