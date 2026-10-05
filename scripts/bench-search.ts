// Times the search's matching (`src/lib/search.ts`) the way `useSearch` runs it on each keystroke: every name split
// around the query, the hits sorted. Over the generated names of every language, and the same names repeated, to see
// how it would hold up with a bigger dex: `npm run bench-search` (or `-- 1 10 100` for other scales). Conditions and
// types, named in the i18n bundles, are left out: a hundred or so names, next to the generated thousand.
//
// It times the matching alone, not Vue rendering the results; for the whole keystroke, record typing in the
// Performance panel on `just preview`.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES, type Locale } from '../src/i18n/locales.ts'
import { fold, split } from '../src/lib/search.ts'

const GENERATED = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/generated')
const CATEGORIES = ['abilities', 'moves', 'items', 'pokemon']
/** Queries matching many names, a few, and none (which still folds every name). */
const QUERIES = ['a', 'ac', 'ataque', 'zzz']
/** Runs averaged per measurement, after as many to warm up. */
const RUNS = 20

const scales = process.argv.slice(2).map(Number)
if (scales.some((n) => !Number.isInteger(n) || n < 1)) throw new Error('Scales must be positive integers')
if (!scales.length) scales.push(1, 10, 50)

function names(locale: Locale): string[] {
  return CATEGORIES.flatMap((c) =>
    Object.values(JSON.parse(readFileSync(`${GENERATED}/${c}.names.${locale}.json`, 'utf8')) as Record<string, string>),
  )
}

/** One keystroke's matching, as `useSearch` does it: the hits, starts of names first, then alphabetically. */
function search(all: string[], q: string, locale: Locale) {
  return all
    .flatMap((name) => {
      const parts = split(name, q)
      return parts ? [{ name, parts }] : []
    })
    .sort((a, b) => +!!a.parts[0] - +!!b.parts[0] || a.name.localeCompare(b.name, locale))
}

for (const locale of Object.keys(LOCALES) as Locale[]) {
  const base = names(locale)
  for (const scale of scales) {
    const all = Array.from({ length: scale }, () => base).flat()
    for (const query of QUERIES) {
      const q = fold(query)
      for (let i = 0; i < RUNS; i++) search(all, q, locale)
      const start = performance.now()
      let hits = 0
      for (let i = 0; i < RUNS; i++) hits = search(all, q, locale).length
      const ms = (performance.now() - start) / RUNS
      console.log(
        `${locale}  ${String(all.length).padStart(7)} names  ${query.padEnd(6)}` +
          `${String(hits).padStart(7)} hits  ${ms.toFixed(2).padStart(7)} ms`,
      )
    }
  }
}
