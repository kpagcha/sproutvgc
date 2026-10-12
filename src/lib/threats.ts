// How a Pokémon's sets threaten another: the damaging moves they run that hit it super effectively, by type, from the
// meta's moves and abilities. The speed tiers filter yours' opponents by it, and weight how often yours moves first
// by it. Known gaps, left as plain types: moves whose type follows the weather or the user (Weather Ball, Revelation
// Dance), Liquid Voice, and yours' item (resist berries).
import type { MoveId, PokemonId } from '@/data/dex'
import type { PokemonMeta } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { POKEMON } from '@/data/pokemon'
import type { Multiplier, TypeId } from '@/data/types'
import { effectiveness } from '@/lib/typecalc'

/** A share of its sets a Pokémon's ability needs to count as theirs, when it can have more than one. */
const ABILITY_SHARE = 0.5

/** Abilities that turn Normal moves into a type of their own (and boost them). */
const ATE: Record<string, TypeId> = { pixilate: 'fairy', aerilate: 'flying', refrigerate: 'ice', galvanize: 'electric' }
/** Abilities that make their holder immune to a type's moves. */
const IMMUNITY: Record<string, TypeId> = {
  levitate: 'ground',
  eartheater: 'ground',
  flashfire: 'fire',
  wellbakedbody: 'fire',
  waterabsorb: 'water',
  stormdrain: 'water',
  dryskin: 'water',
  voltabsorb: 'electric',
  lightningrod: 'electric',
  motordrive: 'electric',
  sapsipper: 'grass',
}
/** Damaging moves whose damage doesn't depend on type effectiveness: never super effective. */
const FIXED = new Set<string>([
  'seismictoss',
  'nightshade',
  'superfang',
  'ruination',
  'finalgambit',
  'counter',
  'mirrorcoat',
  'metalburst',
  'endeavor',
])
/** Moves with priority only with an ability of the user's sets bringing what they need: Grassy Glide, in the Grassy
 * Terrain of Grassy Surge. */
const PRIORITY_WITH: Record<string, string> = { grassyglide: 'grassysurge' }

/** Whether a Pokémon's sets have an ability: on at least `ABILITY_SHARE` of them in the meta, or, with none there, as
 * its only one. */
export function hasAbility(id: PokemonId, m: PokemonMeta | undefined, a: string): boolean {
  if (m?.abilities?.length) return m.abilities.some((x) => x.id === a && (x.share ?? 1) >= ABILITY_SHARE)
  const own = POKEMON[id].abilities as readonly string[]
  return own.length === 1 && own[0] === a
}

/** The types a Pokémon is immune to by its ability (its sets', as `hasAbility` goes). */
export function immunities(id: PokemonId, m: PokemonMeta | undefined): Set<TypeId> {
  const set = new Set<TypeId>()
  for (const [a, ty] of Object.entries(IMMUNITY)) if (hasAbility(id, m, a)) set.add(ty)
  return set
}

export interface ThreatMove {
  id: MoveId
  /** Its type as it hits: a Normal move's, by an -ate ability, that ability's. */
  type: TypeId
  /** The share of the Pokémon's sets running it. */
  share: number
  mult: Multiplier
  /** It goes first whatever the Speeds: positive priority. */
  priority: boolean
}

export interface Threat {
  /** The share of its sets running at least one of `moves`: the most common one's, a floor, as the meta's moves are
   * shares each of their own, not of sets. */
  share: number
  /** Of `share`, the sets hitting with priority (as `share`, the most common such move's). */
  priority: number
  /** The super-effective moves, most common first. */
  moves: ThreatMove[]
}

/** How a Pokémon's sets (`m`) threaten a target of types `def`, immune to `immune`; null when they don't. */
export function threatOf(
  id: PokemonId,
  m: PokemonMeta | undefined,
  def: readonly TypeId[],
  immune: ReadonlySet<TypeId>,
): Threat | null {
  if (!m?.moves?.length) return null
  const ate = Object.keys(ATE).find((a) => hasAbility(id, m, a))
  const scrappy = hasAbility(id, m, 'scrappy')
  const moves: ThreatMove[] = []
  for (const { id: mid, share = 0 } of m.moves) {
    const mv = MOVES[mid]
    if (!mv || mv.category === 'status' || FIXED.has(mid)) continue
    const type = ate && mv.type === 'normal' ? ATE[ate]! : mv.type
    if (immune.has(type)) continue
    // Scrappy's Normal and Fighting moves hit Ghosts as if they weren't.
    const vs = scrappy && (type === 'normal' || type === 'fighting') ? def.filter((t) => t !== 'ghost') : def
    let mult: number = effectiveness(type, vs)
    if (mid === 'freezedry' && def.includes('water')) mult *= 4
    if (mid === 'flyingpress') mult *= effectiveness('flying', vs)
    if (mult <= 1) continue
    const needs = PRIORITY_WITH[mid]
    const priority = mv.priority > 0 || (!!needs && hasAbility(id, m, needs))
    moves.push({ id: mid, type, share, mult: Math.min(mult, 4) as Multiplier, priority })
  }
  if (!moves.length) return null
  moves.sort((a, b) => b.share - a.share)
  const top = (list: ThreatMove[]) => list.reduce((n, x) => Math.max(n, x.share), 0)
  return { share: Math.min(1, top(moves)), priority: Math.min(1, top(moves.filter((x) => x.priority))), moves }
}
