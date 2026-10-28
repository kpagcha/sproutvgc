// The official tournaments under way, read from Limitless VGC as they stand (`LimitlessVgc.liveEvent`: standings,
// rounds so far, the team lists published so far) into `src/data/generated/live/`, which isn't committed: the deploy
// runs it before building, on a schedule over the weekends (and less often over the week, for the team lists published
// after), so the site shows them live (`.github/workflows/deploy.yml`).
// An event over but not generated yet stays here, its team lists still coming in, until the weekly refresh generates it
// for good (`gen-data --update-tournaments`). Nothing here counts towards what adds events up (trends, builds): the app
// keeps them apart (`LIVE_EVENTS` in `src/data/tournaments.ts`).
//
// Quick, and needing no Showdown: what the dex has comes from the generated data. Run with `npm run live-tournaments`.
// A failure leaves no event live rather than failing the build, said as a warning on the workflow's run and as
// `failed=true` in `$GITHUB_OUTPUT`, beside how many it wrote as `events=`, when run by a workflow.

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LimitlessVgc,
  PROVIDER,
  slugOf,
  type ApiListed,
  type EventType,
  type Known,
  type LiveEvent,
  type Standing,
  type TournamentEvent,
  type UpcomingEvent,
} from './limitlessVgc.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GENERATED = join(ROOT, 'src/data/generated')
const OUT = join(GENERATED, 'live')
/** As the generator's. */
const USER_AGENT = 'sproutvgc (+https://kpagcha.github.io/sproutvgc/)'
/** How long after its start an event over but not generated yet is still read: past it, the weekly refresh has it. */
const DAYS = 10

const readJson = <T>(file: string, fallback: T): T =>
  existsSync(join(GENERATED, file)) ? (JSON.parse(readFileSync(join(GENERATED, file), 'utf8')) as T) : fallback

const toId = (s: string) =>
  s
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

async function get(url: string): Promise<Buffer | null> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch((error: Error) => error)
    if (res instanceof Response && res.ok) return Buffer.from(await res.arrayBuffer())
    if (res instanceof Response && res.status === 404) return null
    if ((res instanceof Response && res.status < 500) || attempt === 3)
      throw new Error(`${url}: ${res instanceof Response ? `HTTP ${res.status}` : res.message}`)
    await new Promise((wait) => setTimeout(wait, 2000 * attempt))
  }
}

/** What the dex has, from the generated data: a team list's Pokémon by its ID, Megas by their stones. */
function known(): Known {
  const available = readJson<Record<string, string[]>>('available.json', {})
  const items = readJson<Record<string, { megas?: Record<string, string> }>>('items.data.json', {})
  const pokemon = new Set(available.pokemon)
  return {
    pokemon: (name) => (pokemon.has(toId(name)) ? toId(name) : undefined),
    moves: new Set(available.moves),
    items: new Set(available.items),
    abilities: new Set(available.abilities),
    natures: new Set(Object.keys(readJson<Record<string, unknown>>('natures.json', {}))),
    mega: (p, item) => {
      const to = items[item]?.megas?.[p]
      return to && pokemon.has(to) ? to : undefined
    },
  }
}

const TYPES: Record<string, EventType> = {
  regional: 'regional',
  international: 'international',
  worlds: 'worlds',
  special: 'special',
  national: 'national',
}

/** What's known of an event on the standings site before its standings: from the list of those to come (generated
 * before it started, which has its name, number and regulation), matched by its city and start, else from the standings
 * site alone, named after its type and city, of the current regulation. */
function infoOf(l: ApiListed, upcoming: UpcomingEvent[], regulation: string) {
  const start = l.utc_start.slice(0, 10)
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000
  const city = toId(l.city)
  const u = upcoming.find((e) => Math.abs(day(e.date) - day(start)) <= 2 && toId(e.name).includes(city))
  const type = u?.type ?? TYPES[l.type] ?? 'regional'
  const name = u?.name ?? `${l.type.charAt(0).toUpperCase()}${l.type.slice(1)} ${l.city}`
  const date = u?.date ?? start
  return {
    id: slugOf(name, date),
    n: u?.n ?? -l.id,
    name,
    date,
    country: l.country ?? u?.country ?? '',
    players: 0,
    type,
    category: 'official' as const,
    regulation: u?.regulation ?? regulation,
    provider: PROVIDER,
    url: `https://standings.limitlessvgc.com/${l.id}/standings`,
  }
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  const regulation = readFileSync(join(ROOT, '.env'), 'utf8')
    .match(/^VITE_REGULATION=(.+)$/m)?.[1]
    ?.trim()
  if (!regulation) throw new Error('VITE_REGULATION is missing from .env')
  const generated = readJson<Record<string, TournamentEvent>>('tournaments/index.json', {})
  const upcoming = Object.values(readJson<Record<string, UpcomingEvent>>('tournaments/upcoming.json', {}))
  const limitless = new LimitlessVgc(join(ROOT, 'node_modules/.cache/limitlessvgc'), get, {
    update: false,
    offline: false,
  })
  const ids = new Set(Object.keys(generated))
  const index: Record<string, LiveEvent> = {}
  const dex = known()
  for (const l of await limitless.underWay(new Set(Object.values(generated).map((e) => e.t)), DAYS)) {
    const info = infoOf(l, upcoming, regulation)
    if (ids.has(info.id)) info.id = `${info.id}-${info.date.slice(5, 7)}`
    ids.add(info.id)
    const { event, standings, rounds } = await limitless.liveEvent(l.id, info, info.regulation, dex)
    index[event.id] = event
    mkdirSync(OUT, { recursive: true })
    const byPlacing = Object.fromEntries(
      standings.map(({ placing, ...s }): [number, Omit<Standing, 'placing'>] => [placing, s]),
    )
    writeFileSync(join(OUT, `${event.id}.json`), JSON.stringify(byPlacing))
    writeFileSync(join(OUT, `${event.id}.rounds.json`), JSON.stringify(rounds))
    console.log(
      `${event.name}: ${event.live.completed ? 'over' : event.live.cut ? `top cut, ${event.live.cut} matches` : `round ${event.live.round} of ${event.live.rounds}`}, ${event.players} players, ${event.teams} team lists`,
    )
  }
  const n = Object.keys(index).length
  if (n) writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
  else console.log('No tournament under way')
  if (limitless.requests) console.log(`Made ${limitless.requests} requests to Limitless VGC`)
  return n
}

let n = 0
let failed = false
try {
  n = await main()
} catch (error) {
  // The site builds without them rather than not at all, but not silently: the workflow's run says so.
  const message = `No live tournaments: ${error instanceof Error ? error.message : String(error)}`
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=Live tournaments::${message}` : message)
  rmSync(OUT, { recursive: true, force: true })
  failed = true
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `events=${n}\nfailed=${failed}\n`)
