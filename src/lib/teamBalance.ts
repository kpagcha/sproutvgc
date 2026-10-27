// How a team in the builder stands on each side, physical and special, against the meta, for its Defense and Offense
// panels' charts: a lane per side, the meta's spread of values on it (its shape, quartiles and median) and the team's
// Pokémon placed by theirs. Offense: its attackers by their attacking stat on each side they attack on, against the
// meta's attackers on it, and who only supports; defense: every Pokémon by its bulk on each side (HP times Defense,
// HP times Sp. Def: what damage taken is divided by), against the meta's Pokémon, beside the meta's own split between
// physical and special attacks. A verdict each, in a line; and on each side the moves and abilities that help it. A stat counts what multiplies it outright (Huge Power, a Choice
// Band, Eviolite), not what multiplies damage (Life Orb, Technician: the damage calculator's).
//
// The meta's side (`loadMetaBalance`) is worked out once per dataset, when the browser is idle, and kept: every Pokémon
// at every spread its sets run, weighted by its usage times the spread's share, and by its stat-multiplying abilities
// and items' shares. The team's side is six slots, cheap enough to work out as it's edited.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import type { MetaData, PokemonMeta, Share } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { natureEffectOn } from '@/data/natures'
import { POKEMON, STATS } from '@/data/pokemon'
import { statValue } from '@/lib/stats'
import { distribution, type Distribution } from '@/lib/statPercentiles'
import type { Battler } from '@/lib/team'
import { bestMove, fieldOf, type User } from '@/lib/movePower'
import { abilityOf, FIXED } from '@/lib/teamCoverage'

export type Side = 'physical' | 'special'

/** What a Pokémon's strength on each side comes down to: its attacking stats, and its bulk on each side. */
interface Strength {
  atk: number
  spa: number
  physBulk: number
  specBulk: number
}
type Key = keyof Strength
type MetaKey = Key | 'atkMoves' | 'spaMoves'
/** A move common enough on a meta Pokémon's sets to count toward its best: on a fifth of them. */
const COMMON = 0.2
const KEYS: readonly Key[] = ['atk', 'spa', 'physBulk', 'specBulk']

// What multiplies a stat outright, kept by hand.
type Mods = Partial<Record<Key, number>>
const ABILITY_MODS: Partial<Record<AbilityId, Mods>> = {
  hugepower: { atk: 2 },
  purepower: { atk: 2 },
  gorillatactics: { atk: 1.5 },
  hustle: { atk: 1.5 },
  furcoat: { physBulk: 2 },
}
const ITEM_MODS: Partial<Record<ItemId, Mods>> = {
  choiceband: { atk: 1.5 },
  choicespecs: { spa: 1.5 },
  assaultvest: { specBulk: 1.5 },
  eviolite: { physBulk: 1.5, specBulk: 1.5 },
}

/** A Pokémon's strength at a spread (stat points in `STATS` order, its nature, none for neutral), before what
 * multiplies it. */
function strengthAt(id: PokemonId, points: readonly number[], nature: string | null): Strength {
  const base = POKEMON[id].stats
  const v = (i: number) => statValue(base[i]!, points[i]!, nature ? natureEffectOn(nature, STATS[i]!) : 'neutral', !i)
  const hp = v(0)
  return { atk: v(1), spa: v(3), physBulk: hp * v(2), specBulk: hp * v(4) }
}

/** A move's side when it deals damage the stats set; none for status moves and fixed damage. */
function sideOf(mv: MoveId): Side | null {
  const c = MOVES[mv]?.category
  return c === 'physical' || c === 'special' ? (FIXED.has(mv) ? null : c) : null
}

// The meta's side.

/** The shape of the meta's values on a lane, for its chart: from `lo` to `hi` (its 1st and 99th percentiles, the rare
 * extremes left out), how much of it is at each of `BINS` steps across (the highest 1, smoothed), and its quartiles. */
export interface Shape {
  lo: number
  hi: number
  bins: number[]
  q1: number
  median: number
  q3: number
}
const BINS = 40

/** A lane's values in the meta: where a value stands among them, and their shape. */
export interface MetaLane {
  dist: Distribution
  shape: Shape | null
}

export interface MetaBalance {
  /** Of the meta's attacks (each Pokémon's moves by their share of its sets, weighted by its usage), the share that's
   * physical; null with no moves. */
  physicalShare: number | null
  /** Attacking with moves (the Offense chart's other mode): each attacking stat times the peak power of the best of
   * its common moves on that side (`movePower.ts`), its own ability and the weather and terrain it sets counted. */
  atkMoves: MetaLane
  spaMoves: MetaLane
  /** Its attacking stats, each Pokémon's weighted by how much it attacks on that side, and its bulk, by usage alone. */
  atk: MetaLane
  spa: MetaLane
  physBulk: MetaLane
  specBulk: MetaLane
}

function laneOf(points: [number, number][]): MetaLane {
  const dist = distribution(points)
  const [lo, hi, q1, median, q3] = [0.01, 0.99, 0.25, 0.5, 0.75].map((q) => dist.quantile(q))
  if (lo == null || hi == null || hi <= lo) return { dist, shape: null }
  const raw = new Array<number>(BINS).fill(0)
  for (const [v, w] of points)
    if (v >= lo && v <= hi) raw[Math.min(BINS - 1, Math.floor(((v - lo) / (hi - lo)) * BINS))]! += w
  // Smoothed (a Gaussian, two steps across), so the spreads' discrete values read as one shape.
  const kernel = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((d) => [d, Math.exp(-(d * d) / 8)] as const)
  const bins = raw.map((_, i) => kernel.reduce((a, [d, k]) => a + (raw[i + d] ?? 0) * k, 0))
  const top = Math.max(...bins) || 1
  return { dist, shape: { lo, hi, bins: bins.map((b) => b / top), q1: q1!, median: median!, q3: q3! } }
}

/** A stat's multipliers on a Pokémon's sets, with their shares (the rest at 1): its abilities' times its items'. */
function factors(key: Key, abilities?: Share<AbilityId>[], items?: Share<ItemId>[]): [number, number][] {
  const split = <T extends string>(list: Share<T>[] | undefined, mods: Partial<Record<T, Mods>>) => {
    const on = new Map<number, number>()
    let rest = 1
    for (const x of list ?? []) {
      const f = mods[x.id]?.[key]
      if (f && x.share) {
        on.set(f, (on.get(f) ?? 0) + x.share)
        rest -= x.share
      }
    }
    return [[1, Math.max(0, rest)] as [number, number], ...on]
  }
  const fromItems = split(items, ITEM_MODS)
  return split(abilities, ABILITY_MODS).flatMap(([fa, wa]) =>
    fromItems.map(([fi, wi]): [number, number] => [fa * fi, wa * wi]),
  )
}

/** The most common of a meta Pokémon's list (its abilities, its items). */
const topOf = <T extends string>(list: Share<T>[] | undefined): T | null =>
  [...(list ?? [])].sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0]?.id ?? null

/** What the meta's side needs of each of its Pokémon: how much it attacks on each side (its moves' shares of its sets,
 * by side: four a set, so up to 4 in all), and its best common move on each at its peak, with its most common ability,
 * on the field it sets itself. */
function metaMon(id: PokemonId, d: PokemonMeta) {
  const attacks: Record<Side, number> = { physical: 0, special: 0 }
  for (const mv of d.moves ?? []) {
    const side = sideOf(mv.id)
    if (side) attacks[side] += mv.share ?? 0
  }
  const ability = topOf(d.abilities)
  const common = (d.moves ?? []).filter((mv) => (mv.share ?? 0) >= COMMON).map((mv) => mv.id)
  const user: User = { types: POKEMON[id].types, ability }
  const field = fieldOf([...(ability ? [ability] : []), ...common])
  return {
    attacks,
    ability,
    best: { physical: bestMove(common, 'physical', user, field), special: bestMove(common, 'special', user, field) },
  }
}

function metaBalance(data: MetaData): MetaBalance {
  const points: Record<MetaKey, [number, number][]> = {
    atk: [],
    spa: [],
    physBulk: [],
    specBulk: [],
    atkMoves: [],
    spaMoves: [],
  }
  let physical = 0
  let special = 0
  for (const [id, d] of Object.entries(data) as [PokemonId, PokemonMeta][]) {
    const usage = d.usage
    if (!usage || !POKEMON[id]) continue
    const mon = metaMon(id, d)
    const { attacks } = mon
    physical += usage * attacks.physical
    special += usage * attacks.special
    const weight: Record<Key, number> = {
      atk: usage * attacks.physical,
      spa: usage * attacks.special,
      physBulk: usage,
      specBulk: usage,
    }
    // Every spread its sets run by its share (those without a share counting as one), none at no points.
    const spreads = d.spreads?.length ? d.spreads : [{ nature: '', points: [0, 0, 0, 0, 0, 0], share: 1 }]
    const total = spreads.reduce((a, s) => a + (s.share ?? 1), 0)
    const mods = KEYS.map((k) => factors(k, d.abilities, d.items))
    const best = { atk: mon.best.physical?.power ?? 0, spa: mon.best.special?.power ?? 0 }
    for (const s of spreads) {
      const at = strengthAt(id, s.points, s.nature || null)
      const w = (s.share ?? 1) / total
      KEYS.forEach((k, i) => {
        if (weight[k]) for (const [f, fw] of mods[i]!) points[k].push([at[k] * f, weight[k] * w * fw])
      })
      for (const k of ['atk', 'spa'] as const)
        if (weight[k] && best[k])
          for (const [f, fw] of mods[KEYS.indexOf(k)]!)
            points[`${k}Moves`].push([at[k] * f * best[k], weight[k] * w * fw])
    }
  }
  return {
    physicalShare: physical + special ? physical / (physical + special) : null,
    atk: laneOf(points.atk),
    spa: laneOf(points.spa),
    physBulk: laneOf(points.physBulk),
    specBulk: laneOf(points.specBulk),
    atkMoves: laneOf(points.atkMoves),
    spaMoves: laneOf(points.spaMoves),
  }
}

const balances = new WeakMap<MetaData, Promise<MetaBalance>>()
const whenIdle = (f: () => void) =>
  'requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 1000 }) : setTimeout(f, 1)

/** The meta's side, worked out when the browser is idle, once per dataset. */
export function loadMetaBalance(data: MetaData): Promise<MetaBalance> {
  let p = balances.get(data)
  if (!p) {
    p = new Promise((resolve) => whenIdle(() => resolve(metaBalance(data))))
    balances.set(data, p)
  }
  return p
}

// The team's side.

/** A slot's strength: the Pokémon it battles as (a Mega's stats), its points and nature, its ability and item. */
function strengthOf(m: Battler, id: PokemonId): Strength {
  const at = strengthAt(id, m.points, m.nature)
  const ability = abilityOf(m, id)
  const a = (ability && ABILITY_MODS[ability]) || {}
  const i = (m.item && ITEM_MODS[m.item]) || {}
  return {
    atk: at.atk * (a.atk ?? 1) * (i.atk ?? 1),
    spa: at.spa * (a.spa ?? 1) * (i.spa ?? 1),
    physBulk: at.physBulk * (a.physBulk ?? 1) * (i.physBulk ?? 1),
    specBulk: at.specBulk * (a.specBulk ?? 1) * (i.specBulk ?? 1),
  }
}

/** What a move or an ability does for a side, and who on the team has it. */
export interface Support {
  kind: 'move' | 'ability'
  id: MoveId | AbilityId
  side: Side | 'both'
  pokemon: PokemonId[]
}
interface SupportList {
  moves: Partial<Record<MoveId, Side | 'both'>>
  abilities: Partial<Record<AbilityId, Side | 'both'>>
}

// What raises the team's own attacks, by the side it helps.
const BOOSTS: SupportList = {
  moves: {
    swordsdance: 'physical',
    bulkup: 'physical',
    dragondance: 'physical',
    howl: 'physical',
    coaching: 'physical',
    bellydrum: 'physical',
    shiftgear: 'physical',
    coil: 'physical',
    victorydance: 'physical',
    filletaway: 'both',
    tidyup: 'physical',
    honeclaws: 'physical',
    nastyplot: 'special',
    calmmind: 'special',
    quiverdance: 'special',
    geomancy: 'special',
    tailglow: 'special',
    takeheart: 'special',
    workup: 'both',
    growth: 'both',
    helpinghand: 'both',
  },
  abilities: { powerspot: 'both', battery: 'special' },
}
// What weakens the opponents' attacks, or shields the team from them, by the side it guards.
const GUARDS: SupportList = {
  moves: {
    willowisp: 'physical',
    reflect: 'physical',
    charm: 'physical',
    featherdance: 'physical',
    lunge: 'physical',
    breakingswipe: 'physical',
    tickle: 'physical',
    babydolleyes: 'physical',
    snarl: 'special',
    lightscreen: 'special',
    eerieimpulse: 'special',
    mysticalfire: 'special',
    strugglebug: 'special',
    confide: 'special',
    nobleroar: 'both',
    partingshot: 'both',
    memento: 'both',
    auroraveil: 'both',
  },
  abilities: { intimidate: 'physical', friendguard: 'both' },
}

function supportOf(members: readonly Battler[], list: SupportList): Support[] {
  const found = new Map<string, Support>()
  const add = (kind: Support['kind'], id: MoveId | AbilityId, side: Support['side'] | undefined, p: PokemonId) => {
    if (!side) return
    const key = `${kind}:${id}`
    const s = found.get(key) ?? { kind, id, side, pokemon: [] }
    if (!s.pokemon.includes(p)) s.pokemon.push(p)
    found.set(key, s)
  }
  for (const m of members) {
    const id = m.as
    if (!id) continue
    const ability = abilityOf(m, id)
    if (ability) add('ability', ability, list.abilities[ability], id)
    for (const mv of m.moves) if (mv) add('move', mv, list.moves[mv], id)
  }
  return [...found.values()]
}

export type Role = Side | 'mixed' | 'support'

/** A Pokémon on a lane: its value there, and its percentile among the meta's (null with no meta). */
export interface Plotted {
  pokemon: PokemonId
  value: number
  rank: number | null
  /** An attacker on both sides, on both lanes. */
  mixed?: boolean
  /** Attacking with moves, the move it's measured by. */
  move?: MoveId
}
/** A lane of the team's: its Pokémon on it, their mean value, and their mean percentile (null with none, or no meta). */
export interface Lane {
  side: Side
  points: Plotted[]
  mean: number | null
  rank: number | null
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function lane(side: Side, points: Plotted[]): Lane {
  const ranks = points.map((p) => p.rank).filter((r): r is number => r !== null)
  return { side, points, mean: avg(points.map((p) => p.value)), rank: avg(ranks) }
}

/** The lanes' keys in the meta's balance, each side's: attacking by stats alone or with moves, and defending. */
export const LANE_KEYS = {
  stats: { physical: 'atk', special: 'spa' },
  moves: { physical: 'atkMoves', special: 'spaMoves' },
  defense: { physical: 'physBulk', special: 'specBulk' },
} as const

/** How the Offense chart measures an attacker: its attacking stat alone, or times its best move's peak power. */
export type OffenseMode = 'stats' | 'moves'

export interface Offense {
  /** How many of its Pokémon attack on each side, both, or neither (moves picked, none dealing damage). */
  roles: Record<Role, number>
  lanes: Record<Side, Lane>
  /** Its Pokémon whose moves deal no damage, and those with no moves yet (their role not known), off the lanes. */
  support: PokemonId[]
  unset: PokemonId[]
  boosts: Support[]
}

export function teamOffense(members: readonly Battler[], meta: MetaBalance | null, mode: OffenseMode): Offense {
  // With moves, the weather and terrain the team sets itself, from any of its Pokémon's abilities and moves.
  const field =
    mode === 'moves'
      ? fieldOf(
          members.flatMap((m) => {
            const id = m.as
            const ability = id && abilityOf(m, id)
            return [...(ability ? [ability] : []), ...m.moves.filter((x): x is MoveId => !!x)]
          }),
        )
      : null
  const roles: Record<Role, number> = { physical: 0, special: 0, mixed: 0, support: 0 }
  const support: PokemonId[] = []
  const unset: PokemonId[] = []
  const points: Record<Side, Plotted[]> = { physical: [], special: [] }
  for (const m of members) {
    const id = m.as
    if (!id) continue
    const moves = m.moves.filter((x): x is MoveId => !!x)
    if (!moves.length) {
      unset.push(id)
      continue
    }
    const sides = new Set(moves.map(sideOf).filter((x) => x !== null))
    const role: Role = sides.size === 2 ? 'mixed' : sides.size ? [...sides][0]! : 'support'
    roles[role]++
    if (role === 'support') {
      support.push(id)
      continue
    }
    const s = strengthOf(m, id)
    const user: User = { types: POKEMON[id].types, ability: abilityOf(m, id) }
    for (const side of sides) {
      const stat = s[LANE_KEYS.stats[side]]
      const best = field && bestMove(moves, side, user, field)
      // With moves, only what has a move with power of its own on that side.
      if (field && !best) continue
      const value = best ? stat * best.power : stat
      const rank = meta?.[LANE_KEYS[mode][side]].dist.rank(value) ?? null
      points[side].push({ pokemon: id, value, rank, mixed: sides.size === 2, ...(best && { move: best.move }) })
    }
  }
  return {
    roles,
    lanes: { physical: lane('physical', points.physical), special: lane('special', points.special) },
    support,
    unset,
    boosts: supportOf(members, BOOSTS),
  }
}

export interface Defense {
  lanes: Record<Side, Lane>
  guards: Support[]
}

export function teamDefense(members: readonly Battler[], meta: MetaBalance | null): Defense {
  const points: Record<Side, Plotted[]> = { physical: [], special: [] }
  for (const m of members) {
    const id = m.as
    if (!id) continue
    const s = strengthOf(m, id)
    for (const side of ['physical', 'special'] as const) {
      const key = LANE_KEYS.defense[side]
      points[side].push({ pokemon: id, value: s[key], rank: meta?.[key].dist.rank(s[key]) ?? null })
    }
  }
  return {
    lanes: { physical: lane('physical', points.physical), special: lane('special', points.special) },
    guards: supportOf(members, GUARDS),
  }
}

// The verdicts, a line each: what to take from the chart at a glance.

/** Defending: the weak side when there's clearly one (and how often the meta hits it), else how bulky the team is. */
export type DefenseVerdict = { kind: 'weak'; side: Side; share: number | null } | { kind: 'bulky' | 'frail' | 'even' }

export function defenseVerdict(d: Defense, meta: MetaBalance): DefenseVerdict | null {
  const p = d.lanes.physical.rank
  const s = d.lanes.special.rank
  if (p === null || s === null) return null
  if (Math.abs(p - s) >= 0.15) {
    const side: Side = p < s ? 'physical' : 'special'
    const split = meta.physicalShare
    return { kind: 'weak', side, share: split === null ? null : side === 'physical' ? split : 1 - split }
  }
  const both = (p + s) / 2
  return { kind: both >= 0.6 ? 'bulky' : both <= 0.4 ? 'frail' : 'even' }
}

/** Attacking: which side it leans to, and how hard it hits for the meta (null with no meta). */
export interface OffenseVerdict {
  lean: Side | 'balanced'
  hits: 'harder' | 'softer' | 'even' | null
}

export function offenseVerdict(o: Offense): OffenseVerdict | null {
  const { physical, special, mixed } = o.roles
  const attackers = physical + special + mixed
  if (!attackers) return null
  const share = (physical + mixed / 2) / attackers
  const rank = avg(
    [...o.lanes.physical.points, ...o.lanes.special.points].map((p) => p.rank).filter((r): r is number => r !== null),
  )
  return {
    lean: share >= 2 / 3 ? 'physical' : share <= 1 / 3 ? 'special' : 'balanced',
    hits: rank === null ? null : rank >= 0.6 ? 'harder' : rank <= 0.4 ? 'softer' : 'even',
  }
}

// The meta at a glance (the rankings' overview): its most used Pokémon on the lanes, each at its most common spread,
// with its most common ability and item; attacking, on each side it attacks on (a move's worth of its sets at least).

/** How many of the meta's most used Pokémon the overview places. */
export const OVERVIEW = 12

export function metaOverview(
  data: MetaData,
  meta: MetaBalance,
  mode: 'defense' | OffenseMode,
): Record<Side, Plotted[]> {
  const points: Record<Side, Plotted[]> = { physical: [], special: [] }
  const top = (Object.entries(data) as [PokemonId, PokemonMeta][])
    .filter(([id, d]) => d.usage && POKEMON[id])
    .sort((a, b) => b[1].usage! - a[1].usage!)
    .slice(0, OVERVIEW)
  for (const [id, d] of top) {
    const mon = metaMon(id, d)
    const spread = d.spreads?.[0]
    const at = strengthAt(id, spread?.points ?? [0, 0, 0, 0, 0, 0], spread?.nature || null)
    const a = (mon.ability && ABILITY_MODS[mon.ability]) || {}
    const item = topOf(d.items)
    const i = (item && ITEM_MODS[item]) || {}
    const value = (k: Key) => at[k] * (a[k] ?? 1) * (i[k] ?? 1)
    if (mode === 'defense') {
      for (const side of ['physical', 'special'] as const) {
        const key = LANE_KEYS.defense[side]
        points[side].push({ pokemon: id, value: value(key), rank: meta[key].dist.rank(value(key)) })
      }
      continue
    }
    const sides = (['physical', 'special'] as const).filter((side) => mon.attacks[side] >= 1)
    for (const side of sides) {
      const best = mode === 'moves' ? mon.best[side] : null
      if (mode === 'moves' && !best) continue
      const v = value(LANE_KEYS.stats[side]) * (best?.power ?? 1)
      const rank = meta[LANE_KEYS[mode][side]].dist.rank(v)
      points[side].push({ pokemon: id, value: v, rank, mixed: sides.length === 2, ...(best && { move: best.move }) })
    }
  }
  return points
}
