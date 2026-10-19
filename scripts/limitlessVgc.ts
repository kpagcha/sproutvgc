// Official tournaments from Limitless VGC (limitlessvgc.com; notes/usage-stats.md): each event of a regulation, its
// standings and every listed player's team, as the sets they brought (Pokémon, item, ability, nature, moves; no stat
// points, which the team lists don't have). It covers the top placings of each event, those whose teams it publishes,
// not the whole field. Its robots.txt allows everything; RK9's terms forbid scraping, so its lists aren't read.
// Pages are cached: a team page never changes (only who used it, which isn't read), and an event's page is read again
// while the event is recent, as its teams come in over the days after it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SITE = 'https://limitlessvgc.com'
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

/** How long after an event its page is read again rather than taken from the cache: teams are published over days. */
const FRESH_DAYS = 21
/** A pause between requests, to go easy on the site. */
const PAUSE_MS = 300

export interface TournamentEvent {
  id: string
  name: string
  /** The day it started, as an ISO date. */
  date: string
  country: string
  /** Every player, whether or not their team is listed. */
  players: number
  type: EventType
  /** What kind of tournament it is, the datasets' category: Limitless VGC lists only official ones. */
  category: 'official'
  regulation: string
  provider: { name: string; url: string }
  url: string
  /** The players whose teams are listed. */
  teams: number
  /** Who won, and the Pokémon they brought, for the list of events to show without loading the standings. */
  winner?: { player: string; country: string; team: string[] }
}

/** A Pokémon as brought: its ID (a Mega's when it holds its Mega Stone, as Smogon's stats count it), then its item, ability and nature (Showdown IDs, null when the list doesn't say),
 * then its moves. */
export type TeamSlot = [pokemon: string, item: string | null, ability: string | null, nature: string | null, string[]]

export interface Standing {
  placing: number
  player: string
  country: string
  /** Limitless VGC's team list, shared by every player who brought the same one. */
  list: number
  team: TeamSlot[]
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

export class LimitlessVgc {
  private cache: string
  private get: Get
  /** Whether to read the lists of events again, for new ones, rather than take them from the cache. */
  private update: boolean
  constructor(cache: string, get: Get, update: boolean) {
    this.cache = cache
    this.get = get
    this.update = update
  }

  private async fetch(url: string): Promise<string> {
    await new Promise((wait) => setTimeout(wait, PAUSE_MS))
    const body = await this.get(url)
    if (!body) throw new Error(`Limitless VGC has no ${url}`)
    return body.toString('utf8')
  }

  /** A page, through the cache unless `fresh`. */
  private async page(path: string, file: string, fresh = false): Promise<string> {
    const cached = join(this.cache, file)
    if (fresh || !existsSync(cached)) {
      const html = await this.fetch(`${SITE}${path}`)
      mkdirSync(dirname(cached), { recursive: true })
      writeFileSync(cached, html)
      return html
    }
    return readFileSync(cached, 'utf8')
  }

  /** Every event of a regulation, oldest first, by its number on the site. */
  async events(regulation: string): Promise<number[]> {
    return [...(await this.listed(regulation)).keys()].sort((a, b) => a - b)
  }

  /**
   * An event and its standings. Stops on any name the dex doesn't have when `strict` (the current regulation's); else
   * leaves it out, saying so (a past regulation's, which may have what the dex no longer does).
   */
  async event(
    n: number,
    regulation: string,
    known: Known,
    strict: boolean,
  ): Promise<{ event: TournamentEvent; standings: Standing[] }> {
    const info = await this.info(n, regulation)
    const recent = Date.now() - Date.parse(`${info.date}T00:00:00Z`) < FRESH_DAYS * 864e5
    const html = await this.page(`/tournaments/${n}`, `events/${n}.html`, this.update && recent)
    const unknown = new Set<string>()
    const check = (set: ReadonlySet<string>, what: string, id: string | null) => {
      if (id === null || set.has(id)) return id
      unknown.add(`${what} "${id}"`)
      return null
    }

    const standings: Standing[] = []
    for (const row of html.split(/(?=<tr data-rank=)/).slice(1)) {
      const head = row.match(/^<tr data-rank="(\d+)" data-name="([^"]*)" data-country="([^"]*)"/)
      const list = row.match(/href="\/teams\/(\d+)"/)
      if (!head || !list) continue
      if (standings.some((s) => s.placing === Number(head[1])))
        throw new Error(`Limitless VGC's ${info.name} lists placing ${head[1]} twice`)
      const slots = await this.team(Number(list[1]))
      const team: TeamSlot[] = []
      for (const s of slots) {
        const pokemon = known.pokemon(s.pokemon)
        if (!pokemon) {
          unknown.add(`Pokémon "${s.pokemon}"`)
          continue
        }
        const item = check(known.items, 'item', s.item)
        team.push([
          (item && known.mega(pokemon, item)) || pokemon,
          item,
          check(known.abilities, 'ability', s.ability),
          check(known.natures, 'nature', s.nature),
          s.moves.flatMap((m) => check(known.moves, 'move', m) ?? []),
        ])
      }
      standings.push({
        placing: Number(head[1]),
        player: decode(head[2]!),
        country: head[3]!,
        list: Number(list[1]),
        team,
      })
    }
    if (unknown.size) {
      const msg = `Limitless VGC's ${info.name} (Regulation ${regulation}) names what the dex hasn't: ${[...unknown].join(', ')}`
      if (strict) throw new Error(msg)
      console.warn(`${msg} (left out)`)
    }
    const first = standings.find((s) => s.placing === 1)
    const winner = first && { player: first.player, country: first.country, team: first.team.map(([p]) => p) }
    return { event: { ...info, teams: standings.length, ...(winner && { winner }) }, standings }
  }

  /** What the regulation's list says of an event: its name, date, country, players and type. */
  private async info(n: number, regulation: string): Promise<Omit<TournamentEvent, 'teams'>> {
    const info = (await this.listed(regulation)).get(n)
    if (!info) throw new Error(`Limitless VGC doesn't list event ${n} under Regulation ${regulation}`)
    return info
  }

  /** The regulation's events as its lists give them, one list per type of event (its format on the site is "m-c"),
   * read once a run: through the cache, unless updating. */
  private lists = new Map<string, Map<number, Omit<TournamentEvent, 'teams'>>>()
  private async listed(regulation: string): Promise<Map<number, Omit<TournamentEvent, 'teams'>>> {
    let byEvent = this.lists.get(regulation)
    if (!byEvent) {
      byEvent = new Map()
      for (const [type, name] of Object.entries(TYPES)) {
        const html = await this.page(
          `/tournaments?time=all&type=${type}&format=${format(regulation)}&region=all`,
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
            id: `limitlessvgc-${id}`,
            name: decode(m[3]!),
            date: m[1]!,
            country: m[2]!,
            players: Number(m[4]),
            type: name,
            category: 'official',
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

  /** A team list's six, as the site names them: the Pokémon by its ID there ("basculegion-f"), the rest made IDs. */
  private teams = new Map<number, Promise<RawSlot[]>>()
  private team(list: number): Promise<RawSlot[]> {
    let p = this.teams.get(list)
    if (!p) this.teams.set(list, (p = this.page(`/teams/${list}`, `teams/${list}.html`).then(parseTeam)))
    return p
  }
}

interface RawSlot {
  pokemon: string
  item: string | null
  ability: string | null
  nature: string | null
  moves: string[]
}

function parseTeam(html: string): RawSlot[] {
  return html
    .split(/(?=<div class="pkmn" data-id=)/)
    .slice(1)
    .map((block) => {
      const text = (cls: string) => {
        const m = block.match(new RegExp(`<div class="${cls}">([^<]*)</div>`))
        return m ? decode(m[1]!).trim() : null
      }
      const id = (s: string | null) => (s ? toId(s) || null : null)
      const moves = block.match(/<ul class="moves">([\s\S]*?)<\/ul>/)?.[1] ?? ''
      return {
        pokemon: block.match(/^<div class="pkmn" data-id="([^"]+)"/)![1]!,
        // A list with no item has the label alone, "Held Item:".
        item: id(text('item')?.replace(/^Held Item:?$/, '') ?? null),
        ability: id(text('ability')?.replace(/^Ability:\s*/, '') ?? null),
        nature: id(text('nature')?.replace(/\s*Nature$/, '') ?? null),
        moves: [...moves.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => toId(decode(m[1]!))).filter(Boolean),
      }
    })
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
