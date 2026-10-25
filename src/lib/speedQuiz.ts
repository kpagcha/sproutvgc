// The speed quiz: two Pokémon, and who moves first, or a tie. Questions are generated, not a deck: each one's level is
// how close the two Speeds are (`LEVEL_GAPS`), and the reader's level, per build stage, follows how they answer
// (`record`). The build stages are each Pokémon uninvested (no points, a neutral nature), then at its most used set,
// then at any of its top sets (from a share of them up); progressive, each adds the next once the closest pairs of the
// one before are steady. What the reader shows they don't know (a miss, a close pair) is saved as an SM-2 card
// (`srs.ts`) and asked again on schedule. The plan: notes/speed-quiz.md.

import type { PokemonId } from '@/data/dex'
import type { MetaData } from '@/data/meta'
import { POKEMON, speciesOf } from '@/data/pokemon'
import { speedBuilds, speedStat } from '@/lib/speed'
import type { NatureEffect } from '@/lib/stats'

/** What each Pokémon is at: base (no stat points, a neutral nature: its Speed as the game has it, not its base stat),
 * its most used set, or any of its top sets. */
export const STAGES = ['base', 'common', 'top'] as const
export type Stage = (typeof STAGES)[number]

/** The least gap (the faster Speed over the slower) of levels 1 to 4; level 5 is anything closer, ties included. */
export const LEVEL_GAPS = [1.5, 1.25, 1.1, 1.03] as const
export const LEVELS = LEVEL_GAPS.length + 1
/** Right answers in a row that move a level up; quick ones count double. */
export const STREAK_UP = 5
/** Quick right answers in a row that move two levels up. */
export const QUICK_RUN = 3
/** An answer quicker than this (ms), with the page shown all along, is quick. */
export const QUICK_MS = 3000
/** The answers at a level that count, the latest. */
export const WINDOW = 10
/** Misses among them that move a level down. */
export const DOWN_MISSES = 4
/** Right answers among them, at the last level, that add the next build stage, starting at `UNLOCK_LEVEL`. */
export const UNLOCK_RIGHT = 8
export const UNLOCK_LEVEL = 3
/** One question in this many is from an easier level, not counted. */
export const EASIER_EVERY = 5
/** One question in this many, past the first build stage, is from an earlier stage. */
export const EARLIER_EVERY = 3
/** A Pokémon missed comes up at most this many times as often. */
export const MISS_MAX = 4
/** The answers about a Pokémon its standing is of, the latest. */
export const MON_WINDOW = 10
/** The answers about a Pokémon it takes to have a standing. */
export const MON_MIN = 3
/** The least share right, of the latest, of a Pokémon getting there and of one known. */
export const MON_FAIR = 0.6
export const MON_SOLID = 0.85
/** At the last level, one question in this many is a tie (if there's one to ask): left alone, uninvested Speeds tie so
 * often that most would be. */
export const TIE_EVERY = 3
/** The top sets' least share to choose from. */
export const TOP_SHARES = [0.03, 0.05, 0.1, 0.2] as const
export const POOLS = [50, 100, 'all'] as const
export type Pool = (typeof POOLS)[number]

/** The faster Speed over the slower. */
export const gap = (a: number, b: number) => Math.max(a, b) / Math.min(a, b)

/** The level of a gap: 1 for the widest, `LEVELS` for the closest. */
export function levelOf(g: number): number {
  let level = 1
  for (const least of LEVEL_GAPS) if (g < least) level++
  return level
}

// ---- Settings ----

export interface SpeedQuizSettings {
  /** A build stage alone, or progressive: from uninvested up to `upTo`. */
  builds: 'progressive' | Stage
  upTo: Exclude<Stage, 'base'>
  /** The top sets' least share. */
  topShare: number
  /** Progressive: wider pairs first, closer as the reader gets better; or only the closest. */
  pairs: 'progressive' | 'close'
  /** The most used Pokémon, or every one. */
  pool: Pool
  megas: boolean
}

export const defaultSettings = (): SpeedQuizSettings => ({
  builds: 'progressive',
  upTo: 'top',
  topShare: 0.03,
  pairs: 'progressive',
  pool: 50,
  megas: true,
})

const SETTINGS_KEY = 'sproutvgc.speedQuiz.settings.v1'

/** Settings as saved, anything unknown or out of range back to its default. */
export function normalize(s: Partial<SpeedQuizSettings>): SpeedQuizSettings {
  const d = defaultSettings()
  const oneOf = <T>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)
  return {
    builds: oneOf(s.builds, ['progressive', ...STAGES], d.builds),
    upTo: oneOf(s.upTo, ['common', 'top'] as const, d.upTo),
    topShare: oneOf(s.topShare, TOP_SHARES, d.topShare),
    pairs: oneOf(s.pairs, ['progressive', 'close'] as const, d.pairs),
    pool: oneOf(s.pool, POOLS, d.pool),
    megas: typeof s.megas === 'boolean' ? s.megas : d.megas,
  }
}

export function loadSettings(): SpeedQuizSettings {
  try {
    return normalize(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {})
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s: SpeedQuizSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // Storage unavailable: the settings last until the page reloads.
  }
}

/** The build stages asked: the one picked, or progressive, those unlocked up to the last allowed. With no sets in the
 * data, uninvested alone. */
export function activeStages(s: SpeedQuizSettings, unlocked: Stage, hasSets: boolean): Stage[] {
  if (!hasSets) return ['base']
  if (s.builds !== 'progressive') return [s.builds]
  const last = Math.min(STAGES.indexOf(unlocked), STAGES.indexOf(s.upTo))
  return STAGES.slice(0, last + 1)
}

// ---- Progress ----

/** A build stage's level, and the latest answers at it. */
export interface StageProgress {
  level: number
  /** The level `window` and the runs are of: answers at another one start them over. */
  at: number
  window: boolean[]
  /** Right answers in a row, quick ones counted twice. */
  streak: number
  /** Quick right answers in a row. */
  quick: number
}

export interface Progress {
  v: 1
  /** The last build stage unlocked, progressive. */
  unlocked: Stage
  stages: Partial<Record<Stage, StageProgress>>
  /** How much each Pokémon has been missed lately: 0 to `MISS_MAX` - 1, up one a miss, down a half a right answer. */
  misses: Partial<Record<PokemonId, number>>
  /** The answers about each Pokémon: right of all, and the latest (`MON_WINDOW`), `1` right and `0` missed. */
  mons: Partial<Record<PokemonId, MonRecord>>
}

export interface MonRecord {
  right: number
  seen: number
  last: string
}

/** How well the reader knows a Pokémon's Speed, from the latest answers about it; `new` under `MON_MIN` of them. */
export type Standing = 'new' | 'weak' | 'fair' | 'solid'

/** The share right of the latest answers about a Pokémon. */
export const lately = (r: MonRecord) =>
  r.last.length ? [...r.last].filter((c) => c === '1').length / r.last.length : 0

export function standingOf(r: MonRecord | undefined): Standing {
  if (!r || r.last.length < MON_MIN) return 'new'
  const share = lately(r)
  return share >= MON_SOLID ? 'solid' : share >= MON_FAIR ? 'fair' : 'weak'
}

const PROGRESS_KEY = 'sproutvgc.speedQuiz.v1'
/** The saved pairs' deck (`srs.ts`). */
export const DECK_KEY = 'sproutvgc.speedQuiz.deck.v1'

const freshStage = (level = 1): StageProgress => ({ level, at: level, window: [], streak: 0, quick: 0 })

/** Back to the start: level 1 and uninvested, no Pokémon missed nor answered about. */
export const emptyProgress = (): Progress => ({ v: 1, unlocked: 'base', stages: {}, misses: {}, mons: {} })

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as Progress | null
    if (p?.v === 1 && STAGES.includes(p.unlocked) && p.stages && p.misses) {
      // Saved before each Pokémon's answers were kept.
      p.mons ??= {}
      return p
    }
  } catch {
    // Storage unavailable or corrupt: start fresh in memory.
  }
  return emptyProgress()
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
  } catch {
    // Storage unavailable: progress stays in memory for this session.
  }
}

export const stageProgress = (p: Progress, stage: Stage): StageProgress => (p.stages[stage] ??= freshStage())

/** A build stage's level, 1 until it has one. */
export const levelAt = (p: Progress, stage: Stage) => p.stages[stage]?.level ?? 1

/** What an answer changed: the level, or the build stages. */
export type QuizEvent = { kind: 'up' | 'down'; level: number } | { kind: 'unlock'; stage: Stage; level: number }

/**
 * Records an answer: the Pokémon missed lately and each one's answers, then, for a question that counts, its stage's level. Down a level at
 * `DOWN_MISSES` misses among the latest `WINDOW` answers at it; up one at `STREAK_UP` right in a row (quick ones counting
 * double), two at `QUICK_RUN` quick ones in a row; progressive, the next build stage at `UNLOCK_RIGHT` right among the
 * latest `WINDOW` at the last level.
 */
export function record(
  p: Progress,
  q: Question,
  right: boolean,
  quick: boolean,
  s: SpeedQuizSettings,
  hasSets: boolean,
): QuizEvent | null {
  for (const id of new Set([q.a.id, q.b.id])) {
    const m = right ? Math.max(0, (p.misses[id] ?? 0) - 0.5) : Math.min(MISS_MAX - 1, (p.misses[id] ?? 0) + 1)
    if (m) p.misses[id] = m
    else delete p.misses[id]
    const r = (p.mons[id] ??= { right: 0, seen: 0, last: '' })
    r.seen++
    if (right) r.right++
    r.last = (r.last + (right ? '1' : '0')).slice(-MON_WINDOW)
  }
  if (!q.counts) return null

  const sp = stageProgress(p, q.stage)
  if (sp.at !== q.level) Object.assign(sp, { at: q.level, window: [], streak: 0, quick: 0 })
  sp.window = [...sp.window, right].slice(-WINDOW)
  sp.streak = right ? sp.streak + (quick ? 2 : 1) : 0
  sp.quick = right && quick ? sp.quick + 1 : 0
  const to = (level: number) => Object.assign(sp, freshStage(level))

  if (s.pairs === 'progressive') {
    if (sp.window.filter((r) => !r).length >= DOWN_MISSES && sp.level > 1) {
      to(sp.level - 1)
      return { kind: 'down', level: sp.level }
    }
    if (sp.level < LEVELS && (sp.quick >= QUICK_RUN || sp.streak >= STREAK_UP)) {
      to(Math.min(LEVELS, sp.level + (sp.quick >= QUICK_RUN ? 2 : 1)))
      return { kind: 'up', level: sp.level }
    }
  }

  const i = STAGES.indexOf(p.unlocked)
  const next = STAGES[i + 1]
  if (
    s.builds === 'progressive' &&
    hasSets &&
    q.stage === p.unlocked &&
    q.level === LEVELS &&
    next &&
    STAGES.indexOf(next) <= STAGES.indexOf(s.upTo) &&
    sp.window.length >= WINDOW &&
    sp.window.filter(Boolean).length >= UNLOCK_RIGHT
  ) {
    p.unlocked = next
    sp.window = []
    const n = (p.stages[next] ??= freshStage(UNLOCK_LEVEL))
    return { kind: 'unlock', stage: next, level: s.pairs === 'close' ? LEVELS : n.level }
  }
  return null
}

// ---- The Pokémon asked about ----

/** A Pokémon as a question has it: uninvested (no build), or at a build of its sets and the Speed it gives. */
export interface Side {
  id: PokemonId
  speed: number
  build?: { effect: NatureEffect; points: number }
}

/** A side, and how often it comes up. */
export interface Weighted {
  side: Side
  weight: number
}

/** A forme no different from its species in Speed matters (Rotom's are told apart by their types, so they stay). */
function playsAsBase(id: PokemonId): boolean {
  const p = POKEMON[id]
  const b = p.base && POKEMON[p.base]
  return !!b && !p.mega && p.stats[5] === b.stats[5] && p.types.join() === b.types.join()
}

/** The Pokémon asked about: the most used, or every one of the regulation (`regulation`), but cosmetic formes, those a
 * battle changes into (Megas aside, unless left out) and those battling as their species. */
export function poolIds(s: SpeedQuizSettings, data: MetaData | null, regulation: readonly PokemonId[]): PokemonId[] {
  const ok = (id: PokemonId) => {
    const p = POKEMON[id]
    return !!p && !p.cosmetic && (p.mega ? s.megas : !p.battleOnly) && !playsAsBase(id)
  }
  if (s.pool === 'all' || !data) return regulation.filter(ok)
  const top = s.pool
  return (Object.entries(data) as [PokemonId, NonNullable<MetaData[PokemonId]>][])
    .filter(([id, m]) => m.rank <= top && ok(id))
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([id]) => id)
}

/** A Pokémon's builds at a stage, each with its share of them: its most used, or those from `topShare` of its sets up
 * (its most used at least). None without sets in the data. */
function buildsAt(id: PokemonId, stage: Exclude<Stage, 'base'>, data: MetaData | null, topShare: number) {
  const speeds = data?.[id]?.speeds
  if (!speeds?.length) return []
  const all = speedBuilds(speeds)
  return stage === 'common' ? all.slice(0, 1) : all.filter((b, i) => !i || b.share >= topShare)
}

/** Every side asked about at a stage, each as often as its Pokémon is used (the square root of its usage, so the rarest
 * still come up), and more for one missed lately; a Pokémon's builds splitting its weight by their shares. */
export function sidesAt(
  ids: readonly PokemonId[],
  stage: Stage,
  data: MetaData | null,
  topShare: number,
  misses: Progress['misses'],
): Weighted[] {
  const out: Weighted[] = []
  for (const id of ids) {
    const weight = Math.sqrt(Math.max(data?.[id]?.usage ?? 0, 0.001)) * (1 + (misses[id] ?? 0))
    const base = POKEMON[id].stats[5]
    if (stage === 'base') {
      out.push({ side: { id, speed: speedStat(base, 0, 'neutral') }, weight })
      continue
    }
    const builds = buildsAt(id, stage, data, topShare)
    const total = builds.reduce((a, b) => a + b.share, 0)
    for (const b of builds) {
      const build = { effect: b.effect, points: b.points }
      out.push({ side: { id, speed: speedStat(base, b.points, b.effect), build }, weight: (weight * b.share) / total })
    }
  }
  return out
}

// ---- Questions ----

export interface Question {
  /** Its card's ID, the same whichever side each Pokémon is on. */
  id: string
  stage: Stage
  a: Side
  b: Side
  /** Its gap's level. */
  level: number
  /** Whether it counts toward the stage's level: not a review, nor one from an easier level. */
  counts: boolean
  review?: boolean
}

export type Answer = 'a' | 'b' | 'tie'

export const answerOf = (q: Pick<Question, 'a' | 'b'>): Answer =>
  q.a.speed === q.b.speed ? 'tie' : q.a.speed > q.b.speed ? 'a' : 'b'

const EFFECT_KEY = { up: 'u', neutral: 'n', down: 'd' } as const
const sideKey = (s: Side) => (s.build ? `${s.id}@${EFFECT_KEY[s.build.effect]}${s.build.points}` : s.id)

/** A pair's card ID: `b:` uninvested, `s:` at sets (each side's build after an `@`), its sides in order. */
export function cardId(a: Side, b: Side): string {
  const [x, y] = [sideKey(a), sideKey(b)].sort()
  return `${a.build ? 's' : 'b'}:${x}|${y}`
}

function parseSide(key: string): { id: PokemonId; build?: Side['build'] } | null {
  const [id, build] = key.split('@') as [PokemonId, string | undefined]
  if (!POKEMON[id]) return null
  if (build === undefined) return { id }
  const effect = (Object.keys(EFFECT_KEY) as NatureEffect[]).find((e) => EFFECT_KEY[e] === build[0])
  const points = Number(build.slice(1))
  return effect && Number.isInteger(points) ? { id, build: { effect, points } } : null
}

/**
 * A saved pair as a question, at the stages asked, its sides in a random order; or null when the settings leave it
 * out: a Pokémon no longer asked about, its stage not asked, or, at sets, a build no longer among its Pokémon's.
 */
export function fromCard(
  id: string,
  stages: readonly Stage[],
  ids: ReadonlySet<PokemonId>,
  data: MetaData | null,
  topShare: number,
  rand = Math.random,
): Question | null {
  const [kind, rest] = id.split(':') as [string, string | undefined]
  const sides = rest?.split('|').map(parseSide)
  if (sides?.length !== 2 || sides.some((s) => !s || !ids.has(s.id))) return null
  let stage: Stage | undefined
  if (kind === 'b') stage = stages.includes('base') ? 'base' : undefined
  else {
    // The last set stage asked, if both builds are among their Pokémon's at it.
    const last = stages[stages.length - 1]
    const at = last === 'base' ? undefined : last
    const has = (s: NonNullable<ReturnType<typeof parseSide>>) =>
      !!at &&
      buildsAt(s.id, at, data, topShare).some((b) => b.effect === s.build?.effect && b.points === s.build.points)
    stage = at && sides.every((s) => has(s!)) ? at : undefined
  }
  if (!stage) return null
  const [a, b] = sides.map((s) => {
    const base = POKEMON[s!.id].stats[5]
    const { points, effect } = s!.build ?? { points: 0, effect: 'neutral' as const }
    return { ...s!, speed: speedStat(base, points, effect) }
  }) as [Side, Side]
  return {
    id,
    stage,
    ...(rand() < 0.5 ? { a, b } : { a: b, b: a }),
    level: levelOf(gap(a.speed, b.speed)),
    counts: false,
    review: true,
  }
}

function pick<T extends { weight: number }>(list: readonly T[], rand: () => number): T {
  let r = rand() * list.reduce((a, x) => a + x.weight, 0)
  for (const x of list) if ((r -= x.weight) <= 0) return x
  return list[list.length - 1]!
}

/**
 * A pair at `level` among `sides`, weighted by how often each comes up: two Pokémon of different species (not a Mega
 * and its own), not among `recent` if it can help it; null when it finds none.
 */
export function generate(
  sides: readonly Weighted[],
  stage: Stage,
  level: number,
  recent: ReadonlySet<string>,
  rand = Math.random,
): Omit<Question, 'counts'> | null {
  if (sides.length < 2) return null
  const tie = level === LEVELS ? rand() < 1 / TIE_EVERY : undefined
  for (let tries = 0; tries < 60; tries++) {
    const first = pick(sides, rand).side
    const species = speciesOf(first.id)
    const others = sides.filter(
      (w) => speciesOf(w.side.id) !== species && levelOf(gap(first.speed, w.side.speed)) === level,
    )
    // At the last level, a tie or not as decided, if this one has any of that.
    const want = others.filter((w) => tie === undefined || (w.side.speed === first.speed) === tie)
    if (!others.length || (!want.length && tries < 50)) continue
    const second = pick(want.length ? want : others, rand).side
    const id = cardId(first, second)
    if (recent.has(id) && tries < 40) continue
    const [a, b] = rand() < 0.5 ? [first, second] : [second, first]
    return { id, stage, a, b, level }
  }
  return null
}

// ---- The answer, on the ladder ----

/** A Speed on the ladder around a question's pair: the Pokémon at it, those asked first. */
export interface LadderGroup {
  kind: 'speed'
  speed: number
  sides: Side[]
}
/** Speeds left out between the two asked, folded. */
export interface LadderGap {
  kind: 'gap'
  speeds: number
}
export type LadderRow = LadderGroup | LadderGap

/**
 * The ladder around a question's pair, fastest first: the Speed over the faster and under the slower, their own, and
 * those between them, up to `between` of them (more, the nearest to each kept and the rest folded); at each, its
 * Pokémon, those asked first (as many as fit on a line are shown: `SpeedQuizCard`).
 */
export function ladderAround(q: Question, sides: readonly Side[], between = 3): LadderRow[] {
  const asked = [q.a, q.b]
  const bySpeed = new Map<number, Side[]>()
  for (const s of [...asked, ...sides]) {
    const list = bySpeed.get(s.speed) ?? []
    if (!list.some((x) => x.id === s.id)) list.push(s)
    bySpeed.set(s.speed, list)
  }
  const speeds = [...bySpeed.keys()].sort((x, y) => y - x)
  const hi = speeds.indexOf(Math.max(q.a.speed, q.b.speed))
  const lo = speeds.indexOf(Math.min(q.a.speed, q.b.speed))
  const group = (speed: number): LadderGroup => ({ kind: 'speed', speed, sides: bySpeed.get(speed)! })
  const rows: LadderRow[] = []
  for (let i = Math.max(0, hi - 1); i <= Math.min(speeds.length - 1, lo + 1); i++) {
    const inner = lo - hi - 1
    if (i > hi && i < lo && inner > between) {
      if (i === hi + 1 || i === lo - 1) rows.push(group(speeds[i]!))
      else if (i === hi + 2) rows.push({ kind: 'gap', speeds: inner - 2 })
      continue
    }
    rows.push(group(speeds[i]!))
  }
  return rows
}
