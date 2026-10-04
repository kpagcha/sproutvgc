// Cells of the icon sheets `npm run gen-data` trims from Showdown's (`src/assets/sprites/`): each entry's `icon` is
// its cell, and `sprites.json` how the cells are laid out.

import LAYOUT from '@/data/generated/sprites.json'
import pokemonSheet from '@/assets/sprites/pokemon.webp'
import itemSheet from '@/assets/sprites/items.webp'
import physical from '@/assets/sprites/physical.png'
import special from '@/assets/sprites/special.png'
import status from '@/assets/sprites/status.png'
import type { Category } from '@/data/moves'

export type Sheet = keyof typeof LAYOUT

const URLS: Record<Sheet, string> = { pokemon: pokemonSheet, items: itemSheet }

/** The move category badges (Showdown's), the size of a type badge. */
export const CATEGORY_ICONS: Record<Category, string> = { physical, special, status }

/** The size of a sheet's cells. */
export const cellSize = (sheet: Sheet) => ({ width: LAYOUT[sheet].width, height: LAYOUT[sheet].height })

/** The inline style that shows cell `cell` of `sheet`, `scale` times its size (whole numbers keep the pixels crisp). */
export function cellStyle(sheet: Sheet, cell: number, scale = 1): Record<string, string> {
  const { width, height, columns } = LAYOUT[sheet]
  const x = (cell % columns) * width * scale
  const y = Math.floor(cell / columns) * height * scale
  return {
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    backgroundImage: `url(${URLS[sheet]})`,
    backgroundPosition: `-${x}px -${y}px`,
    backgroundSize: scale === 1 ? 'auto' : `${columns * width * scale}px auto`,
  }
}
