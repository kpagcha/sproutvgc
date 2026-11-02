// The bulk and power tiers: the speed tiers' ladder (`speed.ts`, `SpeedTiersView`) for a Pokémon's bulk on one side
// (HP times Defense, or times Sp. Def: what damage taken is divided by) or its power on one (Attack or Sp. Atk, alone or
// times its best common move's power as it typically hits, `movePower.ts`). Its builds are what its sets put there, from
// the meta's spreads, merged by what the measure cares about (the nature's effect on the stat, its points, and for bulk
// its HP points), as the speed tiers' Speed builds are; the items and abilities that multiply the stat outright (an
// Assault Vest, Huge Power: `teamBalance.ts`'s) are boosts of their own, rows of their own when shown. What it could
// reach spans no points and a nature against it to every point and a nature for it; a Pokémon with no sets is at the
// benchmarks of that span. Yours is measured against each row: the share of its builds yours is stronger than.

import { available, item as itemRef, type AbilityId, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import type { MetaData, PokemonMeta } from '@/data/meta'
import { natureEffectOn } from '@/data/natures'
import { POKEMON, STATS } from '@/data/pokemon'
import { MAX_POINTS, statValue, type NatureEffect } from '@/lib/stats'
import { ABILITY_MODS, ITEM_MODS, attackOf, type Key, type Side } from '@/lib/teamBalance'

export type Measure = 'bulk' | 'power'
/** Power by the stat alone, or times its best move's power. */
export type PowerBy = 'stats' | 'moves'

/** The stat a measure is of on a side, by its index in `STATS`. */
export const statIndex = (measure: Measure, side: Side) =>
  measure === 'bulk' ? (side === 'physical' ? 2 : 4) : side === 'physical' ? 1 : 3
/** The key of `teamBalance.ts`'s multipliers for a measure on a side. */
const modKey = (measure: Measure, side: Side): Key =>
  measure === 'bulk' ? (side === 'physical' ? 'physBulk' : 'specBulk') : side === 'physical' ? 'atk' : 'spa'

/** A build as the measure sees it: the nature's effect on the stat, its points, its HP points (bulk; 0 for power), and
 * the share of the Pokémon's sets running it. */
export interface TierBuild {
  effect: NatureEffect
  points: number
  hp: number
  share: number
}
export const buildKey = (b: Pick<TierBuild, 'effect' | 'points' | 'hp'>) => `${b.effect}:${b.hp}:${b.points}`

/** A Pokémon's builds in the meta, from its spreads, the most common first; their shares summing to 1. */
export function tierBuilds(d: PokemonMeta | undefined, measure: Measure, side: Side): TierBuild[] {
  const i = statIndex(measure, side)
  const stat = STATS[i]!
  const spreads = d?.spreads ?? []
  const total = spreads.reduce((a, s) => a + (s.share ?? 0), 0) || 1
  const byKey = new Map<string, TierBuild>()
  for (const s of spreads) {
    const effect = s.nature ? natureEffectOn(s.nature, stat) : 'neutral'
    const b = { effect, points: s.points[i]!, hp: measure === 'bulk' ? s.points[0]! : 0, share: 0 }
    const k = buildKey(b)
    const at = byKey.get(k) ?? b
    at.share += (s.share ?? 0) / total
    byKey.set(k, at)
  }
  return [...byKey.values()].sort((a, b) => b.share - a.share)
}

/** A build's value: bulk, HP times the defending stat; power, the attacking stat, times `factor` (its move's power). */
export function tierValue(
  id: PokemonId,
  b: Pick<TierBuild, 'effect' | 'points' | 'hp'>,
  measure: Measure,
  side: Side,
  factor = 1,
) {
  const base = POKEMON[id].stats
  const stat = statValue(base[statIndex(measure, side)]!, b.points, b.effect)
  return measure === 'bulk' ? statValue(base[0]!, b.hp, 'neutral', true) * stat : stat * factor
}

/** A value as the ladder writes it: bulk in thousands, one decimal; power with moves in hundreds; a stat as is. */
export function tierLabel(v: number, measure: Measure, by: PowerBy): string {
  if (measure === 'bulk') return (v / 1000).toFixed(1)
  return String(Math.round(by === 'moves' ? v / 100 : v))
}
/** The value as the ladder groups it: what its label says. */
export const tierRound = (v: number, measure: Measure, by: PowerBy) => Number(tierLabel(v, measure, by))

/** What a Pokémon could reach on the measure: no points (no HP points) and a nature against it, to every point and a
 * nature for it. */
export function tierReach(id: PokemonId, measure: Measure, side: Side, factor = 1) {
  const hp = measure === 'bulk' ? MAX_POINTS : 0
  return {
    min: tierValue(id, { effect: 'down', points: 0, hp: 0 }, measure, side, factor),
    max: tierValue(id, { effect: 'up', points: MAX_POINTS, hp }, measure, side, factor),
  }
}
/** The four benchmarks of that span, a Pokémon with no sets' marks: lowest, no points neutral, every point neutral,
 * highest. */
export function tierBench(id: PokemonId, measure: Measure, side: Side, factor = 1): number[] {
  const all = measure === 'bulk' ? MAX_POINTS : 0
  return [
    tierValue(id, { effect: 'down', points: 0, hp: 0 }, measure, side, factor),
    tierValue(id, { effect: 'neutral', points: 0, hp: 0 }, measure, side, factor),
    tierValue(id, { effect: 'neutral', points: MAX_POINTS, hp: all }, measure, side, factor),
    tierValue(id, { effect: 'up', points: MAX_POINTS, hp: all }, measure, side, factor),
  ]
}

/** A Pokémon's power factor and whether it counts on the power side: its sets attack there (a move's worth at least);
 * with moves, by its best common move's power there (none, not on the side). Bulk: every Pokémon, by 1. */
export function sideFactor(
  id: PokemonId,
  d: PokemonMeta | undefined,
  measure: Measure,
  side: Side,
  by: PowerBy,
): number | null {
  if (measure === 'bulk') return 1
  if (!d) return by === 'moves' ? null : 1
  const { attacks, power } = attackOf(id, d, side)
  if (attacks < 1) return null
  return by === 'moves' ? power : 1
}

/** The move power with moves is measured by: its best common move on the side as it typically hits, and that power
 * (`sideFactor`'s). Null for bulk, by the stat alone, or with none. */
export function sideMove(
  id: PokemonId,
  d: PokemonMeta | undefined,
  measure: Measure,
  side: Side,
  by: PowerBy,
): { id: MoveId; power: number } | null {
  if (measure === 'bulk' || by !== 'moves' || !d) return null
  const { move, power } = attackOf(id, d, side)
  return move && power ? { id: move, power } : null
}

/** An item or ability that multiplies the measure outright, as the boost of a row of its own: what it is, its
 * multiplier, and the share of the Pokémon's sets running it (none for what it could have). */
export interface TierBoost {
  kind: 'item' | 'ability'
  id: ItemId | AbilityId
  factor: number
  share?: number
}

/** The boosts a Pokémon's sets run, on at least `min` of them: the items that multiply the stat outright. (The
 * abilities that do are always on, so they're its stat itself: `abilityOf`.) */
export function boostsOf(d: PokemonMeta | undefined, measure: Measure, side: Side, min: number): TierBoost[] {
  const key = modKey(measure, side)
  const out: TierBoost[] = []
  for (const x of d?.items ?? []) {
    const f = ITEM_MODS[x.id]?.[key]
    if (f && (x.share ?? 0) >= min && available(itemRef(x.id)))
      out.push({ kind: 'item', id: x.id, factor: f, share: x.share })
  }
  return out
}

/** The ability that multiplies a Pokémon's stat outright, always on (Huge Power, Fur Coat), as its stat counts it:
 * the one its sets run most, where that's one (with no sets, its only ability, where it's one); `possible`, the best it
 * can have. Null with none. */
export function abilityOf(
  id: PokemonId,
  d: PokemonMeta | undefined,
  measure: Measure,
  side: Side,
  possible = false,
): { id: AbilityId; factor: number } | null {
  const key = modKey(measure, side)
  const of = (a: AbilityId) => {
    const f = ABILITY_MODS[a]?.[key]
    return f ? { id: a, factor: f } : null
  }
  if (possible)
    return (
      POKEMON[id].abilities
        .map(of)
        .filter((x) => x !== null)
        .sort((a, b) => b.factor - a.factor)[0] ?? null
    )
  const top = [...(d?.abilities ?? [])].sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0]?.id
  if (top) return of(top)
  const own = POKEMON[id].abilities
  return own.length === 1 ? of(own[0]!) : null
}

/** The items that multiply the stat outright in the regulation, as the boosts there could be. */
export const boostItems = (measure: Measure, side: Side): ItemId[] =>
  (Object.entries(ITEM_MODS) as [ItemId, Record<string, number>][]).flatMap(([id, mods]) =>
    mods[modKey(measure, side)] && available(itemRef(id)) ? [id] : [],
  )

/** The multipliers yours can have: the regulation's items any Pokémon can hold (Eviolite only short of its last stage,
 * which the dex doesn't say: offered to all), and its own abilities. */
export function myBoostsOf(id: PokemonId, measure: Measure, side: Side): TierBoost[] {
  const key = modKey(measure, side)
  const items = (Object.entries(ITEM_MODS) as [ItemId, Record<string, number>][]).flatMap(([id, mods]) =>
    mods[key] && available(itemRef(id)) ? [{ kind: 'item' as const, id, factor: mods[key]! }] : [],
  )
  const abilities = POKEMON[id].abilities.flatMap((a) => {
    const f = ABILITY_MODS[a]?.[key]
    return f ? [{ kind: 'ability' as const, id: a, factor: f }] : []
  })
  return [...items, ...abilities]
}

/** How yours does against a row's builds: the share of them (by how common) it's above, level with, and under. */
export function tierOdds(mine: number, marks: readonly { value: number; share: number }[]) {
  const total = marks.reduce((a, m) => a + m.share, 0) || 1
  let above = 0
  let level = 0
  for (const m of marks) {
    if (mine > m.value) above += m.share
    else if (mine === m.value) level += m.share
  }
  return { above: above / total, level: level / total, under: Math.max(0, 1 - (above + level) / total) }
}

/** The meta's Pokémon by usage, those it has. */
export const byUsage = (data: MetaData) =>
  (Object.entries(data) as [PokemonId, PokemonMeta][])
    .filter(([id, d]) => d.usage && POKEMON[id])
    .sort((a, b) => b[1].usage! - a[1].usage!)
