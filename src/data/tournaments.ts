// Tournaments, as the meta's data (`meta.ts`): each event's teams, generated from Limitless VGC (`scripts/limitlessVgc.ts`)
// into `generated/tournaments/` (`index.json` the events, `<id>.json` each one's standings), and added up here for
// whichever events are picked, into the shape every page reads (`MetaData`). They aren't snapshots generated whole as
// Smogon's are: any set of a regulation's events can be picked, so each set is a snapshot made on demand, its ID naming
// them (`tournaments-mc` every one of the regulation's, `tournaments-mc~445.446` those two). Only each event's Day 2
// players are there (those whose teams Limitless VGC publishes: its subset, `players`), and their sets have no stat
// points: no spreads nor Speeds.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import type { MetaData, MetaSnapshot, PokemonMeta, Share } from '@/data/meta'

/** What kind of event: Limitless VGC's types. */
export type EventType =
  'regional' | 'international' | 'worlds' | 'special' | 'national' | 'playersCup' | 'masterBallLeague'

/** What kind of tournament, a dataset each: official ones for now; online ones may follow. */
export type TournamentCategory = 'official'

export interface TournamentEvent {
  /** Its name as a slug, with its year: its page's address (`regional-nice-2026`). */
  id: string
  /** Its number on Limitless VGC, short, for the IDs of several events picked together. */
  n: number
  name: string
  /** The day it started, as an ISO date. */
  date: string
  country: string
  /** Every player, whether or not their team is listed. */
  players: number
  type: EventType
  category: TournamentCategory
  regulation: string
  provider: { name: string; url: string }
  url: string
  /** The players whose teams are listed. */
  teams: number
  /** Who won, and the Pokémon they brought. */
  winner?: { player: string; country: string; team: PokemonId[] }
}

/** A Pokémon as brought: its ID (a Mega's when it holds its stone), item, ability, nature, moves. */
export type Slot = [PokemonId, ItemId | null, AbilityId | null, string | null, MoveId[]]

/** A listed player's placing, as the event file has it, by placing. */
export interface Standing {
  player: string
  country: string
  /** Limitless VGC's team list, shared by every player who brought the same one. */
  list: number
  team: Slot[]
}

/** An event by its ID. */
export const eventOf = (id: string): TournamentEvent | undefined => BY_ID.get(id)

const INDEX = import.meta.glob<Record<string, TournamentEvent>>('./generated/tournaments/index.json', {
  eager: true,
  import: 'default',
})
const FILES = import.meta.glob<Record<string, Standing>>(
  ['./generated/tournaments/*.json', '!./generated/tournaments/index.json'],
  { import: 'default' },
)

/** Every event generated, the latest first. */
export const EVENTS: readonly TournamentEvent[] = Object.values(Object.values(INDEX)[0] ?? {}).sort((a, b) =>
  b.date.localeCompare(a.date),
)
const BY_ID = new Map(EVENTS.map((e) => [e.id, e]))
const BY_N = new Map(EVENTS.map((e) => [e.n, e]))

/** An event's standings, its listed players by placing, loaded once. */
const standings = new Map<string, Promise<(Standing & { placing: number })[]>>()
export function loadStandings(id: string): Promise<(Standing & { placing: number })[]> {
  let p = standings.get(id)
  if (!p) {
    const file = FILES[`./generated/tournaments/${id}.json`]
    if (!file) return Promise.reject(new Error(`No data for the event "${id}"`))
    p = file().then((f) =>
      Object.entries(f)
        .map(([placing, s]) => ({ ...s, placing: Number(placing) }))
        .sort((a, b) => a.placing - b.placing),
    )
    standings.set(id, p)
  }
  return p
}

/** A regulation's events of a category, the latest first. */
export const eventsOf = (regulation: string, category: TournamentCategory = 'official') =>
  EVENTS.filter((e) => e.regulation === regulation && e.category === category)

const PREFIX = 'tournaments-'
const regulationKey = (regulation: string) => regulation.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The snapshot of every event of a regulation, as the meta's default list has it (`VITE_META_SETS`). */
export const tournamentSnapshotId = (regulation: string) => `${PREFIX}${regulationKey(regulation)}`

/** The snapshots made so far, by ID, so that the same events are the same snapshot. */
const made = new Map<string, MetaSnapshot>()

/** The snapshot of some of a regulation's events (every one, when they're all of them), or none without events. */
export function tournamentSnapshot(regulation: string, events: readonly string[]): MetaSnapshot | undefined {
  const all = eventsOf(regulation)
  const picked = all.filter((e) => events.includes(e.id))
  if (!picked.length) return undefined
  const id =
    picked.length === all.length
      ? tournamentSnapshotId(regulation)
      : `${tournamentSnapshotId(regulation)}~${picked
          .map((e) => e.n)
          .sort((a, b) => a - b)
          .join('.')}`
  let s = made.get(id)
  if (!s) {
    s = {
      id,
      kind: 'tournament',
      provider: picked[0]!.provider,
      regulation,
      from: picked.at(-1)!.date,
      to: picked[0]!.date,
      period: 'event',
      teams: picked.reduce((n, e) => n + e.teams, 0),
      events: picked.map((e) => e.id),
      players: 'day2',
      capabilities: ['usage', 'moves', 'items', 'abilities', 'teammates', 'natures', 'builds'],
    }
    made.set(id, s)
  }
  return s
}

/** The snapshot an ID names (`tournaments-mc`, `tournaments-mc~445.446`), if its regulation has those events. */
export function tournamentSnapshotOf(id: string): MetaSnapshot | undefined {
  const m = id.match(/^tournaments-([a-z0-9]+)(?:~([\d.]+))?$/)
  if (!m) return undefined
  const regulation = EVENTS.find((e) => regulationKey(e.regulation) === m[1])?.regulation
  if (!regulation) return undefined
  const all = eventsOf(regulation)
  const events = m[2] ? m[2].split('.').flatMap((n) => BY_N.get(Number(n))?.id ?? []) : all.map((e) => e.id)
  const s = tournamentSnapshot(regulation, events)
  // Only the ID it'd have: an ID naming events it hasn't, or naming them all, isn't one.
  return s?.id === id ? s : undefined
}

/** The events a tournament snapshot adds up. */
export const snapshotEvents = (s: MetaSnapshot): TournamentEvent[] =>
  (s.events ?? []).flatMap((id) => BY_ID.get(id) ?? [])

/** As many of each list as Smogon's are kept: its top ones, less than 1% left out; every move, for its movepool. */
const KEEP = { list: 10, min: 0.01 }

const loaded = new Map<string, Promise<MetaData>>()

/** A tournament snapshot's data, its events' teams added up: each Pokémon's share of the teams, and of its sets each
 * item, ability, nature, move, teammate and whole build. Loaded once. */
export function loadTournaments(s: MetaSnapshot): Promise<MetaData> {
  let p = loaded.get(s.id)
  if (!p) {
    p = Promise.all(
      (s.events ?? []).map((id) => {
        const file = FILES[`./generated/tournaments/${id}.json`]
        if (!file) throw new Error(`No data for the event "${id}"`)
        return file()
      }),
    ).then((files) => addUp(files.flatMap((f) => Object.values(f).map((st) => st.team))))
    loaded.set(s.id, p)
  }
  return p
}

/** Counts by key. */
class Tally<K> extends Map<K, number> {
  add(k: K) {
    this.set(k, (this.get(k) ?? 0) + 1)
  }
  /** The most common, as shares of `total`, those under the minimum left out, at most `n`. */
  top(total: number, n: number): { id: K; share: number }[] {
    return [...this]
      .sort((a, b) => b[1] - a[1])
      .map(([id, c]) => ({ id, share: round(c / total) }))
      .filter((x) => x.share >= KEEP.min)
      .slice(0, n)
  }
}

interface Counts {
  sets: number
  items: Tally<ItemId>
  abilities: Tally<AbilityId>
  natures: Tally<string>
  moves: Tally<MoveId>
  teammates: Tally<PokemonId>
  builds: Tally<string>
}

/** How many builds of a Pokémon are kept: its most common, as many as fit a look. */
const BUILDS = 10

function addUp(teams: Slot[][]): MetaData {
  const counts = new Map<PokemonId, Counts>()
  for (const team of teams) {
    for (const [pokemon, item, ability, nature, moves] of team) {
      let c = counts.get(pokemon)
      if (!c) {
        c = {
          sets: 0,
          items: new Tally(),
          abilities: new Tally(),
          natures: new Tally(),
          moves: new Tally(),
          teammates: new Tally(),
          builds: new Tally(),
        }
        counts.set(pokemon, c)
      }
      c.sets++
      if (item) c.items.add(item)
      if (ability) c.abilities.add(ability)
      if (nature) c.natures.add(nature)
      for (const m of moves) c.moves.add(m)
      for (const [other] of team) if (other !== pokemon) c.teammates.add(other)
      c.builds.add(JSON.stringify([item, ability, nature, [...moves].sort()]))
    }
  }
  const data: MetaData = {}
  ;[...counts]
    .sort((a, b) => b[1].sets - a[1].sets || a[0].localeCompare(b[0]))
    .forEach(([pokemon, c], i) => {
      const meta: PokemonMeta = {
        rank: i + 1,
        usage: round(c.sets / teams.length),
        teams: c.sets,
        moves: c.moves.top(c.sets, Infinity) as Share<MoveId>[],
        items: c.items.top(c.sets, KEEP.list),
        abilities: c.abilities.top(c.sets, KEEP.list),
        natures: c.natures.top(c.sets, KEEP.list),
        teammates: c.teammates.top(c.sets, KEEP.list),
        builds: c.builds.top(c.sets, BUILDS).map(({ id, share }) => {
          const [item, ability, nature, moves] = JSON.parse(id) as [
            ItemId | null,
            AbilityId | null,
            string | null,
            MoveId[],
          ]
          return { item, ability, nature, moves, share }
        }),
      }
      data[pokemon] = meta
    })
  return data
}

/** Shares to 4 decimals (0.01%), as the generated ones. */
const round = (x: number) => Math.round(x * 1e4) / 1e4
