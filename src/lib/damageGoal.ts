// The inverse damage calc with yours worked out too: what of your set (its stat points, nature and item) gets what the
// hits say (a knockout, a survival, a number) against the opponent, given what of its set is worked out, at its sets.
// Every build of yours tried (its points in the stats the hits hang on, `ours`, within the 66 a set has) against each of
// the opponent's (its spreads and items as the meta runs them, at what's given of it): a cell fits on the share of the
// hits' rolls giving what was asked for. Read for yours, each build's coverage (the share of the opponent's sets, its
// rolls counted, it fits, weighed by how often they're run), and for each of your items the fewest points reaching
// half, nine in ten and all of them; read for the opponent, each of its common builds against your sets.
//
// The damage is the calc's, never worked out by hand; but each roll only grows with the attacker's stat and only falls
// with the defender's, so between two values of yours dealing the same rolls every value does too, and isn't asked for.

import type { ItemId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import type { PokemonMeta } from '@/data/meta'
import { NATURE_IDS, natureEffectOn } from '@/data/natures'
import { itemBound, POKEMON, STATS } from '@/data/pokemon'
import { battlerOf, hit, leadOf, speedOf, type Battlefield, type Fighter } from '@/lib/damage'
import {
  dealtStats,
  defendedOf,
  fitOf,
  ITEM_MIN,
  NEUTRAL,
  POINT_VALUES,
  takenInert,
  takenStats,
  weighted,
  type Observation,
  type OpponentUnknowns,
  type ReverseResult,
  type ReverseRow,
  type Weighted,
} from '@/lib/damageReverse'
import { MAX_POINTS, statValue, TOTAL_POINTS, type NatureEffect } from '@/lib/stats'
import { stoneMega, type Points } from '@/lib/team'
import { inert } from '@/lib/threats'

/** The coverages a row of yours names the fewest points for: half the opponent's sets, nine in ten, all. */
export const THRESHOLDS = [0.5, 0.9, 1] as const
/** A coverage counted as all of them, for the sums' rounding. */
const ALL = 1 - 1e-9
/** The most of your stats the hits may hang on at once: every build of more is too many to try. */
export const MAX_OURS = 2
/** The most of the opponent's spreads tried: its most run, the rest of its sets too few to change the answer. */
const THEIR_SPREADS = 30
/** The most of the opponent's spreads its table shows. */
const TABLE_MAX = 4

export interface GoalInput {
  yours: Fighter
  theirs: Fighter
  field: Battlefield
  /** The meta's entries of the two's battlers (a stone holder's, its Mega's). */
  entryYours: PokemonMeta | undefined
  entryTheirs: PokemonMeta | undefined
  workYours: OpponentUnknowns
  workTheirs: OpponentUnknowns
  obs: readonly Observation[]
}

/** A build of yours: its nature, points and item, how much of the opponent it covers, and the points it spends in the
 * stats in play. */
export interface GoalBuild {
  nature: string | null
  points: Points
  item: ItemId | null
  coverage: number
  cost: number
}
/** One of your items (or those alike, merged): the fewest points reaching each threshold (null where none does), and
 * the most it covers, at its cheapest. */
export interface GoalRow {
  items: (ItemId | null)[]
  /** Its share of your sets, where your item is worked out and the meta has it. */
  share: number | null
  cells: (GoalBuild | null)[]
  best: GoalBuild | null
}
export interface GoalResult {
  /** Your stats the hits hang on, in `STATS` order: what a build's points are shown in. */
  ours: number[]
  rows: GoalRow[]
  /** Whether the opponent is one set (its rolls alone counted) or its sets. */
  againstSets: boolean
  /** Whether your item varies, the rows being items. */
  itemsVary: boolean
  /** The opponent's common builds against your sets, where something of it is worked out. */
  theirs: ReverseResult | null
  /** Too many of your stats in play at once (`MAX_OURS`): nothing worked out. */
  tooMany: boolean
}

type Build = { nature: string | null; points: readonly number[]; item: ItemId | null }
/** A build of the opponent's tried, with its weight among its sets. */
type Theirs = Build & { w: number; spread: number; itemIdx: number }
/** What a hit's calc gave at full HP: its rolls, and what the defender keeps of it. */
type Rolled = { rolls: readonly number[]; saved: boolean; sitrus: boolean } | null

export function goalDamage(input: GoalInput): { total: number; steps: Generator<unknown, GoalResult | null> } {
  const { field, obs, workYours, workTheirs } = input
  const none = {
    total: 0,
    steps: (function* () {
      return null
    })(),
  }
  const yours: Fighter = { ...input.yours, hp: 100, sets: false, pooled: undefined }
  const theirs: Fighter = { ...input.theirs, hp: 100, sets: false, pooled: undefined }
  const yourId = battlerOf(yours)
  const theirId = battlerOf(theirs)
  if (!yourId || !theirId || !obs.length) return none
  const my = yours.member
  const their = theirs.member
  const myBase = POKEMON[yourId].stats
  const theirBase = POKEMON[theirId].stats

  // What each hit hangs on, of yours and of theirs: the stats the calc reads (`calc`) and those what it did hangs on
  // (`used`: the defender's HP too).
  const plans = obs.map((o) => {
    if (o.by === 'speed') return { o, mine: { calc: [5], used: [5] }, theirs: { calc: [5], used: [5] } }
    if (o.by === 'a') {
      const t = takenStats(o.move, yours, field)
      const c = dealtStats(o.move, yours)
      return { o, mine: { calc: c, used: c }, theirs: t }
    }
    const c = dealtStats(o.move, theirs)
    return { o, mine: takenStats(o.move, theirs, field), theirs: { calc: c, used: c } }
  })
  const ours = [...new Set(plans.flatMap((p) => p.mine.used))].sort()
  const tooMany = workYours.points && ours.length > MAX_OURS
  if (tooMany)
    return {
      total: 0,
      steps: (function* () {
        return { ours, rows: [], againstSets: false, itemsVary: false, theirs: null, tooMany: true }
      })(),
    }

  // Yours: its natures by their effect on the stats in play (every one worked out, else its own), its points in them
  // (every number worked out, else its own), its items (worked out, those its sets run and those changing a hit's
  // damage; else its own, as one it can't be without).
  const myEffect = (n: string | null, s: number): NatureEffect => (!s || !n ? 'neutral' : natureEffectOn(n, STATS[s]!))
  const myNatures = workYours.nature ? NATURE_IDS : [my.nature ?? NEUTRAL]
  const myGroups = groupNatures(myNatures, ours, myEffect)
  const myPoints = (s: number) => (workYours.points ? POINT_VALUES : [my.points[s]!])
  const myFixed = !workYours.item || !!stoneMega(my) || itemBound(my.pokemon!)
  const myItemPrior: Weighted<ItemId | null> = myFixed
    ? [{ value: my.item, w: 1 }]
    : weighted(
        (input.entryYours?.items ?? [])
          .filter((x) => !ITEMS[x.id]?.megas)
          .map((x) => ({ value: x.id as ItemId | null, share: x.share ?? 0 })),
      )
  const myItems: (ItemId | null)[] = myFixed ? [my.item] : [null, ...myItemPrior.map((x) => x.value)]

  // Theirs: its spreads as the meta runs them (at what's given of it), its most run, and its items; or its own set.
  const theirSpreadsAll = theirSpreads(their, input.entryTheirs, workTheirs)
  const theirFixed = !workTheirs.item || !!stoneMega(their) || itemBound(their.pokemon!)
  let theirItemPrior: Weighted<ItemId | null> = theirFixed
    ? [{ value: their.item, w: 1 }]
    : weighted(
        (input.entryTheirs?.items ?? [])
          .filter((x) => !ITEMS[x.id]?.megas && (x.share ?? 0) >= ITEM_MIN)
          .map((x) => ({ value: x.id as ItemId | null, share: x.share ?? 0 })),
      )
  if (!theirItemPrior.length) theirItemPrior = [{ value: null, w: 1 }]
  const others: Theirs[] = theirSpreadsAll.flatMap((s, si) =>
    theirItemPrior.map((it, ii) => ({ ...s, item: it.value, w: s.w * it.w, spread: si, itemIdx: ii })),
  )
  const againstSets = workTheirs.nature || workTheirs.points || workTheirs.item

  // Fighters, made once each.
  const made = new Map<string, Fighter>()
  const fighter = (base: Fighter, b: Build, hp = 100): Fighter => {
    const key = `${base === yours ? 'y' : 't'}|${b.nature}|${b.points.join('.')}|${b.item}|${hp}`
    let f = made.get(key)
    if (!f)
      made.set(
        key,
        (f = {
          ...base,
          hp,
          member: { ...base.member, nature: b.nature, points: [...b.points] as Points, item: b.item },
        }),
      )
    return f
  }

  // Your items, each hit's: those dealing (or taking) the same rolls as none at your set against the opponent's most run
  // count as one with it ('-'), but for Focus Sash and a Sitrus Berry on yours when hit (what it keeps of a hit, not
  // its rolls); a Speed item in the order, as itself. The calc asked once per item and hit.
  const ref = others.reduce((x, y) => (y.w > x.w ? y : x))
  const refThem = fighter(theirs, ref)
  const rollsAt = new Map<string, string>()
  const rollsWith = (pi: number, it: ItemId | null) => {
    const key = `${pi}|${it}`
    let r = rollsAt.get(key)
    if (r === undefined) {
      const { o } = plans[pi]!
      const me = fighter(yours, { nature: my.nature, points: my.points, item: it })
      if (o.by === 'speed') r = ''
      else
        try {
          const opts = { ...o.opts, lean: true }
          const h = o.by === 'a' ? hit(me, refThem, o.move, field, opts) : hit(refThem, me, o.move, field, opts)
          r = h ? h.rolls.join() : ''
        } catch {
          r = ''
        }
      rollsAt.set(key, r)
    }
    return r
  }
  const KEPT = new Set<string>(['focussash', 'sitrusberry'])
  const itemKeyMine = (pi: number, it: ItemId | null) => {
    const { o } = plans[pi]!
    if (o.by === 'speed') return !it || ITEMS[it]?.category !== 'speed' ? '-' : it
    if (!it) return '-'
    if (o.by === 'b' && KEPT.has(it)) return it
    return rollsWith(pi, it) === rollsWith(pi, null) ? '-' : it
  }
  // Worked out, the items its sets don't run that change a hit: each tried, those changing nothing (a type's booster
  // for another type's move) left out.
  if (!myFixed)
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      const c = ITEMS[id]!.category
      if ((c !== 'offense' && c !== 'defense') || ITEMS[id]!.megas || myItems.includes(id)) continue
      if (plans.some((_, pi) => itemKeyMine(pi, id) !== '-')) myItems.push(id)
    }

  const itemKeyTheirs = (pi: number, it: ItemId | null) => {
    const { o, theirs: th } = plans[pi]!
    if (o.by === 'speed') return !it || ITEMS[it]?.category !== 'speed' ? '-' : it
    return (o.by === 'b' ? inert(it, o.move, false) : takenInert(it, o.move, th.calc)) ? '-' : (it ?? '')
  }
  // Your items alike for every hit, one.
  const myItemGroups = new Map<string, (ItemId | null)[]>()
  for (const it of myItems) {
    const key = plans.map((_, pi) => itemKeyMine(pi, it)).join('|')
    myItemGroups.set(key, [...(myItemGroups.get(key) ?? []), it])
  }
  // Each group's items the most run first (no item last), so it's shown, and used, as the one your sets run.
  const runOf = (it: ItemId | null) => (it === null ? -1 : (myItemPrior.find((x) => x.value === it)?.w ?? 0))
  const myItemList = [...myItemGroups.values()].map((g) => [...g].sort((x, y) => runOf(y) - runOf(x)))

  // Each hit's work: your calc values in order, so those between two dealing the same rolls go unasked.
  const valueOf = (base: readonly number[], s: number, p: number, e: NatureEffect) => statValue(base[s]!, p, e, !s)
  let total = 0
  for (const p of plans) total += p.mine.calc.length === 1 ? 12 : 70
  total *= myItemList.length * others.length

  const memos = new Map<string, Map<string, Rolled | number | null>>()
  const yourSpeed = new Map<string, number | null>()
  const theirSpeed = new Map<string, number | null>()

  function* steps(): Generator<unknown, GoalResult | null> {
    // fit[pi]: for each of your item groups, nature groups and points in the hit's `used` stats (mixed radix), each of
    // the opponent's builds: the share of its rolls giving what was asked for.
    const radix = MAX_POINTS + 1
    const J = others.length
    const fits: Float64Array[][][] = []
    for (let pi = 0; pi < plans.length; pi++) {
      const { o, mine, theirs: th } = plans[pi]!
      const perItem: Float64Array[][] = []
      for (let mi = 0; mi < myItemList.length; mi++) {
        const myItem = myItemList[mi]![0]!
        const perGroup: Float64Array[] = []
        for (let gi = 0; gi < myGroups.length; gi++) {
          const rep = myGroups[gi]!.rep
          const table = new Float64Array(radix ** mine.used.length * J)
          // Your values the calc reads, each with the points giving it.
          // Copied as they come: the pick yielded is one array, reused.
          const combos = Array.from(product(mine.calc.map(myPoints)), (p) => [...p]).map((pts) => ({
            pts,
            vals: mine.calc.map((s, k) => valueOf(myBase, s, pts[k]!, myEffect(rep, s))),
          }))
          for (let j = 0; j < J; j++) {
            const ob = others[j]!
            const theirB: Build = ob
            // Your values' rolls (or Speed), asked for in order, those between two alike filled in; shared by your
            // natures and their builds alike in what the hit reads.
            const memoKey = `${pi}|${itemKeyMine(pi, myItem)}|${itemKeyTheirs(pi, ob.item)}|${th.calc.map((s) => valueOf(theirBase, s, ob.points[s]!, theirEffect(ob.nature, s))).join()}`
            let memo = memos.get(memoKey)
            if (!memo) memos.set(memoKey, (memo = new Map()))
            const ask = (c: (typeof combos)[number]): Rolled | number | null => {
              const k = c.vals.join()
              if (memo.has(k)) return memo.get(k)!
              const points = [...my.points]
              mine.calc.forEach((s, i) => (points[s] = c.pts[i]!))
              // At full HP but where the hit hangs on it (what's left worked out from the rolls after).
              const me = fighter(
                yours,
                { nature: rep, points, item: myItem },
                o.by === 'b' && mine.calc.includes(0) ? hpOf(o.before, myBase, points) : 100,
              )
              let r: Rolled | number | null
              if (o.by === 'speed') {
                const sk = `${itemKeyMine(pi, myItem)}|${c.vals.join()}`
                if (!yourSpeed.has(sk)) yourSpeed.set(sk, speedOf(me, field))
                r = yourSpeed.get(sk)!
              } else {
                const them = fighter(
                  theirs,
                  theirB,
                  o.by === 'a' ? Math.min(100, Math.max(0.01, o.before ?? 100)) : 100,
                )
                try {
                  const opts = { ...o.opts, lean: true }
                  const h = o.by === 'a' ? hit(me, them, o.move, field, opts) : hit(them, me, o.move, field, opts)
                  const d = h && (o.by === 'a' ? defendedOf(h, them, me, field) : defendedOf(h, me, them, field))
                  r = h && d ? { rolls: h.rolls, saved: d.saved, sitrus: d.sitrus } : null
                } catch (e) {
                  console.error(`Goal: ${o.move} left out`, e)
                  r = null
                }
              }
              memo.set(k, r)
              return r
            }
            if (mine.calc.length === 1 && o.by !== 'speed') {
              // In order of the value: between two alike, every one alike.
              const order = [...combos].sort((x, y) => x.vals[0]! - y.vals[0]!)
              const fill = (lo: number, hi: number) => {
                const a = ask(order[lo]!)
                const b = ask(order[hi]!)
                if (hi - lo <= 1) return
                if (same(a, b)) {
                  for (let k = lo + 1; k < hi; k++) memo.set(order[k]!.vals.join(), a)
                  return
                }
                const mid = (lo + hi) >> 1
                fill(lo, mid)
                fill(mid, hi)
              }
              if (order.length) fill(0, order.length - 1)
            }
            yield
            // Its HP for what's left, from its build.
            const theirMax = valueOf(theirBase, 0, ob.points[0]!, 'neutral')
            for (const c of combos) {
              const r = ask(c)
              for (const usedPts of product(
                mine.used.map((s) => (mine.calc.includes(s) ? [c.pts[mine.calc.indexOf(s)]!] : myPoints(s))),
              )) {
                let fit: number
                if (o.by === 'speed') {
                  const tk = `${itemKeyTheirs(pi, ob.item)}|${valueOf(theirBase, 5, ob.points[5]!, theirEffect(ob.nature, 5))}`
                  if (!theirSpeed.has(tk)) theirSpeed.set(tk, speedOf(fighter(theirs, theirB), field))
                  const ys = r as number | null
                  const ts = theirSpeed.get(tk)!
                  const lead = ys === null || ts === null ? null : leadOf(ys, ts, field)
                  fit = lead === null ? 1 : lead === 'tie' ? 0.5 : (lead === 'a') === (o.first === 'a') ? 1 : 0
                } else if (!r) fit = 1
                else {
                  const rolled = r as NonNullable<Rolled>
                  let maxHp: number
                  let cur: number
                  if (o.by === 'a') {
                    maxHp = theirMax
                    cur = Math.max(1, Math.round((maxHp * Math.min(100, o.before ?? 100)) / 100))
                  } else {
                    const hpPts = mine.used.includes(0) ? usedPts[mine.used.indexOf(0)]! : my.points[0]!
                    maxHp = valueOf(myBase, 0, hpPts, 'neutral')
                    cur = Math.min(maxHp, o.before ?? maxHp)
                  }
                  fit = fitOf(rolled.rolls, o.saw, {
                    maxHp,
                    hp: cur,
                    saved: rolled.saved && cur === maxHp,
                    sitrus: rolled.sitrus,
                  })
                }
                let at = 0
                for (const p of usedPts) at = at * radix + p
                table[at * J + j] = fit
              }
            }
          }
          perGroup.push(table)
        }
        perItem.push(perGroup)
      }
      fits.push(perItem)
    }

    // A build of yours' fit against each of theirs: every hit's, multiplied.
    const fitRow = (mi: number, gi: number, points: readonly number[], out: Float64Array) => {
      out.fill(1)
      for (let pi = 0; pi < plans.length; pi++) {
        const used = plans[pi]!.mine.used
        let at = 0
        for (const s of used) at = at * radix + points[s]!
        const table = fits[pi]![mi]![gi]!
        const off = at * J
        for (let j = 0; j < J; j++) out[j] = out[j]! * table[off + j]!
      }
      return out
    }
    const row = new Float64Array(J)
    const coverageOf = (mi: number, gi: number, points: readonly number[]) => {
      fitRow(mi, gi, points, row)
      let c = 0
      for (let j = 0; j < J; j++) c += others[j]!.w * row[j]!
      return c
    }

    // Yours: per item group, every nature group and points within the 66, the fewest reaching each threshold.
    const rows: GoalRow[] = []
    for (let mi = 0; mi < myItemList.length; mi++) {
      const cells: (GoalBuild | null)[] = THRESHOLDS.map(() => null)
      let best: GoalBuild | null = null
      for (let gi = 0; gi < myGroups.length; gi++) {
        yield
        for (const pts of product(ours.map(myPoints))) {
          const cost = pts.reduce((n, p) => n + p, 0)
          if (workYours.points && cost > TOTAL_POINTS) continue
          const points = [...my.points]
          ours.forEach((s, k) => (points[s] = pts[k]!))
          const coverage = coverageOf(mi, gi, points)
          const b = (): GoalBuild => ({
            nature: pickNature(myGroups[gi]!, my.nature, input.entryYours),
            points: points as Points,
            item: myItemList[mi]![0]!,
            coverage,
            cost,
          })
          THRESHOLDS.forEach((th, k) => {
            const c = cells[k]
            if (
              (th === 1 ? coverage >= ALL : coverage >= th) &&
              (!c || cost < c.cost || (cost === c.cost && coverage > c.coverage))
            )
              cells[k] = b()
          })
          if (
            !best ||
            coverage > best.coverage + 1e-9 ||
            (Math.abs(coverage - best.coverage) <= 1e-9 && cost < best.cost)
          )
            best = b()
        }
      }
      const items = myItemList[mi]!
      const share = myFixed ? null : items.reduce((n, it) => n + (myItemPrior.find((x) => x.value === it)?.w ?? 0), 0)
      rows.push({ items, share, cells, best: best && best.coverage > 0 ? best : null })
    }
    // Those your sets run first, then by the most they cover, those covering nothing left out (no item kept).
    rows.sort((x, y) => (y.share ?? 0) - (x.share ?? 0) || (y.best?.coverage ?? 0) - (x.best?.coverage ?? 0))
    const shown = rows.filter((r, i) => r.best || i === 0 || r.items.includes(null))

    // Theirs, where something of it is worked out: its common builds against your sets (weighed by how often they're
    // run, at what's given of yours).
    let theirsResult: ReverseResult | null = null
    if (againstSets) {
      yield
      const mine = mySets(my, input.entryYours, workYours, myItemPrior)
      const share = new Float64Array(J)
      let mineTotal = 0
      for (const b of mine) {
        const mi = myItemList.findIndex((g) => g.includes(b.item))
        if (mi < 0) continue
        const gi = Math.max(
          0,
          myGroups.findIndex((g) => g.natures.includes(b.nature ?? NEUTRAL)),
        )
        fitRow(mi, gi, b.points, row)
        mineTotal += b.w
        for (let j = 0; j < J; j++) share[j] = share[j]! + b.w * row[j]!
      }
      if (mineTotal) for (let j = 0; j < J; j++) share[j] = share[j]! / mineTotal
      const spreadsShown = theirSpreadsAll.map((s, si) => ({ s, si })).slice(0, TABLE_MAX)
      const rowsTheirs: ReverseRow[] = spreadsShown.map(({ s, si }) => ({
        nature: s.nature,
        points: [...s.points] as Points,
        share: againstSets && (workTheirs.points || workTheirs.nature) ? s.w : null,
        fits: theirItemPrior.map((_, ii) => share[others.findIndex((x) => x.spread === si && x.itemIdx === ii)]!),
      }))
      const statsTheirs = [...new Set(plans.flatMap((p) => p.theirs.used))].sort()
      const chance = others.reduce((n, x, j) => n + x.w * share[j]!, 0)
      theirsResult = {
        stats: statsTheirs,
        ranges: [],
        possible: chance > 0,
        chance: mineTotal ? chance : null,
        rows: rowsTheirs,
        columns: theirItemPrior.map((x) => ({ items: [x.value], share: theirFixed ? null : x.w })),
        itemsVary: !theirFixed,
      }
    }
    return { ours, rows: shown, againstSets, itemsVary: !myFixed, theirs: theirsResult, tooMany: false }
  }

  function theirEffect(n: string | null, s: number): NatureEffect {
    return !s || !n ? 'neutral' : natureEffectOn(n, STATS[s]!)
  }

  return { total: Math.max(1, total), steps: steps() }
}

/** Natures grouped by what they do to the stats in play, a representative each. */
function groupNatures(
  natures: readonly string[],
  stats: readonly number[],
  effect: (n: string, s: number) => NatureEffect,
) {
  const groups = new Map<string, { rep: string; natures: string[] }>()
  for (const n of natures) {
    const key = stats.map((s) => effect(n, s)).join()
    const g = groups.get(key)
    if (g) g.natures.push(n)
    else groups.set(key, { rep: n, natures: [n] })
  }
  return [...groups.values()]
}

/** A nature of a group to set: the one it had, else the one its sets run most, else its representative. */
function pickNature(g: { rep: string; natures: string[] }, had: string | null, entry: PokemonMeta | undefined) {
  if (had && g.natures.includes(had)) return had
  const run = [...(entry?.natures ?? [])]
    .sort((x, y) => (y.share ?? 0) - (x.share ?? 0))
    .find((x) => g.natures.includes(x.id))
  return run?.id ?? g.rep
}

/** Your HP in percent before a hit, from your HP seen (in HP) and your HP points. */
function hpOf(before: number | undefined, base: readonly number[], points: readonly number[]) {
  if (before === undefined) return 100
  const max = statValue(base[0]!, points[0]!, 'neutral', true)
  return Math.min(100, Math.max(0.01, (before / max) * 100))
}

/** The opponent's spreads tried: its sets' (their nature as given, if it is; their points as given, if they are),
 * merged where alike, its most run; with none, its own set. */
function theirSpreads(m: Fighter['member'], entry: PokemonMeta | undefined, work: OpponentUnknowns) {
  const list = (entry?.spreads ?? [])
    .filter((s) => work.nature || !m.nature || s.nature === m.nature)
    .map((s) => ({
      nature: work.nature ? s.nature : m.nature,
      points: work.points ? s.points : m.points,
      share: s.share ?? 0,
    }))
  const merged = new Map<string, { nature: string | null; points: readonly number[]; share: number }>()
  for (const s of list) {
    const key = `${s.nature}|${s.points.join('.')}`
    const was = merged.get(key)
    if (was) was.share += s.share
    else merged.set(key, { ...s })
  }
  const top = [...merged.values()].sort((x, y) => y.share - x.share).slice(0, THEIR_SPREADS)
  const w = weighted(top.map((s) => ({ value: s, share: s.share })))
  return w.length
    ? w.map((x) => ({ nature: x.value.nature, points: x.value.points, w: x.w }))
    : [{ nature: m.nature, points: m.points, w: 1 }]
}

/** Your sets as the meta runs them, at what's given of yours: to read the opponent's builds against. */
function mySets(
  m: Fighter['member'],
  entry: PokemonMeta | undefined,
  work: OpponentUnknowns,
  items: Weighted<ItemId | null>,
) {
  const spreads = (entry?.spreads ?? [])
    .filter((s) => work.nature || !m.nature || s.nature === m.nature)
    .map((s) => ({
      nature: work.nature ? s.nature : m.nature,
      points: work.points ? s.points : m.points,
      share: s.share ?? 0,
    }))
  const ws = weighted(spreads.map((s) => ({ value: s, share: s.share })))
  const base = ws.length ? ws : [{ value: { nature: m.nature, points: m.points, share: 1 }, w: 1 }]
  return base.flatMap((s) =>
    items.map((it) => ({ nature: s.value.nature, points: s.value.points, item: it.value, w: s.w * it.w })),
  )
}

/** Whether two of the calc's answers are alike. */
function same(a: Rolled | number | null, b: Rolled | number | null) {
  if (a === b) return true
  if (!a || !b || typeof a === 'number' || typeof b === 'number') return false
  if (a.saved !== b.saved || a.sitrus !== b.sitrus || a.rolls.length !== b.rolls.length) return false
  for (let i = 0; i < a.rolls.length; i++) if (a.rolls[i] !== b.rolls[i]) return false
  return true
}

/** Every pick of one from each list; the array yielded is reused, so copied to be kept. */
function* product(lists: readonly (readonly number[])[]): Generator<number[]> {
  const n = lists.length
  const at = Array<number>(n).fill(0)
  const pts = lists.map((l) => l[0]!)
  if (!n) {
    yield pts
    return
  }
  for (;;) {
    yield pts
    let k = n - 1
    while (k >= 0 && at[k] === lists[k]!.length - 1) {
      at[k] = 0
      pts[k] = lists[k]![0]!
      k--
    }
    if (k < 0) return
    pts[k] = lists[k]![++at[k]!]!
  }
}
