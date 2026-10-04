import { TYPES, chart, type Multiplier, type TypeId } from '@/data/types'
import { typeName } from '@/i18n'

export const MULTIPLIERS: Multiplier[] = [0, 0.25, 0.5, 1, 2, 4]

export function effectiveness(atk: TypeId, def: readonly TypeId[]): Multiplier {
  let m = 1
  for (const d of def) m *= chart(atk, d)
  return m as Multiplier
}

export function formatMult(m: number): string {
  if (m === 0.25) return '¼×'
  if (m === 0.5) return '½×'
  return `${m}×`
}

/** A type chart cell's text: blank for neutral, so the chart's other multipliers stand out. */
export function chartCellText(m: number): string {
  return m === 1 ? '' : m === 0.5 ? '½' : String(m)
}

/** CSS class used to color a multiplier cell. */
export function multClass(m: number): string {
  return `m-${String(m).replace('.', '_')}`
}

export function typesLabel(types: readonly TypeId[]): string {
  return types.map(typeName).join('/')
}

export type Profile = Record<Multiplier, TypeId[]>

function emptyProfile(): Profile {
  return { 0: [], 0.25: [], 0.5: [], 1: [], 2: [], 4: [] }
}

/** Every attacking type grouped by its multiplier against `def`. */
export function defensiveProfile(def: readonly TypeId[]): Profile {
  const p = emptyProfile()
  for (const atk of TYPES) p[effectiveness(atk, def)].push(atk)
  return p
}

/** Every defending type grouped by the multiplier `atk` deals to it. */
export function attackProfile(atk: TypeId): Profile {
  const p = emptyProfile()
  for (const def of TYPES) p[chart(atk, def) as Multiplier].push(def)
  return p
}

/** All 18 single types followed by all 153 dual-type combinations. */
export const ALL_DEFENDERS: readonly (readonly TypeId[])[] = (() => {
  const out: TypeId[][] = TYPES.map((t) => [t])
  for (let i = 0; i < TYPES.length; i++) {
    for (let j = i + 1; j < TYPES.length; j++) out.push([TYPES[i]!, TYPES[j]!])
  }
  return out
})()

export interface CoverageEntry {
  def: readonly TypeId[]
  best: Multiplier
}

export interface RootGroup {
  /** Single type that walls the coverage on its own. */
  root: CoverageEntry
  /** Dual types containing `root`, with the partner type. */
  combos: { partner: TypeId; entry: CoverageEntry }[]
}

/**
 * Group walling entries by the single type responsible, so each combo is
 * listed once: under the first single type in it that walls on its own, or
 * in `pairOnly` when only the pairing walls.
 */
export function groupByRoot(entries: readonly CoverageEntry[]) {
  const groups = new Map<TypeId, RootGroup>()
  for (const e of entries) if (e.def.length === 1) groups.set(e.def[0]!, { root: e, combos: [] })
  const pairOnly: CoverageEntry[] = []
  for (const e of entries) {
    if (e.def.length === 1) continue
    const root = e.def.find((t) => groups.has(t))
    if (root) groups.get(root)!.combos.push({ partner: e.def.find((t) => t !== root)!, entry: e })
    else pairOnly.push(e)
  }
  return { groups: [...groups.values()], pairOnly }
}

/** Best multiplier any of `atks` reaches against every defending type combination. */
export function offensiveProfile(atks: readonly TypeId[]): CoverageEntry[] {
  return ALL_DEFENDERS.map((def) => {
    let best = 0
    for (const a of atks) best = Math.max(best, effectiveness(a, def))
    return { def, best: best as Multiplier }
  })
}
