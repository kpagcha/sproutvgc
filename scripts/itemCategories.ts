// Each available item's category, what it's for in a battle, for the item rankings to filter by: derived from
// Showdown's code for it (which handlers it has, and what other code checks for it), with a few set by hand where
// the code says nothing useful. Every item gets one; `gen-data` stops on any it can't place, to add here.

import type { ItemCategory } from '../src/data/itemCategories.ts'

/** What the code doesn't say, or says misleadingly. */
const OVERRIDES: Record<string, ItemCategory> = {
  // Its boost is in a condition it starts, not a handler of its own.
  metronome: 'offense',
  // Restores PP: a defensive berry's handlers, but nothing defensive in a battle of a few turns.
  leppaberry: 'utility',
  // The binding moves' code checks for it; no handlers of its own.
  bindingband: 'utility',
}

/** The handlers that say what an item is for, by category, checked in this order after Mega Stones. */
const HANDLERS: [ItemCategory, string[]][] = [
  ['speed', ['onModifySpe', 'onFractionalPriority']],
  ['field', ['onTerrainChange']],
  ['utility', ['onTrapPokemon']],
  [
    'offense',
    [
      'onBasePower',
      'onModifyDamage',
      'onModifyAtk',
      'onModifySpA',
      'onModifyCritRatio',
      'onSourceModifyAccuracy',
      'onSourceTryPrimaryHit',
      'onModifyMove',
    ],
  ],
  [
    'defense',
    [
      'onSourceModifyDamage',
      'onDamage',
      'onResidual',
      'onTryHeal',
      'onAfterMoveSecondarySelf',
      'onUpdate',
      'onEat',
      'onDamagingHit',
      'onModifyAccuracy',
      'onAfterSetStatus',
    ],
  ],
]

/** Code that forces a switch (sets the flag, not checks it, as Life Orb does): an item running it is for switching. */
const SWITCHING = /switchFlag\s*=\s*true|dragIn\(/i

interface Effect {
  durationCallback?: unknown
  condition?: { durationCallback?: unknown }
}
interface ShowdownItem {
  id: string
  megaStone?: unknown
  [handler: string]: unknown
}
interface Dex {
  items: { get: (id: string) => ShowdownItem }
  moves: { all: () => Effect[] }
  data: { Conditions: Record<string, Effect> }
}

/** What places an item in its category, for `dex`: undefined for one none fits, to add to `OVERRIDES`. */
export function itemCategorizer(dex: Dex): (id: string) => ItemCategory | undefined {
  // The items that make a weather, terrain or screen last longer: what their duration's code checks for.
  const extending = new Set<string>()
  const durations = [
    ...dex.moves.all().map((m) => m.condition?.durationCallback),
    ...Object.values(dex.data.Conditions).map((c) => c.durationCallback),
  ]
  for (const fn of durations) {
    if (typeof fn !== 'function') continue
    for (const [, id] of String(fn).matchAll(/hasItem\(['"](\w+)['"]\)/g)) extending.add(id!)
  }

  return (id) => {
    const it = dex.items.get(id)
    if (it.megaStone) return 'mega'
    if (OVERRIDES[id]) return OVERRIDES[id]
    if (extending.has(id)) return 'field'
    const code = Object.values(it)
      .filter((v) => typeof v === 'function')
      .map(String)
      .join('\n')
    if (SWITCHING.test(code)) return 'utility'
    return HANDLERS.find(([, handlers]) => handlers.some((h) => typeof it[h] === 'function'))?.[0]
  }
}
