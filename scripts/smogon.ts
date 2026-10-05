// The meta from Smogon's usage stats (notes/usage-stats.md): Pokémon Showdown's ladder for the regulation's format
// over one month (`smogon` in `sources.json`), as a snapshot per rating cutoff, in the shape `src/data/meta.ts` reads.
// Each snapshot takes the month's `chaos` JSON (usage and sets, weighted by the cutoff) and its usage table (how often
// each Pokémon is brought, counted over every player whatever the cutoff). A month's files never change once
// published, so they're cached by month.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const STATS = 'https://www.smogon.com/stats'
const PROVIDER = { name: 'Smogon', url: 'https://www.smogon.com/' }

/** The rating cutoffs Smogon publishes, a snapshot each. */
const CUTOFFS = [1760, 1630, 1500, 0] as const

/** How much of each list to keep: Smogon's own moveset files show about as much. Less than 1% is noise. */
const KEEP = { list: 10, spreads: 6, speeds: 20, min: 0.01 }

// What `src/data/meta.ts` reads (`MetaSnapshot`, `PokemonMeta`), with IDs as plain strings.
interface Snapshot {
  id: string
  kind: 'showdown'
  provider: { name: string; url: string }
  regulation: string
  from: string
  to: string
  period: 'month'
  cutoff: number
  battles: number
  capabilities: string[]
  unweighted: string[]
}
interface Share {
  id: string
  share: number
}
interface PokemonMeta {
  rank: number
  usage: number
  brought?: number
  moves: Share[]
  items: Share[]
  abilities: Share[]
  teammates: Share[]
  spreads: { nature: string; points: number[]; share: number }[]
  speeds: { points: number; nature: string; share: number }[]
}

/** What the dex has, to check Smogon's names and IDs against: a Pokémon's ID by its name, or whether an ID exists. */
export interface Known {
  pokemon: (name: string) => string | undefined
  moves: ReadonlySet<string>
  items: ReadonlySet<string>
  abilities: ReadonlySet<string>
}

type Get = (url: string) => Promise<Buffer | null>

// `chaos` JSON: weights by ID (Pokémon by name), not shares.
interface Chaos {
  info: { 'number of battles': number }
  data: Record<
    string,
    {
      usage: number
      Abilities: Record<string, number>
      Items: Record<string, number>
      Moves: Record<string, number>
      Teammates: Record<string, number>
      Spreads: Record<string, number>
    }
  >
}

export class Smogon {
  private cache: string
  private get: Get
  /** The format's ID, Showdown's format name made an ID ("gen9championsvgc2026regmc"). */
  private format: string
  constructor(cache: string, get: Get, format: string) {
    this.cache = cache
    this.get = get
    this.format = format
  }

  /** The latest month with stats for the format. */
  async latestMonth(): Promise<string> {
    const listing = (await this.get(`${STATS}/`))!.toString('utf8')
    const months = [...new Set([...listing.matchAll(/href="(\d{4}-\d{2})\/"/g)].map((m) => m[1]!))].sort().reverse()
    for (const month of months) if (await this.get(`${STATS}/${month}/${this.format}-0.txt`)) return month
    throw new Error(`Smogon has no stats for ${this.format}`)
  }

  /** A file of the month's stats, through the cache. */
  private async file(month: string, path: string): Promise<string> {
    const cached = join(this.cache, month, path)
    if (!existsSync(cached)) {
      const body = await this.get(`${STATS}/${month}/${path}`)
      if (!body) throw new Error(`Smogon has no ${month}/${path}`)
      mkdirSync(dirname(cached), { recursive: true })
      writeFileSync(cached, body)
    }
    return readFileSync(cached, 'utf8')
  }

  /** The month's snapshots, a cutoff each, by snapshot ID. Stops on any name or ID the dex doesn't have. */
  async snapshots(
    month: string,
    regulation: string,
    known: Known,
  ): Promise<{ snapshot: Snapshot; data: Record<string, PokemonMeta> }[]> {
    const unknown = new Set<string>()
    const pokemon = (name: string) => {
      const id = known.pokemon(name)
      if (!id) unknown.add(`Pokémon "${name}"`)
      return id
    }
    // How often each Pokémon is brought (appears in battle) when on a team: unweighted, so any cutoff's table has it.
    const brought = new Map<string, number>()
    for (const [, name, raw, real] of (await this.file(month, `${this.format}-0.txt`)).matchAll(
      /^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*[\d.]+%\s*\|\s*(\d+)\s*\|\s*[\d.]+%\s*\|\s*(\d+)\s*\|/gm,
    )) {
      brought.set(name!, Number(real) / Number(raw))
    }

    const [year, mon] = month.split('-').map(Number) as [number, number]
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate()
    const result = []
    for (const cutoff of CUTOFFS) {
      const chaos = JSON.parse(await this.file(month, `chaos/${this.format}-${cutoff}.json`)) as Chaos
      /** The heaviest entries of a weight list, as shares of `total`, keeping those `keep` accepts. */
      const top = (weights: Record<string, number>, total: number, n: number, keep: (id: string) => boolean) =>
        Object.entries(weights)
          .sort((a, b) => b[1] - a[1])
          .filter(([id, w]) => w / total >= KEEP.min && keep(id))
          .slice(0, n)
          .map(([id, w]) => ({ id, share: round(w / total) }))
      /** What its sets put into Speed, from every spread (the long tail of them is most of the sets): stat points and
       * nature, as shares. */
      const speeds = (spreads: Record<string, number>, total: number) => {
        const weights = new Map<string, number>()
        for (const [spread, w] of Object.entries(spreads)) {
          const [nature, points] = spread.split(':') as [string, string]
          const key = `${points.split('/')[5]}:${nature.toLowerCase()}`
          weights.set(key, (weights.get(key) ?? 0) + w)
        }
        return [...weights]
          .sort((a, b) => b[1] - a[1])
          .filter(([, w]) => w / total >= KEEP.min)
          .slice(0, KEEP.speeds)
          .map(([key, w]) => {
            const [points, nature] = key.split(':') as [string, string]
            return { points: Number(points), nature, share: round(w / total) }
          })
      }
      const check = (set: ReadonlySet<string>, what: string) => (id: string) => {
        if (!set.has(id)) unknown.add(`${what} "${id}"`)
        return set.has(id)
      }

      const data: Record<string, PokemonMeta> = {}
      const ranked = Object.entries(chaos.data).sort((a, b) => b[1].usage - a[1].usage)
      ranked.forEach(([name, d], i) => {
        const id = pokemon(name)
        if (!id) return
        // Every set has one ability, so theirs add up to the Pokémon's total weight.
        const total = Object.values(d.Abilities).reduce((a, b) => a + b, 0)
        const teammates = top(d.Teammates, total, KEEP.list, (n) => !!pokemon(n))
        data[id] = {
          rank: i + 1,
          usage: round(d.usage),
          brought: brought.has(name) ? round(brought.get(name)!) : undefined,
          moves: top(d.Moves, total, KEEP.list, (m) => m !== '' && check(known.moves, 'move')(m)),
          // "nothing": no item.
          items: top(d.Items, total, KEEP.list, (it) => it !== 'nothing' && check(known.items, 'item')(it)),
          abilities: top(d.Abilities, total, KEEP.list, check(known.abilities, 'ability')),
          teammates: teammates.map((t) => ({ ...t, id: pokemon(t.id)! })),
          spreads: top(d.Spreads, total, KEEP.spreads, () => true).map(({ id, share }) => {
            const [nature, points] = id.split(':') as [string, string]
            return { nature: nature.toLowerCase(), points: points.split('/').map(Number), share }
          }),
          speeds: speeds(d.Spreads, total),
        }
      })
      result.push({
        snapshot: {
          id: `smogon-${cutoff}`,
          kind: 'showdown' as const,
          provider: PROVIDER,
          regulation,
          from: `${month}-01`,
          to: `${month}-${last}`,
          period: 'month' as const,
          cutoff,
          battles: chaos.info['number of battles'],
          capabilities: ['usage', 'brought', 'moves', 'items', 'abilities', 'teammates', 'spreads', 'speeds'],
          unweighted: ['brought'],
        },
        data,
      })
    }
    if (unknown.size) throw new Error(`Smogon's ${month} stats name what the dex hasn't: ${[...unknown].join(', ')}`)
    return result
  }
}

/** Shares to 4 decimals (0.01%): finer is noise, and it keeps the files small. */
const round = (x: number) => Math.round(x * 1e4) / 1e4
