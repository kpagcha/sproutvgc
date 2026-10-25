// Tournaments, as the meta's data (`meta.ts`): each event's teams, generated from Limitless VGC (`scripts/limitlessVgc.ts`)
// into `generated/tournaments/` (`index.json` the events, `<id>.json` each one's standings, its whole field, and
// `<id>.rounds.json` its matches), and added up here for whichever events are picked, into the shape every page reads
// (`MetaData`). They aren't snapshots generated whole as Smogon's are: any set of a regulation's events can be picked,
// and whose teams count (`players`: everyone, the default; those who made Day 2, `@day2`; the top cut, `@topcut`), so
// each is a snapshot made on demand, its ID naming them (`tournaments-mc` every event of M-C and every player,
// `tournaments-mc~445.446@day2` those two's Day 2). Their sets have no stat points: no spreads nor Speeds.

import { shallowReactive } from 'vue'
import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import type { Build, MetaData, MetaSnapshot, PokemonMeta, Share, TournamentPlayers } from '@/data/meta'

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
  /** Every player in its standings, those who made Day 2, and the top cut's. */
  players: number
  day2: number
  topCut: number
  /** Its rounds: Swiss on Day 1 and Day 2, then the top cut's. */
  rounds: number
  type: EventType
  category: TournamentCategory
  regulation: string
  provider: { name: string; url: string }
  /** Its standings on Limitless VGC. */
  url: string
  /** The players whose team lists are there. */
  teams: number
  /** Who won, and the Pokémon they brought. */
  winner?: { player: string; country: string; team: PokemonId[] }
  /** An event under way, or over but not generated for good yet (`LIVE_EVENTS`): how far it's got, as last read. */
  live?: LiveState
}

/** How far an event under way has got: the rounds played or being played, of all its rounds; when its standings last
 * changed, as an ISO time; and whether it's over, its team lists maybe still coming in. */
export interface LiveState {
  round: number
  rounds: number
  updated: string
  completed?: true
  /** Under way, who's first so far, their record, and their Pokémon once their team list is out. */
  leader?: { player: string; country: string; wins: number; losses: number; team: PokemonId[] }
}

/** A Pokémon as brought: its ID (a Mega's when it holds its stone), item, ability, nature, moves; with no team list,
 * the Pokémon alone (the rest null, no moves). */
export type Slot = [PokemonId, ItemId | null, AbilityId | null, string | null, MoveId[]]

/** A player's placing, as the event file has it, by placing. */
export interface Standing {
  player: string
  country: string
  wins: number
  losses: number
  /** Whether they made Day 2, and the top cut. */
  day2?: true
  topCut?: true
  /** The round they dropped in, if they did. */
  dropped?: number
  team: Slot[]
}

/** A round's matches, each its two players by placing (the second null for a bye) and who won: 1 the first, 2 the
 * second, 0 neither; at an event under way, one still being played has a 1 after them (`pending`). Its phase: 1 Day 1's
 * Swiss, 2 Day 2's, 3 the top cut. */
export interface Round {
  phase: number
  matches: Match[]
}
export type Match = [number, number | null, 0 | 1 | 2] | [number, number | null, 0, 1]
/** Whether a match is still being played. */
export const pending = (m: Match) => m[3] === 1

/** Whether a slot is a whole set, from a team list, not the Pokémon alone. */
export const listed = ([, item, ability, nature, moves]: Slot) => !!(item || ability || nature || moves.length)

/** Whether a player's team counts among `players`. */
const among = (s: Standing, players: TournamentPlayers) =>
  players === 'all' || (players === 'day2' ? !!s.day2 : !!s.topCut)

/** An event by its ID. */
export const eventOf = (id: string): TournamentEvent | undefined => BY_ID.get(id)

const INDEX = import.meta.glob<Record<string, TournamentEvent>>('./generated/tournaments/index.json', {
  eager: true,
  import: 'default',
})
// The events under way, as read before the build (`scripts/liveTournaments.ts`, into `generated/live/`, never
// committed): their files the same shape, under a name of their own.
const LIVE_INDEX = import.meta.glob<Record<string, TournamentEvent>>('./generated/live/index.json', {
  eager: true,
  import: 'default',
})
const FILES = import.meta.glob<Record<string, Standing>>(
  [
    './generated/tournaments/*.json',
    '!./generated/tournaments/index.json',
    '!./generated/tournaments/usage.json',
    '!./generated/tournaments/upcoming.json',
    '!./generated/tournaments/*.rounds.json',
    './generated/live/*.json',
    '!./generated/live/index.json',
    '!./generated/live/*.rounds.json',
  ],
  { import: 'default' },
)
/** An event's standings file, generated or live. */
const fileOf = (id: string) => FILES[`./generated/tournaments/${id}.json`] ?? FILES[`./generated/live/${id}.json`]

/** Every event generated, the latest first: what's added up, set against each other and trended. */
export const EVENTS: readonly TournamentEvent[] = Object.values(Object.values(INDEX)[0] ?? {}).sort((a, b) =>
  b.date.localeCompare(a.date),
)
const BY_N = new Map(EVENTS.map((e) => [e.n, e]))
const GENERATED_IDS = new Set(EVENTS.map((e) => e.id))
/** The events under way, or over but not generated for good yet, the latest first: shown with the rest, each its
 * pages, but kept out of all that adds events up (`EVENTS`), their fields and team lists not whole yet. One generated
 * since left out. */
export const LIVE_EVENTS: readonly (TournamentEvent & { live: LiveState })[] = Object.values(
  Object.values(LIVE_INDEX)[0] ?? {},
)
  .filter((e): e is TournamentEvent & { live: LiveState } => !!e.live && !BY_N.has(e.n) && !GENERATED_IDS.has(e.id))
  .sort((a, b) => b.date.localeCompare(a.date))
const BY_ID = new Map([...EVENTS, ...LIVE_EVENTS].map((e) => [e.id, e]))

/** An event still to come, as Limitless VGC lists it: its type told by its name, its regulation once announced, and
 * its page there and the official one (venue, registration) when listed. */
export interface UpcomingEvent {
  n: number
  name: string
  /** The day it starts, as an ISO date. */
  date: string
  country: string
  type?: EventType
  regulation?: string
  url: string
  info?: string
}

const UPCOMING_INDEX = import.meta.glob<Record<string, UpcomingEvent>>('./generated/tournaments/upcoming.json', {
  eager: true,
  import: 'default',
})
/** How long after its start an event still counts as to come: one under way, its standings not in yet. */
const UNDER_WAY_DAYS = 4
/** The events still to come, the soonest first: as of when the data was generated, so those started more than a few
 * days ago, or generated since, left out. */
export const UPCOMING: readonly UpcomingEvent[] = (() => {
  const since = new Date(Date.now() - UNDER_WAY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return Object.values(Object.values(UPCOMING_INDEX)[0] ?? {})
    .filter((e) => e.date >= since && !BY_N.has(e.n) && !LIVE_EVENTS.some((l) => l.n === e.n))
    .sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n)
})()

/** A regulation's builds of a Pokémon, every official event of it added up: its sets from team lists, and its most
 * common whole builds, each with its share of them. */
export interface RegulationBuilds {
  sets: number
  builds: Build[]
}

const BUILDS_FILES = import.meta.glob<
  Record<string, [sets: number, builds: [ItemId | null, AbilityId | null, string | null, MoveId[], number][]]>
>('./generated/tournaments/builds/*.json', { import: 'default' })

/** Each regulation's builds, by Pokémon, loaded once (`tournaments/builds/<regulation>.json`, generated from every
 * event's teams): for a Pokémon's meta page to show them whatever data it shows, without loading the standings. Empty
 * for a regulation with no events. */
const regulationBuilds = new Map<string, Promise<Partial<Record<PokemonId, RegulationBuilds>>>>()
export function loadRegulationBuilds(regulation: string): Promise<Partial<Record<PokemonId, RegulationBuilds>>> {
  let p = regulationBuilds.get(regulation)
  if (!p) {
    const file = BUILDS_FILES[`./generated/tournaments/builds/${regulationKey(regulation)}.json`]
    p = file
      ? file().then((f) =>
          Object.fromEntries(
            Object.entries(f).map(([id, [sets, builds]]) => [
              id,
              {
                sets,
                builds: builds.map(([item, ability, nature, moves, share]) => ({
                  item,
                  ability,
                  nature,
                  moves,
                  share,
                })),
              },
            ]),
          ),
        )
      : Promise.resolve({})
    regulationBuilds.set(regulation, p)
  }
  return p
}

/** A build in a link (its page's `?b=`): item, ability, nature and moves, by `~`, its moves by `.`, sorted, each
 * empty when not said (`sitrusberry~intimidate~careful~fakeout.knockoff.partingshot.protect`). */
export const buildParam = (b: Pick<Build, 'item' | 'ability' | 'nature' | 'moves'>) =>
  [b.item ?? '', b.ability ?? '', b.nature ?? '', [...b.moves].sort().join('.')].join('~')

/** The build a link names, if it names one. */
export function buildOfParam(param: string): Omit<Build, 'share'> | undefined {
  const parts = param.split('~')
  if (parts.length !== 4) return undefined
  const [it, ab, nature, moves] = parts as [string, string, string, string]
  return {
    item: (it || null) as ItemId | null,
    ability: (ab || null) as AbilityId | null,
    nature: nature || null,
    moves: (moves ? moves.split('.') : []) as MoveId[],
  }
}

/** Whether a set is a Pokémon's build: that Pokémon, with the same item, ability, nature and moves. */
export const isSetOf = (slot: Slot, pokemon: PokemonId, b: Omit<Build, 'share'>) =>
  slot[0] === pokemon &&
  listed(slot) &&
  slot[1] === b.item &&
  slot[2] === b.ability &&
  slot[3] === b.nature &&
  buildParam({ item: null, ability: null, nature: null, moves: slot[4] }) ===
    buildParam({ item: null, ability: null, nature: null, moves: b.moves })

const ROUNDS = import.meta.glob<Record<number, Round>>(
  ['./generated/tournaments/*.rounds.json', './generated/live/*.rounds.json'],
  { import: 'default' },
)

/** An event's rounds, by number, loaded once. */
const rounds = new Map<string, Promise<Record<number, Round>>>()
export function loadRounds(id: string): Promise<Record<number, Round>> {
  let p = rounds.get(id)
  if (!p) {
    const file = ROUNDS[`./generated/tournaments/${id}.rounds.json`] ?? ROUNDS[`./generated/live/${id}.rounds.json`]
    if (!file) return Promise.reject(new Error(`No rounds for the event "${id}"`))
    rounds.set(id, (p = file()))
  }
  return p
}

/** An event's Pokémon in a few numbers, as `usage.json` has them: the teams (with a Pokémon known) of the whole field,
 * Day 2 and the top cut, and for each Pokémon how many of each had it, then its best placing, then its teams' matches
 * won and lost over the event (no byes, nor matches neither won). */
export interface EventUsage {
  teams: [all: number, day2: number, topCut: number]
  pokemon: Partial<
    Record<PokemonId, [all: number, day2: number, topCut: number, best: number, wins: number, losses: number]>
  >
}

/** Every event's Pokémon in a few numbers, by event, loaded once: for an event's to be set against those before it
 * without loading their standings. */
const USAGE = import.meta.glob<Record<string, EventUsage>>('./generated/tournaments/usage.json', {
  import: 'default',
})
let usage: Promise<Record<string, EventUsage>> | undefined
export const loadEventUsage = () => (usage ??= Object.values(USAGE)[0]?.() ?? Promise.resolve({}))

/** The events an event's Pokémon are set against: the earlier ones of its regulation (not those on its own dates), or,
 * for its regulation's first, the regulation's before it (the latest whose events were all earlier). Its regulation
 * named when it's another. */
export function baselineOf(event: TournamentEvent): { events: TournamentEvent[]; regulation?: string } {
  const before = EVENTS.filter((e) => e.category === event.category && e.date < event.date)
  const own = before.filter((e) => e.regulation === event.regulation)
  if (own.length || !before.length) return { events: own }
  const regulation = before[0]!.regulation
  return { events: before.filter((e) => e.regulation === regulation), regulation }
}

/** The standings loaded so far, by event, for what's named after a player as soon as theirs are in (a player's page's
 * title). */
const loadedStandings = shallowReactive(new Map<string, (Standing & { placing: number })[]>())
/** A player of an event, by placing, once its standings are loaded. */
export const playerOf = (id: string, placing: number) => loadedStandings.get(id)?.find((s) => s.placing === placing)

/** An event's standings, its players by placing, loaded once. */
const standings = new Map<string, Promise<(Standing & { placing: number })[]>>()
export function loadStandings(id: string): Promise<(Standing & { placing: number })[]> {
  let p = standings.get(id)
  if (!p) {
    const file = fileOf(id)
    if (!file) return Promise.reject(new Error(`No data for the event "${id}"`))
    p = file().then((f) => {
      const all = Object.entries(f)
        .map(([placing, s]) => ({ ...s, placing: Number(placing) }))
        .sort((a, b) => a.placing - b.placing)
      loadedStandings.set(id, all)
      return all
    })
    standings.set(id, p)
  }
  return p
}

/** A regulation's events of a category, the latest first. */
export const eventsOf = (regulation: string, category: TournamentCategory = 'official') =>
  EVENTS.filter((e) => e.regulation === regulation && e.category === category)

/** The regulation whose events give a regulation's builds: its own once it has any; until then the one before it (the
 * latest event's before `since`, the day it started, when known), named as a fallback. None without events before. */
export function buildsRegulation(
  regulation: string,
  since?: string,
): { regulation: string; fallback: boolean } | undefined {
  if (eventsOf(regulation).length) return { regulation, fallback: false }
  const before = EVENTS.find(
    (e) => e.category === 'official' && e.regulation !== regulation && (!since || e.date < since),
  )
  return before && { regulation: before.regulation, fallback: true }
}

const PREFIX = 'tournaments-'
const regulationKey = (regulation: string) => regulation.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The snapshot of every event of a regulation, as the meta's default list has it (`VITE_META_SETS`). */
export const tournamentSnapshotId = (regulation: string) => `${PREFIX}${regulationKey(regulation)}`

/** The snapshots made so far, by ID, so that the same events are the same snapshot. */
const made = new Map<string, MetaSnapshot>()

/** Whose teams count, in a snapshot's ID: nothing for everyone. */
const PLAYERS_ID: Record<TournamentPlayers, string> = { all: '', day2: '@day2', topCut: '@topcut' }
/** Whose teams count, the default first: a tournament dataset's subsets. */
export const TOURNAMENT_PLAYERS: readonly TournamentPlayers[] = ['all', 'day2', 'topCut']

/** The snapshot of some of a regulation's events (every one, when they're all of them), the teams of `players`
 * counting, or none without events. */
export function tournamentSnapshot(
  regulation: string,
  events: readonly string[],
  players: TournamentPlayers = 'all',
): MetaSnapshot | undefined {
  const all = eventsOf(regulation)
  const picked = all.filter((e) => events.includes(e.id))
  if (!picked.length) return undefined
  const which =
    picked.length === all.length
      ? ''
      : `~${picked
          .map((e) => e.n)
          .sort((a, b) => a - b)
          .join('.')}`
  const id = `${tournamentSnapshotId(regulation)}${which}${PLAYERS_ID[players]}`
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
      teams: picked.reduce((n, e) => n + (players === 'all' ? e.players : players === 'day2' ? e.day2 : e.topCut), 0),
      events: picked.map((e) => e.id),
      players,
      capabilities: ['usage', 'moves', 'items', 'abilities', 'teammates', 'natures', 'builds'],
    }
    made.set(id, s)
  }
  return s
}

/** The snapshot an ID names (`tournaments-mc`, `tournaments-mc~445.446@day2`), if its regulation has those events. */
export function tournamentSnapshotOf(id: string): MetaSnapshot | undefined {
  const m = id.match(/^tournaments-([a-z0-9]+)(?:~([\d.]+))?(@day2|@topcut)?$/)
  if (!m) return undefined
  const regulation = EVENTS.find((e) => regulationKey(e.regulation) === m[1])?.regulation
  if (!regulation) return undefined
  const all = eventsOf(regulation)
  const events = m[2] ? m[2].split('.').flatMap((n) => BY_N.get(Number(n))?.id ?? []) : all.map((e) => e.id)
  const players = TOURNAMENT_PLAYERS.find((p) => PLAYERS_ID[p] === (m[3] ?? '')) ?? 'all'
  const s = tournamentSnapshot(regulation, events, players)
  // Only the ID it'd have: an ID naming events it hasn't, or naming them all, isn't one.
  return s?.id === id ? s : undefined
}

/** The events a tournament snapshot adds up. */
export const snapshotEvents = (s: MetaSnapshot): TournamentEvent[] =>
  (s.events ?? []).flatMap((id) => BY_ID.get(id) ?? [])

/** As many of each list as Smogon's are kept: its top ones, less than 1% left out; every move, for its movepool. */
const KEEP = { list: 10, min: 0.01 }

const loaded = new Map<string, Promise<MetaData>>()

/** A tournament snapshot's data, its events' teams added up (those of the players it counts): each Pokémon's share of
 * the teams and of its teammates', and of its sets from team lists, each item, ability, nature, move and whole build.
 * Loaded once. */
export function loadTournaments(s: MetaSnapshot): Promise<MetaData> {
  let p = loaded.get(s.id)
  if (!p) {
    p = Promise.all(
      (s.events ?? []).map((id) => {
        const file = FILES[`./generated/tournaments/${id}.json`]
        if (!file) throw new Error(`No data for the event "${id}"`)
        return file()
      }),
    ).then((files) =>
      addUp(
        files.flatMap((f) =>
          // Those with a Pokémon known, as `usage.json` counts them: a team no one knows anything of says nothing.
          Object.values(f)
            .filter((st) => st.team.length && among(st, s.players ?? 'all'))
            .map((st) => st.team),
        ),
      ),
    )
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
  /** The teams it's on, and its sets from team lists among them, what its lists' shares are of. */
  sets: number
  listed: number
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
          listed: 0,
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
      for (const [other] of team) if (other !== pokemon) c.teammates.add(other)
      if (!listed([pokemon, item, ability, nature, moves])) continue
      c.listed++
      if (item) c.items.add(item)
      if (ability) c.abilities.add(ability)
      if (nature) c.natures.add(nature)
      for (const m of moves) c.moves.add(m)
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
        teams: c.listed,
        moves: c.moves.top(c.listed, Infinity) as Share<MoveId>[],
        items: c.items.top(c.listed, KEEP.list),
        abilities: c.abilities.top(c.listed, KEEP.list),
        natures: c.natures.top(c.listed, KEEP.list),
        teammates: c.teammates.top(c.sets, KEEP.list),
        builds: c.builds.top(c.listed, BUILDS).map(({ id, share }) => {
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
