// Gen 9 interactions beyond the type chart, per type. Each entry references a status, move, ability or item by `Ref`.

import {
  ability,
  available,
  condition,
  group,
  item,
  move,
  refKey,
  type ConditionId,
  type ItemId,
  type Ref,
} from '@/data/dex'
import type { TypeId } from '@/data/types'
import type { MessageKey } from '@/i18n'

export const STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const
export type Stat = (typeof STATS)[number]

export interface Entry {
  ref: Ref
  /** The weather or terrain it needs. */
  cond?: Ref<'condition'>
  /** Damage or power multiplier; with `vs`, only against that type. */
  mult?: number
  vs?: TypeId
  /** Stat change: `stages` (+1 SpA) or `statMult` (Def 1.5×). */
  stat?: Stat
  stages?: number
  statMult?: number
  priority?: number
  /** A short effect with no number, e.g. "no stat drops or status". */
  fx?: MessageKey
  /** Overrides the entry's relevance (see `MAJOR`) for this entry only. */
  major?: boolean
}

export interface Note {
  key: MessageKey
  /** The move, ability or item the note is about, when its availability matters. */
  ref?: Ref
  /** Shown under Attacking when it's about the type's Pokémon attacking; under Defending otherwise. */
  side?: 'atk'
  /** Common in competitive play: shown up front rather than collapsed. */
  major?: boolean
}

export interface TypeInfo {
  // Pokémon of the type.
  immune?: Entry[]
  /** What gets past the type's immunities. */
  bypass?: Entry[]
  /** Damage the chart doesn't cover (Stealth Rock is added from the chart). */
  hurt?: Entry[]
  /** Stat boosts in weather. */
  stats?: Entry[]
  /** What allies' moves and abilities do to protect it (doubles). */
  ally?: Entry[]
  notes?: Note[]
  // Moves of the type: the user's and the target's moves, abilities and conditions, and items.
  field?: Entry[]
  user?: Entry[]
  target?: Entry[]
  /** What allies' moves and abilities do for its attacks (doubles). */
  allyAtk?: Entry[]
  items?: Entry[]
  // Interactions with specific moves and abilities, shown collapsed.
  /** What turns into the type. */
  becomes?: Entry[]
  /** What gives the type to a target, or to the user (Reflect Type is added for every type). */
  gives?: Entry[]
  /** What removes the type from its user. */
  loses?: Entry[]
  /** Moves of the type with their own conditions. */
  specific?: Entry[]
}

export const DEF_ROWS = ['immune', 'bypass', 'hurt', 'stats', 'ally'] as const
export const ATK_ROWS = ['field', 'user', 'target', 'allyAtk', 'items'] as const

export const MORE_ROWS = ['becomes', 'gives', 'loses', 'specific'] as const

export type EntryKey = (typeof DEF_ROWS)[number] | (typeof ATK_ROWS)[number] | (typeof MORE_ROWS)[number]

/**
 * Interactions common in competitive play, shown up front; the rest are collapsed. An entry's `major` overrides its
 * entry's (Dry Skin blocks Water moves, which matters, but only slightly boosts Fire ones).
 */
const MAJOR = new Set<string>(
  [
    // Statuses, and what gets past their immunities
    condition('brn'),
    condition('par'),
    condition('psn'),
    condition('frz'),
    ability('corrosion'),
    // Weather and terrain
    condition('sun'),
    condition('rain'),
    condition('sandstorm'),
    condition('snow'),
    group('terrains'),
    condition('electricterrain'),
    condition('grassyterrain'),
    condition('psychicterrain'),
    condition('mistyterrain'),
    ability('primordialsea'),
    ability('desolateland'),
    ability('deltastream'),
    // Hazards
    condition('stealthrock'),
    condition('spikes'),
    condition('toxicspikes'),
    condition('stickyweb'),
    // Moves and groups of moves a type is immune to, and what grounds Flying types
    group('powder'),
    move('leechseed'),
    move('thunderwave'),
    move('sheercold'),
    condition('gravity'),
    // Abilities
    ability('prankster'),
    ability('scrappy'),
    ability('mindseye'),
    group('trapping'),
    ability('arenatrap'),
    // What blocks or redirects a type's moves
    ability('flashfire'),
    ability('wellbakedbody'),
    ability('waterabsorb'),
    ability('stormdrain'),
    ability('voltabsorb'),
    ability('lightningrod'),
    ability('motordrive'),
    ability('sapsipper'),
    ability('levitate'),
    ability('eartheater'),
    ability('eelevate'),
    move('magnetrise'),
    item('airballoon'),
    // Resist berries
    item('chilanberry'),
    item('occaberry'),
    item('passhoberry'),
    item('wacanberry'),
    item('rindoberry'),
    item('yacheberry'),
    item('chopleberry'),
    item('kebiaberry'),
    item('shucaberry'),
    item('cobaberry'),
    item('payapaberry'),
    item('tangaberry'),
    item('chartiberry'),
    item('kasibberry'),
    item('habanberry'),
    item('colburberry'),
    item('babiriberry'),
    item('roseliberry'),
  ].map(refKey),
)

export const isMajor = (e: Entry): boolean => e.major ?? MAJOR.has(refKey(e.ref))

/** `type`'s interactions, without the ones whose entry `game` doesn't have. Stealth Rock is left to the caller, as
 * a dual type's damage comes from both types together. */
export function typeInfo(type: TypeId): TypeInfo {
  const info = TYPE_INFO[type]
  const out: TypeInfo = { notes: info.notes?.filter((n) => available(n.ref)) }
  const gives = [...(info.gives ?? []), { ref: move('reflecttype'), fx: 'info.fx.reflectType' } as Entry]
  for (const k of [...DEF_ROWS, ...ATK_ROWS, ...MORE_ROWS] as EntryKey[]) {
    const entries = k === 'gives' ? gives : info[k]
    out[k] = entries?.filter((e) => available(e.ref))
  }
  return out
}

/** The berry that halves a super effective hit of `type` (the second of its items, by the `items` helper below). */
export function resistBerry(type: TypeId): Ref<'item'> {
  return TYPE_INFO[type].items![1]!.ref as Ref<'item'>
}

const is = (...refs: Ref[]): Entry[] => refs.map((ref) => ({ ref }))
const x = (ref: Ref, mult: number, vs?: TypeId): Entry => ({ ref, mult, vs })
/** `ref` in weather or terrain `cond`, with power `mult`. */
const when = (ref: Ref, cond: ConditionId, mult?: number): Entry => ({ ref, cond: condition(cond), mult })
const up = (ref: Ref, stat: Stat, stages: number, mult?: number): Entry => ({ ref, stat, stages, mult })
/** Every type has a 1.2× boosting item and a berry that halves a super effective hit (any hit, for Normal). */
const items = (boost: ItemId, berry: ItemId, ...more: Entry[]) => [x(item(boost), 1.2), x(item(berry), 0.5), ...more]

const TYPE_INFO: Record<TypeId, TypeInfo> = {
  normal: {
    user: [x(ability('normalize'), 1.2), x(ability('scrappy'), 1, 'ghost'), x(ability('mindseye'), 1, 'ghost')],
    items: items('silkscarf', 'chilanberry', x(item('normalgem'), 1.3)),
  },
  fire: {
    becomes: [when(move('weatherball'), 'sun', 2), when(ability('forecast'), 'sun')],
    loses: is(move('burnup')),
    immune: is(condition('brn')),
    field: [x(condition('sun'), 1.5), x(condition('rain'), 0.5), x(ability('primordialsea'), 0)],
    user: [x(ability('blaze'), 1.5), x(ability('firemane'), 1.5), x(ability('megasol'), 1.5)],
    target: [
      { ...x(ability('flashfire'), 0), fx: 'info.fx.flashFire' },
      up(ability('wellbakedbody'), 'def', 2, 0),
      x(ability('thickfat'), 0.5),
      x(ability('heatproof'), 0.5),
      x(ability('waterbubble'), 0.5),
      x(ability('dryskin'), 1.25),
      x(ability('fluffy'), 2),
      up(ability('thermalexchange'), 'atk', 1),
      up(ability('steamengine'), 'spe', 6),
    ],
    items: items('charcoal', 'occaberry'),
  },
  water: {
    becomes: [when(move('weatherball'), 'rain', 2), when(ability('forecast'), 'rain')],
    gives: is(move('soak')),
    hurt: [x(move('freezedry'), 2), x(move('saltcure'), 2)],
    field: [x(condition('rain'), 1.5), x(condition('sun'), 0.5), x(ability('desolateland'), 0)],
    user: [
      x(ability('torrent'), 1.5),
      x(ability('waterbubble'), 2),
      x(ability('megasol'), 0.5),
      { ref: ability('liquidvoice'), fx: 'info.fx.liquidVoice' },
    ],
    target: [
      { ...x(ability('waterabsorb'), 0), fx: 'info.fx.heals' },
      { ...x(ability('dryskin'), 0), fx: 'info.fx.heals', major: true },
      up(ability('stormdrain'), 'spa', 1, 0),
      up(ability('watercompaction'), 'def', 2),
      up(ability('steamengine'), 'spe', 6),
    ],
    items: items('mysticwater', 'passhoberry', up(item('absorbbulb'), 'spa', 1), up(item('luminousmoss'), 'spd', 1)),
  },
  electric: {
    becomes: [when(move('terrainpulse'), 'electricterrain', 2), when(ability('mimicry'), 'electricterrain')],
    loses: is(move('doubleshock')),
    specific: [{ ref: move('risingvoltage'), cond: condition('electricterrain'), mult: 2, fx: 'info.fx.grounded' }],
    immune: is(condition('par')),
    field: [x(condition('electricterrain'), 1.3), x(ability('deltastream'), 1, 'flying')],
    user: [up(move('charge'), 'spd', 1, 2), x(ability('transistor'), 1.3), x(ability('galvanize'), 1.2)],
    target: [
      { ...x(ability('voltabsorb'), 0), fx: 'info.fx.heals' },
      { ...up(ability('lightningrod'), 'spa', 1, 0), fx: 'info.fx.redirects' },
      up(ability('motordrive'), 'spe', 1, 0),
    ],
    items: items('magnet', 'wacanberry', up(item('cellbattery'), 'atk', 1)),
  },
  grass: {
    becomes: [when(move('terrainpulse'), 'grassyterrain', 2), when(ability('mimicry'), 'grassyterrain')],
    gives: [{ ref: move('forestscurse'), fx: 'info.fx.adds' }],
    immune: is(group('powder'), move('leechseed')),
    ally: [{ ref: ability('flowerveil'), fx: 'info.fx.flowerVeil' }],
    field: [x(condition('grassyterrain'), 1.3)],
    user: [x(ability('overgrow'), 1.5)],
    target: [up(ability('sapsipper'), 'atk', 1, 0)],
    items: items('miracleseed', 'rindoberry'),
  },
  ice: {
    becomes: [when(move('weatherball'), 'snow', 2), when(ability('forecast'), 'snow')],
    immune: is(condition('frz'), move('sheercold')),
    stats: [{ ref: condition('snow'), stat: 'def', statMult: 1.5 }],
    field: [x(ability('deltastream'), 1, 'flying')],
    user: [x(ability('refrigerate'), 1.2)],
    target: [x(ability('thickfat'), 0.5)],
    items: items('nevermeltice', 'yacheberry', up(item('snowball'), 'atk', 1)),
  },
  fighting: {
    user: [x(ability('scrappy'), 1, 'ghost'), x(ability('mindseye'), 1, 'ghost')],
    items: items('blackbelt', 'chopleberry'),
  },
  poison: {
    immune: is(condition('psn')),
    bypass: is(ability('corrosion')),
    notes: [
      { key: 'info.note.toxic', side: 'atk' },
      { key: 'info.note.toxicSpikes', major: true },
      { key: 'info.note.blackSludge', ref: item('blacksludge') },
    ],
    items: items('poisonbarb', 'kebiaberry'),
  },
  ground: {
    immune: is(condition('sandstorm'), move('thunderwave')),
    user: [x(ability('sandforce'), 1.3)],
    target: [
      x(ability('levitate'), 0),
      { ...x(ability('eartheater'), 0), fx: 'info.fx.heals' },
      x(ability('eelevate'), 0),
      x(move('magnetrise'), 0),
    ],
    items: items('softsand', 'shucaberry', x(item('airballoon'), 0)),
  },
  flying: {
    immune: is(
      condition('spikes'),
      condition('toxicspikes'),
      condition('stickyweb'),
      group('terrains'),
      ability('arenatrap'),
    ),
    bypass: is(condition('gravity'), move('ingrain'), move('smackdown'), move('thousandarrows'), item('ironball')),
    loses: is(move('roost')),
    user: [x(ability('aerilate'), 1.2), { ref: ability('galewings'), priority: 1 }],
    items: items('sharpbeak', 'cobaberry'),
  },
  psychic: {
    becomes: [when(move('terrainpulse'), 'psychicterrain', 2), when(ability('mimicry'), 'psychicterrain')],
    gives: is(move('magicpowder')),
    specific: [{ ref: move('expandingforce'), cond: condition('psychicterrain'), mult: 1.5, fx: 'info.fx.spread' }],
    field: [x(condition('psychicterrain'), 1.3)],
    items: items('twistedspoon', 'payapaberry'),
  },
  bug: {
    user: [x(ability('swarm'), 1.5)],
    target: [up(ability('rattled'), 'spe', 1)],
    items: items('silverpowder', 'tangaberry'),
  },
  rock: {
    becomes: [when(move('weatherball'), 'sandstorm', 2)],
    immune: is(condition('sandstorm')),
    stats: [{ ref: condition('sandstorm'), stat: 'spd', statMult: 1.5 }],
    field: [x(ability('deltastream'), 1, 'flying')],
    user: [x(ability('rockypayload'), 1.5), x(ability('sandforce'), 1.3)],
    items: items('hardstone', 'chartiberry'),
  },
  ghost: {
    gives: [{ ref: move('trickortreat'), fx: 'info.fx.adds' }],
    immune: is(group('trapping')),
    bypass: is(ability('scrappy'), ability('mindseye'), move('foresight'), move('odorsleuth')),
    notes: [{ key: 'info.note.curse', side: 'atk' }],
    target: [x(ability('purifyingsalt'), 0.5), up(ability('rattled'), 'spe', 1)],
    items: items('spelltag', 'kasibberry'),
  },
  dragon: {
    field: [x(condition('mistyterrain'), 0.5)],
    user: [x(ability('dragonsmaw'), 1.5), x(ability('dragonize'), 1.2)],
    allyAtk: [{ ref: move('dragoncheer'), fx: 'info.fx.dragonCheer' }],
    items: items('dragonfang', 'habanberry'),
  },
  dark: {
    immune: is(ability('prankster')),
    bypass: is(move('miracleeye')),
    user: [x(ability('darkaura'), 1.33)],
    target: [up(ability('justified'), 'atk', 1), up(ability('rattled'), 'spe', 1)],
    items: items('blackglasses', 'colburberry'),
  },
  steel: {
    immune: is(condition('psn'), condition('sandstorm')),
    bypass: is(ability('corrosion')),
    hurt: [x(move('saltcure'), 2)],
    notes: [{ key: 'info.note.magnetPull', ref: ability('magnetpull') }],
    user: [x(ability('steelworker'), 1.5), x(ability('sandforce'), 1.3)],
    allyAtk: [x(ability('steelyspirit'), 1.5)],
    items: items('metalcoat', 'babiriberry'),
  },
  fairy: {
    becomes: [when(move('terrainpulse'), 'mistyterrain', 2), when(ability('mimicry'), 'mistyterrain')],
    user: [x(ability('fairyaura'), 1.33), x(ability('pixilate'), 1.2)],
    items: items('fairyfeather', 'roseliberry'),
  },
}
