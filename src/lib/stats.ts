import type { StatId } from '@/data/pokemon'

// Stats as Champions has them in VGC: level 50 (Flat Rules' "Adjust Level = 50"), IVs always 31, and Stat Points
// instead of EVs, up to 32 in a stat. Its formula (Showdown's Champions mod, `statModify`) comes down to base + points
// + 75 for HP and base + points + 20 for the rest, then the nature's 1.1× or 0.9×, rounded down.

export const MAX_SP = 32

export type Nature = 'minus' | 'neutral' | 'plus'

/** A stat at level 50 with `sp` Stat Points and the nature given (which never touches HP). */
export function statAt50(stat: StatId, base: number, sp: number, nature: Nature = 'neutral'): number {
  if (stat === 'hp') return base + sp + 75
  const raw = base + sp + 20
  return nature === 'plus' ? Math.floor((raw * 110) / 100) : nature === 'minus' ? Math.floor((raw * 90) / 100) : raw
}

/** The range a stat can take: the lowest (no points, a hindering nature), with no investment, and the highest. */
export function statRange(stat: StatId, base: number): { min: number; neutral: number; max: number } {
  return {
    min: statAt50(stat, base, 0, 'minus'),
    neutral: statAt50(stat, base, 0),
    max: statAt50(stat, base, MAX_SP, 'plus'),
  }
}

/** Low Kick's and Grass Knot's power against a Pokémon this heavy, in kilograms. */
export function weightPower(kg: number): number {
  return kg >= 200 ? 120 : kg >= 100 ? 100 : kg >= 50 ? 80 : kg >= 25 ? 60 : kg >= 10 ? 40 : 20
}
