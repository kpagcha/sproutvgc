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

/** An item's or ability's effect on Speed: what it multiplies it by, when, and the modifier that applies it. */
export interface SpeedEffect {
  factor: number
  when: SpeedWhen
  mod: 'scarf' | 'ironBall' | 'doubled' | 'quickFeet'
}

/**
 * The items and abilities that change Speed, by Showdown ID: those the regulation has whose code changes it
 * (`onModifySpe`). Kept by hand, as the multiplier and its condition are in the code; `npm run gen-data` lists any the
 * regulation has that are missing here.
 */
export const SPEED_ITEMS: Record<string, SpeedEffect> = {
  choicescarf: { factor: 1.5, when: 'always', mod: 'scarf' },
  ironball: { factor: 0.5, when: 'always', mod: 'ironBall' },
}
export const SPEED_ABILITIES: Record<string, SpeedEffect> = {
  swiftswim: { factor: 2, when: 'rain', mod: 'doubled' },
  chlorophyll: { factor: 2, when: 'sun', mod: 'doubled' },
  sandrush: { factor: 2, when: 'sandstorm', mod: 'doubled' },
  slushrush: { factor: 2, when: 'snow', mod: 'doubled' },
  surgesurfer: { factor: 2, when: 'electricterrain', mod: 'doubled' },
  unburden: { factor: 2, when: 'itemLost', mod: 'doubled' },
  quickfeet: { factor: 1.5, when: 'status', mod: 'quickFeet' },
}

/** What changes Speed in battle. */
export interface SpeedMods {
  tailwind?: boolean
  scarf?: boolean
  /** Iron Ball's halving (it can't be held with a Choice Scarf). */
  ironBall?: boolean
  /** Stat stage, -6 to +6. */
  stage?: number
  paralysis?: boolean
  /** Swift Swim, Chlorophyll, Sand Rush, Slush Rush, Surge Surfer and Unburden at work. */
  doubled?: boolean
  /** Quick Feet at work: it raises Speed by half, and paralysis then doesn't halve it. */
  quickFeet?: boolean
}

/** A Speed stat with the modifiers applied: the stage first, then each multiplier, rounded down each time. */
export function inBattle(speed: number, mods: SpeedMods): number {
  const stage = mods.stage ?? 0
  let s = Math.floor((speed * Math.max(2, 2 + stage)) / Math.max(2, 2 - stage))
  if (mods.doubled) s *= 2
  if (mods.quickFeet) s = Math.floor(s * 1.5)
  if (mods.scarf) s = Math.floor(s * 1.5)
  if (mods.ironBall) s = Math.floor(s / 2)
  if (mods.tailwind) s *= 2
  if (mods.paralysis && !mods.quickFeet) s = Math.floor(s / 2)
  return s
}

/**
 * The modifiers with an item's or ability's effect on Speed among them, counted once if they have it already; or null
 * when the two can't be together: a Choice Scarf and an Iron Ball both held, or Unburden at work while holding either.
 */
export function withEffect(mods: SpeedMods, e: SpeedEffect): SpeedMods | null {
  const held = mods.scarf || mods.ironBall
  if (e.when === 'itemLost' && held) return null
  if ((e.mod === 'scarf' && mods.ironBall) || (e.mod === 'ironBall' && mods.scarf)) return null
  return { ...mods, [e.mod]: true }
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
