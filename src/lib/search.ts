// Matching names against a search query, shared by the search boxes.

/** Folds a name for matching, ignoring case and accents: "levitacion" finds "Levitación". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** A character that continues a word: an apostrophe too, so "King's" is one word. */
const IN_WORD = /[\p{L}\p{N}'’]/u

/**
 * A name split by the search's matches: the text between them at even indices, the matches at odd ones (so it always
 * has an odd length, and its first element is empty when the name starts with a match).
 */
export type Marks = readonly string[]

/** The folded query's words, longest first (so a short one doesn't take the place a longer one needs). */
let lastQuery = ''
let lastWords: string[] = []
function words(q: string): string[] {
  if (q !== lastQuery) {
    lastQuery = q
    lastWords = q
      .split(/[^\p{L}\p{N}'’]+/u)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
  }
  return lastWords
}

/** The first place `w` occurs in `folded` at the start of a word, outside the ranges `taken`, or -1. */
function wordMatch(folded: string, w: string, taken: [number, number][]): number {
  for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) {
    if (at > 0 && IN_WORD.test(folded[at - 1]!)) continue
    if (taken.some(([from, to]) => at < to && at + w.length > from)) continue
    return at
  }
  return -1
}

/**
 * `name` split around the matches of the folded query `q`, or null when it doesn't match. Each word of the query has to
 * be found at the start of a word of the name, in any order ("ab" finds "Volt Absorb", "now" doesn't find "Abomasnow";
 * "rotom wash" finds "Rotom (Wash)", "mega garchomp" finds "Garchomp (Mega)"). The matches are found in the folded name,
 * then mapped back character by character, so they're highlighted in the name as written.
 */
export function split(name: string, q: string): Marks | null {
  const ws = words(q)
  if (!ws.length) return null
  const chars = [...name]
  let folded = ''
  const starts: number[] = [] // Where each character of the name starts in `folded`
  for (const c of chars) {
    starts.push(folded.length)
    folded += fold(c)
  }
  const taken: [number, number][] = []
  for (const w of ws) {
    const at = wordMatch(folded, w, taken)
    if (at < 0) return null
    taken.push([at, at + w.length])
  }
  // Back to the name's characters, in order.
  const ranges = taken
    .map(([at, end]): [number, number] => {
      let from = 0
      while (from + 1 < starts.length && starts[from + 1]! <= at) from++
      const to = starts.findIndex((i) => i >= end)
      return [from, to < 0 ? chars.length : to]
    })
    .sort((a, b) => a[0] - b[0])
  const parts: string[] = []
  let prev = 0
  for (const [from, to] of ranges) {
    parts.push(chars.slice(prev, from).join(''), chars.slice(from, to).join(''))
    prev = to
  }
  parts.push(chars.slice(prev).join(''))
  return parts
}

/** The marks of a name, cut down to its part from `at` to `at + text.length` (`text`). */
export function sliceMarks(parts: Marks, text: string, at: number): Marks {
  let pos = 0
  return parts.map((p) => {
    const from = Math.min(text.length, Math.max(0, pos - at))
    const to = Math.min(text.length, Math.max(0, pos + p.length - at))
    pos += p.length
    return text.slice(from, to)
  })
}
