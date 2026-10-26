// A team in the team builder: six slots, each a Pokémon and its set (item, ability, nature, four moves and its stat
// points), any part still unpicked. A slot is the Pokémon as its team sheet has it: a Mega is the Pokémon it changes
// from holding its stone (`stoneMega`), and only one can Mega Evolve a battle, so the team says which does in its
// insights (`Team.mega`, `evolvingSlot`; `battlers`, the slots as they battle). Its paste, Showdown's format, both ways
// (`pokepaste.ts`).

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import { movesOf, POKEMON, speciesOf } from '@/data/pokemon'
import { RULES } from '@/data/rules'
import type { Slot } from '@/data/tournaments'
import { TOTAL_POINTS } from '@/lib/stats'

/** A part of a slot to pick: its Pokémon, item, ability, nature, or one of its moves (by its place). */
export type Field = 'pokemon' | 'item' | 'ability' | 'nature' | 0 | 1 | 2 | 3

export const TEAM_SIZE = RULES.teamSize
export const MOVE_SLOTS = RULES.moves

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
  /** The slot that Mega Evolves in its insights, null for none; unset, the first holding its stone. */
  mega?: number | null
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

/** The Mega a slot's held stone makes it, when it holds its own. */
export function stoneMega(m: Member): PokemonId | null {
  if (!m.pokemon || !m.item) return null
  return ITEMS[m.item]?.megas?.[m.pokemon] ?? null
}

/** The meta's entry for a slot's sets: its Mega's when it holds its stone (the meta counts a Mega apart), else its own. */
export const setsAs = (m: Member): PokemonId | null => stoneMega(m) ?? m.pokemon

/** The slot that Mega Evolves in a team's insights: the one picked (none if so), else the first holding its stone. */
export function evolvingSlot(team: Pick<Team, 'members' | 'mega'>): number | null {
  const { members, mega } = team
  if (mega === null) return null
  if (mega !== undefined && members[mega] && stoneMega(members[mega])) return mega
  const first = members.findIndex((m) => stoneMega(m))
  return first < 0 ? null : first
}

/** A slot as it battles, for the insights: `as`, its Mega when it's the one that Mega Evolves, else itself. */
export type Battler = Member & { as: PokemonId | null }
export const battlers = (members: readonly Member[], evolving: number | null): Battler[] =>
  members.map((m, i) => ({ ...m, as: (i === evolving && stoneMega(m)) || m.pokemon }))

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

/** What a team breaks of the regulation's rules (`RULES`), each with the slots it's in and the part of them that
 * clashes: two of one species (Species Clause, its formes and Megas counting as it), more of one item than Item Clause
 * allows, more Megas than the regulation takes; and what a paste can bring in that the pickers don't offer: a set with
 * a move twice, an item only other Pokémon can use (another's Mega Stone or mask), an ability its Pokémon can't have, a move not in its learnset (once the learnsets are in, `learnsets`:
 * Showdown's, which can lag the game's). */
export type TeamIssue =
  | { kind: 'species'; part: 'pokemon'; slots: number[]; pokemon: PokemonId }
  | { kind: 'item'; part: 'item'; slots: number[]; item: ItemId }
  | { kind: 'megas'; part: 'pokemon'; slots: number[] }
  | { kind: 'move'; part: 'move'; slots: number[]; pokemon: PokemonId; move: MoveId }
  | { kind: 'ability'; part: 'ability'; slots: number[]; pokemon: PokemonId; ability: AbilityId }
  | { kind: 'learn'; part: 'move'; slots: number[]; pokemon: PokemonId; move: MoveId }
  | { kind: 'holder'; part: 'item'; slots: number[]; pokemon: PokemonId; item: ItemId }

/** The slots with a Pokémon, by a key of each (none for a null key). */
function bySlots<K>(members: readonly Member[], key: (m: Member) => K | null): Map<K, number[]> {
  const by = new Map<K, number[]>()
  members.forEach((m, i) => {
    const k = m.pokemon ? key(m) : null
    if (k !== null) by.set(k, [...(by.get(k) ?? []), i])
  })
  return by
}

export function teamIssues(members: readonly Member[], learnsets?: Record<PokemonId, MoveId[]> | null): TeamIssue[] {
  const issues: TeamIssue[] = []
  if (RULES.speciesClause)
    for (const slots of bySlots(members, (m) => speciesOf(m.pokemon!)).values())
      if (slots.length > 1)
        issues.push({ kind: 'species', part: 'pokemon', slots, pokemon: members[slots[0]!]!.pokemon! })
  const { itemClause } = RULES
  if (itemClause !== null)
    for (const [item, slots] of bySlots(members, (m) => m.item))
      if (slots.length > itemClause) issues.push({ kind: 'item', part: 'item', slots, item })
  const megas = members.flatMap((m, i) => (stoneMega(m) ? [i] : []))
  if (megas.length > RULES.megas) issues.push({ kind: 'megas', part: 'pokemon', slots: megas })
  members.forEach((m, i) => {
    const id = m.pokemon
    if (!id) return
    // A Mega's set is the Pokémon's it changes from: its moves those it learns, its ability one it can have, or the
    // Mega's (as team lists often give it).
    const mega = stoneMega(m)
    if (
      m.ability &&
      !POKEMON[id]?.abilities.includes(m.ability) &&
      !(mega && POKEMON[mega]?.abilities.includes(m.ability))
    )
      issues.push({ kind: 'ability', part: 'ability', slots: [i], pokemon: id, ability: m.ability })
    const held = m.item && ITEMS[m.item]
    if (held && (held.megas ? !held.megas[id] : held.users && !held.users.includes(id)))
      issues.push({ kind: 'holder', part: 'item', slots: [i], pokemon: id, item: m.item! })
    const learns = learnsets && new Set(movesOf(learnsets, id))
    const seen = new Set<MoveId>()
    for (const mv of m.moves) {
      if (!mv) continue
      if (seen.has(mv)) issues.push({ kind: 'move', part: 'move', slots: [i], pokemon: id, move: mv })
      else if (learns && !learns.has(mv))
        issues.push({ kind: 'learn', part: 'move', slots: [i], pokemon: id, move: mv })
      seen.add(mv)
    }
  })
  return issues
}

/** What picking into a slot would break of the rules with the others (`others`, the slot itself left out): a Pokémon
 * of a species already there, a Mega past the most the team takes, an item held as many times as Item Clause allows. */
export function clashesOf(others: readonly Member[]) {
  const species = bySlots(others, (m) => speciesOf(m.pokemon!))
  const items = bySlots(others, (m) => m.item)
  const megas = others.filter(stoneMega).length
  const { itemClause } = RULES
  return {
    /** The team's Pokémon of its species, if Species Clause rules it out. */
    species: (id: PokemonId) => {
      const slots = RULES.speciesClause && species.get(speciesOf(pickedAs(id).pokemon))
      return slots ? others[slots[0]!]!.pokemon : null
    },
    /** Whether another Mega would be one too many. */
    megasFull: megas >= RULES.megas,
    /** A Pokémon holding an item, if Item Clause rules out another. */
    item: (id: ItemId) => {
      const slots = items.get(id)
      return itemClause !== null && slots && slots.length >= itemClause ? others[slots[0]!]!.pokemon : null
    },
  }
}
