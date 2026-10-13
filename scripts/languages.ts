// Where `gen-data.ts` finds each language's names in PokéAPI, for every locale but English (Showdown's own names).
// Adding a locale to the app (`src/i18n/locales.ts`) without it here is a compile error.

import type { Locale } from '../src/i18n/locales.ts'

export interface Language {
  /** PokéAPI's identifier for it (`languages.csv`): `fr`, `de`, `it`, `ko`, `zh-hans`, `es-419` (Latin America)... */
  pokeapi: string
}

// English only for now: Spain's Spanish would be `es: { pokeapi: 'es' }`.
export const LANGUAGES: Record<Exclude<Locale, 'en'>, Language> = {}
