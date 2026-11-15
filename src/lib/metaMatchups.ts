// Your Pokémon against the meta, one matchup a row: your moves on each of its most used Pokémon (at its most common
// set), its hardest hits on yours, who moves first, and the two trading their hardest hits one on one (`duelOf`). From
// those, how much of a threat it is to yours (`threatOf`): 0 it's a target, yours knocking it out well before it does
// yours; 1 it's a threat, the other way round; a half even. Weighted by how much it's used, the danger it is
// (`dangerOf`), the meter the list can be sorted by.
import type { MetaData } from '@/data/meta'
import type { PokemonId } from '@/data/dex'
import {
  abilityOf,
  bestHit,
  damaging,
  duelOf,
  hit,
  metaFoes,
  SETS_FIELD,
  speedOf,
  type Battlefield,
  type Fighter,
  type Hit,
  type OneOnOne,
} from '@/lib/damage'

export interface Matchup {
  id: PokemonId
  usage: number
  set: Fighter
  /** Each of your damaging moves on it, in your set's order. */
  hits: (Hit | null)[]
  /** Your hardest hit on it, and its two hardest on yours. */
  mine: Hit | null
  theirs: Hit | null
  next: Hit | null
  /** The two trading their hardest hits one on one, yours as `a`. */
  duel: OneOnOne | null
  /** How much of a threat it is to yours, 0 (a target) to 1 (threat). */
  threat: number
}

/** The most hits counted, a hit too weak for the calc to count them taken as this many at most. */
const MOST_HITS = 20

/** How many of a hit it takes to knock out, counting its chance: a sure 2HKO 2, a 2HKO half the time 2.5; one the calc
 * gives no count for, by its average damage; never, `Infinity`. */
export function hitsOf(h: Hit | null | undefined): number {
  if (!h || h.none) return Infinity
  if (h.koHits) return h.koHits + (1 - h.koChance)
  const avg = (h.minPct + h.maxPct) / 2
  return avg > 0 ? Math.min(MOST_HITS, Math.max(1, (h.hp / h.maxHp) * (100 / avg))) : Infinity
}

/** How steep the threat is around an even matchup: half a turn ahead is about a ninth, a turn ahead nearly nothing. */
const STEEP = 4

/** How much of a threat the other side (`b`) is to yours (`a`) one on one, 0 to 1: the turns each takes to knock the
 * other out, the one moving first half a turn ahead (a quarter on a Speed tie), set against each other. Neither
 * hurting the other is even. */
export function threatOf(duel: OneOnOne | null): number {
  if (!duel) return 0.5
  const lead = (k: 'a' | 'b') => (duel.first === k ? 0.5 : duel.first === 'tie' ? 0.25 : 0)
  const yours = hitsOf(duel.a) - lead('a')
  const theirs = hitsOf(duel.b) - lead('b')
  if (yours === Infinity && theirs === Infinity) return 0.5
  if (yours === Infinity) return 1
  if (theirs === Infinity) return 0
  return 1 / (1 + Math.exp(STEEP * (theirs - yours)))
}

/** A threat in words: a target (yours surely ahead), a likely target, even, a likely threat, a threat (it surely ahead). */
export type Lean = 'target' | 'targetLikely' | 'even' | 'threatLikely' | 'threat'
export function leanOf(threat: number): Lean {
  if (threat < 0.15) return 'target'
  if (threat < 0.45) return 'targetLikely'
  if (threat <= 0.55) return 'even'
  return threat <= 0.85 ? 'threatLikely' : 'threat'
}

/** The danger a matchup is to yours, its threat by how much it's used (each one's usage, the share of teams with it). */
export const dangerOf = (m: Pick<Matchup, 'threat' | 'usage'>) => m.threat * m.usage

/** The field as one of them comes in: its weather or terrain, if its ability sets one, over the calculator's. */
export function fieldWith(field: Battlefield, f: Fighter): Battlefield {
  const a = abilityOf(f)
  return { ...field, ...(a && SETS_FIELD[a]) }
}

/** Every matchup of yours against the meta's `top` most used, one a step (for `runSliced`), returning them all. */
export function* matchupSteps(
  yours: Fighter,
  data: MetaData | null | undefined,
  top: number,
  field: Battlefield,
): Generator<unknown, Matchup[]> {
  const out: Matchup[] = []
  const moves = yours.member.moves.filter(damaging)
  for (const f of metaFoes(data, top)) {
    const on = fieldWith(field, f.set)
    const hits = moves.map((mv) => hit(yours, f.set, mv, on))
    const theirsAll = f.set.member.moves
      .filter(damaging)
      .map((mv) => hit(f.set, yours, mv, on))
      .filter((h): h is Hit => !!h && !h.none)
    const theirs = bestHit(theirsAll)
    const next = bestHit(theirsAll.filter((h) => h !== theirs))
    const mine = bestHit(hits)
    const sa = speedOf(yours, on)
    const sb = speedOf(f.set, on)
    const duel = sa === null || sb === null ? null : duelOf(yours, f.set, on, mine, theirs, sa, sb)
    out.push({ ...f, hits, mine, theirs, next, duel, threat: threatOf(duel) })
    yield
  }
  return out
}

/** Out of matchups, by usage, the share for which `pass` holds (a share of it, for a chance). */
export function shareOf(rows: readonly Matchup[], pass: (m: Matchup) => number): number {
  let all = 0
  let got = 0
  for (const m of rows) {
    all += m.usage
    got += pass(m) * m.usage
  }
  return all ? got / all : 0
}

/** Whether a hit surely or possibly knocks out in `n` hits or fewer, as a share: 1 surely, its chance, else 0. */
export const within = (h: Hit | null | undefined, n: number) =>
  !h || h.none || !h.koHits ? 0 : h.koHits < n ? 1 : h.koHits === n ? h.koChance : 0
