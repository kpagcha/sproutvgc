// The conditions with an entry of their own: what moves, abilities and items leave behind on a Pokémon, its side or
// the field. Only some get one: those several sources cause or interact with, or that last across turns in a way
// worth looking up (`notes/conditions.md`); the rest are explained on their move's page. Which moves, abilities and
// items cause each is generated (`conditions.json`, by `npm run gen-data`), and so is whether the regulation has it:
// a condition is in the game when something the regulation has causes it.

/** How a condition applies: to one Pokémon (statuses, volatile effects), its side or slot, or the whole field. */
export const SUBKINDS = ['status', 'volatile', 'side', 'field', 'weather', 'terrain'] as const
export type Subkind = (typeof SUBKINDS)[number]

export interface ConditionInfo {
  sub: Subkind
  /** Showdown's ID for it, when ours differs: weathers are named after themselves, not the moves that set them. */
  showdown?: string
  /** Named after the move with the same ID (Taunt, Tailwind); the rest are named in each locale's `names`. */
  named?: 'move'
}

export const CONDITIONS = {
  // Statuses: one at a time, they last until cured (sleep and freeze wear off).
  brn: { sub: 'status' },
  par: { sub: 'status' },
  psn: { sub: 'status' },
  tox: { sub: 'status' },
  slp: { sub: 'status' },
  frz: { sub: 'status' },
  // Volatile: on one Pokémon, until it switches out or they end.
  confusion: { sub: 'volatile' },
  flinch: { sub: 'volatile' },
  attract: { sub: 'volatile' },
  partiallytrapped: { sub: 'volatile' },
  trapped: { sub: 'volatile' },
  healblock: { sub: 'volatile' },
  lockedmove: { sub: 'volatile' },
  mustrecharge: { sub: 'volatile' },
  taunt: { sub: 'volatile', named: 'move' },
  encore: { sub: 'volatile', named: 'move' },
  disable: { sub: 'volatile', named: 'move' },
  torment: { sub: 'volatile', named: 'move' },
  leechseed: { sub: 'volatile', named: 'move' },
  yawn: { sub: 'volatile', named: 'move' },
  substitute: { sub: 'volatile', named: 'move' },
  protect: { sub: 'volatile', named: 'move' },
  followme: { sub: 'volatile', named: 'move' },
  ragepowder: { sub: 'volatile', named: 'move' },
  helpinghand: { sub: 'volatile', named: 'move' },
  charge: { sub: 'volatile', named: 'move' },
  // Side: on one side of the field.
  tailwind: { sub: 'side', named: 'move' },
  reflect: { sub: 'side', named: 'move' },
  lightscreen: { sub: 'side', named: 'move' },
  auroraveil: { sub: 'side', named: 'move' },
  safeguard: { sub: 'side', named: 'move' },
  wideguard: { sub: 'side', named: 'move' },
  quickguard: { sub: 'side', named: 'move' },
  spikes: { sub: 'side', named: 'move' },
  toxicspikes: { sub: 'side', named: 'move' },
  stickyweb: { sub: 'side', named: 'move' },
  stealthrock: { sub: 'side', named: 'move' },
  // Field: on the whole field.
  trickroom: { sub: 'field', named: 'move' },
  gravity: { sub: 'field', named: 'move' },
  magicroom: { sub: 'field', named: 'move' },
  wonderroom: { sub: 'field', named: 'move' },
  // Weather and terrains: one of each at a time.
  sun: { sub: 'weather', showdown: 'sunnyday' },
  rain: { sub: 'weather', showdown: 'raindance' },
  sandstorm: { sub: 'weather' },
  snow: { sub: 'weather', showdown: 'snowscape' },
  electricterrain: { sub: 'terrain', named: 'move' },
  grassyterrain: { sub: 'terrain', named: 'move' },
  psychicterrain: { sub: 'terrain', named: 'move' },
  mistyterrain: { sub: 'terrain', named: 'move' },
} as const satisfies Record<string, ConditionInfo>

export type ConditionId = keyof typeof CONDITIONS
/** The conditions named after their move. */
export type MoveNamedCondition = {
  [K in ConditionId]: (typeof CONDITIONS)[K] extends { named: 'move' } ? K : never
}[ConditionId]

/** Showdown's ID for a condition. */
export const showdownId = (id: ConditionId): string => (CONDITIONS[id] as ConditionInfo).showdown ?? id
