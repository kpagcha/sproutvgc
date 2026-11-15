import type { PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { MOVES } from '@/data/moves'
import { POKEMON } from '@/data/pokemon'
import { TYPES, chart, type TypeId } from '@/data/types'
import { effectiveness } from '@/lib/typecalc'

// How the meta leans by type (the rankings' Types panel, `MetaTypes`), every number weighted by usage: each Pokémon in
// the data counting by its share of teams, a Mega apart from the Pokémon it changes from, at its own types and usage,
// as the meta counts them.
// - Pokémon's types: a type's share of the meta's Pokémon, one with two types counting for each (so the shares add up
//   to more than 100%), or each combination's (a type alone its own), adding up to 100%.
// - Attacks: the meta's damaging moves, each Pokémon's by the share of its sets running it times its usage, by type;
//   and, against each defending type, the share of those attacks that hit it super effectively, and that it resists
//   (immunities included), by the type chart alone.
// - What the meta's Pokémon are weak to: for each attacking type, the share of them it hits super effectively, and the
//   share resisting it, at their types (abilities left out: Levitate's isn't a type's).

/** A type, or two joined by "/" in `TYPES` order. */
export type Combo = string

export interface TypeShare<K extends string = TypeId> {
  key: K
  types: TypeId[]
  share: number
  /** Its share's change since the dataset before, when there's one. */
  change?: number
  /** Those adding most to it, most first. */
  top: PokemonId[]
}

export interface Pressure {
  type: TypeId
  /** The share of the meta's attacks super effective against it. */
  weak: number
  /** The share it resists or is immune to. */
  resisted: number
  change?: number
}

export interface MetaTypes {
  single: TypeShare[]
  dual: TypeShare<Combo>[]
  attacks: TypeShare[]
  /** Against each defending type, the meta's attacks. */
  pressure: Pressure[]
  /** Each attacking type against the meta's Pokémon (`Pressure.type` the attacking one). */
  weakTo: Pressure[]
}

/** How many Pokémon each type or attack names as adding most to it. */
const TOP = 3

const comboOf = (types: readonly TypeId[]): Combo =>
  [...types].sort((a, b) => TYPES.indexOf(a) - TYPES.indexOf(b)).join('/')

/** Sums by key, with each key's biggest contributors. */
function tally<K extends string>() {
  const sums = new Map<K, number>()
  const by = new Map<K, Map<PokemonId, number>>()
  let total = 0
  return {
    add(key: K, id: PokemonId, w: number) {
      sums.set(key, (sums.get(key) ?? 0) + w)
      let m = by.get(key)
      if (!m) by.set(key, (m = new Map()))
      m.set(id, (m.get(id) ?? 0) + w)
    },
    total(w: number) {
      total += w
    },
    shares(keys: readonly K[], typesOf: (k: K) => TypeId[], before?: Map<K, number>): TypeShare<K>[] {
      return keys
        .map((key) => {
          const share = total ? (sums.get(key) ?? 0) / total : 0
          const top = [...(by.get(key) ?? [])]
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP)
            .map(([id]) => id)
          const was = before?.get(key)
          return { key, types: typesOf(key), share, change: before ? share - (was ?? 0) : undefined, top }
        })
        .filter((x) => x.share > 0 || (x.change ?? 0) !== 0)
        .sort((a, b) => b.share - a.share)
    },
    map(): Map<K, number> {
      return new Map([...sums].map(([k, v]) => [k, total ? v / total : 0]))
    },
  }
}

interface Raw {
  single: ReturnType<typeof tally<TypeId>>
  dual: ReturnType<typeof tally<Combo>>
  attacks: ReturnType<typeof tally<TypeId>>
}

function count(data: MetaData): Raw {
  const single = tally<TypeId>()
  const dual = tally<Combo>()
  const attacks = tally<TypeId>()
  for (const [key, m] of Object.entries(data)) {
    const id = key as PokemonId
    const mon = POKEMON[id]
    const usage = m?.usage ?? 0
    if (!mon || !usage) continue
    single.total(usage)
    dual.total(usage)
    for (const ty of mon.types) single.add(ty, id, usage)
    dual.add(comboOf(mon.types), id, usage)
    for (const x of m!.moves ?? []) {
      const mv = MOVES[x.id]
      if (!mv || mv.category === 'status' || !x.share) continue
      const w = usage * x.share
      attacks.total(w)
      attacks.add(mv.type, id, w)
    }
  }
  return { single, dual, attacks }
}

function pressureOf(attacks: Map<TypeId, number>) {
  return TYPES.map((def) => {
    let weak = 0
    let resisted = 0
    for (const [atk, share] of attacks) {
      const m = chart(atk, def)
      if (m > 1) weak += share
      else if (m < 1) resisted += share
    }
    return { type: def, weak, resisted }
  })
}

function weakToOf(combos: Map<Combo, number>) {
  return TYPES.map((atk) => {
    let weak = 0
    let resisted = 0
    for (const [combo, share] of combos) {
      const m = effectiveness(atk, combo.split('/') as TypeId[])
      if (m > 1) weak += share
      else if (m < 1) resisted += share
    }
    return { type: atk, weak, resisted }
  })
}

/** The meta's types, against the dataset before's (`before`) where there's one. */
export function metaTypes(data: MetaData, before?: MetaData | null): MetaTypes {
  const now = count(data)
  const was = before ? count(before) : null
  const combos = [...new Set([...now.dual.map().keys(), ...(was ? was.dual.map().keys() : [])])]
  const wasPressure = was && new Map(pressureOf(was.attacks.map()).map((p) => [p.type, p.weak]))
  const wasWeak = was && new Map(weakToOf(was.dual.map()).map((p) => [p.type, p.weak]))
  return {
    single: now.single.shares(TYPES, (k) => [k], was?.single.map()),
    dual: now.dual
      .shares(combos, (k) => k.split('/') as TypeId[], was?.dual.map())
      // A combination gone from the meta isn't one to show.
      .filter((x) => x.share > 0),
    attacks: now.attacks.shares(TYPES, (k) => [k], was?.attacks.map()),
    pressure: pressureOf(now.attacks.map())
      .map((p) => ({ ...p, change: wasPressure ? p.weak - (wasPressure.get(p.type) ?? 0) : undefined }))
      .sort((a, b) => b.weak - a.weak),
    weakTo: weakToOf(now.dual.map())
      .map((p) => ({ ...p, change: wasWeak ? p.weak - (wasWeak.get(p.type) ?? 0) : undefined }))
      .sort((a, b) => b.weak - a.weak),
  }
}
