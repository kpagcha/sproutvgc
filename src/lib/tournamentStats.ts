// A tournament's numbers by day (`TournamentView`'s tabs): the whole event, Day 1, Day 2 or the top cut, each its
// players (everyone plays Day 1; Day 2's and the top cut's those who made them) and its rounds (by phase: 1 Day 1's
// Swiss, 2 Day 2's, 3 the top cut). For each Pokémon, the share of those players' teams with it and how its teams did in
// those rounds' matches (byes and matches neither won left out: they say nothing of the teams); for each player, their
// record in those rounds.

import type { PokemonId } from '@/data/dex'
import type { Round, Standing } from '@/data/tournaments'

export type Day = 'all' | 'day1' | 'day2' | 'cut'
/** The days, as their tabs go: the top cut first, back to Day 1, then the whole event. */
export const DAYS: readonly Day[] = ['cut', 'day2', 'day1', 'all']

const PHASES: Record<Day, readonly number[]> = { all: [1, 2, 3], day1: [1], day2: [2], cut: [3] }

type Placed = Standing & { placing: number }

/** The players a day is of: everyone for the whole event and Day 1, else those who made it. */
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

/** Each player's record in the day's rounds, by placing: a bye a win, a match neither won a loss for both. */
export function recordsOf(rounds: Record<number, Round>, day: Day): Map<number, { wins: number; losses: number }> {
  const records = new Map<number, { wins: number; losses: number }>()
  const add = (p: number, won: boolean) => {
    let r = records.get(p)
    if (!r) records.set(p, (r = { wins: 0, losses: 0 }))
    if (won) r.wins++
    else r.losses++
  }
  for (const r of roundsOf(rounds, day)) {
    for (const [a, b, won] of r.matches) {
      add(a, won === 1)
      if (b !== null) add(b, won === 2)
    }
  }
  return records
}
