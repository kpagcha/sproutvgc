// Practice: endless random cards that never touch the study schedule.

import { TYPES, isType, type TypeId } from '@/data/types'
import { cardKind, getCurriculum, multiQuestion, type Card, type MultiQuestion } from '@/lib/quiz'
import type { Deck } from '@/lib/srs'

export interface PracticeOptions {
  single: boolean
  multi: boolean
  dual: boolean
  /** Only cards involving one of these types; empty means all types. */
  focus: TypeId[]
  /** Only cards missed in study, the most missed most often. */
  weakOnly: boolean
}

export const PRACTICE_DEFAULTS: PracticeOptions = { single: true, multi: true, dual: false, focus: [], weakOnly: false }

const KEY = 'sproutvgc.quiz.practice.v1'

export function loadPractice(): PracticeOptions {
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    // Storage unavailable or corrupt: defaults.
  }
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = PRACTICE_DEFAULTS
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  return {
    single: bool(r.single, d.single),
    multi: bool(r.multi, d.multi),
    dual: bool(r.dual, d.dual),
    focus: Array.isArray(r.focus) ? TYPES.filter((t) => (r.focus as unknown[]).includes(t)) : [],
    weakOnly: bool(r.weakOnly, d.weakOnly),
  }
}

export function savePractice(o: PracticeOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    // Storage unavailable: the options last for this page load.
  }
}

function involves(c: Card, focus: readonly TypeId[]): boolean {
  if (c.kind === 'multi') return focus.includes(c.type)
  return focus.includes(c.atk) || c.def.some((d) => focus.includes(d))
}

export interface Weighted {
  id: string
  weight: number
}

/** The cards practice can show for these options, weighted (by misses when practicing weak spots). */
export function practicePool(o: PracticeOptions, deck: Deck, questions: Record<MultiQuestion, boolean>): Weighted[] {
  const { basic, dual } = getCurriculum()
  const focus = o.focus.filter(isType)
  const out: Weighted[] = []
  for (const c of [...basic, ...dual]) {
    const kind = cardKind(c.id)
    if (!o[kind]) continue
    if (kind === 'multi' && !questions[multiQuestion(c.id)]) continue
    if (focus.length && !involves(c, focus)) continue
    const lapses = deck.cards[c.id]?.lapses ?? 0
    if (o.weakOnly && !lapses) continue
    out.push({ id: c.id, weight: o.weakOnly ? lapses : 1 })
  }
  return out
}

/** Cards that can't come back until this many others have been shown (fewer when the pool is small). */
const NO_REPEAT = 15

/** A random card from `pool`, not one of the last few shown. */
export function pickPractice(pool: readonly Weighted[], recent: readonly string[]): string | null {
  if (!pool.length) return null
  const window = Math.min(NO_REPEAT, pool.length - 1)
  const avoid = new Set(window > 0 ? recent.slice(-window) : [])
  const choices = pool.filter((w) => !avoid.has(w.id))
  const total = choices.reduce((n, w) => n + w.weight, 0)
  let r = Math.random() * total
  for (const w of choices) {
    r -= w.weight
    if (r < 0) return w.id
  }
  return choices.at(-1)?.id ?? null
}
