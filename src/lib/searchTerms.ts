// The terms of an advanced search (`TermSearch`): entries a list is narrowed by, typed into its search box and picked
// from what the text finds: a type, an ability, a move, an item or a Pokémon, or what isn't a dex entry of its own
// (a move's category, tag or reach). An entry passes them all or isn't listed; what passing one means is the page's.
// They're kept in the URL, in the order they were picked:
//
//   ?f=type:fire,move:tailwind

import { available, type Ref } from '@/data/dex'
import { CATEGORIES, FLAGS, REACHES, type Category, type Flag, type Reach } from '@/data/moves'
import { isType } from '@/data/types'

/** A term that's a dex entry (or a type): named and linked as one. */
export type RefTerm = Ref<'type' | 'ability' | 'move' | 'item' | 'pokemon'>
/** A term that isn't: what the page names it by. */
export type ExtraTerm = { kind: 'category'; id: Category } | { kind: 'flag'; id: Flag } | { kind: 'reach'; id: Reach }
export type Term = RefTerm | ExtraTerm
export type TermKind = Term['kind']
export type ExtraKind = ExtraTerm['kind']

const EXTRA: Record<ExtraKind, readonly string[]> = { category: CATEGORIES, flag: FLAGS, reach: REACHES }
export const isExtraKind = (kind: string): kind is ExtraKind => kind in EXTRA

/** A term of `kind` and `id`, if it's one: a type, a dex entry the regulation has, or a known category, tag or reach. */
export function toTerm(kind: string, id: string): Term | null {
  if (isExtraKind(kind)) return EXTRA[kind].includes(id) ? ({ kind, id } as Term) : null
  const term = { kind, id } as Term
  if (kind === 'type') return isType(id) ? term : null
  return available(term as RefTerm) ? term : null
}

/** The terms in `?f=` of the `kinds` given, leaving out any the regulation doesn't have, and repeats. */
export function parseTerms(f: unknown, kinds: readonly TermKind[]): Term[] {
  if (typeof f !== 'string' || !f) return []
  const terms: Term[] = []
  for (const key of f.split(',')) {
    const [kind = '', id = ''] = key.split(':')
    if (!(kinds as readonly string[]).includes(kind)) continue
    const term = toTerm(kind, id)
    if (term && !terms.some((x) => x.kind === term.kind && x.id === term.id)) terms.push(term)
  }
  return terms
}

/** `terms` as `?f=` takes them, undefined to leave it out. */
export const formatTerms = (terms: readonly Term[]) => terms.map((x) => `${x.kind}:${x.id}`).join(',') || undefined
