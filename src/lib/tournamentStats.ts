// A tournament's Pokémon by day (`TournamentView`'s Pokémon tab): the whole event, Day 2 or the top cut, each its
// players (everyone for the whole event; Day 2's and the top cut's those who made them) and its rounds (by phase: 1
// Day 1's Swiss, 2 Day 2's, 3 the top cut). For each Pokémon, the share of those players' teams with it and how its
// teams did in those rounds' matches (byes and matches neither won left out: they say nothing of the teams).

import type { PokemonId } from '@/data/dex'
import type { Round, Standing } from '@/data/tournaments'

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
}

/** Each Pokémon on the day's players' teams, the most used first. */
export function pokemonStats(standings: readonly Placed[], rounds: Record<number, Round>, day: Day): PokemonStat[] {
  const players = playersOf(standings, day)
  const team = new Map(players.map((s) => [s.placing, new Set(s.team.map(([p]) => p))]))
  const stats = new Map<PokemonId, PokemonStat>()
  const stat = (id: PokemonId) => {
    let s = stats.get(id)
    if (!s) stats.set(id, (s = { id, teams: 0, usage: 0, wins: 0, losses: 0, winRate: null }))
    return s
  }
  for (const mons of team.values()) for (const id of mons) stat(id).teams++
  for (const r of roundsOf(rounds, day)) {
    for (const [a, b, won] of r.matches) {
      if (b === null || won === 0) continue
      for (const id of team.get(won === 1 ? a : b) ?? []) stat(id).wins++
      for (const id of team.get(won === 1 ? b : a) ?? []) stat(id).losses++
    }
  }
  const total = [...team.values()].filter((m) => m.size).length || 1
  return [...stats.values()]
    .map((s) => ({
      ...s,
      usage: s.teams / total,
      winRate: s.wins + s.losses ? s.wins / (s.wins + s.losses) : null,
    }))
    .sort((x, y) => y.teams - x.teams || x.id.localeCompare(y.id))
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
      return [{ round, phase: r.phase, opponent, result, ...(r.phase === 3 && { left: last - round }) }]
    })
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
