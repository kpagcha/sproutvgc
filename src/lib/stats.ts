// A Pokémon's stats in Pokémon Champions, as Showdown's Champions mod computes them: HP is its base plus its stat points
// (up to 32) plus 75; any other stat is its base plus its stat points plus 20, times 1.1 or 0.9 for a nature that raises
// or lowers it, rounded down. No imports, so that the generator can read it too (through `speed.ts`).

/** Stat points a stat can have at most. */
export const MAX_POINTS = 32
/** Stat points a Pokémon has to spread across its stats (Showdown's Champions mod: its `evLimit`). */
export const TOTAL_POINTS = 66

/** A nature's effect on a stat. */
export type NatureEffect = 'up' | 'neutral' | 'down'
const FACTOR: Record<NatureEffect, number> = { up: 1.1, neutral: 1, down: 0.9 }

/** A stat with base `base`, `points` stat points in it and a nature of `effect`, which HP ignores. */
export const statValue = (base: number, points: number, effect: NatureEffect, hp = false) =>
  hp ? base + points + 75 : Math.floor((base + points + 20) * FACTOR[effect])

/** What each of a stat's points adds to it, the first to the `MAX_POINTS`th: 1 each, but for a nature's rounding. A
 * nature that raises it makes every tenth point add 2 (where base + points + 20 reaches a multiple of 10, ×1.1 carries
 * over a whole one), and one that lowers it makes every tenth add nothing (×0.9 falls a whole one short). */
export const pointGains = (base: number, effect: NatureEffect, hp = false): number[] =>
  Array.from({ length: MAX_POINTS }, (_, i) => statValue(base, i + 1, effect, hp) - statValue(base, i, effect, hp))

/** The values that mark a stat's range: lowest (no points, a nature against it), no points and a neutral nature, all
 * points and a neutral nature, and highest (all points, a nature for it). HP, which natures don't change, has only the
 * middle two. */
export const BENCHMARKS = ['max', 'maxNeutral', 'none', 'min'] as const
export type Benchmark = (typeof BENCHMARKS)[number]

export function benchmark(base: number, b: Benchmark, hp = false): number {
  switch (b) {
    case 'max':
      return statValue(base, MAX_POINTS, 'up', hp)
    case 'maxNeutral':
      return statValue(base, MAX_POINTS, 'neutral', hp)
    case 'none':
      return statValue(base, 0, 'neutral', hp)
    case 'min':
      return statValue(base, 0, 'down', hp)
  }
}
