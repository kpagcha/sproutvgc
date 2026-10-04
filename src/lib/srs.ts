// SM-2 (SuperMemo-2) spaced repetition with Anki-style in-session learning steps.
//
// Review cards follow SM-2: intervals 1d -> 6d -> interval × ease, where ease
// moves with answer quality. A wrong answer is a lapse: ease drops (once, for a
// card in review, not again for misses while relearning), the card
// loses its interval and re-enters "learning", where it is re-asked after a
// few other cards (LEARN_STEPS, counted in answers, not time) until it is
// answered correctly enough times to graduate again.

const MIN_EASE = 1.3
/** Cards to wait before re-asking a card in learning, per step. */
export const LEARN_STEPS = [3, 8]

export interface CardState {
  ease: number
  /** Current review interval in days (0 while learning). */
  interval: number
  /** Consecutive successful reviews. */
  reps: number
  /** Total wrong answers. */
  lapses: number
  /** Timestamp (ms) when the card is next due for review: the start of a study day. */
  due: number
  /** Learning step index, or -1 when the card is in review. */
  step: number
  /** Deck tick at which a learning card is due again. */
  learnAt: number
}

export interface Deck {
  v: 1
  /** Number of answers ever given; the clock for learning steps. */
  tick: number
  cards: Record<string, CardState>
  /** New cards introduced on `day`, and today's allowance. */
  day: string
  newToday: number
  newLimit: number
  /** Old home of the dual types setting, now in the quiz settings; read once to carry it over. */
  duals?: boolean
  /** Shuffles the order new cards are introduced in; rolled again on reset. */
  seed?: number
}

export const DEFAULT_NEW_LIMIT = 20

/** Local hour a new study day starts at, as in Anki, so a session past midnight still counts as the same day. */
const DAY_START_HOUR = 4

/** Start (ms) of the study day `days` after the one containing `now`. */
function dayStart(now: number, days = 0): number {
  const d = new Date(now)
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1)
  d.setDate(d.getDate() + days)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d.getTime()
}

/** The study day containing `now`, as a local YYYY-MM-DD date. */
export function today(now = Date.now()): string {
  const d = new Date(dayStart(now))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

export function emptyDeck(newLimit = DEFAULT_NEW_LIMIT): Deck {
  return { v: 1, tick: 0, cards: {}, day: today(), newToday: 0, newLimit, seed: newSeed() }
}

/** Roll the daily new-card counter over when the date changes. */
export function rollDay(deck: Deck, newLimit = DEFAULT_NEW_LIMIT, now = Date.now()): void {
  const d = today(now)
  if (deck.day !== d) {
    deck.day = d
    deck.newToday = 0
    deck.newLimit = newLimit
  }
}

function newCard(): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, step: -1, learnAt: 0 }
}

/**
 * Record an answer. `quality` is the SM-2 grade (0–5); anything below 3 is a
 * lapse. The quiz grades automatically: wrong = 1, correct but slow = 3,
 * correct and quick = 5. Quick answers raise ease by 0.1 and slow ones lower it
 * by 0.14, so a card's ease recovers once it stops giving trouble.
 */
export function grade(deck: Deck, id: string, quality: number, now = Date.now()): CardState {
  let c = deck.cards[id]
  if (!c) {
    c = newCard()
    deck.cards[id] = c
    deck.newToday++
  }
  deck.tick++

  if (quality < 3) {
    // Only forgetting a graduated card costs ease; misses while still learning
    // (or on a card's first sight) are part of learning it.
    if (c.step < 0 && c.reps > 0) c.ease = Math.max(MIN_EASE, c.ease - 0.2)
    c.lapses++
    c.reps = 0
    c.interval = 0
    c.step = 0
    c.learnAt = deck.tick + LEARN_STEPS[0]!
    return c
  }

  if (c.step >= 0) {
    // In learning: advance a step, graduate after the last one.
    c.step++
    if (c.step < LEARN_STEPS.length) {
      c.learnAt = deck.tick + LEARN_STEPS[c.step]!
      return c
    }
    c.step = -1
    c.reps = 1
    c.interval = 1
    c.due = dayStart(now, 1)
    return c
  }

  c.reps++
  c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 6 : Math.round(c.interval * c.ease)
  const q = Math.min(5, quality)
  c.ease = Math.max(MIN_EASE, c.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  c.due = dayStart(now, c.interval)
  return c
}

export interface PickOptions {
  /** Unseen card ids in curriculum order. */
  newIds: Iterable<string>
  /** Don't repeat this card immediately if anything else is available. */
  avoid?: string
  now?: number
  /** Ignore the daily new-card limit. */
  ignoreLimit?: boolean
  /** Cards to leave out entirely, even when due (e.g. dual types switched off). */
  skip?: (id: string) => boolean
}

/**
 * Choose the next card:
 *  1. a learning card whose step has come due (earliest first);
 *  2. a due review card, most lapses first, then most overdue;
 *  3. a new card, within today's new-card allowance;
 *  4. otherwise a learning card that isn't due yet, so a session never stalls.
 */
export function pickNext(deck: Deck, opts: PickOptions): string | null {
  const now = opts.now ?? Date.now()
  let learnDue: [string, number] | null = null
  let learnLater: [string, number] | null = null
  let review: [string, CardState] | null = null

  for (const [id, c] of Object.entries(deck.cards)) {
    if (id === opts.avoid || opts.skip?.(id)) continue
    if (c.step >= 0) {
      if (c.learnAt <= deck.tick) {
        if (!learnDue || c.learnAt < learnDue[1]) learnDue = [id, c.learnAt]
      } else if (!learnLater || c.learnAt < learnLater[1]) {
        learnLater = [id, c.learnAt]
      }
    } else if (c.due <= now) {
      const r = review?.[1]
      if (!r || c.lapses > r.lapses || (c.lapses === r.lapses && c.due < r.due)) review = [id, c]
    }
  }

  if (learnDue) return learnDue[0]
  if (review) return review[0]
  if (opts.ignoreLimit || deck.newToday < deck.newLimit) {
    for (const id of opts.newIds) {
      if (id !== opts.avoid && !deck.cards[id] && !opts.skip?.(id)) return id
    }
  }
  if (learnLater) return learnLater[0]
  if (opts.avoid && !opts.skip?.(opts.avoid) && (deck.cards[opts.avoid]?.step ?? -1) >= 0) return opts.avoid
  return null
}

export interface DeckStats {
  seen: number
  learning: number
  due: number
  mature: number
}

export function deckStats(deck: Deck, now = Date.now(), skip?: (id: string) => boolean): DeckStats {
  let learning = 0
  let due = 0
  let mature = 0
  const cards = Object.entries(deck.cards)
    .filter(([id]) => !skip?.(id))
    .map(([, c]) => c)
  for (const c of cards) {
    if (c.step >= 0) learning++
    else if (c.due <= now) due++
    if (c.interval >= 6) mature++
  }
  return { seen: cards.length, learning, due, mature }
}

const STORAGE_KEY = 'sproutvgc.quiz.v1'

export function loadDeck(): Deck {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw) as Deck
      if (d && d.v === 1 && d.cards) {
        // Decks saved before seeds existed get one now; their seen cards are unaffected.
        d.seed ??= newSeed()
        return d
      }
    }
  } catch {
    // Storage unavailable or corrupt: start fresh in memory.
  }
  return emptyDeck()
}

export function saveDeck(deck: Deck): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
  } catch {
    // Storage unavailable: progress stays in memory for this session.
  }
}
