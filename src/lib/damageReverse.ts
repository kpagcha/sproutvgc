// The damage calculator read backwards: what was seen each move do, and what the opponent's set could then be. Yours is
// known; the opponent's stat points, and its nature and item unless at its team sheet, are what's worked out. Your hits
// on it narrow its bulk (its HP and the defense each move hits), its hits on yours its power (the stat each move uses).
// Every build it could have is checked against every hit seen: a hit fits a build on the share of its damage rolls that
// give what was seen (the opponent's HP as the game shows it, a whole percent, or yours' exactly in HP, or a knockout or
// not). Each stat's points where some build fits, within the 66 points a set has; and, weighed by how often players run
// them (the meta's spreads and items, taken as independent, as the threats take them), how likely what was seen was,
// and how each common build goes with it. The damage is always the calc's (`hit`), never worked out by hand.
//
// What the hits hang on of the opponent are a few stats, so each is worked out once per value they can have (at every
// nature and point, their values repeat), not per build; and the items that can't change a move's damage (`inert`,
// `takenInert`) count as one.

import type { ItemId, MoveId } from '@/data/dex'
import type { PokemonMeta } from '@/data/meta'
import { ITEMS } from '@/data/items'
import { MOVES } from '@/data/moves'
import { NATURE_IDS, natureEffectOn } from '@/data/natures'
import { itemBound, POKEMON, STATS } from '@/data/pokemon'
import { MAX_POINTS, statValue, TOTAL_POINTS, type NatureEffect } from '@/lib/stats'
import { stoneMega, type Points } from '@/lib/team'
import {
  abilityOf,
  battlerOf,
  hit,
  hpShown,
  statsOf,
  leadOf,
  speedOf,
  type Battlefield,
  type Fighter,
  type Hit,
  type HitOptions,
} from '@/lib/damage'
import { inert, ORDER_MOVES, statsUsed } from '@/lib/threats'

/** What a move was seen to do: the opponent's HP lost, in whole percent as the game shows it (`pct`), yours' in HP
 * (`hp`), or that it knocked out (`ko`), didn't (`lived`), or did on the second hit (`two`). */
export type Saw = { kind: 'pct' | 'hp'; n: number } | { kind: 'ko' | 'lived' | 'two' }
export type SawKind = Saw['kind']

/** One hit seen: whose move (`a` yours, hitting the opponent; `b` the opponent's, hitting yours), what it did, and the
 * move's options as its row has them (a critical hit, its hits…). */
export interface HitSeen {
  by: 'a' | 'b'
  move: MoveId
  saw: Saw
  opts?: HitOptions
  /** The defender's HP before it: the opponent's in percent (as the game shows it), yours' in HP; full unless said. */
  before?: number
}
/** Which of the two was seen moving first, with moves of the same priority: its Speed against yours, as the calc has
 * them (stages, item, ability, Tailwind, paralysis; Trick Room turning it over), a tie fitting half the time. */
export interface SpeedSeen {
  by: 'speed'
  first: 'a' | 'b'
}
export type Observation = HitSeen | SpeedSeen

const POINT_VALUES = [...Array(MAX_POINTS + 1).keys()]
const BREAKERS = new Set(['moldbreaker', 'teravolt', 'turboblaze'])

/** What the defender has that the calc's rolls don't show: Focus Sash or Sturdy holding it at 1 HP from full (`saved`),
 * a Sitrus Berry healing it a quarter once at half or under (`sitrus`). */
export interface Defended {
  maxHp: number
  hp: number
  saved: boolean
  sitrus: boolean
}

/** What a defender keeps of a hit: Focus Sash or Sturdy at full HP (`koChances`' rule, the threats'), its Sitrus Berry. */
export function defendedOf(h: Hit, def: Fighter, att: Fighter, field: Battlefield): Defended {
  const magic = field.effects.includes('magicRoom')
  const sash = def.member.item === 'focussash' && !magic
  const sturdy = abilityOf(def) === 'sturdy' && !BREAKERS.has(abilityOf(att) ?? '')
  return {
    maxHp: h.maxHp,
    hp: h.hp,
    saved: (sash || sturdy) && h.hp === h.maxHp && h.hits <= 1,
    sitrus: def.member.item === 'sitrusberry' && !magic,
  }
}

/** The share of a hit's rolls that give what was seen, from the defender's HP as it was. */
export function fitOf(rolls: readonly number[], saw: Saw, d: Defended): number {
  if (!rolls.length) return 0
  const knocks = (r: number) => r >= d.hp && !d.saved
  const dealt = (r: number) => (r >= d.hp ? (d.saved ? d.hp - 1 : d.hp) : r)
  let n = 0
  switch (saw.kind) {
    case 'ko':
      for (const r of rolls) if (knocks(r)) n++
      return n / rolls.length
    case 'lived':
      for (const r of rolls) if (!knocks(r)) n++
      return n / rolls.length
    case 'hp':
      for (const r of rolls) if (dealt(r) === saw.n) n++
      return n / rolls.length
    case 'pct': {
      // The HP bar a whole percent, before and after, however the game rounds it: what's left within a point of what
      // was shown; none left, a knockout.
      const target = hpShown((d.hp / d.maxHp) * 100) - saw.n
      for (const r of rolls) {
        const left = d.hp - dealt(r)
        if (left <= 0 ? target <= 0 : target > 0 && Math.abs((left / d.maxHp) * 100 - target) < 1) n++
      }
      return n / rolls.length
    }
    case 'two': {
      for (const r1 of rolls) {
        if (knocks(r1)) continue
        let left = d.hp - dealt(r1)
        if (d.sitrus && left <= d.maxHp / 2) left = Math.min(d.maxHp, left + Math.floor(d.maxHp / 4))
        for (const r2 of rolls) if (r2 >= left) n++
      }
      return n / rolls.length ** 2
    }
  }
}

// What of the opponent a hit hangs on, by their place in `STATS`.
/** Special moves hitting Defense. */
const ON_DEFENSE = new Set(['psyshock', 'psystrike', 'secretsword'])
/** Moves weighing both of the target's defenses. */
const ON_BOTH = new Set(['shellsidearm', 'photongeyser'])
/** Moves whose power is the target's Speed's. */
const ON_TARGET_SPEED = new Set(['gyroball', 'electroball'])
/** Moves whose damage hangs on the target's HP. */
const ON_TARGET_HP = new Set([
  'superfang',
  'ruination',
  'naturesmadness',
  'crushgrip',
  'wringout',
  'hardpress',
  'endeavor',
])
/** Moves whose power hangs on the user's HP. */
const ON_USER_HP = new Set(['eruption', 'waterspout', 'dragonenergy', 'flail', 'reversal'])

/** The opponent's stats a hit on it hangs on (`calc`), and those that what it was seen to do hangs on (`used`: its HP
 * too, which what's left is of). */
function takenStats(move: MoveId, att: Fighter, field: Battlefield): { calc: number[]; used: number[] } {
  const m = MOVES[move]
  const calc = new Set<number>()
  if (ON_BOTH.has(move) || field.effects.includes('wonderRoom')) {
    calc.add(2)
    calc.add(4)
  } else calc.add(m?.category === 'physical' || ON_DEFENSE.has(move) ? 2 : 4)
  if (move === 'foulplay') calc.add(1)
  if (ON_TARGET_SPEED.has(move) || ORDER_MOVES.has(move) || abilityOf(att) === 'analytic') calc.add(5)
  if (ON_TARGET_HP.has(move)) calc.add(0)
  const c = [...calc].sort()
  return { calc: c, used: [...new Set([0, ...c])].sort() }
}
/** The opponent's stats its hit on yours hangs on. */
function dealtStats(move: MoveId, att: Fighter): number[] {
  const own = new Set(statsUsed(move, abilityOf(att) === 'analytic'))
  if (ON_USER_HP.has(move)) own.add(0)
  return [...own].sort()
}
/** Whether a defender's item can't change a hit on it: what it's for is attacking, or Speed where the order doesn't
 * change the move's power. */
function takenInert(item: ItemId | null, move: MoveId, calc: readonly number[]): boolean {
  const c = item ? ITEMS[item]?.category : 'utility'
  return c === 'offense' || (c === 'speed' && !calc.includes(5))
}

/** A share of what it can be, by weight, adding up to 1. */
type Weighted<T> = { value: T; w: number }[]
function weighted<T>(list: readonly { value: T; share: number }[]): Weighted<T> {
  const kept = list.filter((x) => x.share > 0)
  const total = kept.reduce((s, x) => s + x.share, 0)
  return total ? kept.map((x) => ({ value: x.value, w: x.share / total })) : []
}

/** The least share of the opponent's sets an item needs to be tried. */
const ITEM_MIN = 0.03
/** The least share of the opponent's sets a spread needs to be in the table, and the most it takes of them. */
const TABLE_MIN = 0.03
const TABLE_MAX = 4
/** The least share of what fits a spread needs to join them, and the most that join. */
const LIKELY_MIN = 0.1
const LIKELY_MAX = 2

export interface ReverseInput {
  /** Yours, as the calc has it. */
  yours: Fighter
  /** The opponent, as the calc has it: its HP, stages, side and the rest kept; its points (and nature and item but at
   * its team sheet) what's worked out. */
  theirs: Fighter
  field: Battlefield
  /** The meta's entry of the opponent's battler (a stone holder's, its Mega's). */
  entry: PokemonMeta | undefined
  /** At its team sheet: its item, ability and nature as set; only its stat points vary. */
  sheet: boolean
  obs: readonly Observation[]
}

/** A stat's points where some build fits, and, off its team sheet, the natures' effects on it that can (`effects`). */
export interface StatRange {
  stat: number
  from: number
  to: number
  effects: NatureEffect[]
}

/** A build of the table: a nature (its effect on the stats in play is what counts) and points, the share of the
 * opponent's sets running it (null for one that isn't run: its own set where the meta has none, or the nearest that
 * fits), and, for each of the table's items, the share of the hits' rolls that fit it. */
export interface ReverseRow {
  nature: string | null
  points: Points
  share: number | null
  fits: number[]
  /** It's here as the build nearest the most common that fits, none of the common ones doing. */
  nearest?: boolean
}
/** A column of the table: the items alike in every row's fit, merged, with their share of the sets. */
export interface ReverseColumn {
  items: (ItemId | null)[]
  share: number | null
  /** Its items are those that can't change any of the hits seen (`inert`, `takenInert`): "any other item". */
  inert: boolean
}

export interface ReverseResult {
  /** The stats the hits hang on, in `STATS` order. */
  stats: number[]
  /** Each one's points where some build fits; empty when none does. */
  ranges: StatRange[]
  /** How likely what was seen was, at the meta's sets; null with none. */
  chance: number | null
  rows: ReverseRow[]
  columns: ReverseColumn[]
  /** Whether its items vary (not at its team sheet nor fixed): the table's columns are items. */
  itemsVary: boolean
}

/** The opponent at a build, from its set: its nature, points and item. */
type Build = { nature: string | null; points: readonly number[]; item: ItemId | null }

/**
 * The work, a step a hit worked out: a generator for `runSliced`, which returns the result. `total` with it says how
 * many steps, for the progress shown.
 */
export function reverseDamage(input: ReverseInput): { total: number; steps: Generator<unknown, ReverseResult | null> } {
  const { field, entry, sheet, obs } = input
  // Each at full HP but as a hit seen says it was (`before`), the defender's.
  const yours: Fighter = { ...input.yours, hp: 100 }
  const theirs: Fighter = { ...input.theirs, hp: 100 }
  const yourMaxHp = statsOf(yours)?.hp ?? 1
  const yoursAt = new Map<number, Fighter>()
  /** Yours with `points` HP left, made once per number. */
  const yoursWith = (points: number | undefined) => {
    if (points === undefined || points >= yourMaxHp) return yours
    let f = yoursAt.get(points)
    if (!f) yoursAt.set(points, (f = { ...yours, hp: (Math.max(1, points) / yourMaxHp) * 100 }))
    return f
  }
  /** The opponent's HP before a hit, in percent. */
  const theirHp = (o: Observation) => (o.by === 'a' ? Math.min(100, Math.max(0.01, o.before ?? 100)) : 100)
  const id = battlerOf(theirs)
  const m = theirs.member
  if (!id || !battlerOf(yours) || !obs.length)
    return {
      total: 0,
      steps: (function* () {
        return null
      })(),
    }
  const base = POKEMON[id].stats

  // What each hit hangs on of the opponent; the order seen, its Speed.
  const plans = obs.map((o) => {
    if (o.by === 'speed') return { o, calc: [5], used: [5] }
    if (o.by === 'a') {
      const { calc, used } = takenStats(o.move, yours, field)
      return { o, calc, used }
    }
    const calc = dealtStats(o.move, theirs)
    return { o, calc, used: calc }
  })
  const S = [...new Set(plans.flatMap((p) => p.used))].sort()

  // Its natures, by what they do to the stats in play: at its team sheet its own; else every one.
  const effectOf = (n: string | null, s: number): NatureEffect => (!s || !n ? 'neutral' : natureEffectOn(n, STATS[s]!))
  const natures = sheet && m.nature ? [m.nature] : NATURE_IDS
  const groups = new Map<string, { rep: string; natures: string[] }>()
  for (const n of natures) {
    const key = S.map((s) => effectOf(n, s)).join()
    const g = groups.get(key)
    if (g) g.natures.push(n)
    else groups.set(key, { rep: n, natures: [n] })
  }
  const groupList = [...groups.values()]
  // No nature yet, a neutral one.
  const groupOf = (n: string | null) => {
    const i = groupList.findIndex((g) => g.natures.includes(n ?? 'hardy'))
    return i >= 0 ? i : 0
  }

  // Its items: one set (known, or a guess to test) or one it can't be without (a Mega's stone, Ogerpon's mask), alone;
  // unset, those run on `ITEM_MIN` of its sets or more (none, no item). Those alike for every hit (none changes them)
  // as one.
  const fixedItem = !!m.item || !!stoneMega(m) || (!!m.pokemon && itemBound(m.pokemon))
  const itemPrior = fixedItem
    ? [{ value: m.item, w: 1 }]
    : weighted<ItemId | null>(
        (entry?.items ?? [])
          .filter((x) => !ITEMS[x.id]?.megas && (x.share ?? 0) >= ITEM_MIN)
          .map((x) => ({ value: x.id, share: x.share ?? 0 })),
      )
  if (!itemPrior.length) itemPrior.push({ value: null, w: 1 })
  const analytic = abilityOf(theirs) === 'analytic'
  const itemKey = (it: ItemId | null) =>
    plans
      .map((p) =>
        (
          p.o.by === 'speed'
            ? !it || ITEMS[it]?.category !== 'speed'
            : p.o.by === 'b'
              ? inert(it, p.o.move, analytic)
              : takenInert(it, p.o.move, p.calc)
        )
          ? '-'
          : (it ?? ''),
      )
      .join('|')
  const itemGroups = new Map<string, { rep: ItemId | null; items: Weighted<ItemId | null> }>()
  for (const it of itemPrior) {
    const key = itemKey(it.value)
    const g = itemGroups.get(key)
    if (g) g.items.push(it)
    else itemGroups.set(key, { rep: it.value, items: [it] })
  }
  const itemList = [...itemGroups.values()]
  const itemGroupOf = (it: ItemId | null) => itemList.findIndex((g) => g.items.some((x) => x.value === it))

  // The opponent at a build, made once (so the calc's Pokémon for it is too, `lean`).
  const made = new Map<string, Fighter>()
  const fighterAt = (b: Build, hp = 100): Fighter => {
    const key = `${b.nature}|${b.points.join('.')}|${b.item}|${hp}`
    let f = made.get(key)
    if (!f)
      made.set(
        key,
        (f = {
          ...theirs,
          hp,
          sets: false,
          pooled: undefined,
          member: { ...m, nature: b.nature, points: [...b.points] as Points, item: b.item },
        }),
      )
    return f
  }
  const valueOf = (s: number, p: number, effect: NatureEffect) => statValue(base[s]!, p, effect, !s)

  // For each hit, each item and nature group: the share of its rolls fitting at every point of the stats it hangs on
  // (`used`, mixed radix in their order), worked out once per value of the stats the calc reads (`calc`).
  const radix = MAX_POINTS + 1
  const fitTables = new Map<string, Float64Array>()
  const projKey = (pi: number, gi: number) => plans[pi]!.used.map((s) => effectOf(groupList[gi]!.rep, s)).join()
  const tableKey = (pi: number, ii: number, gi: number) => `${pi}|${ii}|${projKey(pi, gi)}`
  // The work to do: each table, and the calc's hits it takes.
  const jobs: { pi: number; ii: number; gi: number }[] = []
  let total = 0
  const seen = new Set<string>()
  for (let pi = 0; pi < plans.length; pi++)
    for (let ii = 0; ii < itemList.length; ii++)
      for (let gi = 0; gi < groupList.length; gi++) {
        const key = tableKey(pi, ii, gi)
        if (seen.has(key)) continue
        seen.add(key)
        jobs.push({ pi, ii, gi })
      }
  // The calc's hits, by the hit, item and the values of what it reads.
  const rollMemo = new Map<string, { h: Hit; d: Defended } | null>()
  const toHit = new Set<string>()
  for (const { pi, ii, gi } of jobs) {
    const calc = plans[pi]!.calc
    const rep = groupList[gi]!.rep
    for (const pts of assignments(calc.length))
      toHit.add(`${pi}|${ii}|${calc.map((s, k) => valueOf(s, pts[k]!, effectOf(rep, s))).join()}`)
  }
  total = toHit.size + groupList.length * itemList.length

  const yourSpeed = speedOf(yours, field)
  const speedMemo = new Map<string, number>()
  function* steps(): Generator<unknown, ReverseResult | null> {
    for (const { pi, ii, gi } of jobs) {
      const { o, calc, used } = plans[pi]!
      const rep = groupList[gi]!.rep
      const item = itemList[ii]!.rep
      const table = new Float64Array(radix ** used.length)
      // The order seen: at each of its Speed points, moving first fits, a tie half the time.
      if (o.by === 'speed') {
        for (const p of POINT_VALUES) {
          const key = `${pi}|${ii}|${valueOf(5, p, effectOf(rep, 5))}`
          let fit = speedMemo.get(key)
          if (fit === undefined) {
            const points = [...m.points]
            points[5] = p
            const theirSpeed = speedOf(fighterAt({ nature: rep, points, item }), field)
            const lead = yourSpeed === null || theirSpeed === null ? null : leadOf(yourSpeed, theirSpeed, field)
            fit = lead === null ? 1 : lead === 'tie' ? 0.5 : (lead === 'a') === (o.first === 'a') ? 1 : 0
            speedMemo.set(key, fit)
            yield
          }
          table[p] = fit
        }
        fitTables.set(tableKey(pi, ii, gi), table)
        continue
      }
      // Each value of what the calc reads, worked out once.
      for (const pts of assignments(calc.length)) {
        const vals = calc.map((s, k) => valueOf(s, pts[k]!, effectOf(rep, s)))
        const memoKey = `${pi}|${ii}|${vals.join()}`
        let r = rollMemo.get(memoKey)
        if (r === undefined) {
          const points = [...m.points]
          calc.forEach((s, k) => (points[s] = pts[k]!))
          const cand = fighterAt({ nature: rep, points, item }, theirHp(o))
          const def = o.by === 'b' ? yoursWith(o.before) : yours
          try {
            const opts = { ...o.opts, lean: true }
            const h = o.by === 'a' ? hit(yours, cand, o.move, field, opts) : hit(cand, def, o.move, field, opts)
            r = h && { h, d: o.by === 'a' ? defendedOf(h, cand, yours, field) : defendedOf(h, def, cand, field) }
          } catch (e) {
            console.error(`Reverse: ${o.move} left out`, e)
            r = null
          }
          rollMemo.set(memoKey, r)
          yield
        }
        // Every point of the stats in `used` the value stands for: HP's, where the calc doesn't read it, its own.
        const hpFree = used.includes(0) && !calc.includes(0)
        for (const hp of hpFree ? POINT_VALUES : [0]) {
          let fit = 1
          if (r) {
            let d = r.d
            if (hpFree) {
              const maxHp = valueOf(0, hp, 'neutral')
              const cur = Math.max(1, Math.round((maxHp * theirHp(o)) / 100))
              d = { ...d, maxHp, hp: cur, saved: d.saved && cur === maxHp }
            }
            fit = fitOf(r.h.rolls, o.saw, d)
          }
          const at = used.map((s) => (s === 0 && hpFree ? hp : pts[calc.indexOf(s)]!))
          table[indexOf(at)] = fit
        }
      }
      fitTables.set(tableKey(pi, ii, gi), table)
    }
    return yield* conclude()
  }

  const indexOf = (pts: readonly number[]) => pts.reduce((n, p) => n * radix + p, 0)
  /** Each hit's table at a nature group and item, looked up once. */
  const tablesAt = new Map<number, Float64Array[]>()
  const tablesOf = (gi: number, ii: number) => {
    const key = gi * 1000 + ii
    let list = tablesAt.get(key)
    if (!list) tablesAt.set(key, (list = plans.map((_, pi) => fitTables.get(tableKey(pi, ii, gi))!)))
    return list
  }
  /** The share of every hit's rolls fitting a build (their product), or of those of `of`. */
  const allPlans = plans.map((_, pi) => pi)
  const fitAt = (gi: number, ii: number, points: readonly number[], of: readonly number[] = allPlans) => {
    const tables = tablesOf(gi, ii)
    let fit = 1
    for (let k = 0; k < of.length && fit; k++) {
      const pi = of[k]!
      const used = plans[pi]!.used
      let at = 0
      for (let u = 0; u < used.length; u++) at = at * radix + points[used[u]!]!
      fit *= tables[pi]![at]!
    }
    return fit
  }

  function* conclude(): Generator<unknown, ReverseResult> {
    // Where some build fits, within the points a set has: given its nature group, item and HP, the other stats in
    // groups the hits tie together (`comps`), each tried at every point.
    const restUsed = plans.map((p) => p.used.filter((s) => s !== 0))
    const comps = components(
      S.filter((s) => s !== 0),
      restUsed,
    )
    // The hits each group's stats are of, and those of HP alone.
    const compPlans = comps.map((stats) => allPlans.filter((pi) => restUsed[pi]!.some((s) => stats.includes(s))))
    const hpPlans = allPlans.filter((pi) => !restUsed[pi]!.length)
    const hasHp = S.includes(0)
    const lo = new Map<number, number>()
    const hi = new Map<number, number>()
    const effects = new Map<number, Set<NatureEffect>>()
    const mark = (s: number, p: number, gi: number) => {
      lo.set(s, Math.min(lo.get(s) ?? Infinity, p))
      hi.set(s, Math.max(hi.get(s) ?? -Infinity, p))
      let e = effects.get(s)
      if (!e) effects.set(s, (e = new Set()))
      e.add(effectOf(groupList[gi]!.rep, s))
    }
    // The meta's spreads (at its team sheet, those of its nature), merged where alike in the stats in play.
    const spreads = weighted(
      (entry?.spreads ?? [])
        .filter((s) => !sheet || !m.nature || s.nature === m.nature)
        .map((s) => ({ value: { nature: s.nature, points: s.points }, share: s.share ?? 0 })),
    )
    const merged = new Map<string, { nature: string | null; points: Points; w: number }>()
    for (const s of spreads) {
      const key = `${S.map((st) => effectOf(s.value.nature, st)).join()}|${S.map((st) => s.value.points[st]).join()}`
      const was = merged.get(key)
      if (was) was.w += s.w
      else merged.set(key, { nature: s.value.nature, points: s.value.points as Points, w: s.w })
    }
    const columnsOf = itemList.flatMap((g, ii) => g.items.map((it) => ({ ii, it })))
    const rowFits = (b: { nature: string | null; points: readonly number[] }) =>
      columnsOf.map((c) => fitAt(groupOf(b.nature), c.ii, b.points))
    let chance: number | null = null
    const all = [...merged.values()].map((s) => {
      const fits = rowFits(s)
      const like = fits.reduce((n, f, ci) => n + f * columnsOf[ci]!.it.w, 0)
      return { ...s, fits, like }
    })
    if (all.length) chance = all.reduce((n, s) => n + s.w * s.like, 0)
    const byShare = [...all].sort((x, y) => y.w - x.w)
    const picked = byShare.filter((s) => s.w >= TABLE_MIN).slice(0, TABLE_MAX)
    if (chance)
      for (const s of [...all].sort((x, y) => y.w * y.like - x.w * x.like).slice(0, LIKELY_MAX))
        if ((s.w * s.like) / chance >= LIKELY_MIN && !picked.includes(s)) picked.push(s)
    const rows: ReverseRow[] = picked.map((s) => ({ nature: s.nature, points: s.points, share: s.w, fits: s.fits }))
    // With no spreads, its own set.
    if (!rows.length) rows.push({ nature: m.nature, points: m.points, share: null, fits: rowFits(m) })
    // The nearest fit to the most common build, for the table when none of its common ones fit (and something does).
    const needNearest = !rows.some((r) => r.fits.some((f) => f > 0))
    const top = topBuild()
    let nearest: { d: number; build: Build } | null = null
    for (let gi = 0; gi < groupList.length; gi++)
      for (let ii = 0; ii < itemList.length; ii++) {
        yield
        for (const hp of hasHp ? POINT_VALUES : [0]) {
          const points = [...m.points]
          if (hasHp) points[0] = hp
          // Each group's fitting points, with their cost and distance from the most common build.
          if (hpPlans.length && !fitAt(gi, ii, points, hpPlans)) continue
          const options = comps.map((stats, ci) => {
            const list: { pts: number[]; cost: number; d: number }[] = []
            for (const pts of assignments(stats.length)) {
              for (let k = 0; k < stats.length; k++) points[stats[k]!] = pts[k]!
              if (!fitAt(gi, ii, points, compPlans[ci])) continue
              let cost = 0
              let d = 0
              for (let k = 0; k < stats.length; k++) {
                cost += pts[k]!
                d += Math.abs(pts[k]! - top.points[stats[k]!]!)
              }
              list.push({ pts: [...pts], cost, d })
            }
            return list
          })
          if (options.some((l) => !l.length)) continue
          const minCost = options.map((l) => Math.min(...l.map((x) => x.cost)))
          const spare = TOTAL_POINTS - hp - minCost.reduce((a, b) => a + b, 0)
          if (spare < 0) continue
          if (hasHp) mark(0, hp, gi)
          comps.forEach((stats, ci) =>
            options[ci]!.forEach((x) => {
              if (x.cost - minCost[ci]! <= spare) stats.forEach((s, k) => mark(s, x.pts[k]!, gi))
            }),
          )
          if (!needNearest) continue
          // The nearest within the points: each group's options by cost, the least distance for each total.
          const pen =
            (groupList[gi]!.natures.includes(top.nature ?? '') ? 0 : 100) + (ii === itemGroupOf(top.item) ? 0 : 50)
          let best = new Map<number, { d: number; picks: number[][] }>([[hasHp ? hp : 0, { d: 0, picks: [] }]])
          for (const l of options) {
            const next = new Map<number, { d: number; picks: number[][] }>()
            for (const [c, v] of best)
              for (const x of l) {
                const nc = c + x.cost
                if (nc > TOTAL_POINTS) continue
                const nd = v.d + x.d
                const was = next.get(nc)
                if (!was || nd < was.d) next.set(nc, { d: nd, picks: [...v.picks, x.pts] })
              }
            best = next
          }
          for (const v of best.values()) {
            const d = v.d + pen + (hasHp ? Math.abs(hp - top.points[0]!) : 0)
            if (nearest && d >= nearest.d) continue
            const pts = [...m.points]
            if (hasHp) pts[0] = hp
            comps.forEach((stats, ci) => stats.forEach((s, k) => (pts[s] = v.picks[ci]![k]!)))
            const g = groupList[gi]!
            const ig = itemList[ii]!
            nearest = {
              d,
              build: {
                nature: g.natures.includes(top.nature ?? '') ? top.nature : g.rep,
                points: pts,
                item: ig.items.some((x) => x.value === top.item) ? top.item : ig.rep,
              },
            }
          }
        }
      }
    const ranges: StatRange[] = S.filter((s) => lo.has(s)).map((s) => ({
      stat: s,
      from: lo.get(s)!,
      to: hi.get(s)!,
      effects: [...effects.get(s)!],
    }))

    // None of them fitting where something does, the nearest that does joins them, its item tried first.
    if (nearest && !rows.some((r) => r.fits.some((f) => f > 0))) {
      const b = nearest.build
      rows.push({ nature: b.nature, points: [...b.points] as Points, share: null, fits: rowFits(b), nearest: true })
    }
    // The items as columns, those alike in every row merged; the most run first.
    const order = columnsOf.map((_, ci) => ci).sort((x, y) => columnsOf[y]!.it.w - columnsOf[x]!.it.w)
    const columns: ReverseColumn[] = []
    const colOf: number[][] = []
    for (const ci of order) {
      const same = colOf.findIndex((cols) => rows.every((r) => r.fits[cols[0]!] === r.fits[ci]))
      if (same >= 0) {
        colOf[same]!.push(ci)
        columns[same]!.items.push(columnsOf[ci]!.it.value)
        columns[same]!.share = (columns[same]!.share ?? 0) + columnsOf[ci]!.it.w
      } else {
        colOf.push([ci])
        columns.push({ items: [columnsOf[ci]!.it.value], share: columnsOf[ci]!.it.w, inert: false })
      }
    }
    for (const r of rows) r.fits = colOf.map((cols) => r.fits[cols[0]!]!)
    const inertItem = (it: ItemId | null) =>
      itemKey(it)
        .split('|')
        .every((k) => k === '-')
    for (const c of columns) c.inert = c.items.every(inertItem)
    if (fixedItem) columns.forEach((c) => (c.share = null))
    return { stats: S, ranges, chance, rows, columns, itemsVary: !fixedItem }
  }

  /** The build the nearest is measured from: its most common spread and item, or its own set. */
  function topBuild(): Build {
    const s = [...(entry?.spreads ?? [])]
      .filter((x) => !sheet || !m.nature || x.nature === m.nature)
      .sort((x, y) => (y.share ?? 0) - (x.share ?? 0))[0]
    const it = [...itemPrior].sort((x, y) => y.w - x.w)[0]?.value ?? m.item
    return s ? { nature: s.nature, points: s.points, item: it } : { nature: m.nature, points: m.points, item: m.item }
  }

  return { total, steps: steps() }
}

/** Every assignment of points to `n` stats, each 0 to `MAX_POINTS`. */
function* assignments(n: number): Generator<number[]> {
  const pts = Array<number>(n).fill(0)
  if (!n) {
    yield pts
    return
  }
  for (;;) {
    yield pts
    let k = n - 1
    while (k >= 0 && pts[k] === MAX_POINTS) pts[k--] = 0
    if (k < 0) return
    pts[k]!++
  }
}

/** The stats in groups the hits tie together: two stats one hit hangs on are in one group. */
function components(stats: readonly number[], sets: readonly number[][]): number[][] {
  const parent = new Map(stats.map((s) => [s, s]))
  const find = (s: number): number => (parent.get(s) === s ? s : find(parent.get(s)!))
  for (const set of sets) for (const s of set.slice(1)) parent.set(find(s), find(set[0]!))
  const out = new Map<number, number[]>()
  for (const s of stats) {
    const r = find(s)
    out.set(r, [...(out.get(r) ?? []), s])
  }
  return [...out.values()]
}
