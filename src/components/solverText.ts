import { natureEffectOn } from '@/data/natures'
import type { NatureEffect } from '@/lib/stats'
import { STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import type { Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'

// The damage solver's sides in words, for its bands.

/** A part of a set that can be worked out, by name. */
export const partLabel = (p: keyof OpponentUnknowns) =>
  t(p === 'nature' ? 'builder.nature' : p === 'item' ? 'builder.item' : 'builder.points')

/** A stat's points in a spread, with what its nature does to it: drawn by `SpreadText`, the nature's effect a double
 * chevron after the points ("32⏶⏶ Atk"), up or down. */
export interface SpreadPart {
  n: number
  stat: number
  effect: NatureEffect
}
/** A spread's parts in the stats given, in their order (HP never marked). */
export const spreadParts = (nature: string | null, points: readonly number[], stats: readonly number[]): SpreadPart[] =>
  stats.map((s) => ({
    n: points[s] ?? 0,
    stat: s,
    effect: s && nature ? natureEffectOn(nature, STATS[s]!) : 'neutral',
  }))
/** Its stat points as the bands show them, the stats with some alone; none, null. */
export function pointsParts(f: Fighter): SpreadPart[] | null {
  const m = f.member
  const parts = spreadParts(
    m.nature,
    m.points,
    m.points.flatMap((n, i) => (n ? [i] : [])),
  )
  return parts.length ? parts : null
}
/** The same in words, for a label read out: "2 HP / 32 Atk, nature raising it / 32 Spe"; at every set, said so. */
export function pointsLabel(f: Fighter): string {
  if (f.sets) return t('compare.atSets')
  const parts = pointsParts(f)
  return parts ? parts.map(partWords).join(' / ') : t('calc.bands.noPoints')
}
export const partWords = (p: SpreadPart) =>
  `${p.n} ${t(`stat.${STATS[p.stat]!}`)}${p.effect !== 'neutral' ? `, ${t(`calc.reverse.nature.${p.effect}`)}` : ''}`
