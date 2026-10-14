// The natures, by Showdown ID ("jolly"): the stat each raises and lowers, and their names in every language. Generated
// by `npm run gen-data` (`natures.json`).

import DATA from '@/data/generated/natures.json'
import type { StatId } from '@/data/pokemon'
import type { NatureEffect } from '@/lib/stats'
import { locale, t } from '@/i18n'

type Nature = { plus?: StatId; minus?: StatId } & Record<string, string>
const NATURES = DATA as unknown as Record<string, Nature>

/** A nature's official name in the reader's language. */
export const natureName = (id: string): string => NATURES[id]?.[locale.value] ?? id

/** What a nature raises and lowers, as short stat names ("+SpA", "−Atk"); nothing for a neutral one. */
export function natureEffects(id: string): { plus: string; minus: string } | null {
  const n = NATURES[id]
  return n?.plus && n.minus ? { plus: `+${t(`stat.${n.plus}`)}`, minus: `−${t(`stat.${n.minus}`)}` } : null
}

/** A nature's effect on one stat: raised, lowered, or neither (HP never). */
export function natureEffectOn(id: string, stat: StatId): NatureEffect {
  const n = NATURES[id]
  return n?.plus === stat && n.minus !== stat ? 'up' : n?.minus === stat && n.plus !== stat ? 'down' : 'neutral'
}
