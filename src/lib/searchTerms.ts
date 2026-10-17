// The terms a list is filtered by (`FilterSearch`): typed into its search box and picked from what the text finds, or
// added in the advanced mode's groups: a type, an ability, a move, an item or a Pokémon, or what isn't a dex entry of
// its own (a move's category, tag or reach, an item's category, a condition's kind). What passing one means is the
// list's. They're kept in the URL as filter groups (`filterGroups.ts`, `?f=`, `?fm=`).

import { available, availableIds, type PokemonId, type Ref } from '@/data/dex'
import { SUBKINDS, type Subkind } from '@/data/conditions'
import { ITEM_CATEGORIES, type ItemCategory } from '@/data/itemCategories'
import { CATEGORIES, FLAGS, REACHES, type Category, type Flag, type Reach } from '@/data/moves'
import { POKEMON } from '@/data/pokemon'
import { isType, TYPES } from '@/data/types'
import { locale, t, typeName, type MessageKey } from '@/i18n'
import { refName } from '@/i18n/refName'
import { parseGroups, formatGroups, type Filters } from '@/lib/filterGroups'

/** A term that's a dex entry (or a type): named and linked as one. */
export type RefTerm = Ref<'type' | 'ability' | 'move' | 'item' | 'pokemon'>
/** A term that isn't: named by `termName`. */
export type ExtraTerm =
  | { kind: 'category'; id: Category }
  | { kind: 'flag'; id: Flag }
  | { kind: 'reach'; id: Reach }
  | { kind: 'itemCategory'; id: ItemCategory }
  | { kind: 'subkind'; id: Subkind }
export type Term = RefTerm | ExtraTerm
export type TermKind = Term['kind']
export type ExtraKind = ExtraTerm['kind']
export type TermFilters = Filters<Term>

/** The terms that aren't dex entries, each kind's IDs, in the order they're offered. */
export const EXTRA: Record<ExtraKind, readonly string[]> = {
  category: CATEGORIES,
  flag: FLAGS,
  reach: REACHES,
  itemCategory: ITEM_CATEGORIES,
  subkind: SUBKINDS,
}
export const isExtraKind = (kind: string): kind is ExtraKind => kind in EXTRA

const EXTRA_NAME: Record<ExtraKind, (id: string) => MessageKey> = {
  category: (id) => `move.category.${id}` as MessageKey,
  flag: (id) => `move.flag.${id}` as MessageKey,
  reach: (id) => `move.reach.${id}` as MessageKey,
  itemCategory: (id) => `itemCategory.${id}` as MessageKey,
  subkind: (id) => `conditions.sub1.${id}` as MessageKey,
}

/** A term's name: a dex entry's own, or what the site calls a category, tag, reach or kind. */
export const termName = (term: Term) =>
  isExtraKind(term.kind) ? t(EXTRA_NAME[term.kind](term.id)) : refName(term as RefTerm)

/** A kind's terms that aren't dex entries, by name. */
export const extraOptions = (kind: ExtraKind) =>
  EXTRA[kind].map((id) => ({ id, name: termName({ kind, id } as ExtraTerm) }))

/**
 * Every term of a kind, for the advanced mode's picks (`FilterAdder`): types in their usual order, what isn't a dex
 * entry as the site lists it, the dex's entries by name (Pokémon but for the formes that only look different).
 */
export function termOptions(kind: TermKind): { id: string; name: string }[] {
  if (kind === 'type') return TYPES.map((id) => ({ id, name: typeName(id) }))
  if (isExtraKind(kind)) return extraOptions(kind)
  return (availableIds(kind) as string[])
    .filter((id) => kind !== 'pokemon' || !POKEMON[id as PokemonId].cosmetic)
    .map((id) => ({ id, name: refName({ kind, id } as RefTerm) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value))
}

/** A term of `kind` and `id`, if it's one: a type, a dex entry the regulation has, or a known category, tag or kind. */
export function toTerm(kind: string, id: string): Term | null {
  if (isExtraKind(kind)) return EXTRA[kind].includes(id) ? ({ kind, id } as Term) : null
  const term = { kind, id } as Term
  if (kind === 'type') return isType(id) ? term : null
  if (kind !== 'ability' && kind !== 'move' && kind !== 'item' && kind !== 'pokemon') return null
  return available(term as RefTerm) ? term : null
}

/** The filters in `?f=` and `?fm=` of the `kinds` given, leaving out any the regulation doesn't have. */
export const parseTermFilters = (f: unknown, fm: unknown, kinds: readonly TermKind[]): TermFilters =>
  parseGroups(f, fm, (kind, id) => ((kinds as readonly string[]).includes(kind) ? toTerm(kind, id) : null))

/** `filters` as `?f=` and `?fm=` take them, each undefined to leave it out. */
export const formatTermFilters = (filters: TermFilters) => formatGroups(filters)

/** What a search box's text is matched against besides its terms: names, or names and what they do. */
export type TextMatch = 'name' | 'effect'

/** What a search box searches by, for its placeholder: "name, type, ability or move". */
export function searchedBy(text: readonly TextMatch[], kinds: readonly TermKind[]): string {
  const words = [...text.map((x) => t(`filter.by.${x}`)), ...kinds.map((k) => t(`filter.by.${k}`))]
  return new Intl.ListFormat(locale.value, { type: 'disjunction' }).format(words)
}
