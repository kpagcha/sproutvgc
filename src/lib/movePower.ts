// A move's power at its peak, for the team builder's Offense chart: what it hits for when everything it's built around
// is in place, against a neutral target (the Types row has the matchups). Its power, at its best where it varies (Low
// Kick at 120, Facade at 140, Weather Ball at 100), times its hits at most, STAB (2 with Adaptability), hitting both
// foes for a spread move (2 × 0.75), the power abilities by what the move is (Technician, Tough Claws, Iron Fist,
// Strong Jaw, Mega Launcher, Sharpness, Punk Rock, Sheer Force, the -ate abilities), and the weather and terrain the
// side sets itself (`fieldOf`): sun and rain, the terrains. Charge and recharge turns, and accuracy, left out: the peak
// is the representative case. Damage that isn't the move's power (Seismic Toss, OHKO moves) has none.

import type { AbilityId, MoveId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import type { TypeId } from '@/data/types'

export type Weather = 'sun' | 'rain' | 'sand' | 'snow'
export type Terrain = 'electric' | 'grassy' | 'psychic' | 'misty'
/** What a side sets: its weathers and terrains (several, where it has more than one setter). */
export interface Field {
  weather: Weather[]
  terrain: Terrain[]
}

// What sets each, abilities and moves alike.
const WEATHER_SETTERS: Record<string, Weather> = {
  drought: 'sun',
  orichalcumpulse: 'sun',
  sunnyday: 'sun',
  drizzle: 'rain',
  raindance: 'rain',
  sandstream: 'sand',
  sandstorm: 'sand',
  snowwarning: 'snow',
  snowscape: 'snow',
}
const TERRAIN_SETTERS: Record<string, Terrain> = {
  electricsurge: 'electric',
  hadronengine: 'electric',
  electricterrain: 'electric',
  grassysurge: 'grassy',
  grassyterrain: 'grassy',
  psychicsurge: 'psychic',
  psychicterrain: 'psychic',
  mistysurge: 'misty',
  mistyterrain: 'misty',
}

/** The weathers and terrains a side's abilities and moves set. */
export function fieldOf(sources: Iterable<string>): Field {
  const weather = new Set<Weather>()
  const terrain = new Set<Terrain>()
  for (const s of sources) {
    if (WEATHER_SETTERS[s]) weather.add(WEATHER_SETTERS[s])
    if (TERRAIN_SETTERS[s]) terrain.add(TERRAIN_SETTERS[s])
  }
  return { weather: [...weather], terrain: [...terrain] }
}

// Moves whose power varies, at their best (what's left at 0 has no power of its own: fixed damage, OHKO).
const PEAK: Partial<Record<MoveId, number>> = {
  lowkick: 120,
  grassknot: 120,
  heavyslam: 120,
  heatcrash: 120,
  gyroball: 150,
  electroball: 150,
  hardpress: 100,
  flail: 200,
  reversal: 200,
  facade: 140,
  hex: 130,
  acrobatics: 110,
  venoshock: 130,
  brine: 130,
  knockoff: 97.5,
  boltbeak: 170,
  fishiousrend: 170,
  payback: 100,
  avalanche: 120,
  revenge: 120,
  storedpower: 100,
  powertrip: 100,
  lastrespects: 150,
  ragefist: 150,
  weatherball: 100,
}
// Moves whose hits grow: their total, its hits counted in.
const TOTAL: Partial<Record<MoveId, number>> = { tripleaxel: 120, triplekick: 60 }

// What each weather and terrain does to a type's power.
const WEATHER_TYPES: Record<Weather, Partial<Record<TypeId, number>>> = {
  sun: { fire: 1.5, water: 0.5 },
  rain: { water: 1.5, fire: 0.5 },
  sand: {},
  snow: {},
}
const TERRAIN_TYPES: Record<Terrain, Partial<Record<TypeId, number>>> = {
  electric: { electric: 1.3 },
  grassy: { grass: 1.3 },
  psychic: { psychic: 1.3 },
  misty: { dragon: 0.5 },
}
const WEATHER_BALL: Record<Weather, TypeId> = { sun: 'fire', rain: 'water', sand: 'rock', snow: 'ice' }
const TERRAIN_PULSE: Record<Terrain, TypeId> = {
  electric: 'electric',
  grassy: 'grass',
  psychic: 'psychic',
  misty: 'fairy',
}

// Power abilities: by what the move is (its flags), by its type, and the -ate abilities, which turn Normal moves.
const FLAG_BOOSTS: Partial<Record<AbilityId, [string, number]>> = {
  toughclaws: ['contact', 1.3],
  ironfist: ['punch', 1.2],
  strongjaw: ['bite', 1.5],
  megalauncher: ['pulse', 1.5],
  sharpness: ['slicing', 1.5],
  punkrock: ['sound', 1.3],
  sheerforce: ['sheerforce', 1.3],
}
const TYPE_BOOSTS: Partial<Record<AbilityId, [TypeId, number]>> = {
  transistor: ['electric', 1.3],
  dragonsmaw: ['dragon', 1.5],
  steelworker: ['steel', 1.5],
  steelyspirit: ['steel', 1.5],
  rockypayload: ['rock', 1.5],
  waterbubble: ['water', 2],
}
const ATE: Partial<Record<AbilityId, TypeId>> = {
  aerilate: 'flying',
  pixilate: 'fairy',
  refrigerate: 'ice',
  galvanize: 'electric',
}

/** Who uses the move: their types (for STAB) and their ability. */
export interface User {
  types: readonly TypeId[]
  ability: AbilityId | null
}

/** A move's peak power for a user on a field; null for one without power of its own, or a status move. */
export function peakPower(mv: MoveId, user: User, field: Field): number | null {
  const m = MOVES[mv]
  if (!m || m.category === 'status') return null
  const base = TOTAL[mv] ?? PEAK[mv] ?? m.power
  if (!base) return null
  const hits = TOTAL[mv] ? 1 : (m.hits ?? 1)
  const flags = m.flags as readonly string[]
  // Each way the field can be (each weather or terrain it sets, or none), the best of them.
  const fields: { weather?: Weather; terrain?: Terrain }[] = [
    {},
    ...field.weather.map((weather) => ({ weather })),
    ...field.terrain.map((terrain) => ({ terrain })),
  ]
  let best = 0
  for (const f of fields) {
    let power = base
    let type: TypeId = m.type
    let spread = m.target === 'allAdjacentFoes' || m.target === 'allAdjacent'
    if (mv === 'weatherball' && f.weather) type = WEATHER_BALL[f.weather]
    if (mv === 'terrainpulse' && f.terrain) [power, type] = [100, TERRAIN_PULSE[f.terrain]]
    if (mv === 'expandingforce' && f.terrain === 'psychic') [power, spread] = [120, true]
    if (mv === 'risingvoltage' && f.terrain === 'electric') power = 140
    const ab = user.ability
    let mult = 1
    if (ab && ATE[ab] && type === 'normal') [type, mult] = [ATE[ab]!, 1.2]
    if (ab === 'normalize') [type, mult] = ['normal', 1.2]
    if (ab === 'liquidvoice' && flags.includes('sound')) type = 'water'
    if (ab === 'technician' && power <= 60) mult *= 1.5
    const byFlag = ab && FLAG_BOOSTS[ab]
    if (byFlag && flags.includes(byFlag[0])) mult *= byFlag[1]
    const byType = ab && TYPE_BOOSTS[ab]
    if (byType && byType[0] === type) mult *= byType[1]
    if (user.types.includes(type)) mult *= ab === 'adaptability' ? 2 : 1.5
    if (spread) mult *= 1.5
    if (f.weather) mult *= WEATHER_TYPES[f.weather][type] ?? 1
    if (f.terrain) mult *= TERRAIN_TYPES[f.terrain][type] ?? 1
    best = Math.max(best, power * hits * mult)
  }
  return best
}

/** Of some moves, the strongest at its peak on a side (physical or special), with its power; null with none. */
export function bestMove(
  moves: Iterable<MoveId>,
  side: 'physical' | 'special',
  user: User,
  field: Field,
): { move: MoveId; power: number } | null {
  let best: { move: MoveId; power: number } | null = null
  for (const mv of moves) {
    if (MOVES[mv]?.category !== side) continue
    const power = peakPower(mv, user, field)
    if (power !== null && (!best || power > best.power)) best = { move: mv, power }
  }
  return best
}
