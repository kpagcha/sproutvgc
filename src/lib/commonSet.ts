// A Pokémon's most common set in the meta, as a team builder's slot has it (`Member`): what the damage calculator's
// sides and the team builder's slots can load rather than be put together a part at a time.

import type { PokemonId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import type { MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { POKEMON } from '@/data/pokemon'
import { emptyMember, MOVE_SLOTS, type Member, type Points } from '@/lib/team'

export const isMega = (id: PokemonId) => !!POKEMON[id]?.mega && !!POKEMON[id]?.battleOnly

/** A Pokémon's most common set in the meta: its most used item, ability, spread (nature and points), and moves (its
 * four most used, damaging or not). A Mega is the Pokémon it changes from holding its stone. With no meta, or none of
 * it, the Pokémon alone, with its only ability if it has one. */
export function commonMember(id: PokemonId, data: MetaData | null | undefined): Member {
  const mega = isMega(id)
  const base = mega ? POKEMON[id].battleOnly! : id
  const entry = data?.[id]
  const baseEntry = data?.[base]
  const m: Member = { ...emptyMember(), pokemon: base }
  const abilities = POKEMON[base].abilities
  m.ability = baseEntry?.abilities?.[0]?.id ?? (abilities.length === 1 ? abilities[0]! : (abilities[0] ?? null))
  if (mega) m.item = POKEMON[id].item ?? null
  else m.item = entry?.items?.find((x) => ITEMS[x.id])?.id ?? null
  const spread = entry?.spreads?.[0]
  if (spread) {
    m.nature = spread.nature
    m.points = [...spread.points] as Points
  } else m.nature = entry?.natures?.[0]?.id ?? null
  const moves = (entry?.moves ?? []).map((x) => x.id).filter((x) => MOVES[x])
  m.moves = Array.from({ length: MOVE_SLOTS }, (_, i) => moves[i] ?? null)
  return m
}

/** The meta's entry most players run of a Pokémon picked from a list (as a team sheet has it, no Megas): itself or one
 * of its Megas, whichever is used most. */
export function mostUsedForme(id: PokemonId, data: MetaData | null | undefined): PokemonId {
  if (!data) return id
  let best = id
  let usage = data[id]?.usage ?? -1
  for (const it of Object.values(ITEMS)) {
    const mega = it.megas?.[id]
    const u = mega ? (data[mega]?.usage ?? -1) : -1
    if (mega && u > usage) {
      best = mega
      usage = u
    }
  }
  return best
}

/** The meta's entry for a Pokémon just picked whose most common set there is to load: its Mega's when that's what most
 * run; none when the meta has no sets of it. */
export function commonForme(id: PokemonId, data: MetaData | null | undefined): PokemonId | undefined {
  const forme = POKEMON[id].mega ? id : mostUsedForme(id, data)
  return data?.[forme]?.moves?.length ? forme : undefined
}
