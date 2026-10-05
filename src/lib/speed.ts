// Speed in Pokémon Champions: the stat as `stats.ts` computes it, a nature raising or lowering it. Then in battle,
// modifiers multiply it (Tailwind, Choice Scarf, stat stages, paralysis), each rounded down in turn. Its only import is
// `stats.ts`, with its extension, so that the generator can read it.

import { MAX_POINTS, statValue, type NatureEffect } from './stats.ts'

/** The natures that raise Speed, and those that lower it, by Showdown ID. */
const FAST = new Set(['timid', 'hasty', 'jolly', 'naive'])
const SLOW = new Set(['brave', 'relaxed', 'quiet', 'sassy'])

/** A nature's effect on Speed. */
export const natureEffect = (nature: string): NatureEffect =>
  FAST.has(nature) ? 'up' : SLOW.has(nature) ? 'down' : 'neutral'

/** The Speed stat of a Pokémon with base Speed `base`, `points` stat points in it and a nature of `effect`. */
export const speedStat = (base: number, points: number, effect: NatureEffect) => statValue(base, points, effect)

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
  /** Iron Ball's halving (it can't be held with a Choice Scarf). */
  ironBall?: boolean
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
  if (mods.ironBall) s = Math.floor(s / 2)
  if (mods.tailwind) s *= 2
  if (mods.paralysis) s = Math.floor(s / 2)
  return s
}

/** Every nature effect, fastest first. */
export const NATURE_EFFECTS = ['up', 'neutral', 'down'] as const satisfies readonly NatureEffect[]

/** The natures with an effect on Speed, by Showdown ID: the others leave it alone. */
export const NATURES_BY_EFFECT = { up: [...FAST], down: [...SLOW] }

/**
 * What it takes to move before a Pokémon at Speed `target`, for a Pokémon of base Speed `base` with a nature of
 * `effect` and `mods`: the stat points that do it, as the least of them (`from`: points from there up move first),
 * or under Trick Room, where the slower moves first, the most (`upTo`); or, when none do, the points that tie it, if
 * any (who moves first is then random).
 */
export function pointsToMoveFirst(
  base: number,
  effect: NatureEffect,
  mods: SpeedMods,
  target: number,
  trickRoom: boolean,
): { from: number } | { upTo: number } | { ties: number } | null {
  const at = (p: number) => inBattle(speedStat(base, p, effect), mods)
  const points = [...Array(MAX_POINTS + 1).keys()]
  if (!trickRoom) {
    const from = points.find((p) => at(p) > target)
    if (from !== undefined) return { from }
  } else {
    const upTo = points.filter((p) => at(p) < target).pop()
    if (upTo !== undefined) return { upTo }
  }
  const ties = points.find((p) => at(p) === target)
  return ties === undefined ? null : { ties }
}
