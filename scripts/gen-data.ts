// Generates `src/data/generated/` from Pokémon Showdown's Champions mod, at the commit pinned in `sources.json`, and
// names in every locale from PokéAPI's data (`languages.ts` says where) and `overrides.ts`, which fills in what
// PokéAPI lacks or has outdated. The regulation is `VITE_REGULATION` in `.env`. Run with `npm run gen-data`; `npm run gen-data -- --update` first moves every pin to
// the latest version.
//
// Showdown's own code loads the data (through jiti, which runs its TypeScript), so the Champions mod is merged over
// Gen 9 and the format's rules apply exactly as on Showdown. Availability comes from the regulation's legal Pokémon:
// an ability is available when one of them can have it, a move when one of them learns it.
//
// Sprites come from Showdown's server, trimmed to the regulation's entries (`sprites.ts`).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import * as prettier from 'prettier'
import { descriptions as ABILITY_DESCRIPTIONS } from '../src/i18n/en/abilities.ts'
import { descriptions as ITEM_DESCRIPTIONS } from '../src/i18n/en/items.ts'
import { descriptions as MOVE_DESCRIPTIONS } from '../src/i18n/en/moves.ts'
import { LOCALES, type Locale } from '../src/i18n/locales.ts'
import { LANGUAGES, type Language } from './languages.ts'
import { NAMES, type CategoryKey } from './overrides.ts'
import { ConditionScan } from './conditions.ts'
import { ITEM_ICONS, POKEMON_ICONS, SpriteSource, iconIndexes, sheetLayout, trimSheet } from './sprites.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'node_modules/.cache')
const SOURCES_FILE = join(ROOT, 'scripts/sources.json')
const OUT = join(ROOT, 'src/data/generated')
/** Sprites the app imports (hashed by Vite), and the ones it loads by URL, one per Pokémon. */
const SPRITES_OUT = join(ROOT, 'src/assets/sprites')
const PUBLIC_SPRITES = join(ROOT, 'public/sprites')

const SHOWDOWN_REPO = 'https://github.com/smogon/pokemon-showdown.git'
const POKEAPI_RAW = 'https://raw.githubusercontent.com/PokeAPI/pokeapi'
const CLIENT_REPO = 'https://github.com/smogon/pokemon-showdown-client.git'
const CLIENT_RAW = 'https://raw.githubusercontent.com/smogon/pokemon-showdown-client'
/** The parts of Showdown's repo its `Dex` needs. */
const SHOWDOWN_PATHS = ['/data/', '/sim/', '/lib/', '/config/', '/package.json']

interface Sources {
  showdown: string
  pokeapi: string
  /** Showdown's client, for its table of where each Pokémon's icon is on the sheet. */
  client: string
  /** The day Showdown's sprites were fetched: they aren't versioned, so this keys their cache. */
  sprites: string
}

// The little of Showdown's API used here.
interface Species {
  id: string
  name: string
  num: number
  exists: boolean
  isNonstandard: string | null
  /** The species a forme belongs to ("Garchomp" for Garchomp-Mega-Z), and the forme ("Mega-Z"; empty for the base). */
  baseSpecies: string
  forme: string
  abilities: Record<string, string>
  types: string[]
  baseStats: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
  weightkg: number
  /** The name of its sprites on Showdown's server: `garchomp-megaz`. */
  spriteid: string
  /** The item it needs: a Mega Stone, or Ogerpon's masks. */
  requiredItem?: string
  prevo: string
  evos: string[]
  isMega?: boolean
  /** Formes a battle changes it into (Megas, Aegislash-Blade): the forme it changes from. */
  battleOnly?: string | string[]
  /** Formes that only look different (Vivillon's patterns). */
  isCosmeticForme?: boolean
}
/** An ability, move or item. */
interface Entry {
  id: string
  name: string
  num: number
  isNonstandard: string | null
}
interface Move extends Entry {
  type: string
  category: 'Physical' | 'Special' | 'Status'
  basePower: number
  /** `true` for moves that never miss. */
  accuracy: number | true
  pp: number
  noPPBoosts?: boolean
  priority: number
  target: string
  flags: Record<string, 1>
}
interface Item extends Entry {
  /** Its cell on Showdown's item sheet. */
  spritenum: number
  /** A Mega Stone's Pokémon and the Mega it becomes: `{ Garchomp: 'Garchomp-Mega-Z' }`. */
  megaStone?: Record<string, string>
  isBerry: boolean
  /** The Pokémon it only works for (Mega Stones, Ogerpon's masks). */
  itemUser?: string[]
}
interface RuleTable {
  isBannedSpecies(species: Species): boolean
  isBanned(thing: string): boolean
}
interface Format {
  name: string
  mod: string
}
interface ModdedDex {
  /** `getMovePool`: every move a species can learn, its pre-evolutions' and base forme's included. */
  species: { all(): readonly Species[]; get(name: string): Species; getMovePool(id: string): Set<string> }
  abilities: { all(): readonly Entry[] }
  moves: { all(): readonly Move[] }
  items: { all(): readonly Item[]; get(name: string): Item }
  formats: { all(): readonly Format[]; getRuleTable(format: Format): RuleTable }
  forFormat(format: Format): ModdedDex
  /**
   * Descriptions by ID, resolved for this dex: its mod's own text when it has one (Champions changes some abilities),
   * else its generation's, else the latest; a missing `desc` or `shortDesc` falls back to the other.
   */
  loadTextData(): Record<TextTable, Record<string, { desc: string; shortDesc: string }>>
}
type TextTable = 'Abilities' | 'Moves' | 'Items'

/**
 * The move flags the app shows, of Showdown's: what boosts or blocks a move (Iron Fist, Soundproof, Bulletproof),
 * whether it makes contact, and `protect` inverted: damaging moves that go through Protect.
 */
const MOVE_FLAGS = [
  'contact',
  'sound',
  'punch',
  'bite',
  'slicing',
  'pulse',
  'bullet',
  'wind',
  'powder',
  'dance',
  'heal',
  'bypasssub',
  'reflectable',
  'protect',
] as const

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function latestCommit(repo: string): string {
  return git(ROOT, 'ls-remote', repo, 'refs/heads/master').split('\t')[0]!
}

/** Showdown's repo at `commit`, sparse-checked out into the cache on first use. */
function showdownCheckout(commit: string): string {
  const dir = join(CACHE, 'showdown', commit)
  if (existsSync(join(dir, 'sim/dex.ts'))) return dir
  console.log(`Fetching Pokémon Showdown ${commit.slice(0, 7)}…`)
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q')
  git(dir, 'remote', 'add', 'origin', SHOWDOWN_REPO)
  git(dir, 'sparse-checkout', 'set', '--no-cone', ...SHOWDOWN_PATHS)
  git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', commit)
  git(dir, 'checkout', '-q', 'FETCH_HEAD')
  return dir
}

/** The body of a GET request. Server errors and dropped connections are usually brief: try a few times. */
async function get(url: string): Promise<string> {
  return (await getBinary(url, false))!.toString('utf8')
}

/** The body of a GET request as bytes, or null when `missingOk` and there's nothing there (404). */
async function getBinary(url: string, missingOk: boolean): Promise<Buffer | null> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url).catch((error: Error) => error)
    if (res instanceof Response && res.ok) return Buffer.from(await res.arrayBuffer())
    if (missingOk && res instanceof Response && res.status === 404) return null
    const retry = !(res instanceof Response) || res.status >= 500
    if (!retry || attempt === 4)
      throw new Error(`${url}: ${res instanceof Response ? `HTTP ${res.status}` : res.message}`)
    await new Promise((wait) => setTimeout(wait, 2000 * attempt))
  }
}

/** A PokéAPI CSV at `commit`, cached, as rows of named columns. */
async function pokeapiCsv(commit: string, file: string): Promise<Record<string, string>[]> {
  const path = join(CACHE, 'pokeapi', commit, file)
  if (!existsSync(path)) {
    const csv = await get(`${POKEAPI_RAW}/${commit}/data/v2/csv/${file}`)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, csv)
  }
  const [head, ...rows] = parseCsv(readFileSync(path, 'utf8'))
  return rows.map((row) => Object.fromEntries(head!.map((col, i) => [col, row[i] ?? ''])))
}

/** Minimal RFC 4180 parsing: quoted fields may hold commas, newlines and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[i++]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f)) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

/** Showdown's IDs are names lowercased with everything but letters and digits removed. */
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function regulation(): string {
  const m = readFileSync(join(ROOT, '.env'), 'utf8').match(/^VITE_REGULATION=(.+)$/m)
  if (!m) throw new Error('VITE_REGULATION is missing from .env')
  return m[1]!.trim()
}

/** Names in `language` (PokéAPI's identifier) by Showdown ID, from a PokéAPI table (`abilities`) and its names table
 * (`ability_names`, keyed by `ability_id`). */
async function pokeapiNames(
  commit: string,
  language: string,
  table: string,
  namesTable: string,
  key: string,
): Promise<Map<string, string>> {
  const languageId = (await pokeapiCsv(commit, 'languages.csv')).find((l) => l.identifier === language)?.id
  if (!languageId) throw new Error(`PokéAPI has no language "${language}"`)
  const ids = new Map((await pokeapiCsv(commit, `${table}.csv`)).map((r) => [r.id, toId(r.identifier!)]))
  const names = new Map<string, string>()
  for (const r of await pokeapiCsv(commit, `${namesTable}.csv`)) {
    if (r.local_language_id === languageId) names.set(ids.get(r[key]!)!, r.name!)
  }
  return names
}

/** A JSON object with one entry per line (so diffs are one line per change), formatted with the project's Prettier
 * settings. */
async function writeJson(file: string, data: Record<string, unknown>) {
  const path = join(OUT, file)
  const lines = Object.entries(data).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  const options = await prettier.resolveConfig(path)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(path, await prettier.format(`{\n${lines.join(',\n')}\n}`, { ...options, filepath: path }))
  console.log(`Wrote ${file}`)
}

/** A short fingerprint of a source description, recorded by the curated text written from it. */
function hashText(short: string, long: string): string {
  return createHash('sha256')
    .update(
      `${short}
${long}`,
    )
    .digest('hex')
    .slice(0, 8)
}

/** A curated description: our own English, or its translation. */
interface Curated {
  short: string
  long?: string
  /** The text it was written from: Showdown's for English, ours in English for a translation (`hashText` of both). */
  source: string
}

/**
 * Compares curated descriptions with the source they were written from: entries whose source changed since (to
 * revise), entries the regulation has with no curated text yet, and curated entries it no longer has. `source` names
 * the text they're written from, `hash` fingerprints it for an entry (`undefined` for one with nothing to write from).
 */
function reportDrift(
  key: string,
  locale: Locale,
  available: Entry[],
  curated: Record<string, Curated>,
  source: string,
  hash: (e: Entry) => string | undefined,
) {
  const file = `src/i18n/${locale}/${key}.ts`
  const changed = available.filter((e) => curated[e.id] && hash(e) && curated[e.id]!.source !== hash(e))
  const writable = available.filter((e) => hash(e))
  const unwritten = writable.filter((e) => !curated[e.id])
  const gone = Object.keys(curated).filter((id) => !writable.some((e) => e.id === id))
  if (changed.length) {
    console.warn(`${source} changed for these ${key}; revise their descriptions in ${file}:`)
    for (const e of changed) console.warn(`  ${e.id}: source ${curated[e.id]!.source} -> ${hash(e)}`)
  }
  if (gone.length) console.warn(`${file} describes ${key} with nothing to write from: ${gone.join(', ')}`)
  console.log(`${key} descriptions (${locale}): ${writable.length - unwritten.length} of ${writable.length} written`)
  if (unwritten.length && locale !== 'en') console.log(`  missing: ${unwritten.map((e) => e.id).join(', ')}`)
}

/** A dex category the script generates. */
interface Category {
  /** Output files (`<key>.json`, `<key>.names.<locale>.json`) and the `overrides.ts` key. */
  key: CategoryKey
  /** Every entry, with whether the regulation has it. */
  entries: () => (Entry & { available: boolean })[]
  /** PokéAPI's table, its names table and the names table's key column. */
  pokeapi: [table: string, names: string, key: string]
  /** Showdown's text table, for categories whose descriptions go in `<key>.json`. */
  text?: TextTable
  /** Our curated descriptions written from Showdown's, checked for drift (`src/i18n/en/<key>.ts`). */
  curated?: Record<string, Curated>
  /** The legal Pokémon with each entry the regulation has, for categories whose pages list them (`<key>.holders.json`). */
  holders?: (id: string) => string[]
  /** What the category's pages show of each entry the regulation has (`<key>.data.json`). */
  details?: (id: string) => Record<string, unknown>
  /**
   * Builds a locale's names from the names its sources give (by ID), for categories whose entries the sources don't
   * name one by one: Pokémon formes.
   */
  compose?: (names: Map<string, string>) => Map<string, string>
}

async function main() {
  const saved = readFileSync(SOURCES_FILE, 'utf8')
  const parsed = JSON.parse(saved) as Partial<Sources>
  const today = new Date().toISOString().slice(0, 10)
  const sources: Sources = {
    showdown: parsed.showdown!,
    pokeapi: parsed.pokeapi!,
    client: parsed.client ?? latestCommit(CLIENT_REPO),
    sprites: parsed.sprites ?? today,
  }
  if (process.argv.includes('--update')) {
    sources.showdown = latestCommit(SHOWDOWN_REPO)
    sources.pokeapi = latestCommit('https://github.com/PokeAPI/pokeapi.git')
    sources.client = latestCommit(CLIENT_REPO)
    sources.sprites = today
    console.log(
      `Pinned Showdown ${sources.showdown.slice(0, 7)}, PokéAPI ${sources.pokeapi.slice(0, 7)}, ` +
        `Showdown's client ${sources.client.slice(0, 7)}, sprites of ${sources.sprites}`,
    )
  }

  const reg = regulation()
  const languages = Object.entries(LANGUAGES) as [Exclude<Locale, 'en'>, Language][]
  const dir = showdownCheckout(sources.showdown)
  const jiti = createJiti(import.meta.url, { moduleCache: true })
  const { Dex } = (await jiti.import(join(dir, 'sim/dex.ts'))) as { Dex: ModdedDex }

  // The regulation's VGC format, e.g. "[Gen 9 Champions] VGC 2026 Reg M-C". Its mod is the data that regulation
  // uses: `champions` for the current one, a frozen snapshot like `championsregmb` for past ones.
  const pattern = new RegExp(`^\\[Gen 9 Champions\\] VGC \\d+ Reg ${reg.replace(/[^\w]/g, '\\$&')}$`)
  const format = Dex.formats.all().find((f) => pattern.test(f.name))
  if (!format) throw new Error(`Showdown ${sources.showdown.slice(0, 7)} has no VGC format for Regulation ${reg}`)
  const dex = Dex.forFormat(format)
  const rules = dex.formats.getRuleTable(format)
  console.log(`${format.name} (mod: ${format.mod})`)

  // The regulation's legal Pokémon, Mega Evolutions included. A forme battles change it into is legal when one it
  // changes from is: the format bans Ogerpon, not its Tera formes, which no team can bring anyway.
  const allowed = dex.species.all().filter((s) => s.exists && !rules.isBannedSpecies(s))
  const allowedIds = new Set(allowed.map((s) => s.id))
  const roster = allowed.filter(
    (s) => !s.battleOnly || [s.battleOnly].flat().some((from) => allowedIds.has(dex.species.get(from).id)),
  )
  console.log(`${roster.length} legal Pokémon`)
  const legal = new Set(roster.map((s) => s.id))
  const abilitiesHeld = new Set(roster.flatMap((s) => Object.values(s.abilities).map(toId)))
  // Abilities only battle-only formes have (Megas'), which team validation never checks: Showdown still tags some new
  // ones as not in the game yet (Mega Lucario Z's Aura Guard) though the formes that have them are legal.
  const battleOnlyAbilities = new Set(
    roster.filter((s) => s.battleOnly).flatMap((s) => Object.values(s.abilities).map(toId)),
  )
  /** The legal Pokémon that can have an ability, in Pokédex order. */
  const holders = (ability: string) =>
    roster.filter((s) => Object.values(s.abilities).some((a) => toId(a) === ability)).map((s) => s.id)
  const movesLearned = new Set(roster.flatMap((s) => [...dex.species.getMovePool(s.id)]))
  const moveAvailable = (m: Move) => movesLearned.has(m.id) && !m.isNonstandard && !rules.isBanned(`move:${m.id}`)
  const itemAvailable = (i: Item) => !i.isNonstandard && !rules.isBanned(`item:${i.id}`)
  const movesById = new Map(dex.moves.all().map((m) => [m.id, m]))
  const availableMoves = new Set([...movesById.values()].filter((m) => m.num > 0 && moveAvailable(m)).map((m) => m.id))
  /** A legal Pokémon's moves the regulation has, by ID. */
  const learnset = (id: string) => [...dex.species.getMovePool(id)].filter((m) => availableMoves.has(m)).sort()

  // Each sprite sheet holds the regulation's entries in ID order, the order of the generated files: an entry's cell
  // is its position in that order.
  const byId = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => a.id.localeCompare(b.id))
  const legalItems = byId(dex.items.all().filter((i) => i.num > 0 && itemAvailable(i)))
  const pokemonCell = new Map(byId(roster).map((s, i) => [s.id, i]))
  const itemCell = new Map(legalItems.map((it, i) => [it.id, i]))
  const speciesId = (name: string) => dex.species.get(name).id

  // Each legal Pokémon's gen5 sprite. Showdown hasn't drawn some new Megas yet: their pages show their icon instead.
  const sprites = new SpriteSource(join(CACHE, 'sprites', sources.sprites), (url) => getBinary(url, true))
  const ownSprites = new Map<string, Buffer>()
  for (const s of roster) {
    const sprite = await sprites.file(`gen5/${s.spriteid}.png`)
    if (sprite) ownSprites.set(s.id, sprite)
  }
  const unsprited = roster.filter((s) => !ownSprites.has(s.id)).map((s) => s.id)
  if (unsprited.length) console.warn(`No gen5 sprite yet, so their pages show their icon: ${unsprited.join(', ')}`)

  // `num <= 0` leaves out Showdown's placeholders ("No Ability") and its fan-made CAP entries (negative numbers).
  const categories: Category[] = [
    {
      // Available when a legal Pokémon can have it.
      key: 'abilities',
      // Showdown's split ones stay split, like "Embody Aspect (Teal)", one per Ogerpon mask, though the games show
      // one name: their names in other languages are in `overrides.ts`.
      entries: () =>
        dex.abilities
          .all()
          .filter((a) => a.num > 0)
          .map((a) => ({
            ...a,
            available:
              abilitiesHeld.has(a.id) &&
              (!a.isNonstandard || battleOnlyAbilities.has(a.id)) &&
              !rules.isBanned(`ability:${a.id}`),
          })),
      pokeapi: ['abilities', 'ability_names', 'ability_id'],
      text: 'Abilities',
      curated: ABILITY_DESCRIPTIONS,
      holders,
    },
    {
      // Available when a legal Pokémon learns it, and the game has it: the Champions mod drops some moves Pokémon
      // still learn in Scarlet and Violet (Tackle, Swift).
      key: 'moves',
      entries: () =>
        dex.moves
          .all()
          .filter((m) => m.num > 0)
          .map((m) => ({
            ...m,
            available: moveAvailable(m),
          })),
      pokeapi: ['moves', 'move_names', 'move_id'],
      text: 'Moves',
      curated: MOVE_DESCRIPTIONS,
      details: (id) => {
        const m = movesById.get(id)!
        return {
          type: toId(m.type),
          category: toId(m.category),
          // 0 for status moves, and for moves whose power varies (Low Kick, Gyro Ball): their text says how.
          power: m.basePower,
          accuracy: m.accuracy,
          // As Champions has it: PP capped at 20, then PP Ups always applied (`calculatePP` in its scripts).
          pp: m.noPPBoosts ? m.pp : (m.pp / 5 + 1) * 4,
          priority: m.priority,
          target: m.target,
          flags: MOVE_FLAGS.filter((f) => (f === 'protect' ? !m.flags.protect && m.category !== 'Status' : m.flags[f])),
        }
      },
    },
    {
      // Available when the game has it.
      key: 'items',
      entries: () =>
        dex.items
          .all()
          .filter((i) => i.num > 0)
          .map((i) => ({ ...i, available: itemAvailable(i) })),
      pokeapi: ['items', 'item_names', 'item_id'],
      text: 'Items',
      curated: ITEM_DESCRIPTIONS,
      details: (id) => {
        const it = dex.items.get(id)
        const megas = Object.entries(it.megaStone ?? {}).map(([from, to]) => [speciesId(from), speciesId(to)] as const)
        return {
          icon: itemCell.get(id),
          kind: megas.length ? 'mega' : it.isBerry ? 'berry' : 'held',
          // The legal Megas it brings out, by the Pokémon holding it.
          ...(megas.length && { megas: Object.fromEntries(megas.filter(([, to]) => legal.has(to))) }),
          // The Pokémon it only works for, besides Mega Stones (Ogerpon's masks).
          ...(it.itemUser && !megas.length && { users: it.itemUser.map(speciesId).filter((s) => legal.has(s)) }),
        }
      },
    },
    {
      // Available when the regulation allows it (the roster). Named by species, official in every locale, plus the
      // forme as Showdown labels it: "Garchomp (Mega-Z)", "Raichu (Alola)". Provisional: PokéAPI's official forme names
      // are patchy (no Spanish for most new Megas), so proper forme names wait for the Pokémon category.
      key: 'pokemon',
      entries: () =>
        dex.species
          .all()
          .filter((s) => s.exists && s.num > 0)
          .map((s) => ({ ...s, available: legal.has(s.id) })),
      pokeapi: ['pokemon_species', 'pokemon_species_names', 'pokemon_species_id'],
      details: (id) => {
        const s = dex.species.get(id)
        const battleOnly = Array.isArray(s.battleOnly) ? s.battleOnly[0] : s.battleOnly
        const st = s.baseStats
        return {
          types: s.types.map(toId),
          stats: [st.hp, st.atk, st.def, st.spa, st.spd, st.spe],
          // In slot order. Whether one is the hidden ability makes no difference in competitive play, so it isn't kept.
          abilities: [
            ...new Set(
              (['0', '1', 'H', 'S'] as const).flatMap((slot) => {
                const a = (s.abilities as Record<string, string | undefined>)[slot]
                return a ? [toId(a)] : []
              }),
            ),
          ],
          weight: s.weightkg,
          icon: pokemonCell.get(id),
          ...(!ownSprites.has(id) && { noSprite: true }),
          ...(s.forme && { base: toId(s.baseSpecies), forme: s.forme }),
          ...(s.isMega && { mega: true }),
          ...(battleOnly && { battleOnly: speciesId(battleOnly) }),
          ...(s.isCosmeticForme && { cosmetic: true }),
          ...(s.requiredItem && { item: toId(s.requiredItem) }),
          // The legal ones only: Pokémon the regulation lacks have no page, nor a name.
          ...(s.prevo && legal.has(speciesId(s.prevo)) && { prevo: speciesId(s.prevo) }),
          ...(s.evos.some((e) => legal.has(speciesId(e))) && {
            evos: s.evos.map(speciesId).filter((e) => legal.has(e)),
          }),
        }
      },
      compose: (names) => {
        const named = new Map<string, string>()
        for (const s of roster) {
          const species = names.get(toId(s.baseSpecies))
          if (species) named.set(s.id, s.forme ? `${species} (${s.forme})` : species)
        }
        return named
      },
    },
  ]

  const availableIds: Record<string, string[]> = {}
  for (const c of categories) {
    const entries = c.entries().sort((a, b) => a.id.localeCompare(b.id))
    const available = entries.filter((e) => e.available)

    // Each locale's names: English is Showdown's; the others come from PokéAPI, then the overrides.
    const english = new Map(entries.map((e) => [e.id, e.name]))
    const names = { en: c.compose ? c.compose(english) : english } as Record<Locale, Map<string, string>>
    for (const [locale, language] of languages) {
      names[locale] = await pokeapiNames(sources.pokeapi, language.pokeapi, ...c.pokeapi)
      if (c.compose) names[locale] = c.compose(names[locale])
      const overrides = NAMES[locale]?.[c.key] ?? {}
      const redundant = Object.keys(overrides).filter((id) => overrides[id] === names[locale].get(id))
      if (redundant.length)
        console.warn(`The sources agree with the ${locale} ${c.key} overrides for ${redundant.join(', ')}`)
      for (const [id, name] of Object.entries(overrides)) names[locale].set(id, name)
    }

    // Every entry the regulation has needs a name in every locale: when PokéAPI has none yet, the override does.
    const missing = languages.flatMap(([locale]) =>
      available.filter((e) => !names[locale].has(e.id)).map((e) => `NAMES.${locale}.${c.key}.${e.id} (${e.name})`),
    )
    if (missing.length) throw new Error(`Names missing; add them to scripts/overrides.ts:\n  ${missing.join('\n  ')}`)

    // `<key>.json`: every entry by Showdown ID and whether the regulation has it, plus, for the entries it has,
    // Showdown's descriptions: a short one and a long one (the short one again when there's nothing more to say).
    // They're the source our own, curated descriptions are written from. Names only for the entries the regulation
    // has, the only ones the app shows.
    const text = c.text && dex.loadTextData()[c.text]
    if (text) {
      const missing = available.filter((e) => !text[e.id]?.shortDesc)
      if (missing.length) throw new Error(`Showdown has no description for ${missing.map((e) => e.name).join(', ')}`)
    }
    const data = (e: Entry & { available: boolean }) =>
      text && e.available
        ? { available: true, short: text[e.id]!.shortDesc, long: text[e.id]!.desc }
        : { available: e.available }
    await writeJson(`${c.key}.json`, Object.fromEntries(entries.map((e) => [e.id, data(e)])))
    if (text && c.curated) {
      const en = c.curated
      reportDrift(c.key, 'en', available, en, "Showdown's text", (e) =>
        hashText(text[e.id]!.shortDesc, text[e.id]!.desc),
      )
      // Every other locale's, translated from ours, when it has a file of them.
      for (const locale of Object.keys(LOCALES) as Locale[]) {
        const file = join(ROOT, `src/i18n/${locale}/${c.key}.ts`)
        if (locale === 'en' || !existsSync(file)) continue
        const { descriptions } = (await import(pathToFileURL(file).href)) as { descriptions: Record<string, Curated> }
        reportDrift(c.key, locale, available, descriptions, 'Our English', (e) =>
          en[e.id] ? hashText(en[e.id]!.short, en[e.id]!.long ?? '') : undefined,
        )
      }
    }
    for (const locale of Object.keys(LOCALES) as Locale[]) {
      await writeJson(
        `${c.key}.names.${locale}.json`,
        Object.fromEntries(available.map((e) => [e.id, names[locale].get(e.id)!])),
      )
    }
    if (c.holders) {
      await writeJson(`${c.key}.holders.json`, Object.fromEntries(available.map((e) => [e.id, c.holders!(e.id)])))
    }
    if (c.details) {
      await writeJson(`${c.key}.data.json`, Object.fromEntries(available.map((e) => [e.id, c.details!(e.id)])))
    }
    availableIds[c.key] = available.map((e) => e.id)
    console.log(`${available.length} of ${entries.length} ${c.key} available`)
  }
  // Conditions: the ones the regulation's moves, abilities and items cause, with those sources (by Showdown's
  // condition IDs: `sunnyday` for sun). A condition no source causes isn't in the game.
  const scan = new ConditionScan(toId)
  for (const id of availableIds.moves!) {
    scan.declared(id, movesById.get(id)!)
    scan.code('move', id, movesById.get(id)!)
  }
  const abilitiesById = new Map(dex.abilities.all().map((a) => [a.id, a]))
  for (const id of availableIds.abilities!) scan.code('ability', id, abilitiesById.get(id)!)
  for (const id of availableIds.items!) scan.code('item', id, dex.items.get(id))
  const conditions = scan.result()
  await writeJson('conditions.json', conditions)
  availableIds.conditions = Object.keys(conditions)
  console.log(`${availableIds.conditions.length} conditions caused by what the regulation has`)

  // The IDs the regulation has, per category: all the app needs to know at run time to hide the rest (the files
  // above give it the types, and the category pages their data).
  await writeJson('available.json', availableIds)
  // Each legal Pokémon's moves, for its page (and the other way round, for a move's).
  await writeJson('pokemon.learnsets.json', Object.fromEntries(byId(roster).map((s) => [s.id, learnset(s.id)])))

  // Sprites: the icon sheets cut down to the regulation's entries, in ID order, and each legal Pokémon's own sprite.
  const clientData = await get(`${CLIENT_RAW}/${sources.client}/play.pokemonshowdown.com/src/battle-dex-data.ts`)
  const iconIndex = iconIndexes(clientData)
  // As Showdown's client finds it (`getPokemonIconNum`): its own index for formes, else the National Dex number.
  const pokemonIcon = (s: Species) => iconIndex.get(s.id) ?? (s.num > 0 && s.num <= 1025 ? s.num : 0)
  mkdirSync(SPRITES_OUT, { recursive: true })
  const pokemonSheet = await trimSheet(sprites, POKEMON_ICONS, byId(roster).map(pokemonIcon))
  writeFileSync(join(SPRITES_OUT, 'pokemon.webp'), pokemonSheet)
  const itemSheet = await trimSheet(
    sprites,
    ITEM_ICONS,
    legalItems.map((i) => i.spritenum),
  )
  writeFileSync(join(SPRITES_OUT, 'items.webp'), itemSheet)
  await writeJson('sprites.json', { pokemon: sheetLayout(POKEMON_ICONS), items: sheetLayout(ITEM_ICONS) })
  // Each legal Pokémon's own sprite, by its ID; the folder only ever holds the current regulation's.
  rmSync(join(PUBLIC_SPRITES, 'pokemon'), { recursive: true, force: true })
  mkdirSync(join(PUBLIC_SPRITES, 'pokemon'), { recursive: true })
  for (const [id, sprite] of ownSprites) writeFileSync(join(PUBLIC_SPRITES, 'pokemon', `${id}.png`), sprite)
  console.log(`Wrote the sprites of ${roster.length} Pokémon and ${legalItems.length} items`)

  // Where all of the above came from.
  await writeJson('source.json', {
    note: "Generated by `npm run gen-data` (scripts/gen-data.ts): don't edit anything in this folder by hand.",
    regulation: reg,
    format: format.name,
    showdown: sources.showdown,
    pokeapi: sources.pokeapi,
    client: sources.client,
    sprites: sources.sprites,
  })
  const pinned = JSON.stringify(sources, null, 2) + '\n'
  if (pinned !== saved) {
    writeFileSync(SOURCES_FILE, pinned)
    console.log('Updated scripts/sources.json')
  }
}

await main()
