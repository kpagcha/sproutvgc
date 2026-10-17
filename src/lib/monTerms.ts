// What filtering a list of Pokémon from the meta by a term means (the Pokémon rankings, an ability's, item's or move's
// meta page): of a type, able to have an ability, or with sets running a move or item, on at least `MIN_SHARE` of them
// (what a few sets run doesn't make it one that runs it).

import type { PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { POKEMON } from '@/data/pokemon'
import type { Term } from '@/lib/searchTerms'

export const MIN_SHARE = 0.05
/** The kinds a list of the meta's Pokémon is filtered by. */
export const MON_TERM_KINDS = ['type', 'ability', 'move', 'item'] as const
/** Where a Pokémon's sets list each kind. */
export const SET_LIST = { item: 'items', ability: 'abilities', move: 'moves' } as const
export type SetTerm = Extract<Term, { kind: 'ability' | 'move' | 'item' }>
export const isSetTerm = (term: Term): term is SetTerm =>
  term.kind === 'ability' || term.kind === 'move' || term.kind === 'item'

/** The share of a Pokémon's sets running a term's ability, move or item, when the data has it. */
export function setShare(data: MetaData | null | undefined, id: PokemonId, term: Term): number | undefined {
  if (!isSetTerm(term)) return undefined
  const list: readonly { id: string; share?: number }[] | undefined = data?.[id]?.[SET_LIST[term.kind]]
  return list?.find((x) => x.id === term.id)?.share
}

/** Whether a Pokémon matches a term. */
export function monMatches(data: MetaData | null | undefined, id: PokemonId, term: Term): boolean {
  if (term.kind === 'type') return POKEMON[id].types.includes(term.id)
  if (term.kind === 'ability') return POKEMON[id].abilities.includes(term.id)
  if (term.kind !== 'move' && term.kind !== 'item') return false
  return (setShare(data, id, term) ?? 0) >= MIN_SHARE
}
