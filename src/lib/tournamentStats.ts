// A tournament's Pokémon by day (`TournamentView`'s Pokémon tab): the whole event, Day 2 or the top cut, each its
// players (everyone for the whole event; Day 2's and the top cut's those who made them) and its rounds (by phase: 1
// Day 1's Swiss, 2 Day 2's, 3 the top cut). For each Pokémon, the share of those players' teams with it and how its
// teams did in those rounds' matches (byes and matches neither won left out: they say nothing of the teams).

import type { PokemonId } from '@/data/dex'
import type { EventUsage, Round, Slot, Standing } from '@/data/tournaments'

export type Day = 'all' | 'day2' | 'cut'
/** The days, as their choice goes: the whole event, the default, then Day 2 and the top cut. */
export const DAYS: readonly Day[] = ['all', 'day2', 'cut']

const PHASES: Record<Day, readonly number[]> = { all: [1, 2, 3], day2: [2], cut: [3] }

type Placed = Standing & { placing: number }

/** The players a day is of: everyone for the whole event, else those who made it. */
export const playersOf = (standings: readonly Placed[], day: Day): Placed[] =>
  day === 'day2' ? standings.filter((s) => s.day2) : day === 'cut' ? standings.filter((s) => s.topCut) : [...standings]

/** The day's rounds. */
const roundsOf = (rounds: Record<number, Round>, day: Day) =>
  Object.values(rounds).filter((r) => PHASES[day].includes(r.phase))

export interface PokemonStat {
  id: PokemonId
  /** The day's teams with it, and their share of the day's teams. */
  teams: number
  usage: number
  /** Its teams' matches that day, won and lost; their win rate, none without any. */
  wins: number
  losses: number
  winRate: number | null
  /** The best placing of the day's teams with it. */
  best: number
}

/** Each Pokémon on the day's players' teams, the most used first; with `keep`, only its sets that pass it count (a
 * build's), its share still of every team. */
export function pokemonStats(
  standings: readonly Placed[],
  rounds: Record<number, Round>,
  day: Day,
  keep?: (slot: Slot) => boolean,
): PokemonStat[] {
  const players = playersOf(standings, day)
  const total = players.filter((s) => s.team.length).length || 1
  const team = new Map(players.map((s) => [s.placing, new Set(s.team.filter((x) => !keep || keep(x)).map(([p]) => p))]))
  const stats = new Map<PokemonId, PokemonStat>()
  const stat = (id: PokemonId) => {
    let s = stats.get(id)
    if (!s) stats.set(id, (s = { id, teams: 0, usage: 0, wins: 0, losses: 0, winRate: null, best: Infinity }))
    return s
  }
  for (const [placing, mons] of team) {
    for (const id of mons) {
      const s = stat(id)
      s.teams++
      s.best = Math.min(s.best, placing)
    }
  }
  for (const r of roundsOf(rounds, day)) {
    for (const [a, b, won] of r.matches) {
      if (b === null || won === 0) continue
      for (const id of team.get(won === 1 ? a : b) ?? []) stat(id).wins++
      for (const id of team.get(won === 1 ? b : a) ?? []) stat(id).losses++
    }
  }
  return [...stats.values()]
    .map((s) => ({
      ...s,
      usage: s.teams / total,
      winRate: s.wins + s.losses ? s.wins / (s.wins + s.losses) : null,
    }))
    .sort((x, y) => y.teams - x.teams || x.id.localeCompare(y.id))
}

/** Where a day's numbers are in an event's `EventUsage`. */
const SLOT: Record<Day, 0 | 1 | 2> = { all: 0, day2: 1, cut: 2 }

/** Each Pokémon's share of the day's teams over some events, pooled (each team counting once, so a bigger event counts
 * more), and how many teams that is. */
export function pooledUsage(
  usage: Record<string, EventUsage>,
  events: readonly string[],
  day: Day,
): { teams: number; share: Map<PokemonId, number> } {
  const i = SLOT[day]
  let teams = 0
  const counts = new Map<PokemonId, number>()
  for (const e of events) {
    const u = usage[e]
    if (!u) continue
    teams += u.teams[i]
    for (const [id, n] of Object.entries(u.pokemon) as [PokemonId, number[]][])
      if (n[i]) counts.set(id, (counts.get(id) ?? 0) + n[i]!)
  }
  return { teams, share: new Map([...counts].map(([id, n]) => [id, n / (teams || 1)])) }
}

/** The Pokémon that made the top cut at some events: on a team there. */
export const cutAt = (usage: Record<string, EventUsage>, events: readonly string[]): Set<PokemonId> =>
  new Set(
    events.flatMap((e) =>
      (Object.entries(usage[e]?.pokemon ?? {}) as [PokemonId, number[]][]).filter(([, n]) => n[2]).map(([id]) => id),
    ),
  )

/** Off the meta: outside the ladder's top `OFF_META_RANK` (or not on it), and on under `NICHE_USAGE` of the event's
 * teams, so one the event took up (a ladder's #45 on 14% of its teams) isn't. */
export const OFF_META_RANK = 40
export const NICHE_USAGE = 0.05
/** The fewest teams with it for its Day 2 rate to be gone by, and how sure it must be to be over the field's: its lower
 * bound at 95% (Wilson's, one-sided), so 1 of 1 or 2 of 3 doesn't count. */
const MIN_TEAMS = 5
const Z = 1.645
const lowerBound = (k: number, n: number) => {
  const p = k / n
  const z2 = Z * Z
  return (p + z2 / (2 * n) - Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n)
}

export interface Standout {
  id: PokemonId
  /** Its share of the whole field's teams, and their number. */
  usage: number
  teams: number
  /** Its rank on the ladder, none when it isn't there. */
  ladder: number | null
  /** Its best placing, and whether that made the top cut. */
  best: number
  cut: boolean
  /** Its teams that made Day 2, and that share's lower bound when it's surely over the field's. */
  day2: number
  sure?: number
  /** Its first top cut of the regulation: none at the events before it (when there were some). */
  firstCut: boolean
}

/** The Pokémon off the meta that shone at an event: those that made its top cut, by their best placing, then those whose
 * teams surely made Day 2 more often than the field's did, the surest first. */
export function standouts(
  standings: readonly Placed[],
  ladder: Partial<Record<PokemonId, number>>,
  cutBefore: ReadonlySet<PokemonId> | null,
): Standout[] {
  const field = standings.filter((s) => s.team.length)
  const fieldRate = field.filter((s) => s.day2).length / (field.length || 1)
  const byMon = new Map<PokemonId, Placed[]>()
  for (const s of field) for (const id of new Set(s.team.map(([p]) => p))) byMon.set(id, [...(byMon.get(id) ?? []), s])
  const found: Standout[] = []
  for (const [id, teams] of byMon) {
    const usage = teams.length / field.length
    const rank = ladder[id] ?? null
    if ((rank !== null && rank <= OFF_META_RANK) || usage >= NICHE_USAGE) continue
    const best = teams[0]!
    const day2 = teams.filter((s) => s.day2).length
    const low = teams.length >= MIN_TEAMS ? lowerBound(day2, teams.length) : 0
    if (!best.topCut && low <= fieldRate) continue
    found.push({
      id,
      usage,
      teams: teams.length,
      ladder: rank,
      best: best.placing,
      cut: !!best.topCut,
      day2,
      ...(low > fieldRate && { sure: low }),
      firstCut: !!best.topCut && !!cutBefore && !cutBefore.has(id),
    })
  }
  return found.sort((a, b) =>
    a.cut !== b.cut ? (a.cut ? -1 : 1) : a.cut ? a.best - b.best : (b.sure ?? 0) - (a.sure ?? 0),
  )
}

/** The day's matches with a winner, those its win rates come from. */
export const decidedMatches = (rounds: Record<number, Round>, day: Day) =>
  roundsOf(rounds, day).reduce((n, r) => n + r.matches.filter(([, b, won]) => b !== null && won !== 0).length, 0)

/** The fewest matches a win rate is worth going by, per day: Pokémon with fewer go after the rest when sorted by win
 * rate, by usage, whichever way the win rates run, so a 2–0 doesn't top the list, and don't set the chart's reach. Less for
 * the smaller days: the top cut's most played Pokémon often have under 20. */
export const MIN_MATCHES: Record<Day, number> = { all: 20, day2: 10, cut: 5 }

/** How many times the day's minimum of matches a win rate's mark is solid from. */
const SOLID_AT = 5
/** How solid a win rate's mark is, 0 to 1, by the matches behind it: faint at the day's minimum and under, solid from
 * `SOLID_AT` times it, on a log scale between (20 matches to 40 counting as much as 40 to 80). */
export function strength(s: PokemonStat, day: Day): number {
  const min = MIN_MATCHES[day]
  const f = Math.log((s.wins + s.losses) / min) / Math.log(SOLID_AT)
  return Math.min(Math.max(f, 0), 1)
}

/** How far from even the win-rate chart reaches at least, so a day whose Pokémon all sit close to it isn't blown up. */
const MIN_REACH = 0.1
/** The chart's win rates' marks, a step apart, its reach a whole number of them. */
export const WR_STEP = 0.05
/** How far from even the win-rate chart reaches, both ways: the farthest win rate of those with the day's minimum of
 * matches (all of them, if none has), to the next step. One with fewer that's farther is pinned to its edge, so a 2–0
 * doesn't stretch the chart and squash the rest around even. */
export function chartReach(stats: readonly PokemonStat[], day: Day): number {
  const sure = stats.filter((s) => s.wins + s.losses >= MIN_MATCHES[day])
  const far = Math.max(MIN_REACH, ...(sure.length ? sure : stats).map((s) => Math.abs((s.winRate ?? 0.5) - 0.5)))
  return Math.ceil(far / WR_STEP - 1e-9) * WR_STEP
}
/** Whether a win rate is past the chart's reach, pinned to its edge. */
export const pinned = (s: PokemonStat, reach: number) => Math.abs((s.winRate ?? 0.5) - 0.5) > reach + 1e-9

/** How a player's match went: won, lost, neither (a tie, or both given a loss), or a bye, a round won with no one to
 * play. */
export type Result = 'win' | 'loss' | 'tie' | 'bye'

export interface PlayerMatch {
  round: number
  phase: number
  /** Their opponent by placing; none for a bye, or an opponent since disqualified (out of the standings). */
  opponent: number | null
  result: Result
  /** In the top cut, how many rounds were left after it: 0 the final, 1 the semifinals, 2 the quarterfinals… */
  left?: number
  /** The match as the Rounds tab knows it, its two players' placings as paired (`?match=`). */
  key: string
}

/** A player's matches, round by round, the first first. */
export function playerMatches(rounds: Record<number, Round>, placing: number): PlayerMatch[] {
  const cut = Object.entries(rounds)
    .filter(([, r]) => r.phase === 3)
    .map(([n]) => Number(n))
  const last = Math.max(...cut)
  return Object.entries(rounds)
    .map(([n, r]) => ({ round: Number(n), r }))
    .sort((x, y) => x.round - y.round)
    .flatMap(({ round, r }) => {
      const m = r.matches.find(([a, b]) => a === placing || b === placing)
      if (!m) return []
      const [a, b, won] = m
      const first = a === placing
      const opponent = first ? b : a
      const result: Result =
        opponent === null && won === 1 ? 'bye' : won === 0 ? 'tie' : (won === 1) === first ? 'win' : 'loss'
      return [
        { round, phase: r.phase, opponent, result, key: `${a}-${b}`, ...(r.phase === 3 && { left: last - round }) },
      ]
    })
}

/** The Swiss' two cuts: to Day 2, after Day 1's rounds, and to the top cut, after Day 2's. */
export type Cut = 'day2' | 'topCut'
/** A match that settled a cut for a player: the win that clinched it, or the loss that put it out of reach. */
export interface CutMark {
  cut: Cut
  mark: 'clinched' | 'out'
}

/** The matches that settled a player's cuts, by round: the first after which they'd finish above everyone who missed it
 * even losing the rest, or below everyone who made it even winning the rest (3 points a win or a bye, 1 a match neither
 * won, a round not played none). What the event's standings say each cut ended up taking, not its rules: Day 2's is a
 * line of points, so it's the rule's; the top cut's is by placing, those on its last record split by tiebreakers. Day 2
 * a player made, its top cut too; one who missed it, Day 2's alone. */
export function cutMarks(rounds: Record<number, Round>, standings: readonly Placed[], placing: number) {
  const marks = new Map<number, CutMark[]>()
  const set = (round: number, mark: CutMark) => marks.set(round, [...(marks.get(round) ?? []), mark])
  const me = standings.find((s) => s.placing === placing)
  if (!me) return marks
  const numbered = Object.entries(rounds)
    .map(([n, r]) => ({ round: Number(n), r }))
    .sort((x, y) => x.round - y.round)
  const cuts = [
    { cut: 'day2' as const, phases: [1], made: (s: Placed) => !!s.day2, among: () => true },
    { cut: 'topCut' as const, phases: [1, 2], made: (s: Placed) => !!s.topCut, among: (s: Placed) => !!s.day2 },
  ]
  for (const { cut, phases, made, among } of cuts) {
    if (!among(me)) continue
    const stage = numbered.filter(({ r }) => phases.includes(r.phase))
    // Each player's points over the stage, and the rounds they have a match in, for the least it took and the most that
    // wasn't enough: only of those with a match in every round up to their last, as a round the data has none of theirs
    // in (a hole in it: they played on) could have been a win.
    const points = new Map<number, number>()
    const played = new Map<number, number[]>()
    const add = (p: number, n: number, i: number) => {
      points.set(p, (points.get(p) ?? 0) + n)
      played.set(p, [...(played.get(p) ?? []), i])
    }
    for (const [i, { r }] of stage.entries())
      for (const [a, b, won] of r.matches) {
        add(a, won === 0 ? 1 : won === 1 ? 3 : 0, i)
        if (b !== null) add(b, won === 0 ? 1 : won === 2 ? 3 : 0, i)
      }
    const whole = (s: Placed) => {
      const rs = played.get(s.placing) ?? []
      return rs.length > 0 && rs.length === rs[rs.length - 1]! + 1
    }
    const field = standings.filter((s) => among(s) && whole(s))
    const inPoints = field.filter(made).map((s) => points.get(s.placing)!)
    if (!inPoints.length) continue
    const least = Math.min(...inPoints)
    // Those who dropped left out: they didn't miss it on their record.
    const most = Math.max(-Infinity, ...field.filter((s) => !made(s) && !s.dropped).map((s) => points.get(s.placing)!))
    let mine = 0
    let holes = 0
    for (const [i, { round, r }] of stage.entries()) {
      const m = r.matches.find(([a, b]) => a === placing || b === placing)
      if (!m) {
        holes++
        continue
      }
      const [a, , won] = m
      mine += won === 0 ? 1 : (won === 1) === (a === placing) ? 3 : 0
      const left = stage.length - 1 - i
      if (made(me) && mine > most) {
        set(round, { cut, mark: 'clinched' })
        break
      }
      if (!made(me) && mine + 3 * (left + holes) < least) {
        set(round, { cut, mark: 'out' })
        break
      }
    }
  }
  return marks
}

/** The top 8's placings as medals (`main.css`'s `.medal`): gold, silver, bronze for the semifinals, and a plain one for
 * the quarterfinals. */
export const medalOf = (placing: number) =>
  placing === 1
    ? 'medal gold'
    : placing === 2
      ? 'medal silver'
      : placing <= 4
        ? 'medal bronze'
        : placing <= 8
          ? 'medal'
          : ''

/** The top cut as a bracket: its rounds, the first first, each with how many were left after it, as `PlayerMatch`'s
 * `left`, and its matches ordered so that each two side by side lead to the next round's match at their place (worked
 * back from the final, each match's players found in the round before). */
export function bracketOf(rounds: Record<number, Round>): { round: number; left: number; matches: Round['matches'] }[] {
  const cut = Object.entries(rounds)
    .filter(([, r]) => r.phase === 3)
    .map(([n, r]) => ({ round: Number(n), matches: r.matches }))
    .sort((a, b) => a.round - b.round)
  for (let i = cut.length - 2; i >= 0; i--) {
    const next = cut[i + 1]!.matches
    const left = new Set(cut[i]!.matches)
    const ordered: Round['matches'] = []
    for (const [a, b] of next)
      for (const p of [a, b]) {
        const m = [...left].find(([x, y]) => p !== null && (x === p || y === p))
        if (m) {
          ordered.push(m)
          left.delete(m)
        }
      }
    cut[i]!.matches = [...ordered, ...left]
  }
  const last = cut.length - 1
  return cut.map((r, i) => ({ ...r, left: last - i }))
}

/** Each player's record going into a round: their wins, losses and matches neither won in the rounds before it (a bye
 * a win, as the standings count it). */
export function recordsBefore(rounds: Record<number, Round>, round: number): Map<number, [number, number, number]> {
  const records = new Map<number, [number, number, number]>()
  const add = (p: number, i: 0 | 1 | 2) => {
    const r = records.get(p) ?? [0, 0, 0]
    r[i]++
    records.set(p, r)
  }
  for (const [n, r] of Object.entries(rounds)) {
    if (Number(n) >= round) continue
    for (const [a, b, won] of r.matches) {
      if (won === 0) {
        add(a, 2)
        if (b !== null) add(b, 2)
      } else {
        add(a, won === 1 ? 0 : 1)
        if (b !== null) add(b, won === 2 ? 0 : 1)
      }
    }
  }
  return records
}
