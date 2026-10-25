// A team in the team builder: six slots, each a Pokémon and its set (item, ability, nature, four moves and its stat
// points), any part still unpicked. A Mega is kept as the Pokémon it changes from holding its stone, as a paste writes
// it (`shownAs` gives the Mega it battles as). Its paste, Showdown's format, both ways (`pokepaste.ts`).

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import { POKEMON } from '@/data/pokemon'
import type { Slot } from '@/data/tournaments'
import { TOTAL_POINTS } from '@/lib/stats'

/** A part of a slot to pick: its Pokémon, item, ability, nature, or one of its moves (by its place). */
export type Field = 'pokemon' | 'item' | 'ability' | 'nature' | 0 | 1 | 2 | 3

export const TEAM_SIZE = 6
export const MOVE_SLOTS = 4

export type Points = [number, number, number, number, number, number]

export interface Member {
  pokemon: PokemonId | null
  item: ItemId | null
  ability: AbilityId | null
  nature: string | null
  /** Four, each null until picked. */
  moves: (MoveId | null)[]
  /** In `STATS` order. */
  points: Points
}

export interface Team {
  id: string
  name: string
  members: Member[]
  /** Pinned to the top of the saved teams. */
  starred?: boolean
  /** When last changed, in milliseconds. */
  updated: number
}

export const emptyMember = (): Member => ({
  pokemon: null,
  item: null,
  ability: null,
  nature: null,
  moves: Array<MoveId | null>(MOVE_SLOTS).fill(null),
  points: [0, 0, 0, 0, 0, 0],
})

export const newTeam = (name: string): Team => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name,
  members: Array.from({ length: TEAM_SIZE }, emptyMember),
  updated: Date.now(),
})

/** The Pokémon a slot battles as: the Mega its held stone makes it, else itself. */
export function shownAs(m: Member): PokemonId | null {
  if (!m.pokemon) return null
  return (m.item && ITEMS[m.item]?.megas?.[m.pokemon]) || m.pokemon
}

/** A Pokémon picked from a list as a slot takes it: a Mega as the Pokémon it changes from, holding its stone. */
export function pickedAs(id: PokemonId): { pokemon: PokemonId; item?: ItemId } {
  const p = POKEMON[id]
  return p.mega && p.battleOnly && p.item ? { pokemon: p.battleOnly, item: p.item } : { pokemon: id }
}

/** A tournament team's set as a slot: a Mega as the Pokémon holding its stone, no stat points (team lists have none). */
export function memberFromSlot([mon, item, ability, nature, moves]: Slot): Member {
  const { pokemon, item: stone } = pickedAs(mon)
  return {
    ...emptyMember(),
    pokemon,
    item: item ?? stone ?? null,
    ability,
    nature,
    moves: Array.from({ length: MOVE_SLOTS }, (_, i) => moves[i] ?? null),
  }
}

/** The stat points a slot has left to spread. */
export const pointsLeft = (m: Member) => TOTAL_POINTS - m.points.reduce((a, b) => a + b, 0)

/** Whether a slot has nothing picked. */
export const isEmpty = (m: Member) => !m.pokemon
