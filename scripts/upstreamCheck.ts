/**
 * Checks Pokémon Showdown for what would change the dex since the commit `scripts/sources.json` pins, without
 * regenerating anything: a Champions VGC regulation it has that we don't (`VITE_REGULATION` and the past ones in
 * `sources.json`), and commits touching the Champions mod (balance changes, new Pokémon, moves, items, text).
 *
 * Writes a report with a short guide to `upstream-report.md` and, on GitHub Actions, `changed` and `state` (a key of
 * what was found, so the same findings aren't reported twice) to `$GITHUB_OUTPUT`. Run by
 * `.github/workflows/upstream-check.yml`; `node scripts/upstreamCheck.ts` runs it locally (`GH_TOKEN` optional,
 * for GitHub's rate limit).
 */
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'smogon/pokemon-showdown'
/** The Champions mod: the current regulation's data (past ones are frozen copies beside it, `championsregmb`). */
const MOD_PATH = 'data/mods/champions'

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sproutvgc-upstream-check',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

interface Commit {
  sha: string
  html_url: string
  commit: { message: string; committer: { date: string } }
}

const sources = JSON.parse(readFileSync(join(ROOT, 'scripts/sources.json'), 'utf8')) as {
  showdown: string
  smogon: Record<string, string[]>
}
const env = readFileSync(join(ROOT, '.env'), 'utf8')
const current = /^VITE_REGULATION=(.+)$/m.exec(env)?.[1].trim()
if (!current) throw new Error('No VITE_REGULATION in .env')
const known = new Set([current, ...Object.keys(sources.smogon)])

// Regulations Showdown has a Champions VGC format for, on its master.
const formats = await fetch(`https://raw.githubusercontent.com/${REPO}/master/config/formats.ts`).then((r) => {
  if (!r.ok) throw new Error(`formats.ts: ${r.status}`)
  return r.text()
})
const regs = [...formats.matchAll(/name: "\[Gen 9 Champions\] VGC \d+ Reg ([^"\s(]+)"/g)].map((m) => m[1])
const newRegs = [...new Set(regs)].filter((r) => !known.has(r))
const currentDropped = !regs.includes(current)

// Commits touching the Champions mod since the pin (`since` is inclusive, so the pin itself is dropped).
const pin = await gh<Commit>(`repos/${REPO}/commits/${sources.showdown}`)
const since = pin.commit.committer.date
const commits: Commit[] = []
for (let page = 1; page <= 5; page++) {
  const batch = await gh<Commit[]>(
    `repos/${REPO}/commits?sha=master&path=${MOD_PATH}&since=${since}&per_page=100&page=${page}`,
  )
  commits.push(...batch.filter((c) => c.sha !== sources.showdown))
  if (batch.length < 100) break
}

const changed = newRegs.length > 0 || currentDropped || commits.length > 0
const state = createHash('sha256')
  .update(JSON.stringify({ newRegs, currentDropped, commits: commits.map((c) => c.sha).sort() }))
  .digest('hex')
  .slice(0, 16)

const short = (sha: string) => sha.slice(0, 7)
const lines: string[] = []
lines.push(`<!-- upstream-state: ${state} -->`)
lines.push(
  `Weekly check of [Pokémon Showdown](https://github.com/${REPO}) against the commit the dex is pinned to ` +
    `([\`${short(sources.showdown)}\`](https://github.com/${REPO}/commit/${sources.showdown}), ${since.slice(0, 10)}). ` +
    `The site is on Regulation ${current}. Nothing has been regenerated: this only says what changed.`,
)
lines.push('')
if (newRegs.length) {
  lines.push(`## New regulation on Showdown: ${newRegs.map((r) => `**${r}**`).join(', ')}`)
  lines.push('')
  lines.push(
    `Showdown now has a Champions VGC format for it, so \`gen-data\` can generate it. Follow ` +
      `[\`docs/regulation-change.md\`](../blob/main/docs/regulation-change.md) whole, once the regulation is live (or ` +
      `about to be).`,
  )
  lines.push('')
}
if (currentDropped) {
  lines.push(`## Showdown no longer has Regulation ${current}'s format`)
  lines.push('')
  lines.push(
    `\`gen-data -- --update\` would stop on "no VGC format for Regulation ${current}" until \`VITE_REGULATION\` moves on.`,
  )
  lines.push('')
}
if (commits.length) {
  lines.push(`## ${commits.length} commit${commits.length === 1 ? '' : 's'} to the Champions mod since the pin`)
  lines.push('')
  lines.push(
    'Balance changes, new or changed Pokémon, moves, items or abilities, or their text. ' +
      `[Whole diff](https://github.com/${REPO}/compare/${sources.showdown}...master) (all of Showdown, not just the mod).`,
  )
  lines.push('')
  for (const c of commits.slice(0, 50)) {
    const title = c.commit.message.split('\n')[0].replace(/@(\w)/g, '`@`$1')
    lines.push(`- [\`${short(c.sha)}\`](${c.html_url}) ${c.commit.committer.date.slice(0, 10)}: ${title}`)
  }
  if (commits.length > 50) lines.push(`- …and ${commits.length - 50} more`)
  lines.push('')
}
lines.push('## What to do')
lines.push('')
if (newRegs.length) {
  lines.push(`1. In \`.env\`, set \`VITE_REGULATION=${newRegs.at(-1)}\` (and the dates in its comment).`)
  lines.push('2. Repin and regenerate: `just gen-data --update` (`npm run gen-data -- --update`).')
  lines.push(
    '3. Work through what it stops on and warns about, as `docs/regulation-change.md` says: Mega limit in ' +
      '`scripts/teamRules.ts`, missing names in `scripts/overrides.ts`, descriptions, Speed effects, conditions.',
  )
  lines.push('4. `just build`, `npm run lint`, and look at a new Pokémon, the speed tiers and the calc in the browser.')
} else {
  lines.push('1. Repin and regenerate: `just gen-data --update` (`npm run gen-data -- --update`).')
  lines.push(
    '2. Read its warnings: descriptions whose Showdown text changed (revise in `src/i18n/en/<category>.ts`), new ' +
      'Speed items or abilities (`src/lib/speed.ts`), moves whose priority, target or power changed ' +
      '(`src/lib/battleRules.ts`), missing names (`scripts/overrides.ts`).',
  )
  lines.push(
    '3. `git diff src/data/generated` to see what moved (base stats, move numbers, learnsets, availability), then ' +
      '`just build` and `npm run lint`.',
  )
  lines.push(
    "4. Some commits don't touch VGC (Smogon's tier bans, tests): if the generated data comes out unchanged, " +
      'commit just the new pins.',
  )
}
lines.push('')
lines.push('Close this issue once done; the next change found opens a new one.')

writeFileSync(join(ROOT, 'upstream-report.md'), lines.join('\n') + '\n')
const title = newRegs.length
  ? `Regulation ${newRegs.join(', ')} is on Showdown`
  : currentDropped
    ? `Showdown dropped Regulation ${current}`
    : `Showdown's Champions data changed (${commits.length} commit${commits.length === 1 ? '' : 's'})`
console.log(changed ? title : 'Nothing upstream to update.')
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nstate=${state}\ntitle=${title}\n`)
}
