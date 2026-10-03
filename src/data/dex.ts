// The dex's categories, and references to their entries. Every mention of a status, move, ability or item is a `Ref`,
// so it renders through `DexRef` and becomes a link once its category has a page (see `PAGES`). Names come from the
// generated data (`src/data/generated/`, by `npm run gen-data`) or, for the rest, the locale `names` tables.

// Type-only: the full files give the IDs, and stay out of the bundle. `available.json` is the compact part needed at
// run time.
import type ABILITIES from '@/data/generated/abilities.json'
import AVAILABLE from '@/data/generated/available.json'
import type ITEMS from '@/data/generated/items.json'
import type MOVES from '@/data/generated/moves.json'
import type POKEMON from '@/data/generated/pokemon.json'
import type { TypeId } from '@/data/types'
import { CONDITIONS, showdownId, type ConditionId } from '@/data/conditions'

export type { ConditionId }

// Abilities, moves, items and Pokémon are generated: every one in the games, and whether the current regulation has it.
// Conditions are curated (`conditions.ts`), and the regulation has one when something it has causes it (generated).
// Groups list the entries referenced so far. An ID is only unique within its category: Electric
// Terrain is both a move and the terrain it sets, and Psychic both a type and a move.

/** Groups of moves, abilities or effects, with no entry of their own. */
export const GROUPS = ['powder', 'trapping', 'terrains'] as const

export type GroupId = (typeof GROUPS)[number]
export type MoveId = keyof typeof MOVES
export type AbilityId = keyof typeof ABILITIES
export type ItemId = keyof typeof ITEMS
/** A species or forme, by Showdown ID: `garchomp`, `garchompmegaz`, `raichualola`. */
export type PokemonId = keyof typeof POKEMON

/** Each category's IDs. */
export interface Ids {
  type: TypeId
  condition: ConditionId
  group: GroupId
  move: MoveId
  ability: AbilityId
  item: ItemId
  pokemon: PokemonId
}
export type Kind = keyof Ids
/** The categories named in the locale `names` tables (types have their own). */
export type NamedKind = Exclude<Kind, 'type'>

/** An entry of the dex: `Ref<'item'>` for an item, `Ref` for any. */
export type Ref<K extends Kind = Kind> = { [k in K]: { kind: k; id: Ids[k] } }[K]

export const condition = (id: ConditionId): Ref<'condition'> => ({ kind: 'condition', id })
export const group = (id: GroupId): Ref<'group'> => ({ kind: 'group', id })
export const move = (id: MoveId): Ref<'move'> => ({ kind: 'move', id })
export const ability = (id: AbilityId): Ref<'ability'> => ({ kind: 'ability', id })
export const item = (id: ItemId): Ref<'item'> => ({ kind: 'item', id })
export const pokemon = (id: PokemonId): Ref<'pokemon'> => ({ kind: 'pokemon', id })

/** A string unique to `ref` across categories, for keys and sets. */
export const refKey = (ref: Ref): string => `${ref.kind}:${ref.id}`
export const sameRef = (a: Ref, b: Ref): boolean => a.kind === b.kind && a.id === b.id

/** A category's entry page: its route's name, and the route parameter that takes the entry's ID (`id` by default). */
export interface Page {
  route: string
  param?: string
}

/** Each category's entry page. Mentions of a category without one are plain text; registering it links them all. */
export const PAGES: Partial<Record<Kind, Page>> = {
  type: { route: 'types', param: 'type' },
  ability: { route: 'ability' },
  pokemon: { route: 'pokemon' },
  move: { route: 'move' },
  item: { route: 'item' },
  condition: { route: 'condition' },
}

/** Whether the current regulation has `ref` (or there's no ref to check), so its interactions are shown. */
export function available(ref: Ref | undefined): boolean {
  if (!ref) return true
  const ids = AVAILABLE_IDS[ref.kind as keyof typeof AVAILABLE_IDS] as Set<string> | undefined
  return ids ? ids.has(ref.id) : true // Types and groups are all in the game
}

/** The entries the current regulation has, of a generated category, in ID order. */
export function availableIds<K extends keyof typeof AVAILABLE_IDS>(kind: K): Ids[K][] {
  return [...AVAILABLE_IDS[kind]] as Ids[K][]
}

const AVAILABLE_IDS = {
  ability: new Set(AVAILABLE.abilities),
  move: new Set(AVAILABLE.moves),
  item: new Set(AVAILABLE.items),
  pokemon: new Set(AVAILABLE.pokemon),
  condition: new Set(
    (Object.keys(CONDITIONS) as ConditionId[]).filter((id) => AVAILABLE.conditions.includes(showdownId(id))),
  ),
}
