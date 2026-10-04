// The type chart as a PNG to download: drawn on a canvas rather than captured from the page (the badges' glyphs are
// CSS masks, which DOM-to-image tools don't render well), always in the light palette so the image is the same
// whatever the reader's theme.
import { TYPES, chart, type TypeId } from '@/data/types'
import { TYPE_GLYPHS } from '@/data/typeGlyphs'
import { chartCellText } from '@/lib/typecalc'

// The light theme's tokens (main.css `:root`).
const LIGHT = {
  panel: '#fffdf7',
  panelAlt: '#f6f1e4',
  border: '#c9c1b1',
  ink: '#141414',
  text: '#141414',
  muted: '#5d5850',
}

// The multiplier colors (main.css `--m*-bg/fg`, light).
const MULT: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#2f2f2f', fg: '#ffffff' },
  0.25: { bg: '#c0392b', fg: '#ffffff' },
  0.5: { bg: '#f4b6b0', fg: '#6b1510' },
  2: { bg: '#a9dba0', fg: '#134a13' },
  4: { bg: '#3a9a3a', fg: '#ffffff' },
}

// The official type colors (retro.css's `--tc`).
const TYPE_COLORS: Record<TypeId, string> = {
  normal: '#9fa19f',
  fire: '#e62829',
  water: '#2980ef',
  electric: '#fac000',
  grass: '#3fa129',
  ice: '#3fd8ff',
  fighting: '#ff8000',
  poison: '#9141cb',
  ground: '#915121',
  flying: '#81b9ef',
  psychic: '#ef4179',
  bug: '#91a119',
  rock: '#afa981',
  ghost: '#704170',
  dragon: '#5060e1',
  dark: '#50413f',
  steel: '#60a1b8',
  fairy: '#ef70ef',
}

// Layout in CSS pixels, drawn at SCALE for a sharp image.
const SCALE = 2
const PAD = 16
const TITLE_H = 32
const FOOTER_H = 22
const CELL_W = 36
const CELL_H = 24
const HEAD_W = 40 // the row headers' column
const HEAD_H = 30 // the column headers' row
const BADGE_W = 26
const BADGE_H = 20
const GLYPH = 14

async function loadGlyphs(): Promise<Record<TypeId, HTMLImageElement>> {
  const entries = await Promise.all(
    TYPES.map(async (type) => {
      const img = new Image()
      img.src = TYPE_GLYPHS[type]
      await img.decode()
      return [type, img] as const
    }),
  )
  return Object.fromEntries(entries) as Record<TypeId, HTMLImageElement>
}

// A small type badge, as retro.css draws it: the type's color in an ink frame with a hard shadow, and the white glyph.
function badge(ctx: CanvasRenderingContext2D, glyph: HTMLImageElement, color: string, cx: number, cy: number) {
  const x = Math.round(cx - BADGE_W / 2)
  const y = Math.round(cy - BADGE_H / 2)
  ctx.fillStyle = LIGHT.ink
  ctx.fillRect(x + 1, y + 1, BADGE_W, BADGE_H)
  ctx.fillRect(x, y, BADGE_W, BADGE_H)
  ctx.fillStyle = color
  ctx.fillRect(x + 1, y + 1, BADGE_W - 2, BADGE_H - 2)
  ctx.drawImage(glyph, x + (BADGE_W - GLYPH) / 2, y + (BADGE_H - GLYPH) / 2, GLYPH, GLYPH)
}

export async function downloadChart(opts: { title: string; atk: string; def: string; font: string }): Promise<void> {
  const glyphs = await loadGlyphs()
  const gridW = HEAD_W + TYPES.length * CELL_W
  const gridH = HEAD_H + TYPES.length * CELL_H
  const width = PAD * 2 + gridW
  const height = PAD * 2 + TITLE_H + gridH + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas context')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = LIGHT.panel
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = LIGHT.text
  ctx.font = `bold 20px ${opts.font}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(opts.title, PAD, PAD)

  const x0 = PAD
  const y0 = PAD + TITLE_H

  // Header backgrounds: the top row and the left column.
  ctx.fillStyle = LIGHT.panelAlt
  ctx.fillRect(x0, y0, gridW, HEAD_H)
  ctx.fillRect(x0, y0, HEAD_W, gridH)

  // The corner's axis labels.
  ctx.fillStyle = LIGHT.muted
  ctx.font = `9px ${opts.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${opts.atk} ↓`, x0 + HEAD_W / 2, y0 + HEAD_H / 2 - 5)
  ctx.fillText(`${opts.def} →`, x0 + HEAD_W / 2, y0 + HEAD_H / 2 + 6)

  // The cells.
  ctx.font = `bold 13px ${opts.font}`
  TYPES.forEach((atk, i) => {
    TYPES.forEach((def, j) => {
      const m = chart(atk, def)
      const x = x0 + HEAD_W + j * CELL_W
      const y = y0 + HEAD_H + i * CELL_H
      const colors = MULT[m]
      if (colors) {
        ctx.fillStyle = colors.bg
        ctx.fillRect(x, y, CELL_W, CELL_H)
        ctx.fillStyle = colors.fg
        ctx.fillText(chartCellText(m), x + CELL_W / 2, y + CELL_H / 2 + 1)
      }
    })
  })

  // The grid lines, each on a pixel boundary so they stay crisp.
  ctx.fillStyle = LIGHT.border
  ctx.fillRect(x0, y0, gridW, 1)
  ctx.fillRect(x0, y0 + HEAD_H, gridW, 1)
  for (let i = 1; i <= TYPES.length; i++) ctx.fillRect(x0, y0 + HEAD_H + i * CELL_H - 1, gridW, 1)
  ctx.fillRect(x0, y0, 1, gridH)
  ctx.fillRect(x0 + HEAD_W, y0, 1, gridH)
  for (let j = 1; j <= TYPES.length; j++) ctx.fillRect(x0 + HEAD_W + j * CELL_W - 1, y0, 1, gridH)

  // The badges, over the lines.
  TYPES.forEach((type, k) => {
    badge(ctx, glyphs[type], TYPE_COLORS[type], x0 + HEAD_W + k * CELL_W + CELL_W / 2, y0 + HEAD_H / 2)
    badge(ctx, glyphs[type], TYPE_COLORS[type], x0 + HEAD_W / 2, y0 + HEAD_H + k * CELL_H + CELL_H / 2)
  })

  ctx.fillStyle = LIGHT.muted
  ctx.font = `11px ${opts.font}`
  ctx.textAlign = 'right'
  ctx.fillText('kpagcha.github.io/sproutvgc', width - PAD, y0 + gridH + FOOTER_H / 2 + 2)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode the chart')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sproutvgc-type-chart.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
