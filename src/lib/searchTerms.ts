// The terms of an advanced search (`TermSearch`): entries a list is narrowed by, typed into its search box and picked
// from what the text finds: a type, an ability, a move, an item or a Pokémon. An entry passes them all or isn't
// listed; what passing one means is the page's. They're kept in the URL, in the order they were picked:
//
//   ?f=type:fire,move:tailwind

import { available, refKey, sameRef, type Ref } from '@/data/dex'
import { isType } from '@/data/types'

export type Term = Ref<'type' | 'ability' | 'move' | 'item' | 'pokemon'>
export type TermKind = Term['kind']

/** The terms in `?f=` of the `kinds` given, leaving out any the regulation doesn't have, and repeats. */
export function parseTerms(f: unknown, kinds: readonly TermKind[]): Term[] {
  if (typeof f !== 'string' || !f) return []
  const terms: Term[] = []
  for (const key of f.split(',')) {
    const [kind = '', id = ''] = key.split(':')
    const term = { kind, id } as Term
    if (!(kinds as readonly string[]).includes(kind)) continue
    if (kind === 'type' ? !isType(id) : !available(term)) continue
    if (!terms.some((x) => sameRef(x, term))) terms.push(term)
  }
  return terms
}

/** `terms` as `?f=` takes them, undefined to leave it out. */
export const formatTerms = (terms: readonly Term[]) => terms.map(refKey).join(',') || undefined
