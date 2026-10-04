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
export const NAMES: { [L in Exclude<Locale, 'en'>]?: { [C in CategoryKey]?: Record<string, string> } } = {
  es: {
    abilities: {
      // Showdown splits Embody Aspect ("Evocarrecuerdos") into one ability per Ogerpon mask, labelled with the mask's
      // name minus "Mask"; the games show one name. Ours do the same with the masks' official Spanish names
      // (PokéAPI), minus "Máscara": Máscara Turquesa, Máscara Horno, Máscara Fuente, Máscara Cimiento.
      embodyaspectteal: 'Evocarrecuerdos (Turquesa)',
      embodyaspecthearthflame: 'Evocarrecuerdos (Horno)',
      embodyaspectwellspring: 'Evocarrecuerdos (Fuente)',
      embodyaspectcornerstone: 'Evocarrecuerdos (Cimiento)',
      // Not in PokéAPI yet (new in Champions).
      // https://bulbapedia.bulbagarden.net/wiki/Aura_Guard_(Ability)
      auraguard: 'Aura Protectora',
      // https://bulbapedia.bulbagarden.net/wiki/Eelevate_(Ability)
      eelevate: 'Impulso Anguila',
      // https://bulbapedia.bulbagarden.net/wiki/Fire_Mane_(Ability)
      firemane: 'Crin de Fuego',
      // Renamed from Generation IX; PokéAPI still has "Lodo Líquido" (Generations III–VIII).
      // https://bulbapedia.bulbagarden.net/wiki/Liquid_Ooze_(Ability)
      liquidooze: 'Viscosecreción',
    },
    items: {
      // Renamed from Legends: Z-A; PokéAPI still has "Cinta Experto" (X and Y to Scarlet and Violet).
      // https://bulbapedia.bulbagarden.net/wiki/Expert_Belt
      expertbelt: 'Cinturón de Experto',
      // Formerly Stick; PokéAPI still has it as `stick`, so it doesn't match Showdown's `leek`. "Puerro" since
      // Generation VIII ("Palo" before).
      // https://bulbapedia.bulbagarden.net/wiki/Leek
      leek: 'Puerro',
      // The games abbreviate it to fit ("Revest. Metálico", as PokéAPI has it); the dex has room for the full name,
      // as PokéAPI itself gives for others ("Electricidad Estática", "Absorbe Electricidad").
      // https://bulbapedia.bulbagarden.net/wiki/Metal_Coat
      metalcoat: 'Revestimiento Metálico',
    },
  },
}
