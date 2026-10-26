// A team's type coverage in the team builder: how each of its Pokémon takes each attacking type, and how its moves hit
// each defending type. Its abilities count where they change that (Levitate, Thick Fat, Pixilate, Scrappy...); what
// changes a move's type otherwise (Weather Ball, a held Plate) doesn't.

import type { AbilityId, MoveId, PokemonId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import { POKEMON } from '@/data/pokemon'
import { TYPES, chart, type Multiplier, type TypeId } from '@/data/types'
import { effectiveness } from '@/lib/typecalc'
import { shownAs, type Member } from '@/lib/team'

// What a defending ability does to an attacking type's multiplier.
const TAKES: Partial<Record<AbilityId, Partial<Record<TypeId, number>>>> = {
  levitate: { ground: 0 },
  eartheater: { ground: 0 },
  flashfire: { fire: 0 },
  wellbakedbody: { fire: 0 },
  waterabsorb: { water: 0 },
  stormdrain: { water: 0 },
  dryskin: { water: 0 },
  voltabsorb: { electric: 0 },
  lightningrod: { electric: 0 },
  motordrive: { electric: 0 },
  sapsipper: { grass: 0 },
  thickfat: { fire: 0.5, ice: 0.5 },
  heatproof: { fire: 0.5 },
  waterbubble: { fire: 0.5 },
  purifyingsalt: { ghost: 0.5 },
}
// The -ate abilities: Normal moves become the type.
const ATE: Partial<Record<AbilityId, TypeId>> = {
  pixilate: 'fairy',
  aerilate: 'flying',
  refrigerate: 'ice',
  galvanize: 'electric',
  dragonize: 'dragon',
}
// Normal and Fighting moves hit Ghost.
const SCRAPPY = new Set<AbilityId>(['scrappy', 'mindseye'])
// Moves whose damage is fixed, the type chart aside (and the stats).
export const FIXED = new Set<string>([
  'seismictoss',
  'nightshade',
  'superfang',
  'ruination',
  'naturesmadness',
  'endeavor',
  'finalgambit',
  'counter',
  'mirrorcoat',
  'metalburst',
  'comeuppance',
])

/** The ability a slot battles with: a Mega's own, else the one picked. */
export function abilityOf(m: Member, id: PokemonId): AbilityId | null {
  if (id !== m.pokemon) return POKEMON[id].abilities[0] ?? null
  return m.ability
}

export interface Taken {
  pokemon: PokemonId
  mult: Multiplier
}

/** Per attacking type, how each of the team's Pokémon takes it, its ability counted. */
export function defenseOf(members: readonly Member[]): Record<TypeId, Taken[]> {
  const out = Object.fromEntries(TYPES.map((t) => [t, [] as Taken[]])) as Record<TypeId, Taken[]>
  for (const m of members) {
    const id = shownAs(m)
    if (!id) continue
    const ability = abilityOf(m, id)
    const types = POKEMON[id].types
    for (const atk of TYPES) {
      let mult: number = effectiveness(atk, types)
      if (ability === 'wonderguard' && mult < 2) mult = 0
      const by = ability && TAKES[ability]?.[atk]
      if (by !== undefined && by !== null) mult *= by
      // Thick Fat on a double resistance: still a quarter, the chart's smallest step.
      if (mult > 0 && mult < 0.25) mult = 0.25
      out[atk].push({ pokemon: id, mult: mult as Multiplier })
    }
  }
  return out
}

export interface Hit {
  pokemon: PokemonId
  /** The best its moves do. */
  mult: Multiplier
  /** The moves that do it, each with the type it's used as. */
  moves: { id: MoveId; type: TypeId }[]
  /** One of them gets STAB. */
  stab: boolean
}

/** Per defending type, how well each of the team's Pokémon with damaging moves hits it. */
export function offenseOf(members: readonly Member[]): Record<TypeId, Hit[]> {
  const out = Object.fromEntries(TYPES.map((t) => [t, [] as Hit[]])) as Record<TypeId, Hit[]>
  for (const m of members) {
    const id = shownAs(m)
    if (!id) continue
    const ability = abilityOf(m, id)
    const types = POKEMON[id].types
    const moves = m.moves.flatMap((mv) => {
      const data = mv && MOVES[mv]
      if (!data || data.category === 'status' || FIXED.has(mv)) return []
      const ate = ability && ATE[ability]
      const type: TypeId = ability === 'normalize' ? 'normal' : ate && data.type === 'normal' ? ate : data.type
      return [{ id: mv, type }]
    })
    if (!moves.length) continue
    for (const def of TYPES) {
      let best: Hit | null = null
      for (const mv of moves) {
        let mult: number = chart(mv.type, def)
        if (mult === 0 && def === 'ghost' && ability && SCRAPPY.has(ability)) mult = 1
        const stab = types.includes(mv.type)
        if (!best || mult > best.mult) best = { pokemon: id, mult: mult as Multiplier, moves: [mv], stab }
        else if (mult === best.mult) {
          best.moves.push(mv)
          best.stab ||= stab
        }
      }
      out[def].push(best!)
    }
  }
  return out
}
