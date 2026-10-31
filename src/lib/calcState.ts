// The damage calculator's setup in its URL, so a calc is a link to share: each side (`?a=`, `?b=`) as its set, then
// what a battle adds to it, and the field (`?f=`). Each a few `~`-separated parts, plain Showdown IDs, so a link reads:
// `?a=incineroar~sitrusberry~intimidate~adamant~fakeout.flareblitz.knockoff.partingshot~32.20.0.0.14.0~h50.R`.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import { MOVES } from '@/data/moves'
import { NATURE_IDS } from '@/data/natures'
import { POKEMON } from '@/data/pokemon'
import {
  BOOSTED,
  emptyField,
  emptyFighter,
  FIELD_EFFECTS,
  MAX_ATTACKED,
  MAX_SPIKES,
  SIDE_EFFECTS,
  STAGE_MAX,
  STAGE_MIN,
  STATUSES,
  TERRAINS,
  WEATHERS,
  type Battlefield,
  type Boosts,
  type FieldEffect,
  type Fighter,
  type SideEffect,
  type Status,
} from '@/lib/damage'
import { emptyMember, MOVE_SLOTS, stoneMega, type Points } from '@/lib/team'
import { MAX_POINTS } from '@/lib/stats'

const SIDE_CODES: Record<SideEffect, string> = {
  reflect: 'R',
  lightScreen: 'L',
  auroraVeil: 'V',
  tailwind: 'T',
  helpingHand: 'H',
  friendGuard: 'F',
  steelySpirit: 'S',
  stealthRock: 'SR',
  leechSeed: 'LS',
  saltCure: 'SC',
  charge: 'C',
}
const FIELD_CODES: Record<FieldEffect, string> = {
  gravity: 'G',
  magicRoom: 'MR',
  wonderRoom: 'WR',
  trickRoom: 'TR',
  fairyAura: 'FA',
}

export function encodeFighter(f: Fighter): string {
  const m = f.member
  if (!m.pokemon) return ''
  const flags: string[] = []
  // Holding its stone it Mega Evolves unless said otherwise.
  if (stoneMega(m) && !f.mega) flags.push('n')
  if (f.hp !== 100) flags.push(`h${f.hp}`)
  if (f.status) flags.push(`s${f.status}`)
  if (f.boosts.some((b) => b)) flags.push(`b${f.boosts.join('_')}`)
  if (f.abilityOn) flags.push('a')
  if (f.fainted) flags.push(`f${f.fainted}`)
  if (f.attacked) flags.push(`r${f.attacked}`)
  if (f.spikes) flags.push(`k${f.spikes}`)
  for (const s of SIDE_EFFECTS) if (f.side.includes(s)) flags.push(SIDE_CODES[s])
  return [
    m.pokemon,
    m.item ?? '',
    m.ability ?? '',
    m.nature ?? '',
    m.moves.map((x) => x ?? '').join('.'),
    m.points.join('.'),
    flags.join('.'),
  ]
    .join('~')
    .replace(/~+$/, '')
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function decodeFighter(s: unknown): Fighter | null {
  if (typeof s !== 'string' || !s) return null
  const [mon, it, ab, nature, moves, points, flags] = s.split('~')
  if (!mon || !POKEMON[mon as PokemonId]) return null
  const m = emptyMember()
  m.pokemon = mon as PokemonId
  m.item = it && ITEMS[it as ItemId] ? (it as ItemId) : null
  m.ability = ab ? (ab as AbilityId) : null
  m.nature = nature && NATURE_IDS.includes(nature) ? nature : null
  const mv = (moves ?? '').split('.')
  m.moves = Array.from({ length: MOVE_SLOTS }, (_, i) => (mv[i] && MOVES[mv[i] as MoveId] ? (mv[i] as MoveId) : null))
  const pts = (points ?? '').split('.').map(Number)
  if (pts.length === 6) m.points = pts.map((p) => clamp(Math.round(p) || 0, 0, MAX_POINTS)) as Points
  const f = emptyFighter(m)
  for (const tok of (flags ?? '').split('.')) {
    if (tok === 'n') f.mega = false
    else if (tok === 'a') f.abilityOn = true
    else if (/^h\d+$/.test(tok)) f.hp = clamp(Number(tok.slice(1)), 1, 100)
    else if (/^f\d$/.test(tok)) f.fainted = clamp(Number(tok.slice(1)), 0, 5)
    else if (/^r\d$/.test(tok)) f.attacked = clamp(Number(tok.slice(1)), 0, MAX_ATTACKED)
    else if (/^k\d$/.test(tok)) f.spikes = clamp(Number(tok.slice(1)), 0, MAX_SPIKES)
    else if (tok[0] === 's' && (STATUSES as readonly string[]).includes(tok.slice(1))) f.status = tok.slice(1) as Status
    else if (tok[0] === 'b') {
      const b = tok.slice(1).split('_').map(Number)
      if (b.length === BOOSTED.length)
        f.boosts = b.map((x) => clamp(Math.round(x) || 0, STAGE_MIN, STAGE_MAX)) as Boosts
    } else {
      const side = SIDE_EFFECTS.find((k) => SIDE_CODES[k] === tok)
      if (side) f.side.push(side)
    }
  }
  return f
}

export function encodeField(f: Battlefield): string {
  return [
    f.weather && `w${f.weather}`,
    f.terrain && `t${f.terrain}`,
    ...FIELD_EFFECTS.filter((r) => f.effects.includes(r)).map((r) => FIELD_CODES[r]),
  ]
    .filter(Boolean)
    .join('.')
}

export function decodeField(s: unknown): Battlefield {
  const f = emptyField()
  if (typeof s !== 'string') return f
  for (const tok of s.split('.')) {
    if (tok[0] === 'w' && (WEATHERS as readonly string[]).includes(tok.slice(1)))
      f.weather = tok.slice(1) as Battlefield['weather']
    else if (tok[0] === 't' && (TERRAINS as readonly string[]).includes(tok.slice(1)))
      f.terrain = tok.slice(1) as Battlefield['terrain']
    else {
      const effect = FIELD_EFFECTS.find((r) => FIELD_CODES[r] === tok)
      if (effect) f.effects.push(effect)
    }
  }
  return f
}

/** The calc as last left, put back when it's opened bare. */
const KEY = 'sproutvgc.calc.last'
export interface CalcQuery {
  a?: string
  b?: string
  f?: string
}
export function readLast(): CalcQuery {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && typeof v === 'object' ? (v as CalcQuery) : {}
  } catch {
    return {}
  }
}
export function saveLast(q: CalcQuery) {
  try {
    if (q.a || q.b || q.f) localStorage.setItem(KEY, JSON.stringify(q))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the URL has it.
  }
}
