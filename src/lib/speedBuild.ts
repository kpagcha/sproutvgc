// A Pokémon's Speed build as the speed pages keep it in the URL: its nature's effect, its stat points, and the modifiers
// it has of its own (toggles and a stat stage). The speed tiers keep yours under `my…`; the comparison keeps each side
// under its letter (`a…`, `b…`), so a link from one page to the other carries the builds across.

import { POKEMON } from '@/data/pokemon'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { NATURE_EFFECTS, inBattle, pointsToMoveFirst, speedStat, type SpeedMods } from './speed'
import { MAX_POINTS, type Benchmark, type NatureEffect } from './stats'

/** The modifiers a single Pokémon can have, by their key in the URL. */
export const BUILD_TOGGLES = ['tailwind', 'scarf', 'ironball', 'doubled', 'paralysis'] as const
export type BuildToggle = (typeof BUILD_TOGGLES)[number]

export interface SpeedBuild {
  effect: NatureEffect
  points: number
  toggles: BuildToggle[]
  stage: number
}

/** The fastest build, with nothing on. */
export const FASTEST: SpeedBuild = { effect: 'up', points: MAX_POINTS, toggles: [], stage: 0 }

export const isEffect = (e: unknown): e is NatureEffect => (NATURE_EFFECTS as readonly unknown[]).includes(e)

/** Its toggles as `inBattle` takes them. */
export const modsOf = (b: SpeedBuild): SpeedMods => ({
  tailwind: b.toggles.includes('tailwind'),
  scarf: b.toggles.includes('scarf'),
  ironBall: b.toggles.includes('ironball'),
  doubled: b.toggles.includes('doubled'),
  paralysis: b.toggles.includes('paralysis'),
  stage: b.stage,
})

/** Turns a toggle on or off: a Choice Scarf and an Iron Ball can't be held together. */
export function toggled(list: readonly BuildToggle[], k: BuildToggle): BuildToggle[] {
  if (list.includes(k)) return list.filter((x) => x !== k)
  const clash = k === 'scarf' ? 'ironball' : k === 'ironball' ? 'scarf' : null
  return [...list.filter((x) => x !== clash), k]
}

/** A Pokémon's Speed in battle with a build. */
export const buildSpeed = (id: PokemonId, b: SpeedBuild) =>
  inBattle(speedStat(POKEMON[id].stats[5], b.points, b.effect), modsOf(b))

/** A benchmark's build. */
export const benchBuild = (bench: Benchmark): Pick<SpeedBuild, 'effect' | 'points'> => ({
  effect: bench === 'max' ? 'up' : bench === 'min' ? 'down' : 'neutral',
  points: bench === 'max' || bench === 'maxNeutral' ? MAX_POINTS : 0,
})

/** A build read from the URL under `prefix`: its letter, or `my` on the speed tiers. */
export function readBuild(query: Record<string, unknown>, prefix: string): SpeedBuild {
  const pts = Number(query[`${prefix}pts`])
  const stage = Number(query[`${prefix}stage`])
  const nat = query[`${prefix}nat`]
  return {
    effect: isEffect(nat) ? nat : 'up',
    points: Number.isInteger(pts) && pts >= 0 && pts <= MAX_POINTS ? pts : MAX_POINTS,
    toggles: String(query[`${prefix}mods`] ?? '')
      .split(',')
      .filter((m): m is BuildToggle => (BUILD_TOGGLES as readonly string[]).includes(m)),
    stage: Number.isInteger(stage) && stage >= -6 && stage <= 6 ? stage : 0,
  }
}

/** A build as the URL keeps it under `prefix`, what's at its default left out. */
export const buildQuery = (b: SpeedBuild, prefix: string): Record<string, string | undefined> => ({
  [`${prefix}nat`]: b.effect,
  [`${prefix}pts`]: String(b.points),
  [`${prefix}mods`]: b.toggles.length ? b.toggles.join(',') : undefined,
  [`${prefix}stage`]: b.stage ? String(b.stage) : undefined,
})

/** What it takes to move before a Pokémon at Speed `target`, at each nature effect. */
export const toMoveFirst = (id: PokemonId, b: SpeedBuild, target: number, trickRoom: boolean) =>
  NATURE_EFFECTS.map((effect) => ({
    effect,
    result: pointsToMoveFirst(POKEMON[id].stats[5], effect, modsOf(b), target, trickRoom),
  }))

/** What `pointsToMoveFirst` found, in words. */
export function pointsText(r: ReturnType<typeof pointsToMoveFirst>) {
  if (!r) return t('speed.vsNever')
  if ('from' in r) return r.from === 0 ? t('speed.vsAny') : t('speed.vsFrom', { points: r.from })
  if ('upTo' in r) return r.upTo === MAX_POINTS ? t('speed.vsAny') : t('speed.vsUpTo', { points: r.upTo })
  return t('speed.vsTies', { points: r.ties })
}
