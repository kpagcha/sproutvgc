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
  type HitOptions,
  type SideEffect,
  type Status,
} from '@/lib/damage'
import { emptyMember, MOVE_SLOTS, stoneMega, type Points } from '@/lib/team'
import { MAX_POINTS } from '@/lib/stats'
import { TTL } from '@/lib/tiersState'
import type { HitSeen, Saw } from '@/lib/damageReverse'

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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// Each move's options, `heatwave-cs.beatup-h3`: its ID, then `c` a critical hit, `s` one target alone, `d` doubled,
// `h<n>` its hits, `p<n>` Spit Up's Stockpile layers. Only its set's moves', and only what's set.
function encodeHitOpts(f: Fighter): string {
  return f.member.moves
    .filter((mv, i, all): mv is MoveId => !!mv && all.indexOf(mv) === i)
    .map((mv) => {
      const o = f.hitOpts?.[mv]
      if (!o) return ''
      const code = [
        o.crit && 'c',
        o.single && 's',
        o.doubled && 'd',
        o.hits != null && `h${o.hits}`,
        o.stockpile != null && `p${o.stockpile}`,
      ]
        .filter(Boolean)
        .join('')
      return code && `${mv}-${code}`
    })
    .filter(Boolean)
    .join('.')
}

function decodeHitOpts(s: string | undefined, moves: readonly (MoveId | null)[]): Fighter['hitOpts'] {
  const out: Partial<Record<MoveId, HitOptions>> = {}
  for (const tok of (s ?? '').split('.')) {
    const [mv, code] = tok.split('-') as [MoveId, string | undefined]
    if (!code || !moves.includes(mv)) continue
    const o: HitOptions = {}
    for (const [, flag, key, n] of code.matchAll(/([csd])|([hp])(\d+)/g)) {
      if (flag === 'c') o.crit = true
      else if (flag === 's') o.single = true
      else if (flag === 'd') o.doubled = true
      else if (key === 'h') o.hits = clamp(Number(n), 1, 10)
      else if (key === 'p') o.stockpile = clamp(Number(n), 1, 3)
    }
    out[mv] = o
  }
  return Object.keys(out).length ? out : undefined
}

export function encodeFighter(f: Fighter): string {
  const m = f.member
  if (!m.pokemon) return ''
  const flags: string[] = []
  // Holding its stone it Mega Evolves unless said otherwise.
  if (stoneMega(m) && !f.mega) flags.push('n')
  // To a hundredth of a percent, enough for a whole number of HP points to come back exactly, its decimal point an
  // underscore (the flags are dot-separated): `h72_46`.
  if (f.hp !== 100) flags.push(`h${String(+f.hp.toFixed(2)).replace('.', '_')}`)
  if (f.status) flags.push(`s${f.status}`)
  if (f.boosts.some((b) => b)) flags.push(`b${f.boosts.join('_')}`)
  if (f.abilityOn) flags.push('a')
  if (f.fainted) flags.push(`f${f.fainted}`)
  if (f.attacked) flags.push(`r${f.attacked}`)
  if (f.spikes) flags.push(`k${f.spikes}`)
  if (f.sets) flags.push('e')
  for (const s of SIDE_EFFECTS) if (f.side.includes(s)) flags.push(SIDE_CODES[s])
  return [
    m.pokemon,
    m.item ?? '',
    m.ability ?? '',
    m.nature ?? '',
    m.moves.map((x) => x ?? '').join('.'),
    m.points.join('.'),
    flags.join('.'),
    encodeHitOpts(f),
  ]
    .join('~')
    .replace(/~+$/, '')
}

export function decodeFighter(s: unknown): Fighter | null {
  if (typeof s !== 'string' || !s) return null
  const [mon, it, ab, nature, moves, points, flags, opts] = s.split('~')
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
  f.hitOpts = decodeHitOpts(opts, m.moves)
  for (const tok of (flags ?? '').split('.')) {
    if (tok === 'n') f.mega = false
    else if (tok === 'a') f.abilityOn = true
    else if (tok === 'e') f.sets = true
    else if (/^h\d+(_\d+)?$/.test(tok)) f.hp = clamp(Number(tok.slice(1).replace('_', '.')), 0.01, 100)
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

// The inverse calc's hits seen (`?h=`), in the order entered: `adragonclaw-p42.bflareblitz-h51-b120-c`, each whose move
// (`a` yours, `b` the opponent's) and its ID, then what it did (`p<n>` the opponent's HP lost in percent, `h<n>` yours'
// in HP, `k` a knockout, `l` survived, `t` knocked out on the second hit), then `b<n>` the defender's HP before (the
// opponent's in percent, yours' in HP; full unless given), `c` a critical hit, `s` one target alone.
const SAW_CODES = { ko: 'k', lived: 'l', two: 't' } as const
export function encodeHits(hits: readonly HitSeen[]): string {
  return hits
    .map((h) => {
      const w = h.saw
      const saw = 'n' in w ? `${w.kind === 'pct' ? 'p' : 'h'}${w.n}` : SAW_CODES[w.kind]
      return [
        `${h.by}${h.move}`,
        saw,
        h.before !== undefined && `b${h.before}`,
        h.opts?.crit && 'c',
        h.opts?.single && 's',
      ]
        .filter(Boolean)
        .join('-')
    })
    .join('.')
}
export function decodeHits(s: unknown): HitSeen[] {
  if (typeof s !== 'string' || !s) return []
  return s.split('.').flatMap((tok): HitSeen[] => {
    const [head, ...codes] = tok.split('-')
    const by = head?.[0]
    const move = head?.slice(1) as MoveId
    if ((by !== 'a' && by !== 'b') || !MOVES[move]) return []
    let saw: Saw | null = null
    let before: number | undefined
    let crit = false
    let single = false
    for (const c of codes) {
      const num = /^([phb])(\d+)$/.exec(c)
      if (num?.[1] === 'b') before = clamp(Number(num[2]), 1, by === 'a' ? 100 : 9999)
      else if (num)
        saw = { kind: num[1] === 'p' ? 'pct' : 'hp', n: clamp(Number(num[2]), 0, num[1] === 'p' ? 100 : 9999) }
      else if (c === 'c') crit = true
      else if (c === 's') single = true
      else {
        const kind = (Object.keys(SAW_CODES) as (keyof typeof SAW_CODES)[]).find((k) => SAW_CODES[k] === c)
        if (kind) saw = { kind }
      }
    }
    if (!saw) return []
    const opts: HitOptions = { ...(crit && { crit }), ...(single && { single }) }
    return [{ by, move, saw, ...(before !== undefined && { before }), ...(Object.keys(opts).length && { opts }) }]
  })
}

/** The calc as last left, put back when it's opened bare, for `TTL` since it was last changed (as the speed pages). */
const KEY = 'sproutvgc.calc.last'
export interface CalcQuery {
  a?: string
  b?: string
  f?: string
  /** The threats at the opponent's team sheet (`CalcThreats`), `1`. */
  sheet?: string
  /** The inverse calc's hits seen (`encodeHits`). */
  h?: string
  /** Read backwards, which was seen moving first: `a` or `b`. */
  first?: string
}
export function readLast(): CalcQuery {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at?: unknown; q?: unknown } | null
    // Saved before it said when (no `at`): long ago, so forgotten.
    if (!v || typeof v.at !== 'number' || !v.q || typeof v.q !== 'object' || Date.now() - v.at > TTL) return {}
    return v.q as CalcQuery
  } catch {
    return {}
  }
}
export function saveLast(q: CalcQuery) {
  try {
    if (!(q.a || q.b || q.f)) return localStorage.removeItem(KEY)
    // The same setup written again (the page opened on it) isn't a change: its time stays.
    const now = readLast()
    if (now.a === q.a && now.b === q.b && now.f === q.f && now.h === q.h && now.first === q.first) return
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), q }))
  } catch {
    // Storage unavailable: the URL has it.
  }
}
