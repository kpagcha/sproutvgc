// The official tournaments' players across every event generated (`generated/tournaments/players.json`, written by
// `scripts/tournamentPlayers.ts`): each one by a slug of their name, with their name and country as their latest event
// has them and their events, the latest first: placing, record, how far they made it and their six's Pokémon. Events
// under way aren't in it, as nothing that adds events up counts them until they're generated for good.

import { shallowReactive } from 'vue'
import type { PokemonId } from '@/data/dex'
import { EVENTS, type TournamentEvent } from '@/data/tournaments'

type Row = [name: string, country: string, events: [number, number, number, number, 0 | 1 | 2, PokemonId[]][]]

/** How far a player made it at an event. */
export type Stage = 'day1' | 'day2' | 'topCut'
const STAGES: readonly Stage[] = ['day1', 'day2', 'topCut']

/** A player's run at one event. */
export interface PlayerRun {
  event: TournamentEvent
  placing: number
  wins: number
  losses: number
  stage: Stage
  team: PokemonId[]
}

/** A player across the events, with their numbers added up. */
export interface TournamentPlayer {
  slug: string
  name: string
  country: string
  /** Their events, the latest first. */
  runs: PlayerRun[]
  wins: number
  losses: number
  day2s: number
  topCuts: number
  /** Their best placing, and where (the latest of those at it). */
  best: PlayerRun
}

const BY_N = new Map(EVENTS.map((e) => [e.n, e]))

function playerOf(slug: string, [name, country, events]: Row): TournamentPlayer | undefined {
  const runs = events.flatMap(([n, placing, wins, losses, stage, team]): PlayerRun[] => {
    const event = BY_N.get(n)
    return event ? [{ event, placing, wins, losses, stage: STAGES[stage]!, team }] : []
  })
  if (!runs.length) return undefined
  const sum = (f: (r: PlayerRun) => number) => runs.reduce((n, r) => n + f(r), 0)
  return {
    slug,
    name,
    country,
    runs,
    wins: sum((r) => r.wins),
    losses: sum((r) => r.losses),
    day2s: sum((r) => (r.stage !== 'day1' ? 1 : 0)),
    topCuts: sum((r) => (r.stage === 'topCut' ? 1 : 0)),
    best: runs.reduce((b, r) => (r.placing < b.placing ? r : b)),
  }
}

const FILE = import.meta.glob<Record<string, Row>>('./generated/tournaments/players.json', { import: 'default' })

/** Every player, by slug, loaded once; and, once in, for what's named after one (a player's page's title). */
export const loadedPlayers = shallowReactive(new Map<string, TournamentPlayer>())
let players: Promise<Map<string, TournamentPlayer>> | undefined
export function loadPlayers(): Promise<Map<string, TournamentPlayer>> {
  return (players ??= (Object.values(FILE)[0]?.() ?? Promise.resolve<Record<string, Row>>({})).then((rows) => {
    for (const [slug, row] of Object.entries(rows)) {
      const p = playerOf(slug, row)
      if (p) loadedPlayers.set(slug, p)
    }
    return loadedPlayers
  }))
}

/** A player's key: their name, its case and spacing aside, and their country, as the generator tells players apart. */
const keyOf = (name: string, country: string) => `${name.trim().replace(/\s+/g, ' ').toLowerCase()}\u0000${country}`
const SLUGS = new Map<string, string>()
/** A player's slug by their name and country, as an event's standings have them, once the players are in. */
export function slugOfPlayer(name: string, country: string): string | undefined {
  if (!SLUGS.size) for (const p of loadedPlayers.values()) SLUGS.set(keyOf(p.name, p.country), p.slug)
  return SLUGS.get(keyOf(name, country))
}
