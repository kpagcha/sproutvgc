// The sprites `gen-data.ts` takes from Pokémon Showdown's server, trimmed to what the regulation has: its icon sheets
// (every Pokémon and every item, one sheet each) cut down to the regulation's entries, its gen5 sprite of each legal
// Pokémon, and the move category badges. Showdown's sprites aren't versioned, so a fetch is cached under the date it
// was made (`sprites` in `sources.json`): reruns read the cache, and `--update` fetches them again.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const SPRITES = 'https://play.pokemonshowdown.com/sprites'

/** A cell of a sprite sheet: its size, and how many cells a row has. */
interface Sheet {
  file: string
  width: number
  height: number
  columns: number
}

/** Showdown's sheets (`getPokemonIcon` and `getItemIcon` in its client's `battle-dex.ts`). */
export const POKEMON_ICONS: Sheet = { file: 'pokemonicons-sheet.png', width: 40, height: 30, columns: 12 }
export const ITEM_ICONS: Sheet = { file: 'itemicons-sheet.png', width: 24, height: 24, columns: 16 }
/** Ours: rows as long as Showdown's, so the trimmed sheets keep its proportions. */
const OUT_COLUMNS = 16

/** Fetches Showdown's sprites, through a cache keyed by the date of the fetch. */
export class SpriteSource {
  private cache: string
  private get: (url: string) => Promise<Buffer | null>
  constructor(cache: string, get: (url: string) => Promise<Buffer | null>) {
    this.cache = cache
    this.get = get
  }

  /** A sprite (`gen5/garchomp.png`), or null if Showdown has none. */
  async file(path: string): Promise<Buffer | null> {
    const cached = join(this.cache, path)
    const missing = `${cached}.missing`
    if (existsSync(cached)) return readFileSync(cached)
    if (existsSync(missing)) return null
    const body = await this.get(`${SPRITES}/${path}`)
    mkdirSync(dirname(cached), { recursive: true })
    if (body) writeFileSync(cached, body)
    else writeFileSync(missing, '')
    return body
  }

  /** A sprite as raw RGBA pixels. */
  async pixels(path: string): Promise<{ data: Buffer; width: number; height: number }> {
    const body = await this.file(path)
    if (!body) throw new Error(`Showdown has no sprite ${path}`)
    const { data, info } = await sharp(body).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
  }
}

/**
 * A sheet of the cells at `indexes` of Showdown's `sheet`, in that order, `OUT_COLUMNS` to a row: the cell for
 * `indexes[i]` is cell `i` of ours. Lossless WebP: a quarter of the size of the same pixels as a PNG.
 */
export async function trimSheet(source: SpriteSource, sheet: Sheet, indexes: number[]): Promise<Buffer> {
  const from = await source.pixels(sheet.file)
  const width = OUT_COLUMNS * sheet.width
  const height = Math.ceil(indexes.length / OUT_COLUMNS) * sheet.height
  const out = Buffer.alloc(width * height * 4)
  indexes.forEach((index, i) => {
    const sx = (index % sheet.columns) * sheet.width
    const sy = Math.floor(index / sheet.columns) * sheet.height
    const dx = (i % OUT_COLUMNS) * sheet.width
    const dy = Math.floor(i / OUT_COLUMNS) * sheet.height
    if (sy + sheet.height > from.height) throw new Error(`${sheet.file} has no cell ${index}`)
    for (let y = 0; y < sheet.height; y++) {
      const start = ((sy + y) * from.width + sx) * 4
      from.data.copy(out, ((dy + y) * width + dx) * 4, start, start + sheet.width * 4)
    }
  })
  return sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer()
}

/** How a trimmed sheet's cell `i` is placed: the app positions its background from these. */
export const sheetLayout = (sheet: Sheet) => ({ width: sheet.width, height: sheet.height, columns: OUT_COLUMNS })

/**
 * Showdown's icon index of each Pokémon that isn't at its National Dex number (formes, Megas): its client's
 * `BattlePokemonIconIndexes` table, read as data (`id: 1032 + 35,`).
 */
export function iconIndexes(source: string): Map<string, number> {
  const table = source.match(/export const BattlePokemonIconIndexes\b[^{]*\{([\s\S]*?)\n\};/)
  if (!table) throw new Error("Showdown's client has no BattlePokemonIconIndexes")
  const indexes = new Map<string, number>()
  for (const [, id, sum] of table[1]!.matchAll(/^\s*(\w+): ([\d +]+),/gm)) {
    indexes.set(
      id!,
      sum!.split('+').reduce((total, n) => total + Number(n), 0),
    )
  }
  return indexes
}
