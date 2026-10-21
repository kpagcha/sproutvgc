// Official tournaments from Limitless VGC (notes/usage-stats.md): each event of a regulation, its whole field's
// standings (every player's placing, record, whether they made Day 2 and the top cut, and when they dropped), the team
// each one brought, as whole sets (Pokémon, item, ability, nature, moves; no stat points, which team lists don't have),
// and every round's matches. Which events a regulation has, and of what type, comes from limitlessvgc.com's lists, whose
// event pages link their standings; the standings, matches and team lists come from the JSON its standings site
// (standings.limitlessvgc.com) loads, undocumented (`mew.limitlesstcg.com/labs/data/vgc`): one request for the
// standings, one per round for its matches, and one per player for their team list, about a thousand for a Regional.
// So the requests are paced (a few at once, at most 8 a second), say who's asking (`get`'s User-Agent, set by the generator), and are made
// once: every response is cached, and an event once generated is kept from its committed files (the generator's), never
// requested again. Both sites' robots.txt allow everything; RK9's terms forbid scraping, so its lists aren't read.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SITE = 'https://limitlessvgc.com'
const STANDINGS = 'https://standings.limitlessvgc.com'
const API = 'https://mew.limitlesstcg.com/labs/data/vgc'
export const PROVIDER = { name: 'Limitless VGC', url: 'https://limitlessvgc.com/' }

/** The kinds of event it lists, by its filter's values, with the name we give each. */
const TYPES = {
  regional: 'regional',
  international: 'international',
  worlds: 'worlds',
  special: 'special',
  national: 'national',
  players_cup: 'playersCup',
  mbl: 'masterBallLeague',
} as const
export type EventType = (typeof TYPES)[keyof typeof TYPES]

/** How many requests at once, and the least time between two starting: at most 8 a second, to go easy on the sites. */
const PARALLEL = 4
const GAP_MS = 125
/** The division read: Masters, the one the meta is about. */
const DIVISION = 'MA'
/** The shape of what's generated for an event: an event generated in another is generated again, not kept. */
export const FORMAT = 3

export interface TournamentEvent {
  /** Its name as a slug, with its year (`slugOf`): its page's address. */
  id: string
  /** Its number on Limitless VGC, short, for the IDs of several events picked together. */
  n: number
  /** Its number on the standings site. */
  t: number
  /** The shape it was generated in (`FORMAT`). */
  format: number
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
  /** What kind of tournament it is, the datasets' category: Limitless VGC lists only official ones. */
  category: 'official'
  regulation: string
  provider: { name: string; url: string }
  /** Its standings on Limitless VGC. */
  url: string
  /** The players whose team lists are there. */
  teams: number
  /** Who won, and the Pokémon they brought, for the list of events to show without loading the standings. */
  winner?: { player: string; country: string; team: string[] }
}

/** An event still to come, as Limitless VGC's list of them has it: no players nor standings yet, its regulation only
 * once announced, and its type told by its name (the list has no type of its own). */
export interface UpcomingEvent {
  /** Its number on Limitless VGC, which it keeps once it's over. */
  n: number
  name: string
  /** The day it starts, as an ISO date. */
  date: string
  country: string
  type?: EventType
  regulation?: string
  /** Its page on Limitless VGC, and the official one, its venue and registration, when the list links it. */
  url: string
  info?: string
}

/** A Pokémon as brought: its ID (a Mega's when it holds its Mega Stone, as Smogon's stats count it), then its item,
 * ability and nature (Showdown IDs, null when the list doesn't say), then its moves. Without a team list, the Pokémon
 * alone (the rest null, no moves). */
export type TeamSlot = [pokemon: string, item: string | null, ability: string | null, nature: string | null, string[]]

export interface Standing {
  placing: number
  player: string
  country: string
  wins: number
  losses: number
  /** Whether they made Day 2, and the top cut. */
  day2?: true
  topCut?: true
  /** The round they dropped in, if they did. */
  dropped?: number
  team: TeamSlot[]
}

/** A round's matches, each its two players by placing (the second null for a bye) and who won: 1 the first, 2 the
 * second, 0 neither (a tie, or not played). Its phase: 1 Day 1's Swiss, 2 Day 2's, 3 the top cut. */
export interface Round {
  phase: number
  matches: [number, number | null, 0 | 1 | 2][]
}

/** What the dex has, to check the site's names against: a Pokémon's ID by its Limitless ID, or whether an ID exists. */
export interface Known {
  pokemon: (id: string) => string | undefined
  moves: ReadonlySet<string>
  items: ReadonlySet<string>
  abilities: ReadonlySet<string>
  natures: ReadonlySet<string>
  /** The Mega a Pokémon holding an item becomes, when the item is its Mega Stone. */
  mega: (pokemon: string, item: string) => string | undefined
}

type Get = (url: string) => Promise<Buffer | null>

// The standings site's JSON, the little of it read.
interface ApiTournament {
  round: number
  completed: number
}
interface ApiStanding {
  tp_id: number
  name: string
  country: string | null
  /** None for a player disqualified. */
  placement: number | null
  wins: number
  losses: number
  day2: number
  topcut: number
  dropped: number
  drop_round: number | null
  teamlist: number
  team: string | null
}
interface ApiSlot {
  id: string
  item: string | null
  ability: string | null
  nature: string | null
  moves: string[]
}
/** A match, its two players by their number in the event (as the standings' `tp_id`; the second none for a bye) and
 * the winner's (another, -1, when neither won). */
interface ApiMatch {
  player1: number
  player2: number | null
  winner: number | null
}

/** Asked to fetch while it mustn't (`offline`): what the event would have needed. */
class Offline extends Error {}

export class LimitlessVgc {
  private cache: string
  private get: Get
  /** Whether to read the lists of events again, for new ones, rather than take them from the cache. */
  private update: boolean
  /** Whether to make no requests at all, generating from the cache alone: an event it hasn't whole is left out. */
  private offline: boolean
  /** The requests made so far this run. */
  requests = 0
  constructor(cache: string, get: Get, options: { update: boolean; offline: boolean }) {
    this.cache = cache
    this.get = get
    this.update = options.update
    this.offline = options.offline
  }

  /** When the next request may start, so that they start `GAP_MS` apart at least, however many are waiting. */
  private next = 0
  private async fetch(url: string): Promise<string> {
    if (this.offline) throw new Offline(url)
    const start = Math.max(Date.now(), this.next)
    this.next = start + GAP_MS
    await new Promise((wait) => setTimeout(wait, start - Date.now()))
    this.requests++
    const body = await this.get(url)
    if (!body) throw new Error(`Limitless VGC has no ${url}`)
    return body.toString('utf8')
  }

  /** A URL's body, through the cache unless `fresh` (and online). */
  private async cached(url: string, file: string, fresh = false): Promise<string> {
    const path = join(this.cache, file)
    if ((fresh && !this.offline) || !existsSync(path)) {
      const body = await this.fetch(url)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body)
      return body
    }
    return readFileSync(path, 'utf8')
  }

  /** The standings site's JSON, its `message`, through the cache. */
  private async api<T>(path: string, file: string, fresh = false): Promise<T> {
    const body = JSON.parse(await this.cached(`${API}/${path}`, `api/${file}`, fresh)) as { ok: boolean; message: T }
    if (!body.ok) throw new Error(`Limitless VGC's ${path}: ${JSON.stringify(body.message)}`)
    return body.message
  }

  /** Every event of a regulation, oldest first, by its number on limitlessvgc.com. */
  async events(regulation: string): Promise<number[]> {
    return [...(await this.listed(regulation)).keys()].sort((a, b) => a - b)
  }

  /** The events still to come, soonest first, from its list of them: read again when updating, else through the cache;
   * nothing offline with none cached. */
  async upcoming(): Promise<UpcomingEvent[] | null> {
    let html: string
    try {
      html = await this.cached(`${SITE}/tournaments/upcoming`, 'lists/upcoming.html', this.update)
    } catch (error) {
      if (error instanceof Offline) return null
      throw error
    }
    const events: UpcomingEvent[] = []
    for (const row of html.split(/(?=<tr data-date=)/).slice(1)) {
      const m = row.match(
        /^<tr data-date="([\d-]+)" data-country="([^"]*)"\s+data-name="([^"]*)" data-format="([^"]*)"[\s\S]*?<a href="\/tournaments\/(\d+)">/,
      )
      if (!m) continue
      const name = decode(m[3]!)
      const info = row.split('</tr>')[0]!.match(/<a href="(https?:\/\/[^"]+)"/)?.[1]
      const type = typeOf(name)
      events.push({
        n: Number(m[5]),
        name,
        date: m[1]!,
        country: m[2]!,
        ...(type && { type }),
        ...(m[4] && { regulation: m[4].toUpperCase() }),
        url: `${SITE}/tournaments/${m[5]}`,
        ...(info && { info: decode(info) }),
      })
    }
    return events.sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n)
  }

  /**
   * An event, its standings and its rounds, or nothing while it isn't over (its standings aren't final) or, offline,
   * while the cache hasn't all of it. Stops on any Pokémon the dex doesn't have when `strict` (the current regulation's:
   * most likely a name of ours to fix); else leaves it out, saying so (a past regulation's, which may have what the dex
   * no longer does). An item, ability, move or nature the regulation hasn't is a player's slip on their team list, not
   * ours: left out, said so, either way.
   */
  async event(
    n: number,
    regulation: string,
    known: Known,
    strict: boolean,
  ): Promise<{ event: TournamentEvent; standings: Standing[]; rounds: Record<number, Round> } | null> {
    const info = (await this.listed(regulation)).get(n)
    if (!info) throw new Error(`Limitless VGC doesn't list event ${n} under Regulation ${regulation}`)
    try {
      return await this.read(n, info, regulation, known, strict)
    } catch (error) {
      if (!(error instanceof Offline)) throw error
      console.warn(`Limitless VGC's ${info.name} isn't all in the cache: left out (offline)`)
      return null
    }
  }

  private async read(
    n: number,
    info: Omit<TournamentEvent, 'teams' | 't' | 'format' | 'day2' | 'topCut' | 'rounds'>,
    regulation: string,
    known: Known,
    strict: boolean,
  ) {
    // Its page links its standings, by their number there.
    const page = await this.cached(`${SITE}/tournaments/${n}`, `events/${n}.html`)
    const t = Number(page.match(/standings\.limitlessvgc\.com\/(\d+)\/standings/)?.[1])
    if (!t) throw new Error(`Limitless VGC's ${info.name} links no standings`)
    // Until it's over, its state is read again each run; once it is, what's cached is final.
    const cachedOver = (() => {
      const path = join(this.cache, `api/${t}/tournament.json`)
      return (
        existsSync(path) && (JSON.parse(readFileSync(path, 'utf8')) as { message: ApiTournament }).message.completed
      )
    })()
    const q = `tournamentId=${t}&division=${DIVISION}`
    const tournament = await this.api<ApiTournament>(
      `tournament?id=${t}&division=${DIVISION}`,
      `${t}/tournament.json`,
      !cachedOver,
    )
    if (!tournament.completed) {
      console.warn(`Limitless VGC's ${info.name} isn't over yet: left out until it is`)
      return null
    }
    const all = await this.api<ApiStanding[]>(`standings?${q}`, `${t}/standings.json`, !cachedOver)
    // Its standings, those disqualified left out (they have no placing): their matches stay, their opponents' results
    // standing, against no one.
    const field = all.filter((p): p is ApiStanding & { placement: number } => p.placement !== null)
    if (field.length < all.length)
      console.log(`Limitless VGC's ${info.name}: ${all.length - field.length} disqualified, left out of the standings`)
    const lists = field.filter((p) => p.teamlist).length
    const uncached = field.filter((p) => p.teamlist && !existsSync(join(this.cache, `api/${t}/teams/${p.tp_id}.json`)))
    if (uncached.length && !this.offline) {
      console.log(
        `Limitless VGC's ${info.name}: ${uncached.length} team lists to fetch, about ${Math.ceil((uncached.length * GAP_MS) / 60000)} minutes`,
      )
      // Fetched a few at once into the cache, then read from it in order below.
      await inParallel(uncached, (p) =>
        this.api(`teamlist?tournamentId=${t}&playerId=${p.tp_id}`, `${t}/teams/${p.tp_id}.json`),
      )
    }
    // Its rounds' pairings, likewise.
    await inParallel(
      Array.from({ length: tournament.round }, (_, i) => i + 1),
      (r) => this.api(`pairings?${q}&round=${r}`, `${t}/pairings/${r}.json`),
    )

    const unknown = new Set<string>()
    const slips = new Set<string>()
    // A list leaving one out has its label alone ("Held Item:").
    const check = (set: ReadonlySet<string>, what: string, name: string | null) => {
      const id = name && !/:\s*$/.test(name) ? toId(name) : null
      if (id === null || set.has(id)) return id
      slips.add(`${what} "${id}"`)
      return null
    }
    const pokemonOf = (limitless: string) => {
      const id = known.pokemon(limitless)
      if (!id) unknown.add(`Pokémon "${limitless}"`)
      return id
    }

    const standings: Standing[] = []
    const placingOf = new Map<number, number>()
    for (const p of [...field].sort((a, b) => a.placement - b.placement)) {
      if (standings.some((s) => s.placing === p.placement))
        throw new Error(`Limitless VGC's ${info.name} has placing ${p.placement} twice`)
      placingOf.set(p.tp_id, p.placement)
      const slots = p.teamlist
        ? await this.api<ApiSlot[]>(`teamlist?tournamentId=${t}&playerId=${p.tp_id}`, `${t}/teams/${p.tp_id}.json`)
        : null
      const team: TeamSlot[] = []
      if (slots) {
        for (const s of slots) {
          const pokemon = pokemonOf(s.id)
          if (!pokemon) continue
          const item = check(known.items, 'item', s.item)
          team.push([
            (item && known.mega(pokemon, item)) || pokemon,
            item,
            check(known.abilities, 'ability', s.ability),
            check(known.natures, 'nature', s.nature),
            s.moves.flatMap((m) => check(known.moves, 'move', m) ?? []),
          ])
        }
      } else {
        // No team list: the Pokémon alone, as its standings name them.
        for (const s of (p.team ?? '').split(',').filter(Boolean)) {
          const pokemon = pokemonOf(s)
          if (pokemon) team.push([pokemon, null, null, null, []])
        }
      }
      standings.push({
        placing: p.placement,
        player: p.name,
        country: p.country ?? '',
        wins: p.wins,
        losses: p.losses,
        ...(p.day2 ? { day2: true as const } : {}),
        ...(p.topcut ? { topCut: true as const } : {}),
        ...(p.dropped && p.drop_round ? { dropped: p.drop_round } : {}),
        team,
      })
    }

    // Its rounds, each's matches by the players' placings, and its phase, from who plays it (the pairings don't say):
    // the top cut's when only the top cut's players do, Day 2's when only Day 2's, else Day 1's.
    const rounds: Record<number, Round> = {}
    const byPlacing = new Map(standings.map((st) => [st.placing, st]))
    for (let r = 1; r <= tournament.round; r++) {
      const matches = await this.api<ApiMatch[]>(`pairings?${q}&round=${r}`, `${t}/pairings/${r}.json`)
      const at = (id: number | null) => (id === null ? null : (placingOf.get(id) ?? null))
      const pairs = matches.flatMap(({ player1, player2, winner }) => {
        const a = at(player1)
        if (a === null) return []
        const won = winner === player1 ? 1 : winner !== null && winner === player2 ? 2 : 0
        return [[a, at(player2), won] as [number, number | null, 0 | 1 | 2]]
      })
      const playing = pairs.flatMap(([a, b]) => (b === null ? [a] : [a, b])).map((p) => byPlacing.get(p))
      const phase = !playing.length
        ? 0
        : playing.every((st) => st?.topCut)
          ? 3
          : playing.every((st) => st?.day2)
            ? 2
            : 1
      rounds[r] = { phase, matches: pairs }
    }

    if (unknown.size) {
      const msg = `Limitless VGC's ${info.name} (Regulation ${regulation}) names what the dex hasn't: ${[...unknown].join(', ')}`
      if (strict) throw new Error(msg)
      console.warn(`${msg} (left out)`)
    }
    if (slips.size)
      console.warn(
        `Limitless VGC's ${info.name}: team lists name what Regulation ${regulation} hasn't, left out: ${[...slips].join(', ')}`,
      )
    const first = standings.find((s) => s.placing === 1)
    const winner = first && { player: first.player, country: first.country, team: first.team.map(([p]) => p) }
    const event: TournamentEvent = {
      ...info,
      t,
      format: FORMAT,
      players: standings.length,
      day2: standings.filter((s) => s.day2).length,
      topCut: standings.filter((s) => s.topCut).length,
      rounds: tournament.round,
      url: `${STANDINGS}/${t}/standings`,
      teams: lists,
      ...(winner && { winner }),
    }
    return { event, standings, rounds }
  }

  /** The regulation's events as its lists give them, one list per type of event (its format on the site is "m-c"),
   * read once a run: through the cache, unless updating. */
  private lists = new Map<
    string,
    Map<number, Omit<TournamentEvent, 'teams' | 't' | 'format' | 'day2' | 'topCut' | 'rounds'>>
  >()
  private async listed(regulation: string) {
    let byEvent = this.lists.get(regulation)
    if (!byEvent) {
      byEvent = new Map()
      for (const [type, name] of Object.entries(TYPES)) {
        const html = await this.cached(
          `${SITE}/tournaments?time=all&type=${type}&format=${format(regulation)}&region=all`,
          `lists/${format(regulation)}-${type}.html`,
          this.update,
        )
        for (const row of html.split(/(?=<tr data-date=)/).slice(1)) {
          const m = row.match(
            /^<tr data-date="([\d-]+)" data-country="([^"]*)"\s+data-name="([^"]*)" data-format="[^"]*"\s+data-players="(\d+)"[\s\S]*?<a href="\/tournaments\/(\d+)">/,
          )
          if (!m) continue
          const id = Number(m[5])
          byEvent.set(id, {
            id: slugOf(decode(m[3]!), m[1]!),
            n: id,
            name: decode(m[3]!),
            date: m[1]!,
            country: m[2]!,
            players: Number(m[4]),
            type: name,
            category: 'official' as const,
            regulation,
            provider: PROVIDER,
            url: `${SITE}/tournaments/${id}`,
          })
        }
      }
      this.lists.set(regulation, byEvent)
    }
    return byEvent
  }
}

/**
 * An event's name as a slug, for its page's address: lowercased, accents dropped, what's after a comma left out (a
 * Regional's state, an International's city: "Regional Louisville, KY" is `regional-louisville`, "NAIC 2026, New
 * Orleans" is `naic-2026`), the World Championships `worlds`, and its year added when the name hasn't one
 * (`regional-nice-2026`, `worlds-2026`). Two events of one name and year are told apart by the generator.
 */
export function slugOf(name: string, date: string): string {
  const slug = name
    .split(',')[0]!
    .normalize('NFD')
    .toLowerCase()
    .replace(/world championships?/, 'worlds')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return /\b\d{4}\b/.test(slug) ? slug : `${slug}-${date.slice(0, 4)}`
}

/** An event's type by its name, for the list of those to come, which has no type of its own: "Regional Puebla",
 * "Special Event Lima", "LAIC 2026–27, São Paulo", "World Championships 2027". */
function typeOf(name: string): EventType | undefined {
  if (/^regional\b/i.test(name)) return 'regional'
  if (/^special event\b/i.test(name)) return 'special'
  if (/\b[A-Z]{2}IC\b/.test(name) || /international/i.test(name)) return 'international'
  if (/world championships?/i.test(name)) return 'worlds'
  if (/players'? cup/i.test(name)) return 'playersCup'
  if (/master ball league/i.test(name)) return 'masterBallLeague'
  if (/national/i.test(name)) return 'national'
  return undefined
}

/** `task` on each of `items`, `PARALLEL` at a time, failing as soon as one does. */
async function inParallel<T>(items: readonly T[], task: (item: T) => Promise<unknown>): Promise<void> {
  let i = 0
  const worker = async () => {
    while (i < items.length) await task(items[i++]!)
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker))
}

/** A regulation's format on the site: "M-C" is "m-c". */
const format = (regulation: string) => regulation.toLowerCase()

/** Showdown's IDs, its accents dropped first ("Naïve" is `naive`). */
const toId = (s: string) =>
  s
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** The HTML entities the site's text uses. */
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
