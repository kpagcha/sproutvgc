// The threats: what an opponent could hit yours with, and how likely each hit is to knock it out. Every damaging move
// in its movepool, not only those its sets run (the rare one that surprises), each worked out over the sets the meta has
// of it: its spreads, items and abilities, each counting as often as it's run, every damage roll alike. A move's row is
// its damage across those sets, the chance it knocks yours out in one hit and in two (from yours' HP left, as the calc's
// side has it), and how often its sets run it.
//
// Thousands of hits, so it's worked out a slice at a time (`runThreats`), and with as few hits as it takes: for each
// move, every item and ability is tried once at the most common spread, and those that leave its damage as it is (most
// items don't change most moves) count as one; only what's left is worked out at every spread. The calc's one-line
// account is left out (`lean`). The usage data counts spreads, items and abilities apart, not as whole sets, so they're
// taken as independent (a Choice Specs with a physical spread can come up).

import type { AbilityId, ItemId, MoveId } from '@/data/dex'
import type { PokemonMeta } from '@/data/meta'
import { ITEMS } from '@/data/items'
import { MOVES } from '@/data/moves'
import { natureEffectOn } from '@/data/natures'
import { itemBound, POKEMON, STATS } from '@/data/pokemon'
import { statValue } from '@/lib/stats'
import { stoneMega } from '@/lib/team'
import {
  abilityOf,
  battlerOf,
  damaging,
  type HitOptions,
  hit,
  SETS_FIELD,
  type Battlefield,
  type Fighter,
  type Hit,
} from '@/lib/damage'
import { runSliced } from '@/lib/slices'

/** One move of the opponent's against yours. */
export interface Threat {
  move: MoveId
  /** The share of its sets running it, from the meta; null when the data doesn't have it (under its floor, or none). */
  run: number | null
  /** The chance it knocks yours out in one hit, and in two hits or fewer, over its sets and the damage rolls. */
  ohko: number
  two: number
  /** Its damage across its sets, in percent of yours' whole HP: the least and the most. */
  minPct: number
  maxPct: number
}

/** A share of what it can be, by weight, the weights adding up to 1. */
type Weighted<T> = { value: T; w: number }[]

/** A list of shares as weights adding up to 1 (the data's lists stop short of every set), or `fallback` alone. */
function weighted<T>(list: readonly { value: T; share?: number }[] | undefined, fallback: T): Weighted<T> {
  const kept = (list ?? []).filter((x) => (x.share ?? 0) > 0)
  const total = kept.reduce((s, x) => s + x.share!, 0)
  return total ? kept.map((x) => ({ value: x.value, w: x.share! / total })) : [{ value: fallback, w: 1 }]
}

type Spread = { nature: string | null; points: Fighter['member']['points'] }

/**
 * Its sets as the threats count them: its spreads, items and abilities, from the meta's entry (`entry`, its battler's:
 * a stone holder's, its Mega's) or its own set where the entry has none. A Pokémon whose item is fixed (a Mega's stone,
 * Ogerpon's mask) keeps it, and a Mega its own ability. At its team sheet (`sheet`), its item, ability and nature are
 * its set's, as an open team sheet shows them: its stat points, which no sheet shows, are what vary, as the spreads of
 * that nature have them (its set's own, when the entry has none of that nature).
 */
function setsOf(att: Fighter, entry: PokemonMeta | undefined, sheet: boolean) {
  const m = att.member
  const spreads = weighted<Spread>(
    entry?.spreads
      ?.filter((s) => !sheet || s.nature === m.nature)
      .map((s) => ({ value: { nature: s.nature, points: s.points }, share: s.share })),
    { nature: m.nature, points: m.points },
  )
  const fixedItem = sheet || !!stoneMega(m) || (!!m.pokemon && itemBound(m.pokemon))
  const items = fixedItem
    ? [{ value: m.item, w: 1 }]
    : weighted<ItemId | null>(
        // Not its Mega Stones: holding one, it'd be its Mega, a Pokémon of its own here.
        entry?.items?.filter((x) => !ITEMS[x.id]?.megas).map((x) => ({ value: x.id, share: x.share })),
        m.item,
      )
  const megaAbility = att.mega && stoneMega(m)
  const abilities =
    sheet || megaAbility
      ? [{ value: m.ability, w: 1 }]
      : weighted<AbilityId | null>(
          entry?.abilities?.map((x) => ({ value: x.id, share: x.share })),
          m.ability,
        )
  return { spreads, items, abilities }
}

/** Abilities that ignore Sturdy, among others (Mold Breaker's kind). */
const BREAKERS = new Set(['moldbreaker', 'teravolt', 'turboblaze'])

/**
 * The chance a hit knocks out in one: its rolls reaching the HP left, but not through Focus Sash or Sturdy at full HP
 * (which the calc doesn't count), unless it hits more than once; and in two or fewer, as the calc's verdict has it (its
 * healing berries and the like counted), at least as likely as in one.
 */
function koChances(h: Hit, def: Fighter, att: Fighter, field: Battlefield): [number, number] {
  if (h.none) return [0, 0]
  const sash = def.member.item === 'focussash' && !field.effects.includes('magicRoom')
  const sturdy = abilityOf(def) === 'sturdy' && !BREAKERS.has(abilityOf(att) ?? '')
  const survives = (sash || sturdy) && h.hp === h.maxHp && h.hits <= 1
  const one = survives ? 0 : h.rolls.filter((r) => r >= h.hp).length / h.rolls.length
  const two = !h.koHits ? 0 : h.koHits === 1 ? 1 : h.koHits === 2 ? h.koChance : 0
  return [one, Math.max(one, two)]
}

/** The moves to work out: every damaging one it learns, or at its team sheet (`sheet`), those of its set. */
export const threatMoves = (learnset: readonly MoveId[], att: Fighter, sheet: boolean) =>
  sheet ? att.member.moves.filter(damaging) : learnset.filter(damaging)

/** How the threats are worked out: at its team sheet (`setsOf`), and each move's options as the calc has them set on
 * its rows (a critical hit, its hits, a doubled move's doubling, Stockpile's layers, one target alone). */
export interface ThreatOptions {
  sheet?: boolean
  moveOpts?: Partial<Record<MoveId, HitOptions>>
}

/**
 * The attacker's stats a move's damage hangs on, by their place in `STATS`: its attacking stat as its category has it,
 * Body Press's Defense, Gyro Ball's and Electro Ball's Speed, Final Gambit's HP, both attacking stats for those that pick
 * the better (Shell Side Arm, Photon Geyser), none for Foul Play, which uses the target's; and Speed too where the order
 * changes its power (Payback, Bolt Beak, Fishious Rend, or any move from an Analytic user: `ordered`). Spreads alike in
 * them hit alike.
 */
export function statsUsed(move: MoveId, ordered: boolean): readonly number[] {
  const own = OWN_STATS[move] ?? (MOVES[move]?.category === 'special' ? [3] : [1])
  return ordered || ORDER_MOVES.has(move) ? [...own, 5] : own
}
const OWN_STATS: Partial<Record<string, readonly number[]>> = {
  bodypress: [2],
  gyroball: [5],
  electroball: [5],
  finalgambit: [0],
  shellsidearm: [1, 3],
  photongeyser: [1, 3],
  foulplay: [],
}
/** The moves whose power hangs on moving first or last. */
export const ORDER_MOVES = new Set(['payback', 'boltbeak', 'fishiousrend'])
/** The moves any item can change: those whose power the held item sets (Fling, Natural Gift), and those hanging on the
 * user's stat stages or Defense, which an item can raise (a Terrain Seed: Stored Power, Power Trip, Body Press). */
const ITEM_MOVES = new Set(['fling', 'naturalgift', 'storedpower', 'powertrip', 'bodypress'])
/**
 * Whether an item can't change a move's damage: what its category says it's for (defense, the field, utility; Speed,
 * but where Speed changes the move's power, or the order does). An item the regulation doesn't have is tried, as is any
 * other, and every item for a move whose power the item sets.
 */
export function inert(item: ItemId | null, move: MoveId, ordered: boolean): boolean {
  if (ITEM_MOVES.has(move)) return false
  const c = item ? ITEMS[item]?.category : 'utility'
  const speedCounts = ordered || ORDER_MOVES.has(move) || move === 'gyroball' || move === 'electroball'
  return c === 'defense' || c === 'field' || c === 'utility' || (c === 'speed' && !speedCounts)
}

/**
 * Each move's threat, one move a step: a generator, so the work can stop between moves (`runThreats`). `att` is the
 * opponent as the calc has it (its stages, side and HP kept; its set what's varied), `def` yours as it is. For each move,
 * the items that can't change its damage count as one (`inert`); the others, and each ability, are tried at the most
 * common spread, those dealing the same damage counting as one; and spreads alike in the stats it uses (`statsUsed`) are
 * worked out once.
 */
export function* threatSteps(
  att: Fighter,
  def: Fighter,
  field: Battlefield,
  entry: PokemonMeta | undefined,
  moves: readonly MoveId[],
  options: ThreatOptions = {},
): Generator<Threat | null> {
  const { spreads, items, abilities } = setsOf(att, entry, !!options.sheet)
  // A move's options as the calc has them, lean.
  const optsOf = (move: MoveId): HitOptions => ({ ...options.moveOpts?.[move], lean: true })
  const runs = new Map((entry?.moves ?? []).map((x) => [x.id, x.share ?? 0]))
  const spreadList = [...spreads].sort((x, y) => y.w - x.w)
  const base = att.member.pokemon ? POKEMON[battlerOf(att)!]!.stats : null
  // Each spread's stats, to tell those alike in what a move uses.
  const statsOf = spreadList.map((s) =>
    STATS.map((stat, i) =>
      base
        ? statValue(base[i]!, s.value.points[i]!, s.value.nature ? natureEffectOn(s.value.nature, stat) : 'neutral', !i)
        : 0,
    ),
  )
  // Each side made once, so the calc's Pokémon for it is too (`lean`).
  const made = new Map<string, Fighter>()
  const fighter = (si: number, item: ItemId | null, ability: AbilityId | null): Fighter => {
    const key = `${si}|${item}|${ability}`
    let f = made.get(key)
    if (!f) {
      const s = spreadList[si]!.value
      made.set(
        key,
        (f = {
          ...att,
          sets: false,
          pooled: undefined,
          member: { ...att.member, nature: s.nature, points: s.points, item, ability },
        }),
      )
    }
    return f
  }
  // The field as it comes in: the weather or terrain its ability sets, over the calc's.
  const fields = new Map<AbilityId | null, Battlefield>()
  const fieldIds = new Map<Battlefield, number>()
  const fieldFor = (ability: AbilityId | null): Battlefield => {
    let fl = fields.get(ability)
    if (!fl) {
      const a = abilityOf(fighter(0, null, ability))
      fl = a && SETS_FIELD[a] ? { ...field, ...SETS_FIELD[a] } : field
      // One object per field it can bring, so abilities bringing the same one share it.
      const same = [...fieldIds.keys()].find((x) => x.weather === fl!.weather && x.terrain === fl!.terrain)
      if (same) fl = same
      else fieldIds.set(fl, fieldIds.size)
      fields.set(ability, fl)
    }
    return fl
  }
  // An Analytic user's moves hang on the order, so on its Speed.
  const analytic = abilities.some((a) => a.value === 'analytic')
  /** One move's threat, or null when it does nothing. */
  const one = (move: MoveId): Threat | null => {
    const used = statsUsed(move, analytic)
    // The spreads by what the move uses of them, their weights added.
    const spreadGroups = new Map<string, { si: number; w: number }>()
    spreadList.forEach((s, si) => {
      const key = used.map((i) => statsOf[si]![i]).join(',')
      const g = spreadGroups.get(key)
      if (g) g.w += s.w
      else spreadGroups.set(key, { si, w: s.w })
    })
    const [first, ...rest] = [...spreadGroups.values()]
    // The items and abilities by what they do to its damage, at the first spread, their weights added.
    const groups = new Map<string, { item: ItemId | null; ability: AbilityId | null; w: number; hit: Hit | null }>()
    const add = (key: string, item: ItemId | null, ability: AbilityId | null, w: number, h: () => Hit | null) => {
      const g = groups.get(key)
      if (g) g.w += w
      else groups.set(key, { item, ability, w, hit: h() })
    }
    // Keyed by the damage at the first spread and the field the ability brings (its own weather or terrain), so the
    // abilities that change neither, like the items, count as one.
    const keyOf = (h: Hit | null, fl: Battlefield) =>
      `${h ? `${h.rolls.join(',')}|${h.koHits}|${h.koChance}` : '-'}|${fieldIds.get(fl)}`
    // The items that can't change it: one hit for them all, with the first of them.
    const plain = items.filter((it) => inert(it.value, move, analytic))
    const probe = plain[0] ?? items[0]!
    // Each ability tried with one item first: one dealing what the first ability does, with the same field, does what
    // it does with every item, its weight going to the first's (no ability that changes nothing with one item changes
    // something with another).
    const abilityW = new Map<AbilityId | null, number>()
    let firstKey: string | null = null
    for (const ab of abilities) {
      const fl = fieldFor(ab.value)
      const key = keyOf(hit(fighter(first!.si, probe.value, ab.value), def, move, fl, optsOf(move)), fl)
      if (firstKey === null) firstKey = key
      const to = key === firstKey ? abilities[0]!.value : ab.value
      abilityW.set(to, (abilityW.get(to) ?? 0) + ab.w)
    }
    for (const [ability, aw] of abilityW) {
      const fl = fieldFor(ability)
      const tryHit = (item: ItemId | null) => hit(fighter(first!.si, item, ability), def, move, fl, optsOf(move))
      let plainHit: Hit | null | undefined
      for (const it of items) {
        const w = it.w * aw
        if (plain.includes(it)) {
          if (plainHit === undefined) plainHit = tryHit(plain[0]!.value)
          add(keyOf(plainHit, fl), plain[0]!.value, ability, w, () => plainHit!)
        } else {
          const h = tryHit(it.value)
          add(keyOf(h, fl), it.value, ability, w, () => h)
        }
      }
    }
    let ohko = 0
    let two = 0
    let minPct = Infinity
    let maxPct = -Infinity
    const count = (h: Hit | null, w: number, f: Fighter, fl: Battlefield) => {
      if (!h) return
      const [o, t] = koChances(h, def, f, fl)
      ohko += w * o
      two += w * t
      if (!h.none) {
        minPct = Math.min(minPct, h.minPct)
        maxPct = Math.max(maxPct, h.maxPct)
      }
    }
    for (const g of groups.values()) {
      const fl = fieldFor(g.ability)
      count(g.hit, g.w * first!.w, fighter(first!.si, g.item, g.ability), fl)
      for (const s of rest) {
        const f = fighter(s.si, g.item, g.ability)
        count(hit(f, def, move, fl, optsOf(move)), g.w * s.w, f, fl)
      }
    }
    return minPct === Infinity
      ? null
      : { move, run: runs.has(move) ? runs.get(move)! : null, ohko, two, minPct, maxPct }
  }
  // A move the calc throws on is left out, the rest still worked out.
  for (const move of moves) {
    try {
      yield one(move)
    } catch (e) {
      console.error(`Threats: ${move} left out`, e)
      yield null
    }
  }
}

/**
 * Works out the threats a slice at a time (`runSliced`), `onProgress` told how far it's got, `onDone` given them all; the
 * function it returns stops it (the inputs changed, or the page left), nothing called after.
 */
export function runThreats(
  steps: Generator<Threat | null>,
  total: number,
  onProgress: (done: number) => void,
  onDone: (rows: Threat[]) => void,
): () => void {
  function* collect(): Generator<unknown, Threat[]> {
    const rows: Threat[] = []
    for (const r of steps) {
      if (r) rows.push(r)
      yield
    }
    return rows
  }
  return runSliced(collect(), total, onProgress, onDone)
}
