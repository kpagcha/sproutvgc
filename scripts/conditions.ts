// The conditions moves, abilities and items cause (statuses, volatile effects, side and field effects, weather,
// terrains), found in Showdown's data: declared on moves (`status: 'par'`, `sideCondition: 'tailwind'`, secondary
// effects), and in the code of moves, abilities and items (`trySetStatus('par')`, `setWeather('raindance')`),
// including the code of the conditions those set up (Toxic Spikes poisons, so it counts as a source of poison).

/** How a condition is applied, as Showdown does it. */
export type ConditionKind = 'status' | 'volatile' | 'side' | 'slot' | 'field' | 'weather' | 'terrain'

/** A condition's sources, by category and ID. */
export type Sources = Record<'move' | 'ability' | 'item', string[]>

export interface Found {
  kind: ConditionKind
  sources: Sources
}

interface MoveLike {
  status?: string
  volatileStatus?: string
  sideCondition?: string
  slotCondition?: string
  pseudoWeather?: string
  weather?: string
  terrain?: string
  secondaries?: { status?: string; volatileStatus?: string; self?: { volatileStatus?: string } }[] | null
  self?: { volatileStatus?: string; sideCondition?: string } | null
}

const PATTERNS: [ConditionKind, RegExp][] = [
  ['status', /(?:trySetStatus|setStatus)\(\s*['"](\w+)['"]/g],
  ['volatile', /addVolatile\(\s*['"](\w+)['"]/g],
  ['weather', /setWeather\(\s*['"](\w+)['"]/g],
  ['terrain', /setTerrain\(\s*['"](\w+)['"]/g],
  ['side', /addSideCondition\(\s*['"](\w+)['"]/g],
  ['slot', /addSlotCondition\([^,)]*,\s*['"](\w+)['"]/g],
  ['field', /addPseudoWeather\(\s*['"](\w+)['"]/g],
]

/** Collects conditions and their sources; `toId` normalizes Showdown's IDs ("Wish" → "wish"). */
export class ConditionScan {
  private found = new Map<string, Found>()
  private toId: (s: string) => string
  constructor(toId: (s: string) => string) {
    this.toId = toId
  }

  private add(kind: ConditionKind, condition: string, category: keyof Sources, id: string) {
    const key = this.toId(condition)
    const entry = this.found.get(key) ?? { kind, sources: { move: [], ability: [], item: [] } }
    if (!entry.sources[category].includes(id)) entry.sources[category].push(id)
    this.found.set(key, entry)
  }

  /** The conditions a move declares it causes. */
  declared(id: string, move: object) {
    const m = move as MoveLike
    const add = (kind: ConditionKind, c: string | undefined) => c && this.add(kind, c, 'move', id)
    add('status', m.status)
    add('volatile', m.volatileStatus)
    add('side', m.sideCondition)
    add('slot', m.slotCondition)
    add('field', m.pseudoWeather)
    add('weather', m.weather)
    add('terrain', m.terrain)
    for (const s of m.secondaries ?? []) {
      add('status', s.status)
      add('volatile', s.volatileStatus)
      add('volatile', s.self?.volatileStatus)
    }
    add('volatile', m.self?.volatileStatus)
    add('side', m.self?.sideCondition)
  }

  /** The conditions an entry's code sets, its own conditions' code included (a few levels deep). */
  code(category: keyof Sources, id: string, entry: object, depth = 0, seen = new Set<object>()) {
    if (depth > 3 || seen.has(entry)) return
    seen.add(entry)
    for (const value of Object.values(entry) as unknown[]) {
      if (typeof value === 'function') {
        const code = String(value)
        for (const [kind, re] of PATTERNS) for (const [, c] of code.matchAll(re)) this.add(kind, c!, category, id)
      } else if (value && typeof value === 'object') this.code(category, id, value, depth + 1, seen)
    }
  }

  /** Every condition found, by Showdown ID, with its sources sorted. */
  result(): Record<string, Found> {
    const out: Record<string, Found> = {}
    for (const key of [...this.found.keys()].sort()) {
      const { kind, sources } = this.found.get(key)!
      out[key] = {
        kind,
        sources: { move: sources.move.sort(), ability: sources.ability.sort(), item: sources.item.sort() },
      }
    }
    return out
  }
}
