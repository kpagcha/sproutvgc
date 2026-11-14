import { natureEffectOn } from '@/data/natures'
import { STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import type { Fighter } from '@/lib/damage'
import type { OpponentUnknowns } from '@/lib/damageReverse'

// The damage solver's sides in words, for its bands and its setup's What you know.

/** A part of a set that can be worked out, by name. */
export const partLabel = (p: keyof OpponentUnknowns) =>
  t(p === 'nature' ? 'builder.nature' : p === 'item' ? 'builder.item' : 'builder.points')

/** Its stat points in Showdown's short way, the stats with some alone, its nature's marks: "2 HP / 32+ Atk / 32 Spe";
 * at every set, said so. */
export function pointsLabel(f: Fighter): string {
  if (f.sets) return t('compare.atSets')
  const m = f.member
  const parts = m.points.flatMap((n, i) => {
    if (!n) return []
    const e = i && m.nature ? natureEffectOn(m.nature, STATS[i]!) : 'neutral'
    return [`${n}${e === 'up' ? '+' : e === 'down' ? '−' : ''} ${t(`stat.${STATS[i]!}`)}`]
  })
  return parts.join(' / ') || t('calc.bands.noPoints')
}
