// The meta from Smogon's usage stats (notes/usage-stats.md): Pokémon Showdown's ladder for a regulation's format over
// each month it has (`smogon` in `sources.json`), as a snapshot per month and rating cutoff, in the shape
// `src/data/meta.ts` reads.
// Each snapshot takes the month's `chaos` JSON (usage and sets, weighted by the cutoff) and its usage table (how often
// each Pokémon is brought, counted over every player whatever the cutoff). A month's files never change once
// published, so they're cached by month.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const STATS = 'https://www.smogon.com/stats'
const PROVIDER = { name: 'Smogon', url: 'https://www.smogon.com/' }

/** The rating cutoffs Smogon publishes, a snapshot each. */
const CUTOFFS = [1760, 1630, 1500, 0] as const

/** How much of each list to keep: Smogon's own moveset files show about as much. Less than 1% is noise. Speeds are
 * kept whole (`speeds`), as the app adds them up: what's left out would be left out of its totals too. */
const KEEP = { list: 10, spreads: 6, min: 0.01 }
// Its moves, every one over `KEEP.min`: its meta page shows its whole movepool with the share of each (its sets' view
// the top `KEEP.list` of them).
const KEEP_MOVES = Infinity

// What `src/data/meta.ts` reads (`MetaSnapshot`, `PokemonMeta`), with IDs as plain strings.
export interface Snapshot {
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
  previous?: string
  history?: string
}
interface Share {
  id: string
  share: number
}
export interface MetaEntry {
  rank: number
  usage: number
  brought?: number
  moves: Share[]
  items: Share[]
  abilities: Share[]
  teammates: Share[]
  spreads: { nature: string; points: number[]; share: number }[]
  speeds: { points: number; nature: string; share: number }[]
  natures: Share[]
  prev?: { rank: number; usage?: number }
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

  /** Every month with stats for the format, oldest first: a regulation's run of them, as the newest found back to
   * the first before it with none, looking no further back than the year its name gives ("vgc2026"). */
  async months(): Promise<string[]> {
    const listing = (await this.get(`${STATS}/`))!.toString('utf8')
    const all = [...new Set([...listing.matchAll(/href="(\d{4}-\d{2})\/"/g)].map((m) => m[1]!))].sort().reverse()
    const since = this.format.match(/vgc(\d{4})/)?.[1] ?? ''
    const found: string[] = []
    for (const month of all.filter((m) => m >= since)) {
      if (await this.get(`${STATS}/${month}/${this.format}-0.txt`)) found.push(month)
      else if (found.length) break
    }
    return found.reverse()
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

  /**
   * The month's snapshots, a cutoff each, by snapshot ID (`smogon-<regulation>-<month>-<cutoff>`). Stops on any name or
   * ID the dex doesn't have when `strict` (the current regulation's); else leaves them out, saying so (a past
   * regulation's, which may have what the dex no longer does).
   */
  async snapshots(
    month: string,
    regulation: string,
    known: Known,
    strict: boolean,
  ): Promise<{ snapshot: Snapshot; data: Record<string, MetaEntry> }[]> {
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
       * nature, as shares, every one of them (but those too rare to show at the shares' precision), so they add up to
       * all of its sets. Lists in the app leave out the rare ones themselves. */
      const speeds = (spreads: Record<string, number>, total: number) => {
        const weights = new Map<string, number>()
        for (const [spread, w] of Object.entries(spreads)) {
          const [nature, points] = spread.split(':') as [string, string]
          const key = `${points.split('/')[5]}:${nature.toLowerCase()}`
          weights.set(key, (weights.get(key) ?? 0) + w)
        }
        return [...weights]
          .sort((a, b) => b[1] - a[1])
          .map(([key, w]) => {
            const [points, nature] = key.split(':') as [string, string]
            return { points: Number(points), nature, share: round(w / total) }
          })
          .filter((s) => s.share > 0)
      }
      /** Its natures, from every spread, as shares, the rare ones left out. */
      const natures = (spreads: Record<string, number>, total: number) => {
        const weights = new Map<string, number>()
        for (const [spread, w] of Object.entries(spreads)) {
          const nature = spread.split(':')[0]!.toLowerCase()
          weights.set(nature, (weights.get(nature) ?? 0) + w)
        }
        return [...weights]
          .sort((a, b) => b[1] - a[1])
          .map(([id, w]) => ({ id, share: round(w / total) }))
          .filter((x) => x.share >= KEEP.min)
          .slice(0, KEEP.list)
      }
      const check = (set: ReadonlySet<string>, what: string) => (id: string) => {
        if (!set.has(id)) unknown.add(`${what} "${id}"`)
        return set.has(id)
      }

      const data: Record<string, MetaEntry> = {}
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
          moves: top(d.Moves, total, KEEP_MOVES, (m) => m !== '' && check(known.moves, 'move')(m)),
          // "nothing": no item.
          items: top(d.Items, total, KEEP.list, (it) => it !== 'nothing' && check(known.items, 'item')(it)),
          abilities: top(d.Abilities, total, KEEP.list, check(known.abilities, 'ability')),
          teammates: teammates.map((t) => ({ ...t, id: pokemon(t.id)! })),
          spreads: top(d.Spreads, total, KEEP.spreads, () => true).map(({ id, share }) => {
            const [nature, points] = id.split(':') as [string, string]
            return { nature: nature.toLowerCase(), points: points.split('/').map(Number), share }
          }),
          speeds: speeds(d.Spreads, total),
          // Its natures from every spread: the long tail of spreads is most of the sets, so its top spreads, a few
          // percent each, don't say what its natures are.
          natures: natures(d.Spreads, total),
        }
      })
      result.push({
        snapshot: {
          id: `smogon-${regulation.toLowerCase().replace(/[^a-z0-9]/g, '')}-${month}-${cutoff}`,
          kind: 'showdown' as const,
          provider: PROVIDER,
          regulation,
          from: `${month}-01`,
          to: `${month}-${last}`,
          period: 'month' as const,
          cutoff,
          battles: chaos.info['number of battles'],
          capabilities: [
            'usage',
            'brought',
            'moves',
            'items',
            'abilities',
            'teammates',
            'spreads',
            'speeds',
            'natures',
          ],
          unweighted: ['brought'],
        },
        data,
      })
    }
    if (unknown.size) {
      const msg = `Smogon's ${month} stats of Regulation ${regulation} name what the dex hasn't: ${[...unknown].join(', ')}`
      if (strict) throw new Error(msg)
      console.warn(`${msg} (left out)`)
    }
    return result
  }
}

/**
 * Each snapshot's previous one in its series (`previous`): the same source, regulation, players and kind of period, the
 * latest that ended before it began. Each Pokémon then gets its rank and usage there (`prev`); one it doesn't have is
 * new to the series. A first snapshot has neither. Works on any adapter's snapshots, by what they say of themselves.
 */
export function withPrevious(index: Record<string, Snapshot>, data: Record<string, Record<string, MetaEntry>>) {
  for (const list of seriesOf(index).values()) {
    list.forEach((s, i) => {
      const before = list[i - 1]
      if (!before) return
      s.previous = before.id
      const then = data[before.id]!
      for (const [id, m] of Object.entries(data[s.id]!)) {
        const p = then[id]
        if (p) m.prev = { rank: p.rank, usage: p.usage }
      }
    })
  }
}

/**
 * The snapshots by series (the same source, regulation, players and kind of period), each series' in order, by a key
 * naming it ("smogon-mb-1760-month").
 */
function seriesOf(index: Record<string, Snapshot>): Map<string, Snapshot[]> {
  const series = new Map<string, Snapshot[]>()
  for (const s of Object.values(index)) {
    const key = [s.provider.name, s.regulation, s.cutoff, s.period]
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
    series.set(key, [...(series.get(key) ?? []), s])
  }
  for (const list of series.values()) list.sort((a, b) => a.from.localeCompare(b.from))
  return series
}

/**
 * Each series' history (`meta/history/<key>.json`): every Pokémon's rank and usage in each of its snapshots, in order,
 * null where it wasn't, for a Pokémon's page to draw. Each snapshot is given its series' key (`history`); one alone in
 * its series has none to draw, and no history.
 */
export function histories(index: Record<string, Snapshot>, data: Record<string, Record<string, MetaEntry>>) {
  const files: Record<string, Record<string, ([number, number] | null)[]>> = {}
  for (const [key, list] of seriesOf(index)) {
    if (list.length < 2) continue
    const ids = new Set(list.flatMap((s) => Object.keys(data[s.id]!)))
    files[key] = Object.fromEntries(
      [...ids].sort().map((id) => [
        id,
        list.map((s) => {
          const m = data[s.id]![id]
          return m ? [m.rank, m.usage] : null
        }),
      ]),
    )
    for (const s of list) s.history = key
  }
  return files
}

/** Shares to 4 decimals (0.01%): finer is noise, and it keeps the files small. */
const round = (x: number) => Math.round(x * 1e4) / 1e4
