import { h, type Component, type FunctionalComponent } from 'vue'
import {
  Ban,
  Box,
  CloudRain,
  HandHelping,
  Shield,
  ShieldHalf,
  ShieldPlus,
  Snowflake,
  Sparkle,
  Sun,
  Tornado,
  Wind,
} from '@lucide/vue'
import { ability, available, condition, move, type AbilityId, type MoveId, type Ref } from '@/data/dex'
import { showdownId, type ConditionId } from '@/data/conditions'
import SOURCES from '@/data/generated/conditions.json'
import type { MetaData } from '@/data/meta'
import type { TypeId } from '@/data/types'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  FIELD_EFFECTS,
  SIDE_GROUPS,
  TERRAINS,
  WEATHERS,
  type FieldEffect,
  type SideEffect,
  type SideGroup,
  type Terrain,
  type Weather,
} from '@/lib/damage'
import TypeGlyph from '@/components/TypeGlyph'

// The damage calculator's battle conditions as the page shows them: each one's dex entry (its name, and whether the
// regulation has it) and, for the common ones, its icon. The weather and terrain one of each at a time, the rest any of
// them together. Which of the rest are common isn't kept by hand: it's how many of the meta's teams run what causes
// them (`presence`), common from `COMMON_MIN` of them (`isCommon`); with no meta, the ones common so far
// (`COMMON_WITHOUT_META`).

export interface Condition<K extends string> {
  key: K
  ref: Ref | null
  icon?: Component
}

/** A type's glyph as an icon: a terrain's, the type it powers up (Misty Terrain's, Fairy, the type it shares its
 * color with). */
const glyph = (type: TypeId): Component => {
  const icon: FunctionalComponent = () => h(TypeGlyph, { type })
  return icon
}
/** Fairy Aura's: the Fairy glyph with two small sparks by it. */
const FairyAura: FunctionalComponent = () =>
  h('span', { class: 'aura-icon' }, [
    h(TypeGlyph, { type: 'fairy' }),
    h(Sparkle, { size: 6, class: 'spark top' }),
    h(Sparkle, { size: 5, class: 'spark bottom' }),
  ])

const WEATHER: Record<Exclude<Weather, ''>, [Ref, Component]> = {
  Sun: [condition('sun'), Sun],
  Rain: [condition('rain'), CloudRain],
  Sand: [condition('sandstorm'), Tornado],
  Snow: [condition('snow'), Snowflake],
}
const TERRAIN: Record<Exclude<Terrain, ''>, [Ref, Component]> = {
  Electric: [condition('electricterrain'), glyph('electric')],
  Grassy: [condition('grassyterrain'), glyph('grass')],
  Psychic: [condition('psychicterrain'), glyph('psychic')],
  Misty: [condition('mistyterrain'), glyph('fairy')],
}
// The rest, each with an icon only where it's common enough to be looked for at a glance.
const FIELD: Record<FieldEffect, [Ref, Component?]> = {
  gravity: [condition('gravity')],
  magicRoom: [condition('magicroom')],
  wonderRoom: [condition('wonderroom')],
  trickRoom: [condition('trickroom'), Box],
  fairyAura: [ability('fairyaura'), FairyAura],
}
const SIDE: Record<SideEffect, [Ref, Component?]> = {
  tailwind: [condition('tailwind'), Wind],
  reflect: [condition('reflect'), Shield],
  lightScreen: [condition('lightscreen'), ShieldHalf],
  auroraVeil: [condition('auroraveil'), ShieldPlus],
  helpingHand: [condition('helpinghand'), HandHelping],
  friendGuard: [ability('friendguard')],
  steelySpirit: [ability('steelyspirit')],
  stealthRock: [condition('stealthrock')],
  leechSeed: [condition('leechseed')],
  saltCure: [move('saltcure')],
  charge: [condition('charge')],
}
export const SPIKES: Condition<'spikes'> = { key: 'spikes', ref: condition('spikes') }
export const spikesOn = available(condition('spikes'))

const list = <K extends string>(keys: readonly K[], map: Record<K, [Ref, Component?]>): Condition<K>[] =>
  keys.filter((k) => available(map[k][0])).map((k) => ({ key: k, ref: map[k][0], icon: map[k][1] }))
const none = { ref: null, icon: Ban }

/** Each kind's choices, only those the regulation has: the weather and terrain led by none. */
export const weathers: Condition<Weather>[] = [
  { key: '', ...none },
  ...list(WEATHERS.filter((w) => w) as Exclude<Weather, ''>[], WEATHER),
]
export const terrains: Condition<Terrain>[] = [
  { key: '', ...none },
  ...list(TERRAINS.filter((x) => x) as Exclude<Terrain, ''>[], TERRAIN),
]
export const fieldEffects: Condition<FieldEffect>[] = list(FIELD_EFFECTS, FIELD)
export const sideGroups = (Object.keys(SIDE_GROUPS) as SideGroup[])
  .map((g) => ({ group: g, items: list(SIDE_GROUPS[g] as readonly SideEffect[], SIDE) }))
  .filter((g) => g.items.length || (g.group === 'hazards' && spikesOn))
export const sideEffects = sideGroups.flatMap((g) => g.items)

export const conditionName = (c: Condition<string>) => (c.ref ? refName(c.ref) : t('calc.none'))
export const weatherOf = (w: Weather) => weathers.find((c) => c.key === w)
export const terrainOf = (x: Terrain) => terrains.find((c) => c.key === x)
export const fieldOf = (e: FieldEffect) => fieldEffects.find((c) => c.key === e)
export const sideOf = (s: SideEffect) => sideEffects.find((c) => c.key === s)

// What's common, from the meta.

/** The share of the meta's teams counted as running a condition from `COMMON_MIN` up: 5% puts screens and Helping Hand
 * in (7% and more in Regulation M-B) and Stealth Rock and Friend Guard out (2%). */
export const COMMON_MIN = 0.05
/** With no meta to tell, those common in the meta so far. */
const COMMON_WITHOUT_META: readonly string[] = [
  'trickRoom',
  'fairyAura',
  'tailwind',
  'reflect',
  'lightScreen',
  'auroraVeil',
  'helpingHand',
]

/** What causes a condition: a condition's moves and abilities, as the generated data finds them; an ability or move
 * standing for one (Fairy Aura, Salt Cure), itself. */
function causes(ref: Ref | null): { move: readonly string[]; ability: readonly string[] } {
  if (!ref) return { move: [], ability: [] }
  if (ref.kind === 'ability') return { move: [], ability: [ref.id] }
  if (ref.kind === 'move') return { move: [ref.id], ability: [] }
  if (ref.kind !== 'condition') return { move: [], ability: [] }
  const id = showdownId(ref.id as ConditionId)
  const s = (SOURCES as Record<string, { sources: { move: string[]; ability: string[] } }>)[id]?.sources
  return s ?? { move: [], ability: [] }
}

/** How many of the meta's teams run what causes a condition: each Pokémon's usage by the share of its sets running
 * any of its moves or abilities, added up. */
export function presence(ref: Ref | null, data: MetaData): number {
  const { move: moves, ability: abilities } = causes(ref)
  let sum = 0
  for (const m of Object.values(data)) {
    if (!m?.usage) continue
    let share = 0
    for (const x of m.moves ?? []) if (moves.includes(x.id as MoveId)) share += x.share ?? 0
    for (const x of m.abilities ?? []) if (abilities.includes(x.id as AbilityId)) share += x.share ?? 0
    sum += m.usage * Math.min(1, share)
  }
  return sum
}

/** Whether a field or side condition is common in the meta shown (with none, in the meta so far). */
export const isCommon = (c: Condition<string>, data: MetaData | null | undefined) =>
  data ? presence(c.ref, data) >= COMMON_MIN : COMMON_WITHOUT_META.includes(c.key)
