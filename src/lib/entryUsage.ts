// The usage of what Pokémon's sets run (abilities, items), from a meta snapshot's data by Pokémon: an entry's usage is
// the teams running it, each Pokémon with it counting its usage by the share of its sets that run it. For their
// rankings (`UsageRankingsView`) and an ability's meta page (`MetaAbilityView`).

import type { PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { locale } from '@/i18n'

/** The lists of a Pokémon's sets an entry's usage can be counted from. */
export type UsageField = 'abilities' | 'items'

/** A Pokémon running an entry: the share of its sets that do, and the usage that brings the entry. */
export interface User {
  id: PokemonId
  share: number
  usage: number
}

/** Each entry's Pokémon in a snapshot's data, by its ID, in no order. */
export function usersOf(d: MetaData, field: UsageField): Map<string, User[]> {
  const by = new Map<string, User[]>()
  for (const [key, m] of Object.entries(d)) {
    for (const a of m![field] ?? []) {
      if (!a.share) continue
      const list = by.get(a.id) ?? []
      list.push({ id: key as PokemonId, share: a.share, usage: (m!.usage ?? 0) * a.share })
      by.set(a.id, list)
    }
  }
  return by
}

/** An entry's usage: its Pokémon's, summed. */
export const usageOf = (list: readonly User[]) => list.reduce((sum, u) => sum + u.usage, 0)

/** Each entry's rank by usage, from 1. */
export const ranksOf = (by: Map<string, User[]>) =>
  new Map([...by].sort((a, b) => usageOf(b[1]) - usageOf(a[1])).map(([id], i) => [id, i + 1]))

/** Each entry's rank and usage, for the trends against the dataset before. */
export function standings(d: MetaData, field: UsageField) {
  const by = usersOf(d, field)
  return { ranks: ranksOf(by), usage: new Map([...by].map(([id, list]) => [id, usageOf(list)])) }
}

/** Changes in usage under this read as noise: shown, but not colored. */
export const STEADY = 0.005

/** A change in usage, in percentage points: "+3.2", "−1.8". */
export const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
