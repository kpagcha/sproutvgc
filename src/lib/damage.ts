// The damage calculator's logic: Smogon's calc (`@smogon/calc`, its Champions mechanics, generation 0, where stat
// points are what it takes as EVs), fed a side as the team builder's slot has it (`Member`) with what a battle adds to
// it (`Fighter`: whether it Mega Evolves, its HP, status, stat stages, and what its side of the field has), and a field
// (`Battlefield`: weather, terrain, rooms; doubles, always). Each move's result comes back as its damage range, in HP
// and in percent of the defender's, and the calc's verdict on how many hits it takes (`Hit`). The meta's most common
// set of a Pokémon fills a side picked from a list (`commonSet`), and the meta's most used, at theirs, are what a side's
// moves are measured against (`metaFoes`).

import { calculate, Field, Generations, Move, Pokemon } from '@smogon/calc'
// The calc's own final Speed (stages, Tailwind, Choice Scarf, Iron Ball, paralysis, the weather's and terrain's Speed
// abilities, Unburden), which it doesn't export from its root.
import { getFinalSpeed } from '@smogon/calc/dist/mechanics/util'
import {
  ability,
  condition,
  item,
  type AbilityId,
  type ItemId,
  type MoveId,
  type PokemonId,
  type Ref,
} from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { isSpread, MOVES } from '@/data/moves'
import { POKEMON, STATS } from '@/data/pokemon'
import { chart, TYPES, type TypeId } from '@/data/types'
import { commonMember, isMega, mostUsedForme } from '@/lib/commonSet'
import { emptyMember, stoneMega, type Member } from '@/lib/team'

const GEN = Generations.get(0)

export const STATUSES = ['', 'brn', 'par', 'psn', 'tox', 'slp', 'frz'] as const
export type Status = (typeof STATUSES)[number]

/** The stats a stage can raise or lower, in `STATS` order but for HP. */
export const BOOSTED = ['atk', 'def', 'spa', 'spd', 'spe'] as const
export type Boosted = (typeof BOOSTED)[number]
export type Boosts = [number, number, number, number, number]
export const STAGE_MIN = -6
export const STAGE_MAX = 6

/** What a side of the field can have that changes the damage its Pokémon deal or take, or how fast it is, in groups:
 * its screens and Tailwind; its ally's help (Helping Hand, Friend Guard, Steely Spirit; Plus or Minus beside it is
 * `abilityOn` below); the hazards it switched in on (Spikes' layers are `spikes`), counted before a knockout; and
 * what's on the Pokémon itself (Leech Seed and Salt Cure, at the end of each turn; Charge, for its next Electric move). */
export const SIDE_GROUPS = {
  side: ['tailwind', 'reflect', 'lightScreen', 'auroraVeil'],
  ally: ['helpingHand', 'friendGuard', 'steelySpirit'],
  hazards: ['stealthRock'],
  on: ['leechSeed', 'saltCure', 'charge'],
} as const
export type SideGroup = keyof typeof SIDE_GROUPS
export const SIDE_EFFECTS = Object.values(SIDE_GROUPS).flat()
export type SideEffect = (typeof SIDE_GROUPS)[SideGroup][number]
export const MAX_SPIKES = 3

/** One side: its set, and what a battle adds to it. */
export interface Fighter {
  member: Member
  /** It Mega Evolves (when it holds its stone). */
  mega: boolean
  /** Its HP left, in percent. */
  hp: number
  status: Status
  boosts: Boosts
  /** Its ability's condition is met (Flash Fire triggered, Stakeout's target switching in, Intimidate on entry...). */
  abilityOn: boolean
  /** Its allies fainted, for Supreme Overlord and Last Respects. */
  fainted: number
  /** The times it's been hit, for Rage Fist. */
  attacked: number
  side: SideEffect[]
  /** The layers of Spikes it switched in on. */
  spikes: number
}

export const WEATHERS = ['', 'Sun', 'Rain', 'Sand', 'Snow'] as const
export type Weather = (typeof WEATHERS)[number]
export const TERRAINS = ['', 'Electric', 'Grassy', 'Psychic', 'Misty'] as const
export type Terrain = (typeof TERRAINS)[number]
/** What's on the whole field besides the weather and terrain, any of them at once: Gravity and the rooms, Trick Room
 * (the slower moving first, which the calc doesn't know: the order is ours), and an ally's Fairy Aura. */
export const FIELD_EFFECTS = ['gravity', 'magicRoom', 'wonderRoom', 'trickRoom', 'fairyAura'] as const
export type FieldEffect = (typeof FIELD_EFFECTS)[number]

export interface Battlefield {
  weather: Weather
  terrain: Terrain
  effects: FieldEffect[]
}

export const emptyFighter = (member: Member = emptyMember()): Fighter => ({
  member,
  mega: !!stoneMega(member),
  hp: 100,
  status: '',
  boosts: [0, 0, 0, 0, 0],
  abilityOn: false,
  fainted: 0,
  attacked: 0,
  side: [],
  spikes: 0,
})

export const emptyField = (): Battlefield => ({ weather: '', terrain: '', effects: [] })

/** The weather or terrain an ability sets as its Pokémon comes in. */
export const SETS_FIELD: Partial<Record<AbilityId, Partial<Battlefield>>> = {
  drizzle: { weather: 'Rain' },
  drought: { weather: 'Sun' },
  sandstream: { weather: 'Sand' },
  snowwarning: { weather: 'Snow' },
  grassysurge: { terrain: 'Grassy' },
  electricsurge: { terrain: 'Electric' },
  psychicsurge: { terrain: 'Psychic' },
  mistysurge: { terrain: 'Misty' },
}

/** The abilities whose effect waits on something the calc can't see, for which a side says whether it's met. */
export const CONDITIONAL_ABILITIES: readonly AbilityId[] = [
  'flashfire',
  'stakeout',
  'electromorphosis',
  'plus',
  'minus',
  'unburden',
  'analytic',
  'slowstart',
] as AbilityId[]

/** The Pokémon a side battles as: its Mega when it Mega Evolves, else itself. */
export const battlerOf = (f: Fighter): PokemonId | null => (f.mega && stoneMega(f.member)) || f.member.pokemon

/** Its ability as it battles: a Mega's own (the sheet registers the one it changes from). */
export function abilityOf(f: Fighter): AbilityId | null {
  const mega = f.mega ? stoneMega(f.member) : null
  return (mega && POKEMON[mega]?.abilities[0]) || f.member.ability
}

// The calc's names: it reads Showdown's IDs, which ours are, but names entries in its descriptions by what it's given.
// The formes it lacks are cosmetic (their species') or Aegislash's, which battles in its Shield Forme until it attacks.
const SPECIES_AS: Partial<Record<string, string>> = { aegislash: 'aegislashshield' }
function speciesName(id: PokemonId): string {
  const as = SPECIES_AS[id] ?? (GEN.species.get(id as never) ? id : (POKEMON[id].base ?? id))
  return GEN.species.get(as as never)?.name ?? as
}
const named = <T extends { name: string }>(get: (id: never) => T | undefined, id: string) =>
  get(id as never)?.name ?? id

function pokemonOf(f: Fighter): Pokemon | null {
  const id = battlerOf(f)
  if (!id) return null
  const m = f.member
  const p = POKEMON[id]
  const mon = new Pokemon(GEN, speciesName(id), {
    // Our data's types and stats, from the same Champions mod, so the two never disagree.
    overrides: {
      types: p.types.map((t) => (t[0]!.toUpperCase() + t.slice(1)) as never) as never,
      baseStats: Object.fromEntries(STATS.map((s, i) => [s, p.stats[i]!])) as never,
    },
    ability: (() => {
      const a = abilityOf(f)
      return a ? named((x) => GEN.abilities.get(x), a) : undefined
    })(),
    abilityOn: f.abilityOn,
    item: m.item ? named((x) => GEN.items.get(x), m.item) : undefined,
    nature: m.nature ? named((x) => GEN.natures.get(x), m.nature) : undefined,
    evs: Object.fromEntries(STATS.map((s, i) => [s, m.points[i]!])),
    boosts: Object.fromEntries(BOOSTED.map((s, i) => [s, f.boosts[i]!])),
    status: f.status,
    alliesFainted: f.fainted,
  })
  mon.originalCurHP = Math.max(1, Math.round((mon.maxHP() * f.hp) / 100))
  return mon
}

const sideOf = (f: Fighter) => ({
  isReflect: f.side.includes('reflect'),
  isLightScreen: f.side.includes('lightScreen'),
  isAuroraVeil: f.side.includes('auroraVeil'),
  isTailwind: f.side.includes('tailwind'),
  isHelpingHand: f.side.includes('helpingHand'),
  isFriendGuard: f.side.includes('friendGuard'),
  isSteelySpirit: f.side.includes('steelySpirit'),
  isSR: f.side.includes('stealthRock'),
  spikes: f.spikes,
  isSeeded: f.side.includes('leechSeed'),
  isSaltCured: f.side.includes('saltCure'),
  isCharge: f.side.includes('charge'),
})

const calcField = (field: Battlefield, atkSide: ReturnType<typeof sideOf>, defSide: ReturnType<typeof sideOf>) =>
  new Field({
    gameType: 'Doubles',
    weather: field.weather || undefined,
    terrain: field.terrain || undefined,
    isGravity: field.effects.includes('gravity'),
    isMagicRoom: field.effects.includes('magicRoom'),
    isWonderRoom: field.effects.includes('wonderRoom'),
    isFairyAura: field.effects.includes('fairyAura'),
    attackerSide: atkSide,
    defenderSide: defSide,
  })

/** A side's Speed as it battles, as the calc has it: its stat, stage, item, ability, Tailwind and paralysis. */
export function speedOf(f: Fighter, field: Battlefield): number | null {
  const p = pokemonOf(f)
  if (!p) return null
  const side = sideOf(f)
  return getFinalSpeed(GEN, p, calcField(field, side, side), side as never)
}

/** Who of two sides moves first by their Speeds (under Trick Room the slower): `a`, `b`, or a tie. */
export type Lead = 'a' | 'b' | 'tie'
export function leadOf(a: number, b: number, field: Battlefield): Lead {
  if (a === b) return 'tie'
  return a > b !== field.effects.includes('trickRoom') ? 'a' : 'b'
}

/** Whether a side's on the ground, as Showdown's `Pokemon.isGrounded` has it: under Gravity or holding an Iron Ball it is;
 * else not when Flying-type, with Levitate or holding an Air Balloon (items doing nothing in Magic Room). */
function grounded(f: Fighter, field: Battlefield): boolean {
  const item = field.effects.includes('magicRoom') ? null : f.member.item
  if (field.effects.includes('gravity') || item === 'ironball') return true
  const id = battlerOf(f)
  if (id && POKEMON[id]?.types.includes('flying')) return false
  if (abilityOf(f) === 'levitate') return false
  return item !== 'airballoon'
}

/** A move's priority in the battle, as Showdown's `onModifyPriority` handlers change it: Grassy Glide +1 in Grassy
 * Terrain from a grounded user, Gale Wings +1 to Flying moves at full HP, Prankster +1 to status moves, Triage +3 to
 * healing moves. */
export function priorityOf(f: Fighter, move: MoveId, field: Battlefield): number {
  const m = MOVES[move]
  if (!m) return 0
  let p = m.priority
  if (move === 'grassyglide' && field.terrain === 'Grassy' && grounded(f, field)) p += 1
  const ability = abilityOf(f)
  if (ability === 'galewings' && m.type === 'flying' && f.hp === 100) p += 1
  if (ability === 'prankster' && m.category === 'status') p += 1
  if (ability === 'triage' && m.flags.includes('heal')) p += 3
  return p
}

/** Whether a move goes before the other side's move (one at no priority) or after: by its priority, else by Speed. */
export function orderOf(
  attacker: Fighter,
  defender: Fighter,
  move: MoveId,
  field: Battlefield,
): 'first' | 'last' | 'tie' | null {
  const prio = priorityOf(attacker, move, field)
  if (prio) return prio > 0 ? 'first' : 'last'
  const a = speedOf(attacker, field)
  const d = speedOf(defender, field)
  if (a === null || d === null) return null
  const lead = leadOf(a, d, field)
  return lead === 'tie' ? 'tie' : lead === 'a' ? 'first' : 'last'
}

/** The moves whose power hangs on whether the user moves before its target or after (Payback, doubled moving last;
 * Bolt Beak and Fishious Rend, moving first), and Analytic's, moving last: the calc reads the order off the Speeds
 * alone, with no Trick Room nor priority. */
const ORDER_MOVES: readonly MoveId[] = ['payback', 'boltbeak', 'fishiousrend'] as MoveId[]
const ordered = (f: Fighter, move: MoveId) => ORDER_MOVES.includes(move) || abilityOf(f) === 'analytic'

/** How a move does against the other side. */
export interface Hit {
  move: MoveId
  /** Its least and most damage, in HP, and in percent of the defender's whole HP. */
  min: number
  max: number
  minPct: number
  maxPct: number
  /** Every roll, in HP (each hit's added up for a move hitting more than once). */
  rolls: number[]
  /** The defender's HP, whole and left. */
  maxHp: number
  hp: number
  /** The calc's verdict: how many hits it takes and the chance of it ("guaranteed 2HKO"), and the hits as a number. */
  ko: string
  koHits: number
  koChance: number
  /** The calc's one-line account of it, to share ("252+ Atk Incineroar Flare Blitz vs. …"). */
  desc: string
  /** Its recoil or what it drains, if any, as the calc says it. */
  extra: string
  /** It does nothing: a status move, or the defender's immune. */
  none: boolean
  /** Why a damaging move does nothing, when it's known: what blocks it (the terrain, the defender's ability or item),
   * or the defender's type it doesn't affect. */
  blocked: { ref: Ref } | { type: TypeId } | null
  /** For a move whose power hangs on the order (Payback, Analytic), the order it was worked out at; a Speed tie as
   * moving last. */
  order: 'first' | 'last' | null
  /** Its priority in the battle (`priorityOf`): Grassy Glide's in Grassy Terrain, Prankster's and the like. */
  priority: number
  /** How many times it hit, as the calc had it. */
  hits: number
  /** It hits both foes in this battle (`spreadIn`), so it can be told to hit one alone (`single`). */
  spread: boolean
}

export interface HitOptions {
  crit?: boolean
  /** How many times it hits, for a move whose hits vary (Beat Up's, its party members able to fight). */
  hits?: number
  /** A spread move (Earthquake, Heat Wave…) hitting one target alone, the other gone or out of reach: no doubles'
   * spread reduction (×0.75), for this move alone, everything else still a double battle. */
  single?: boolean
  /** A move whose power doubles on something before it (`DOUBLING`), doubled. */
  doubled?: boolean
  /** Spit Up's Stockpile layers, 1 unless said. */
  stockpile?: number
}

/** The moves whose power hangs on what the calc doesn't know, by what they're doubled on: the user's last move
 * failing (Stomping Tantrum, Temper Flare), the target hitting it first this turn (Avalanche), an ally's Round just
 * before, Fickle Beam's all-out attack (a 30% chance). Their power ours, as Showdown's `basePowerCallback`s and
 * `onBasePower`s have it (`patchOf`). */
export const DOUBLING = {
  stompingtantrum: 'failed',
  temperflare: 'failed',
  avalanche: 'hitFirst',
  round: 'round',
  ficklebeam: 'allOut',
} as Partial<Record<MoveId, 'failed' | 'hitFirst' | 'round' | 'allOut'>>
export const MAX_STOCKPILE = 3
/** The most times Rage Fist counts, its power capped at 350. */
export const MAX_ATTACKED = 6
/** The moves whose power the side's battle state sets (`Fighter.fainted`, `Fighter.attacked`). */
export const usesFainted = (move: MoveId | null) => move === 'lastrespects'
export const usesAttacked = (move: MoveId | null) => move === 'ragefist'

/** The hits a move can be told to hit: those whose hits vary, 2 to 5; Beat Up's, a hit per party member able to
 * fight, 1 to the four brought. */
export function hitChoices(move: MoveId): readonly number[] | null {
  if (move === 'beatup') return [1, 2, 3, 4]
  return MOVES[move]?.hits === 5 ? [2, 3, 4, 5] : null
}

/** A move as it battles where it hangs on what the calc doesn't know (the calc's own otherwise): Last Respects' 50
 * more per ally fainted, Rage Fist's per time hit (to 350), a doubling move's doubled, Spit Up's 100 per Stockpile
 * layer, and Beat Up, which Showdown gives no power of its own: a hit per party member able to fight (the four brought
 * but those fainted, unless said), each at 5 + that member's base Attack / 10, every one here counted as the user's
 * (the calc knows no other), so exact for its own hit alone. */
function patchOf(f: Fighter, move: MoveId, opts: HitOptions): { basePower?: number; multihit?: number } | null {
  const bp = MOVES[move]?.power ?? 0
  if (move === 'lastrespects') return { basePower: 50 + 50 * f.fainted }
  if (move === 'ragefist') return { basePower: Math.min(350, 50 + 50 * f.attacked) }
  if (move === 'spitup') return { basePower: 100 * (opts.stockpile ?? 1) }
  if (move === 'beatup') {
    const id = battlerOf(f)
    const atk = id ? POKEMON[id]!.stats[1]! : 0
    return { basePower: 5 + Math.floor(atk / 10), multihit: opts.hits ?? Math.max(1, 4 - f.fainted) }
  }
  if (DOUBLING[move] && opts.doubled) return { basePower: bp * 2 }
  return null
}

/** Whether a move hits both foes in the battle: a spread move (Earthquake, Heat Wave…), or Expanding Force in Psychic
 * Terrain from a grounded user (its target `allAdjacentFoes` there, as Showdown's `onModifyMove` and the calc have it). */
export function spreadIn(f: Fighter, move: MoveId, field: Battlefield): boolean {
  const m = MOVES[move]
  if (!m) return false
  return isSpread(m) || (move === 'expandingforce' && field.terrain === 'Psychic' && grounded(f, field))
}

/** A move whose target stays one Pokémon's, whatever the calc sets it to: for `single`, no spread reduction (×0.75),
 * which the calc reads off the target, and Expanding Force's ×1.5 in Psychic Terrain kept, which its branch pushes as
 * it sets the target to both foes. The calc works on a copy (`calculate` calls `clone`, which rebuilds the move from its
 * name), so the copy is pinned, and its own copies in turn. Leans on the calc's internals (0.12.0); checked by hand
 * once: Expanding Force in Psychic Terrain hitting one foe is 80 × 1.5 × 1.3, with no ×0.75. */
function pinnedSingle(mv: Move): Move {
  Object.defineProperty(mv, 'target', { get: () => 'normal', set() {}, configurable: true })
  const clone = Move.prototype.clone
  mv.clone = () => pinnedSingle(clone.call(mv))
  return mv
}

/** What one side's move does to the other, on this field. */
export function hit(
  attacker: Fighter,
  defender: Fighter,
  move: MoveId,
  field: Battlefield,
  opts: HitOptions = {},
): Hit | null {
  if (!MOVES[move]) return null
  // A move whose power hangs on the order, at the order the battle has (Trick Room, priority): the calc reads it off
  // the two Speeds, so where they'd say otherwise, they're set apart by Speed stages (which nothing else here reads).
  let order: Hit['order'] = null
  if (ordered(attacker, move)) {
    const o = orderOf(attacker, defender, move, field)
    order = o === 'first' ? 'first' : 'last'
    const as = speedOf(attacker, field)
    const ds = speedOf(defender, field)
    if (as !== null && ds !== null && (as > ds ? 'first' : 'last') !== order) {
      const by = order === 'first' ? STAGE_MAX : STAGE_MIN
      const atSpe = (f: Fighter, spe: number): Fighter => ({
        ...f,
        boosts: [f.boosts[0], f.boosts[1], f.boosts[2], f.boosts[3], spe],
      })
      attacker = atSpe(attacker, by)
      defender = atSpe(defender, -by)
    }
  }
  const a = pokemonOf(attacker)
  const d = pokemonOf(defender)
  if (!a || !d) return null
  return {
    ...hitOf(a, d, move, field, sideOf(attacker), sideOf(defender), opts, patchOf(attacker, move, opts)),
    order,
    priority: priorityOf(attacker, move, field),
    spread: spreadIn(attacker, move, field),
  }
}

function hitOf(
  a: Pokemon,
  d: Pokemon,
  move: MoveId,
  field: Battlefield,
  atkSide: ReturnType<typeof sideOf>,
  defSide: ReturnType<typeof sideOf>,
  opts: HitOptions,
  patch: ReturnType<typeof patchOf>,
): Omit<Hit, 'order' | 'priority' | 'spread'> {
  const mv = new Move(
    GEN,
    named((x) => GEN.moves.get(x), move),
    {
      isCrit: !!opts.crit,
      ...(opts.hits && { hits: opts.hits }),
      ...(patch && { overrides: patch }),
      ability: a.ability,
      item: a.item,
      species: a.name,
    },
  )
  const r = calculate(GEN, a, d, opts.single ? pinnedSingle(mv) : mv, calcField(field, atkSide, defSide))
  const maxHp = r.defender.maxHP()
  const hp = r.defender.curHP()
  const dmg = r.damage
  // A move hitting more than once: each roll its hits added up, as the calc's range does.
  const rolls: number[] =
    typeof dmg === 'number'
      ? [dmg]
      : Array.isArray(dmg[0])
        ? (dmg[0] as number[]).map((_, i) => (dmg as number[][]).reduce((s, h) => s + h[i]!, 0))
        : [...(dmg as number[])]
  const [min, max] = r.range()
  const none = max === 0
  let ko = ''
  let koHits = 0
  let koChance = 0
  let desc = ''
  let extra = ''
  if (!none) {
    try {
      const k = r.kochance()
      ko = k.text
      koHits = k.n
      koChance = k.chance ?? 0
    } catch {
      // A case the calc can't put a verdict on: the range alone.
    }
    try {
      desc = r.desc()
      extra = [r.recoil().text, r.recovery().text].filter(Boolean).join(' · ')
    } catch {
      desc = ''
    }
  }
  return {
    move,
    min,
    max,
    blocked: none ? blockedBy(r.rawDesc, r.move.type, r.defender.types) : null,
    // Rounded down to a tenth, as the calc's own line has them.
    minPct: Math.floor((min * 1000) / maxHp) / 10,
    maxPct: Math.floor((max * 1000) / maxHp) / 10,
    rolls,
    maxHp,
    hp,
    hits: r.move.hits,
    ko,
    koHits,
    koChance,
    desc,
    extra,
    none,
  }
}

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** What the calc says kept a damaging move from doing anything, as it returns early on it: the defender's ability or
 * item, Psychic Terrain against priority, or else the defender's type. */
function blockedBy(
  desc: { defenderAbility?: string; defenderItem?: string; terrain?: string },
  moveType: string,
  types: readonly string[],
): Hit['blocked'] {
  if (desc.defenderAbility) return { ref: ability(toId(desc.defenderAbility) as AbilityId) }
  if (desc.defenderItem) return { ref: item(toId(desc.defenderItem) as ItemId) }
  if (desc.terrain === 'Psychic') return { ref: condition('psychicterrain') }
  const atk = toId(moveType) as TypeId
  const immune = types.map((x) => toId(x) as TypeId).find((x) => TYPES.includes(x) && chart(atk, x) === 0)
  return immune ? { type: immune } : null
}

/** How many of a hit it takes to knock out, as the calc says (up to 9), else never. */
const hitsToKo = (h: Hit) => (h.none || !h.koHits ? Infinity : h.koHits)

/** A side's hardest-hitting move: the one that knocks out in the fewest hits, then the likeliest to, then the most. */
export function bestHit(hits: readonly (Hit | null)[]): Hit | null {
  let best: Hit | null = null
  for (const h of hits) {
    if (!h || h.none) continue
    const by = best ? hitsToKo(h) - hitsToKo(best) || best.koChance - h.koChance || best.maxPct - h.maxPct : -1
    if (by < 0) best = h
  }
  return best
}

/** The two sides trading their hardest hits, one on one: each one's move, who moves first (a priority move before
 * one with less, else by Speed), and who knocks the other out first, if either does within the calc's reach; `sure`
 * when the winner's knockout is guaranteed and the loser's can't come sooner. */
export interface OneOnOne {
  a: Hit | null
  b: Hit | null
  first: Lead
  winner: Lead | null
  sure: boolean
}
export function oneOnOne(a: Fighter, b: Fighter, field: Battlefield): OneOnOne | null {
  const sa = speedOf(a, field)
  const sb = speedOf(b, field)
  if (sa === null || sb === null) return null
  const best = (x: Fighter, y: Fighter) =>
    bestHit(x.member.moves.filter((m): m is MoveId => !!m).map((m) => hit(x, y, m, field)))
  const ha = best(a, b)
  const hb = best(b, a)
  const pa = ha ? priorityOf(a, ha.move, field) : 0
  const pb = hb ? priorityOf(b, hb.move, field) : 0
  const first: Lead = pa !== pb ? (pa > pb ? 'a' : 'b') : leadOf(sa, sb, field)
  const na = ha ? hitsToKo(ha) : Infinity
  const nb = hb ? hitsToKo(hb) : Infinity
  if (na === Infinity && nb === Infinity) return { a: ha, b: hb, first, winner: null, sure: false }
  const winner: Lead = na < nb ? 'a' : nb < na ? 'b' : first
  const won = winner === 'a' ? ha : winner === 'b' ? hb : null
  const lost = winner === 'a' ? hb : winner === 'b' ? ha : null
  const sure = !!won && won.koChance >= 1 && (!lost || hitsToKo(lost) > hitsToKo(won) || winner === first)
  return { a: ha, b: hb, first, winner, sure }
}

/** A side's stats as it battles, after its nature, points and stages (its Speed with them, before its item's). */
export function statsOf(f: Fighter): Record<(typeof STATS)[number], number> | null {
  const p = pokemonOf(f)
  if (!p) return null
  return { ...p.stats, hp: p.maxHP() } as Record<(typeof STATS)[number], number>
}

/** A Pokémon's most common set in the meta (`commonMember`), a Mega Mega Evolving. */
export const commonSet = (id: PokemonId, data: MetaData | null | undefined): Fighter => ({
  ...emptyFighter(commonMember(id, data)),
  mega: isMega(id),
})

export { mostUsedForme }

/** The meta's most used Pokémon, at their most common sets, up to `n`, each with its usage. */
export function metaFoes(
  data: MetaData | null | undefined,
  n: number,
): { id: PokemonId; usage: number; set: Fighter }[] {
  if (!data) return []
  return (Object.keys(data) as PokemonId[])
    .filter((id) => POKEMON[id] && data[id]?.usage)
    .sort((a, b) => data[b]!.usage! - data[a]!.usage!)
    .slice(0, n)
    .map((id) => ({ id, usage: data[id]!.usage!, set: commonSet(id, data) }))
}

/** The verdict's kind, to color it by: a one-hit KO, two hits, three or more, or nothing. */
export type KoKind = 'ohko' | 'two' | 'more' | 'none'
export function koKind(h: Hit | null | undefined): KoKind {
  if (!h || h.none) return 'none'
  if (h.koHits === 1) return 'ohko'
  if (h.koHits === 2) return 'two'
  return 'more'
}

/** Whether a move damages at all: not a status move. */
export const damaging = (id: MoveId | null): id is MoveId => !!id && !!MOVES[id] && MOVES[id].category !== 'status'
