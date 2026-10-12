// A Pokémon's Speed build as the speed pages keep it in the URL: its nature's effect, its stat points, and the modifiers
// it has of its own (toggles and a stat stage). The speed tiers keep yours under `my…`; the comparison keeps each side
// under its letter (`a…`, `b…`), so a link from one page to the other carries the builds across.

import { POKEMON } from '@/data/pokemon'
import { ability, condition, type AbilityId, type PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { NATURE_EFFECTS, SPEED_ABILITIES, inBattle, pointsToMoveFirst, speedStat, type SpeedMods } from './speed'
import { MAX_POINTS, type Benchmark, type NatureEffect } from './stats'

/**
 * The modifiers a single Pokémon can have, by their key in the URL. `doubled` is its ability that doubles Speed at work
 * (Swift Swim, Chlorophyll, Unburden…), `doubled2` its second one, for the one Pokémon with two (Beartic).
 */
export const BUILD_TOGGLES = ['tailwind', 'scarf', 'ironball', 'doubled', 'doubled2', 'paralysis'] as const
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

/** The abilities a Pokémon can have that double its Speed, in slot order: `doubled` and `doubled2` turn them on. */
export const doublers = (id: PokemonId): string[] =>
  (POKEMON[id].abilities as readonly string[]).filter((a) => SPEED_ABILITIES[a]?.factor === 2)
/** The toggle for a Pokémon's doubling ability, by its place among them. */
export const doublerToggle = (i: number): BuildToggle => (i ? 'doubled2' : 'doubled')
/** The doubling ability at work in a build, if any: one the Pokémon can have. */
export function doubling(id: PokemonId, b: SpeedBuild): string | undefined {
  const list = doublers(id)
  return b.toggles.includes('doubled2') ? list[1] : b.toggles.includes('doubled') ? list[0] : undefined
}

/** A doubling ability's toggle in words: its name, and what it needs. */
export function doublerLabel(a: string) {
  const name = refName(ability(a as AbilityId))
  const when = SPEED_ABILITIES[a]!.when
  const need =
    when === 'itemLost' || when === 'status'
      ? t(`speed.when.${when}`)
      : when === 'always'
        ? ''
        : t('speed.when.field', { field: refName(condition(when)) })
  return {
    label: t('speed.mod.ability', { ability: name }),
    tip: t('speed.modTip.ability', { ability: name, when: need }),
  }
}

/** The buttons for a Pokémon's modifiers, in order: its doubling abilities by name, only those it can have (none
 * without a Pokémon). */
export function modButtons(id: PokemonId | null) {
  const MOD_ITEMS: Partial<Record<BuildToggle, 'choicescarf' | 'ironball'>> = {
    scarf: 'choicescarf',
    ironball: 'ironball',
  }
  const list: { key: BuildToggle; label: string; tip: string; item?: 'choicescarf' | 'ironball' }[] = []
  for (const k of BUILD_TOGGLES) {
    if (k === 'doubled' || k === 'doubled2') {
      const a = id ? doublers(id)[k === 'doubled' ? 0 : 1] : undefined
      if (a) list.push({ key: k, ...doublerLabel(a) })
    } else list.push({ key: k, label: t(`speed.mod.${k}`), tip: t(`speed.modTip.${k}`), item: MOD_ITEMS[k] })
  }
  return list
}

/** Its toggles as `inBattle` takes them: a doubling ability only one the Pokémon `id` can have, when given. */
export const modsOf = (b: SpeedBuild, id?: PokemonId): SpeedMods => ({
  tailwind: b.toggles.includes('tailwind'),
  scarf: b.toggles.includes('scarf'),
  ironBall: b.toggles.includes('ironball'),
  doubled: id ? !!doubling(id, b) : b.toggles.includes('doubled') || b.toggles.includes('doubled2'),
  paralysis: b.toggles.includes('paralysis'),
  stage: b.stage,
})

/** Turns a toggle on or off: a Choice Scarf and an Iron Ball can't be held together, nor two abilities had. */
const CLASHES: Partial<Record<BuildToggle, BuildToggle>> = {
  scarf: 'ironball',
  ironball: 'scarf',
  doubled: 'doubled2',
  doubled2: 'doubled',
}
export function toggled(list: readonly BuildToggle[], k: BuildToggle): BuildToggle[] {
  if (list.includes(k)) return list.filter((x) => x !== k)
  const clash = CLASHES[k]
  return [...list.filter((x) => x !== clash), k]
}

/** A Pokémon's Speed in battle with a build. */
export const buildSpeed = (id: PokemonId, b: SpeedBuild) =>
  inBattle(speedStat(POKEMON[id].stats[5], b.points, b.effect), modsOf(b, id))

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
    result: pointsToMoveFirst(POKEMON[id].stats[5], effect, modsOf(b, id), target, trickRoom),
  }))

/** What `pointsToMoveFirst` found, in words. */
export function pointsText(r: ReturnType<typeof pointsToMoveFirst>) {
  if (!r) return t('speed.vsNever')
  if ('from' in r) return r.from === 0 ? t('speed.vsAny') : t('speed.vsFrom', { points: r.from })
  if ('upTo' in r) return r.upTo === MAX_POINTS ? t('speed.vsAny') : t('speed.vsUpTo', { points: r.upTo })
  return t('speed.vsTies', { points: r.ties })
}

type MoveFirst = ReturnType<typeof pointsToMoveFirst>
/** Whether points do it: moving first, not only tying. */
export const works = (r: MoveFirst): r is { from: number } | { upTo: number } => !!r && !('ties' in r)

/**
 * What it takes a Pokémon at build `b` to move before one at Speed `target`, in short. With its nature: the points that
 * do it (with what's left of its own to spare), or how close it gets, its fastest (under Trick Room, its slowest) Speed
 * and how far off it is. When its nature can't, the nature that would (raising Speed; lowering it under Trick Room).
 * When neither can, the modifiers that would, each on its own, with what they'd take: one added (Tailwind, a Choice
 * Scarf, its doubling abilities, the least Speed stage that does it, Trick Room), or one it has taken off; under Trick
 * Room, the ones slowing it, and Trick Room gone.
 */
export function moveFirstPlan(id: PokemonId, b: SpeedBuild, target: number, trickRoom: boolean) {
  const base = POKEMON[id].stats[5]
  const better: NatureEffect = trickRoom ? 'down' : 'up'
  const at = (effect: NatureEffect, mods: SpeedMods, tr = trickRoom) =>
    pointsToMoveFirst(base, effect, mods, target, tr)
  const mods = modsOf(b, id)
  const result = at(b.effect, mods)
  const reach = inBattle(speedStat(base, trickRoom ? 0 : MAX_POINTS, b.effect), mods)
  const current = {
    effect: b.effect,
    result,
    reach,
    /** How far its reach is from moving first: by how much it's too slow (too fast, under Trick Room). */
    off: trickRoom ? reach - target + 1 : target + 1 - reach,
    spare: !trickRoom && result && 'from' in result && b.points > result.from ? b.points - result.from : 0,
  }
  const otherResult = b.effect === better ? null : at(better, mods)
  const other = otherResult && works(otherResult) ? { effect: better, result: otherResult } : null
  if (works(result) || other) return { current, other, mods: null }

  // Each modifier on its own: what it takes with its nature, else with the better one.
  const list: { label: string; effect: NatureEffect; result: NonNullable<MoveFirst> }[] = []
  const tryWith = (label: string, next: SpeedBuild, tr = trickRoom) => {
    const m = modsOf(next, id)
    const fast: NatureEffect = tr ? 'down' : 'up'
    for (const effect of b.effect === fast ? [fast] : [b.effect, fast]) {
      const r = at(effect, m, tr)
      if (works(r)) return void list.push({ label, effect, result: r })
    }
  }
  const adding = (k: BuildToggle) => ({ ...b, toggles: toggled(b.toggles, k) })
  const without = (k: BuildToggle, label: string) =>
    b.toggles.includes(k) && tryWith(t('speed.without', { mod: label }), adding(k))
  if (!trickRoom) {
    for (const k of ['tailwind', 'scarf'] as const) if (!b.toggles.includes(k)) tryWith(t(`speed.mod.${k}`), adding(k))
    doublers(id).forEach((a, i) => {
      const k = doublerToggle(i)
      if (!modsOf(b, id).doubled) tryWith(doublerLabel(a).label, adding(k))
    })
    without('ironball', t('speed.mod.ironball'))
    without('paralysis', t('speed.mod.paralysis'))
  } else {
    for (const k of ['paralysis', 'ironball'] as const)
      if (!b.toggles.includes(k)) tryWith(t(`speed.mod.${k}`), adding(k))
    for (const k of ['tailwind', 'scarf'] as const) without(k, t(`speed.mod.${k}`))
    const doubled = doubling(id, b)
    if (doubled) without(b.toggles.includes('doubled2') ? 'doubled2' : 'doubled', doublerLabel(doubled).label)
  }
  // The least stage that does it, from its own.
  const step = trickRoom ? -1 : 1
  for (let s = b.stage + step; Math.abs(s) <= 6; s += step) {
    const before = list.length
    tryWith(t('speed.stageShort', { stage: s > 0 ? `+${s}` : String(s) }), { ...b, stage: s })
    if (list.length > before) break
  }
  tryWith(trickRoom ? t('speed.without', { mod: t('speed.mod.trickroom') }) : t('speed.mod.trickroom'), b, !trickRoom)
  return { current, other: null, mods: list }
}

/** How an answer of `pointsToMoveFirst` goes: whatever the points, with some, only to a tie, or not at all. */
export function moveFirstKind(r: MoveFirst): 'any' | 'some' | 'tie' | 'never' {
  if (!r) return 'never'
  if ('ties' in r) return 'tie'
  return ('from' in r && r.from === 0) || ('upTo' in r && r.upTo === MAX_POINTS) ? 'any' : 'some'
}
