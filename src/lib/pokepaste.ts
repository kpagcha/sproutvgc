// A tournament team as a paste, in the format Showdown imports and pokepast.es shows (pokepast.es/syntax.html): each
// Pokémon its species and item, its ability, its nature and its moves, a blank line between them. Tournament team lists
// have no stat points, so no EVs line; a team builder's team has them, Showdown's Champions sets keeping stat points
// where other games' keep EVs ("EVs: 2 HP / 32 Atk / 32 Spe"). No level, Champions having none to set. Its species as
// Showdown writes it ("Basculegion-F", a forme after a hyphen), a Mega as the Pokémon it changes from (it holds the
// stone); everything by its name in the site's language, English, the only one for now: Showdown reads English names
// alone, so a paste should stay in English once there are others. A paste is read back (`parsePaste`) by the same
// names, any it doesn't know reported.

import {
  ability,
  availableIds,
  item,
  move,
  pokemon,
  type AbilityId,
  type ItemId,
  type MoveId,
  type PokemonId,
} from '@/data/dex'
import { NATURE_IDS, natureName } from '@/data/natures'
import { POKEMON, splitForme } from '@/data/pokemon'
import { listed, type Slot } from '@/data/tournaments'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import { MAX_POINTS, TOTAL_POINTS } from '@/lib/stats'
import { emptyMember, MOVE_SLOTS, pickedAs, TEAM_SIZE, type Member, type Points } from '@/lib/team'

/** A Pokémon's name as Showdown writes it: a battle-only forme (a Mega) as the one it changes from, a forme after its
 * species' name and a hyphen. The species from the forme's own name, "Floette (Eternal)": the dex names only what the
 * regulation has, which needn't be the species itself. */
function species(id: Slot[0]): string {
  const p = POKEMON[id]
  if (p?.battleOnly) return species(p.battleOnly)
  const { species: name, forme } = splitForme(id, refName(pokemon(id)))
  return forme ? `${name}-${forme}` : name
}

/** The stats' names on a paste's EVs line, in `STATS` order. */
const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'] as const

/** One Pokémon as a paste's block: its name alone without a team list. Its stat points, when given and any spent. */
function slotPaste(slot: Slot, points?: Points): string {
  const [id, it, ab, nature, moves] = slot
  if (!listed(slot) && !points?.some(Boolean)) return species(id)
  const evs = points?.flatMap((p, i) => (p ? [`${p} ${STAT_NAMES[i]}`] : [])) ?? []
  return [
    it ? `${species(id)} @ ${refName(item(it))}` : species(id),
    ...(ab ? [`Ability: ${refName(ability(ab))}`] : []),
    ...(evs.length ? [`EVs: ${evs.join(' / ')}`] : []),
    ...(nature ? [`${natureName(nature)} Nature`] : []),
    ...moves.map((m) => `- ${refName(move(m))}`),
  ].join('\n')
}

/** A team as a paste. */
export const teamPaste = (team: readonly Slot[]) => team.map((s) => slotPaste(s)).join('\n\n') + '\n'

/** A team builder's team as a paste: its Pokémon picked so far, with their stat points. */
export const membersPaste = (members: readonly Member[]) =>
  members
    .flatMap((m) =>
      m.pokemon
        ? [slotPaste([m.pokemon, m.item, m.ability, m.nature, m.moves.filter((x) => x !== null)], m.points)]
        : [],
    )
    .join('\n\n') + '\n'

/** What a paste had that couldn't be read as it was: a name the dex (or the regulation) doesn't have, more than six
 * Pokémon, or EVs from another game, turned into stat points. */
export type PasteProblem =
  | { kind: 'pokemon' | 'item' | 'ability' | 'move' | 'nature'; name: string }
  | { kind: 'tooMany'; n: number }
  | { kind: 'converted'; name: string }

type Lookup<T extends string> = Map<string, T>
interface Lookups {
  pokemon: Lookup<PokemonId>
  item: Lookup<ItemId>
  ability: Lookup<AbilityId>
  move: Lookup<MoveId>
  nature: Lookup<string>
}
let lookups: Lookups | undefined
/** Every name the dex has, folded, to its ID: a Pokémon by its name and as a paste writes it. */
function names(): Lookups {
  if (lookups) return lookups
  const of = <T extends string>(ids: readonly T[], name: (id: T) => string): Lookup<T> =>
    new Map(ids.map((id) => [fold(name(id)), id]))
  const mons = availableIds('pokemon').filter((p) => !POKEMON[p].cosmetic)
  const pokemonNames = of(mons, (p) => refName(pokemon(p)))
  // As a paste writes it, the forme after a hyphen; a battle-only forme's is its base's, which keeps it, though other
  // pastes write a Mega as one too ("Salamence-Mega"), read as the Pokémon holding its stone.
  for (const p of mons) {
    if (!POKEMON[p].battleOnly) pokemonNames.set(fold(species(p)), p)
    else {
      const { species: name, forme } = splitForme(p, refName(pokemon(p)))
      if (forme && !pokemonNames.has(fold(`${name}-${forme}`))) pokemonNames.set(fold(`${name}-${forme}`), p)
    }
  }
  lookups = {
    pokemon: pokemonNames,
    item: of(availableIds('item'), (i) => refName(item(i))),
    ability: of(availableIds('ability'), (a) => refName(ability(a))),
    move: of(availableIds('move'), (m) => refName(move(m))),
    nature: of(NATURE_IDS, natureName),
  }
  return lookups
}

/** A block's species, from its first line: "Nickname (Species) (M)", the nickname and gender left out. */
function speciesName(head: string): string {
  const s = head.replace(/\s*\((?:M|F)\)\s*$/, '').trim()
  return /\(([^()]+)\)$/.exec(s)?.[1]!.trim() ?? s
}

/** A paste's EVs line as stat points: as they are when they fit Champions' (`MAX_POINTS` each, `TOTAL_POINTS` in all),
 * else EVs from another game, each turned into the points Showdown's Champions mod gives them (the first point 4 EVs,
 * the others 8 each). */
function readPoints(line: string): { points: Points; converted: boolean } {
  const raw: Points = [0, 0, 0, 0, 0, 0]
  for (const part of line.split('/')) {
    const m = /(\d+)\s*(\w+)/.exec(part.trim())
    const i = m ? STAT_NAMES.findIndex((n) => n.toLowerCase() === m[2]!.toLowerCase()) : -1
    if (m && i >= 0) raw[i] = Number(m[1])
  }
  if (raw.every((p) => p <= MAX_POINTS) && raw.reduce((a, b) => a + b, 0) <= TOTAL_POINTS)
    return { points: raw, converted: false }
  const points = raw.map((ev) => Math.min(MAX_POINTS, ev ? Math.floor((ev + 4) / 8) : 0)) as Points
  return { points, converted: true }
}

/** A paste read as a team: up to six Pokémon, each with what of its set the dex has, and what couldn't be read. */
export function parsePaste(text: string): { members: Member[]; problems: PasteProblem[] } {
  const known = names()
  const problems: PasteProblem[] = []
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((b) => b.length)
  if (blocks.length > TEAM_SIZE) problems.push({ kind: 'tooMany', n: blocks.length })
  const members: Member[] = []
  for (const [head, ...rest] of blocks.slice(0, TEAM_SIZE)) {
    const [who, held] = head!.split(/\s@\s/)
    const name = speciesName(who!)
    const id = known.pokemon.get(fold(name))
    if (!id) {
      problems.push({ kind: 'pokemon', name })
      continue
    }
    const m = emptyMember()
    // A Mega as the Pokémon it changes from, holding its stone (the one the paste gives, else its own).
    const { pokemon: base, item: stone } = pickedAs(id)
    m.pokemon = base
    m.item = stone ?? null
    if (held) {
      m.item = known.item.get(fold(held.trim())) ?? m.item
      if (!known.item.has(fold(held.trim()))) problems.push({ kind: 'item', name: held.trim() })
    }
    const moves: MoveId[] = []
    for (const line of rest) {
      if (line.startsWith('-')) {
        // "Hidden Power [Fire]" and the like: the move's name before any bracket.
        const mv = line
          .slice(1)
          .replace(/\[.*\]/, '')
          .trim()
        const id = known.move.get(fold(mv))
        if (id) moves.push(id)
        else problems.push({ kind: 'move', name: mv })
      } else if (/^ability:/i.test(line)) {
        const ab = line.slice(line.indexOf(':') + 1).trim()
        m.ability = known.ability.get(fold(ab)) ?? null
        if (!m.ability) problems.push({ kind: 'ability', name: ab })
      } else if (/^evs:/i.test(line)) {
        const { points, converted } = readPoints(line.slice(4))
        m.points = points
        if (converted) problems.push({ kind: 'converted', name })
      } else if (/ nature$/i.test(line)) {
        const n = line.replace(/ nature$/i, '').trim()
        m.nature = known.nature.get(fold(n)) ?? null
        if (!m.nature) problems.push({ kind: 'nature', name: n })
      }
      // Anything else (Level, IVs, Tera Type, Shiny, Happiness) Champions has no use for.
    }
    m.moves = Array.from({ length: MOVE_SLOTS }, (_, i) => moves[i] ?? null)
    members.push(m)
  }
  return { members, problems }
}
