// Speed in Pokémon Champions, as Showdown's Champions mod computes it: at level 50 a stat is its base plus its stat
// points (up to 32) plus 20, times 1.1 or 0.9 for a nature that raises or lowers it, rounded down. Then in battle,
// modifiers multiply it (Tailwind, Choice Scarf, stat stages, paralysis), each rounded down in turn. No imports, so
// that it stays plain logic.

/** Stat points a stat can have at most. */
export const MAX_POINTS = 32

/** The natures that raise Speed, and those that lower it, by Showdown ID. */
const FAST = new Set(['timid', 'hasty', 'jolly', 'naive'])
const SLOW = new Set(['brave', 'relaxed', 'quiet', 'sassy'])

/** A nature's effect on Speed. */
export type NatureEffect = 'up' | 'neutral' | 'down'
export const natureEffect = (nature: string): NatureEffect =>
  FAST.has(nature) ? 'up' : SLOW.has(nature) ? 'down' : 'neutral'
const FACTOR: Record<NatureEffect, number> = { up: 1.1, neutral: 1, down: 0.9 }

/** The Speed stat of a Pokémon with base Speed `base`, `points` stat points in it and a nature of `effect`. */
export const speedStat = (base: number, points: number, effect: NatureEffect) =>
  Math.floor((base + points + 20) * FACTOR[effect])

/** The Speeds that mark a Pokémon's range: fastest (all points, a nature for Speed), all points and a neutral nature,
 * none, and slowest (none, a nature against it, for Trick Room). */
export const BENCHMARKS = ['max', 'maxNeutral', 'none', 'min'] as const
export type Benchmark = (typeof BENCHMARKS)[number]

export function benchmark(base: number, b: Benchmark): number {
  switch (b) {
    case 'max':
      return speedStat(base, MAX_POINTS, 'up')
    case 'maxNeutral':
      return speedStat(base, MAX_POINTS, 'neutral')
    case 'none':
      return speedStat(base, 0, 'neutral')
    case 'min':
      return speedStat(base, 0, 'down')
  }
}

/**
 * When an item's or ability's effect on Speed applies: always, in a weather or terrain (its condition's ID in the dex),
 * once the holder's item is gone (Unburden), or while it has a status condition (Quick Feet).
 */
export type SpeedWhen = 'always' | 'rain' | 'sun' | 'sandstorm' | 'snow' | 'electricterrain' | 'itemLost' | 'status'

/** An item's or ability's effect on Speed: what it multiplies it by, and when. */
export interface SpeedEffect {
  factor: number
  when: SpeedWhen
}

/**
 * The items and abilities that change Speed, by Showdown ID: those the regulation has whose code changes it
 * (`onModifySpe`). Kept by hand, as the multiplier and its condition are in the code; `npm run gen-data` lists any the
 * regulation has that are missing here.
 */
export const SPEED_ITEMS: Record<string, SpeedEffect> = {
  choicescarf: { factor: 1.5, when: 'always' },
  ironball: { factor: 0.5, when: 'always' },
}
export const SPEED_ABILITIES: Record<string, SpeedEffect> = {
  swiftswim: { factor: 2, when: 'rain' },
  chlorophyll: { factor: 2, when: 'sun' },
  sandrush: { factor: 2, when: 'sandstorm' },
  slushrush: { factor: 2, when: 'snow' },
  surgesurfer: { factor: 2, when: 'electricterrain' },
  unburden: { factor: 2, when: 'itemLost' },
  quickfeet: { factor: 1.5, when: 'status' },
}

/** A Speed stat with an item's or ability's effect, rounded down. */
export const withEffect = (speed: number, e: SpeedEffect) => Math.floor(speed * e.factor)

/** What changes Speed in battle. */
export interface SpeedMods {
  tailwind?: boolean
  scarf?: boolean
  /** Stat stage, -6 to +6. */
  stage?: number
  paralysis?: boolean
  /** Swift Swim, Chlorophyll, Sand Rush, Slush Rush and Unburden at work. */
  doubled?: boolean
}

/** A Speed stat with the modifiers applied: the stage first, then each multiplier, rounded down each time. */
export function inBattle(speed: number, mods: SpeedMods): number {
  const stage = mods.stage ?? 0
  let s = Math.floor((speed * Math.max(2, 2 + stage)) / Math.max(2, 2 - stage))
  if (mods.doubled) s *= 2
  if (mods.scarf) s = Math.floor(s * 1.5)
  if (mods.tailwind) s *= 2
  if (mods.paralysis) s = Math.floor(s / 2)
  return s
}
