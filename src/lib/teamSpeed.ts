// How a team in the builder stands on Speed against the meta, for its Speed panel's chart: the meta's Speeds as a lane
// (every Pokémon at every Speed build its sets run, weighted by its usage times the build's share, and by its Choice
// Scarf's and Iron Ball's shares) and the team's Pokémon placed by theirs, at their nature and stat points with the
// Speed items they hold; on their side, Tailwind or Trick Room when picked. And what controls Speed on the team.

import type { ItemId, MoveId, PokemonId } from '@/data/dex'
import type { MetaData, PokemonMeta } from '@/data/meta'
import { POKEMON } from '@/data/pokemon'
import { inBattle, natureEffect, speedBuilds, speedStat, type SpeedBuildShare } from '@/lib/speed'
import { buildSpeed, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import type { Battler } from '@/lib/team'
import type { MetaLane, Plotted } from '@/lib/teamBalance'

/** The Speed builds a meta Pokémon's sets run: its Speeds, else its spreads' Speed, else none at no points. */
function buildsOf(d: PokemonMeta): SpeedBuildShare[] {
  if (d.speeds?.length) return speedBuilds(d.speeds)
  if (d.spreads?.length)
    return speedBuilds(d.spreads.map((s) => ({ points: s.points[5] ?? 0, nature: s.nature, share: s.share ?? 1 })))
  return [{ effect: 'neutral', points: 0, share: 1 }]
}
const shareOf = (d: PokemonMeta, id: ItemId) => d.items?.find((x) => x.id === id)?.share ?? 0

/** The meta's Speeds, `[speed, weight]`, for its lane (`laneOf`). */
export function metaSpeedPoints(data: MetaData): [number, number][] {
  const points: [number, number][] = []
  for (const [id, d] of Object.entries(data) as [PokemonId, PokemonMeta][]) {
    const usage = d.usage
    if (!usage || !POKEMON[id]) continue
    const base = POKEMON[id].stats[5]
    const builds = buildsOf(d)
    const total = builds.reduce((a, b) => a + b.share, 0) || 1
    const scarf = shareOf(d, 'choicescarf')
    const ball = shareOf(d, 'ironball')
    const items = [
      [{}, Math.max(0, 1 - scarf - ball)],
      [{ scarf: true }, scarf],
      [{ ironBall: true }, ball],
    ] as const
    for (const b of builds) {
      const stat = speedStat(base, b.points, b.effect)
      for (const [mods, w] of items) if (w) points.push([inBattle(stat, mods), (usage * b.share * w) / total])
    }
  }
  return points
}

/** How the team's side is read: as it is, in Tailwind (its Speed doubled), or under Trick Room (the slower first). */
export type SpeedMode = 'none' | 'tailwind' | 'trickroom'

/** One of the team's Pokémon on Speed: the Pokémon it battles as, its build as the speed pages take it, its Speed. */
export interface SpeedEntry extends Plotted {
  build: SpeedBuild
}

/** A slot's Speed build: its nature's effect, its points, the Speed items it holds, Tailwind when its side has it. */
export function speedBuildOf(m: Battler, tailwind: boolean): SpeedBuild {
  const toggles: BuildToggle[] = []
  if (m.item === 'choicescarf') toggles.push('scarf')
  if (m.item === 'ironball') toggles.push('ironball')
  if (tailwind) toggles.push('tailwind')
  return { effect: natureEffect(m.nature ?? ''), points: m.points[5] ?? 0, toggles, stage: 0 }
}

/** What controls Speed, by what it does: speeds the team up, slows the foes down, or turns the order around. */
export type ControlKind = 'ours' | 'theirs' | 'room'
export interface SpeedControl {
  move: MoveId
  kind: ControlKind
  pokemon: PokemonId[]
}
const CONTROL: Partial<Record<MoveId, ControlKind>> = {
  tailwind: 'ours',
  afteryou: 'ours',
  agility: 'ours',
  rockpolish: 'ours',
  autotomize: 'ours',
  dragondance: 'ours',
  quiverdance: 'ours',
  shiftgear: 'ours',
  flamecharge: 'ours',
  trailblaze: 'ours',
  aquastep: 'ours',
  esperwing: 'ours',
  icywind: 'theirs',
  electroweb: 'theirs',
  thunderwave: 'theirs',
  glare: 'theirs',
  nuzzle: 'theirs',
  stunspore: 'theirs',
  bulldoze: 'theirs',
  rocktomb: 'theirs',
  lowsweep: 'theirs',
  mudshot: 'theirs',
  scaryface: 'theirs',
  cottonspore: 'theirs',
  stringshot: 'theirs',
  quash: 'theirs',
  trickroom: 'room',
}

export interface TeamSpeed {
  /** Its Pokémon in the order they move: the fastest first, the slowest under Trick Room. */
  entries: SpeedEntry[]
  mean: number | null
  /** The mean of their ranks: the share of the meta each moves first against (null with no meta). */
  rank: number | null
  control: SpeedControl[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function teamSpeed(members: readonly Battler[], meta: MetaLane | null, mode: SpeedMode): TeamSpeed {
  const entries: SpeedEntry[] = []
  const control = new Map<MoveId, SpeedControl>()
  for (const m of members) {
    const id = m.as
    if (!id) continue
    const build = speedBuildOf(m, mode === 'tailwind')
    const value = buildSpeed(id, build)
    const r = meta?.dist.rank(value) ?? null
    entries.push({ pokemon: id, value, build, rank: r === null ? null : mode === 'trickroom' ? 1 - r : r })
    for (const mv of m.moves) {
      const kind = mv && CONTROL[mv]
      if (!kind) continue
      const c = control.get(mv) ?? { move: mv, kind, pokemon: [] }
      if (!c.pokemon.includes(id)) c.pokemon.push(id)
      control.set(mv, c)
    }
  }
  entries.sort((a, b) => (mode === 'trickroom' ? a.value - b.value : b.value - a.value))
  return {
    entries,
    mean: avg(entries.map((e) => e.value)),
    rank: avg(entries.map((e) => e.rank).filter((r): r is number => r !== null)),
    control: [...control.values()],
  }
}
