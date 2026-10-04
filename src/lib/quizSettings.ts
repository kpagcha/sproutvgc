import { MULTI_QUESTIONS, type MultiQuestion } from '@/lib/quiz'
import { DEFAULT_NEW_LIMIT } from '@/lib/srs'

export type DualsMode = 'auto' | 'on' | 'off'

export interface QuizSettings {
  /** Show the memory hooks for the card's matchups after answering. */
  hints: boolean
  newPerDay: number
  /** New cards added by "Learn more" once today's are done. */
  learnMoreStep: number
  /** One tick-all card in every this many new single-type cards; 0 turns them off. */
  multiEvery: number
  questions: Record<MultiQuestion, boolean>
  duals: DualsMode
  /** Share of the basic cards that must have graduated before Auto turns dual types on. */
  dualUnlock: number
  /** One dual-type card in every this many new cards. */
  dualEvery: number
  /** Seconds after which a correct answer counts as hesitant, per card kind; 0 turns it off. */
  slowMult: number
  slowMulti: number
}

export const DEFAULTS: QuizSettings = {
  hints: false,
  newPerDay: DEFAULT_NEW_LIMIT,
  learnMoreStep: 10,
  multiEvery: 5,
  questions: { weak: true, resist: true, immune: true, se: true, nve: true, noeff: true },
  duals: 'auto',
  dualUnlock: 0.6,
  dualEvery: 4,
  slowMult: 8,
  slowMulti: 20,
}

/** The values offered for the settings picked from a list. */
export const CHOICES = {
  multiEvery: [0, 3, 5, 8],
  dualUnlock: [0.4, 0.6, 0.8],
  dualEvery: [2, 4, 8],
} as const

export const LIMITS = { newPerDay: [1, 200], learnMoreStep: [1, 200], slow: [0, 120] } as const

const KEY = 'sproutvgc.quiz.settings.v1'

const int = (v: unknown, [min, max]: readonly [number, number], d: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : d
const oneOf = <T>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/**
 * Saved settings over the defaults, each checked, so a setting added later gets its default
 * and a bad stored value falls back to it. `legacyDuals` is the dual types choice decks used to keep.
 */
export function loadSettings(legacyDuals?: boolean): QuizSettings {
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    // Storage unavailable or corrupt: defaults.
  }
  return normalize(raw, legacyDuals)
}

/** `raw` as valid settings: each value checked, and replaced by its default when missing or out of range. */
export function normalize(raw: unknown, legacyDuals?: boolean): QuizSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const q = (r.questions && typeof r.questions === 'object' ? r.questions : {}) as Record<string, unknown>
  const d = DEFAULTS
  const legacy: DualsMode = legacyDuals === undefined ? d.duals : legacyDuals ? 'on' : 'off'
  return {
    hints: bool(r.hints, d.hints),
    newPerDay: int(r.newPerDay, LIMITS.newPerDay, d.newPerDay),
    learnMoreStep: int(r.learnMoreStep, LIMITS.learnMoreStep, d.learnMoreStep),
    multiEvery: oneOf(r.multiEvery, CHOICES.multiEvery, d.multiEvery),
    questions: Object.fromEntries(MULTI_QUESTIONS.map((k) => [k, bool(q[k], d.questions[k])])) as Record<
      MultiQuestion,
      boolean
    >,
    duals: oneOf<DualsMode>(r.duals, ['auto', 'on', 'off'], legacy),
    dualUnlock: oneOf(r.dualUnlock, CHOICES.dualUnlock, d.dualUnlock),
    dualEvery: oneOf(r.dualEvery, CHOICES.dualEvery, d.dualEvery),
    slowMult: int(r.slowMult, LIMITS.slow, d.slowMult),
    slowMulti: int(r.slowMulti, LIMITS.slow, d.slowMulti),
  }
}

export function saveSettings(s: QuizSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage unavailable: the settings last for this page load.
  }
}

export function defaultSettings(): QuizSettings {
  return structuredClone(DEFAULTS)
}
