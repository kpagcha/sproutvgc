// Speed in Pokémon Champions: the stat as `stats.ts` computes it, a nature raising or lowering it. Then in battle,
// modifiers multiply it (Tailwind, Choice Scarf, stat stages, paralysis), rounded as Showdown does (`inBattle`). Its only import is
// `stats.ts`, with its extension, so that the generator can read it.

import { MAX_POINTS, statValue, type NatureEffect } from './stats.ts'

/** The natures that raise Speed, and those that lower it, by Showdown ID. */
const FAST = new Set(['timid', 'hasty', 'jolly', 'naive'])
const SLOW = new Set(['brave', 'relaxed', 'quiet', 'sassy'])

/** A nature's effect on Speed. */
export const natureEffect = (nature: string): NatureEffect =>
  FAST.has(nature) ? 'up' : SLOW.has(nature) ? 'down' : 'neutral'

/** A Speed build as Speed sees it: a nature's effect and stat points, with the share of a Pokémon's sets running it. */
export interface SpeedBuildShare {
  effect: NatureEffect
  points: number
  share: number
}

/**
 * A Pokémon's Speed investments in the meta (each an exact nature and points) merged by what Speed cares about, the
 * nature's effect and the points, their shares added up; the most common first.
 */
export function speedBuilds(speeds: readonly { points: number; nature: string; share: number }[]): SpeedBuildShare[] {
  const byBuild = new Map<string, SpeedBuildShare>()
  for (const sp of speeds) {
    const effect = natureEffect(sp.nature)
    const key = `${effect}:${sp.points}`
    const b = byBuild.get(key) ?? { effect, points: sp.points, share: 0 }
    b.share += sp.share
    byBuild.set(key, b)
  }
  return [...byBuild.values()].sort((x, y) => y.share - x.share)
}

/** The builds to offer in a tap: those on at least 3% of the sets, the 4 most common. */
export const commonBuilds = (builds: readonly SpeedBuildShare[]) => builds.filter((b) => b.share >= 0.03).slice(0, 4)

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

/**
 * A Speed stat with the modifiers applied, as Showdown computes it: the stat stage first, rounded down; then every
 * multiplier (abilities, items, Tailwind) chained into one, in 4096ths, and applied once, rounding to the nearest and
 * halves down; then paralysis halving it, rounded down, unless Quick Feet is at work.
 */
export function inBattle(speed: number, mods: SpeedMods): number {
  const stage = mods.stage ?? 0
  const s = Math.floor((speed * Math.max(2, 2 + stage)) / Math.max(2, 2 - stage))
  const factors = [
    mods.doubled && 2,
    mods.quickFeet && 1.5,
    mods.scarf && 1.5,
    mods.ironBall && 0.5,
    mods.tailwind && 2,
  ].filter((f): f is number => !!f)
  // Showdown's `chainModify` and `modify`.
  let modifier = 4096
  for (const f of factors) modifier = (modifier * Math.trunc(f * 4096) + 2048) >> 12
  const v = Math.trunc((Math.trunc(s * modifier) + 2047) / 4096)
  return mods.paralysis && !mods.quickFeet ? Math.floor((v * 50) / 100) : v
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
