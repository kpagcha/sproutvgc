// The meta: what players use, as snapshots of one source or another (Smogon's Showdown stats, the game's own Battle
// Data, tournaments). The generator has an adapter per source that turns its data into the one shape typed here,
// and which source it uses is decided there: the app never tells one from another, only what each snapshot has
// (`capabilities`), so a page shows what's there and hides the rest. Generated into `generated/meta/`: `index.json`
// lists the snapshots, `<id>.json` holds each one's data, loaded on demand. With none generated there's no meta,
// and pages show none. Which snapshots the app shows is `VITE_META_SETS` in `.env`: the generator writes every one
// it can (Smogon's four cutoffs, for every month of every regulation it's given), so trying another, or another
// source, is a matter of changing it. The reader picks among them by regulation, dataset and players (`MetaCard`); the
// default is the current regulation's latest dataset. On the dev server, the settings page overrides which are shown
// (`setActiveSnapshots`), saved in this browser.
// Sources and their formats: notes/usage-stats.md.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { computed, ref } from 'vue'
import { REGULATION } from '@/data/format'
import { locale, t } from '@/i18n'

/** The kind of play a snapshot observes, which its label names. */
export type MetaKind = 'showdown' | 'ingame' | 'tournament'

/** What a snapshot has besides each Pokémon's rank, which they all have. */
export type MetaCapability =
  'usage' | 'brought' | 'winRate' | 'leads' | 'moves' | 'items' | 'abilities' | 'teammates' | 'spreads' | 'speeds'

/** Smogon's rating cutoffs: the players whose teams count most. */
export type Cutoff = 0 | 1500 | 1630 | 1760

export interface MetaSnapshot {
  /** Its data's file, `generated/meta/<id>.json`, and how `VITE_META_SETS` names it. */
  id: string
  kind: MetaKind
  /** Where it comes from, for its credit. */
  provider: { name: string; url: string }
  regulation: string
  /** The days its battles were played, as ISO dates. */
  from: string
  to: string
  /** What it covers, for its label: a month of a ladder, a day's snapshot of a season, or an event. */
  period: 'month' | 'day' | 'event'
  /** The game's ranked season ("M6"), for in-game data. */
  season?: string
  /** The rating its teams are weighted by (Smogon's cutoffs). */
  cutoff?: Cutoff
  bestOf?: 1 | 3
  battles?: number
  capabilities: MetaCapability[]
  /** What it has that covers every player, whatever its cutoff (Smogon's brought counts): labeled as such. */
  unweighted?: MetaCapability[]
  /** The snapshot before it in its series (same source, regulation, players and kind of period), for the trends: its
   * Pokémon's `prev` are from there, and one without is new to it. None for a series' first. */
  previous?: string
}

/** An entry of a list, most used first. Its share (0 to 1) when the source gives one: some only rank them. */
export interface Share<T extends string> {
  id: T
  share?: number
}

export interface Spread {
  nature: string
  /** Stat points, in `STATS` order. */
  points: [number, number, number, number, number, number]
  share?: number
}

export interface PokemonMeta {
  /** By usage, from 1. */
  rank: number
  /** The share of teams with it, 0 to 1. */
  usage?: number
  /** How often it's brought, when on a team: the share of its games it appears in battle. */
  brought?: number
  winRate?: number
  /** The share of games it leads. */
  lead?: number
  moves?: Share<MoveId>[]
  items?: Share<ItemId>[]
  abilities?: Share<AbilityId>[]
  teammates?: Share<PokemonId>[]
  spreads?: Spread[]
  /** What its sets put into Speed, from all of them: stat points and nature (by Showdown ID), most common first.
   * Its Speed stat follows from its base Speed (`speedStat`, with `natureEffect`). */
  speeds?: { points: number; nature: string; share: number }[]
  /** Its rank and usage in the snapshot's `previous`, when it was there. */
  prev?: { rank: number; usage?: number }
}

export type MetaData = Partial<Record<PokemonId, PokemonMeta>>

/** Each Pokémon's usage rank in a snapshot's data, for a picker to list them by. */
export const usageRanks = (d: MetaData): Partial<Record<PokemonId, number>> =>
  Object.fromEntries(Object.entries(d).map(([id, m]) => [id, m!.rank]))

const INDEX = import.meta.glob<Record<string, MetaSnapshot>>('./generated/meta/index.json', {
  eager: true,
  import: 'default',
})
const FILES = import.meta.glob<MetaData>(['./generated/meta/*.json', '!./generated/meta/index.json'], {
  import: 'default',
})

const GENERATED = Object.values(INDEX)[0] ?? {}

/** Every snapshot generated, in the generator's order, for the dev settings to pick from. */
export const GENERATED_SNAPSHOTS: readonly MetaSnapshot[] = Object.values(GENERATED)

/** The ones `.env` picks (`VITE_META_SETS`), what production shows: by ID, or a pattern, `*` standing for anything
 * (`smogon-*-1760`: every regulation's and month's), its matches in the generator's order. */
export const DEFAULT_PATTERNS: readonly string[] = (import.meta.env.VITE_META_SETS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
const matching = (pattern: string): string[] => {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`)
  return Object.keys(GENERATED).filter((id) => re.test(id))
}
export const DEFAULT_ACTIVE: readonly string[] = [...new Set(DEFAULT_PATTERNS.flatMap(matching))]
if (import.meta.env.DEV) {
  const missing = DEFAULT_PATTERNS.filter((p) => !matching(p).length)
  if (missing.length) console.warn(`VITE_META_SETS names snapshots never generated: ${missing.join(', ')}`)
}

const DEV_KEY = 'sproutvgc.dev.metaSets'

function savedActive(): string[] | null {
  if (!import.meta.env.DEV) return null
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DEV_KEY) ?? 'null')
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : null
  } catch {
    return null
  }
}

const active = ref<readonly string[]>(savedActive() ?? DEFAULT_ACTIVE)

/** Dev only: shows these snapshots instead of `.env`'s, in this browser; null goes back to `.env`'s. */
export function setActiveSnapshots(ids: readonly string[] | null) {
  active.value = ids ?? DEFAULT_ACTIVE
  try {
    if (ids) localStorage.setItem(DEV_KEY, JSON.stringify(ids))
    else localStorage.removeItem(DEV_KEY)
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}

/** The snapshots the app shows, in order. */
export const snapshots = computed<MetaSnapshot[]>(() => active.value.flatMap((id) => GENERATED[id] ?? []))

/**
 * The latest dataset's snapshots, what's shown by default: the current regulation's latest (any regulation's,
 * when the current one has none yet), in their order.
 */
const latestSnapshots = computed<MetaSnapshot[]>(() => {
  const list = snapshots.value
  const pool = list.some((s) => s.regulation === REGULATION) ? list.filter((s) => s.regulation === REGULATION) : list
  const latest = pool.reduce<MetaSnapshot | undefined>((a, s) => (!a || s.to > a.to ? s : a), undefined)
  return latest ? pool.filter((s) => datasetKey(s) === datasetKey(latest)) : []
})

/** The snapshot shown by default: the latest dataset's first. */
export const defaultSnapshot = computed<MetaSnapshot | undefined>(() => latestSnapshots.value[0])

const PICK_KEY = 'sproutvgc.metaSet'
/** A pick of the latest dataset, saved as its subset alone (`latest:1630`), so that it stays the latest as new ones
 * come; any other is saved as its ID. */
const LATEST = 'latest:'

function savedPick(): string | null {
  try {
    const id = localStorage.getItem(PICK_KEY)
    // From before snapshot IDs named their regulation and month ("smogon-1630"): a pick of a cutoff of the latest.
    return id?.replace(/^smogon-(\d+)$/, `${LATEST}$1`) ?? null
  } catch {
    return null
  }
}

const picked = ref<string | null>(savedPick())

const subsetKey = (s: MetaSnapshot) => `${s.cutoff ?? ''}|${s.bestOf ?? ''}`

/** The snapshot every page shows: the one the reader picked, while it's still shown, or else the latest's first. */
export const selectedSnapshot = computed<MetaSnapshot | undefined>(() => {
  const latest = latestSnapshots.value
  const p = picked.value
  if (p?.startsWith(LATEST)) {
    const subset = p.slice(LATEST.length)
    return latest.find((s) => subsetKey(s) === subset || String(s.cutoff) === subset) ?? latest[0]
  }
  return snapshots.value.find((s) => s.id === p) ?? latest[0]
})

/** Whether the snapshot shown is of another dataset than the latest (another regulation or period), whatever its
 * players: what the data button marks, tinted. */
export const offLatest = computed(() => {
  const s = selectedSnapshot.value
  return !!s && !latestSnapshots.value.includes(s)
})

/** Back to the latest dataset, at the players shown when it has them (its card's Latest). */
export function showLatest() {
  const now = selectedSnapshot.value
  const s = latestSnapshots.value.find((x) => now && subsetKey(x) === subsetKey(now)) ?? latestSnapshots.value[0]
  if (s) selectSnapshot(s.id)
}

/** Shows `id`'s snapshot on every page, remembered in this browser. */
export function selectSnapshot(id: string) {
  const s = snapshots.value.find((x) => x.id === id)
  const save = s && latestSnapshots.value.includes(s) ? `${LATEST}${subsetKey(s)}` : id
  picked.value = save
  try {
    localStorage.setItem(PICK_KEY, save)
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}

const ROSTERS = import.meta.glob<Record<string, PokemonId[]>>('./generated/meta/rosters.json', {
  eager: true,
  import: 'default',
})

/** A past regulation's legal Pokémon, those the dex still has; null for the current one, whose are the dex's. */
export const pastRoster = (regulation: string): readonly PokemonId[] | null =>
  regulation === REGULATION ? null : (Object.values(ROSTERS)[0]?.[regulation] ?? null)

export const has = (s: MetaSnapshot, c: MetaCapability) => s.capabilities.includes(c)

const loaded = new Map<string, Promise<MetaData>>()

/** A snapshot's data, loaded once. */
export function loadMeta(s: MetaSnapshot): Promise<MetaData> {
  let p = loaded.get(s.id)
  if (!p) {
    const file = FILES[`./generated/meta/${s.id}.json`]
    if (!file) throw new Error(`No data for the meta snapshot "${s.id}"`)
    loaded.set(s.id, (p = file()))
  }
  return p
}

const date = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale.value, { ...opts, timeZone: 'UTC' })

/** What a snapshot is, to label every number from it with: "Showdown ladder · Sep 2026 · 1760+". */
export const metaLabel = (s: MetaSnapshot): string => metaParts(s).join(' · ')

/** What a snapshot is, part by part: its dataset's (kind, season, period), then its subset's (players, format). */
export const metaParts = (s: MetaSnapshot): string[] => [...datasetParts(s), ...subsetParts(s)]

/** What a snapshot's dataset is, part by part: its kind, season and period ("Showdown ladder", "Sep 2026"). */
export const datasetParts = (s: MetaSnapshot): string[] => [
  ...(severalRegulations.value ? [t('meta.regulation', { reg: s.regulation })] : []),
  ...sourceParts(s),
]

/** What a snapshot's dataset is within its regulation: its source and period ("Showdown ladder", "Sep 2026"). */
export function sourceParts(s: MetaSnapshot): string[] {
  const parts = [t(`meta.kind.${s.kind}`)]
  if (s.season) parts.push(t('meta.season', { season: s.season }))
  parts.push(periodLabel(s))
  return parts
}

/** Whether the snapshots shown are of several regulations: then each one's label names its own. */
const severalRegulations = computed(() => new Set(snapshots.value.map((s) => s.regulation)).size > 1)

/** The period a snapshot covers: its month ("Sep 2026"), or the day it ends. */
const periodLabel = (s: MetaSnapshot): string =>
  s.period === 'month'
    ? date(s.from, { month: 'short', year: 'numeric' })
    : date(s.to, { day: 'numeric', month: 'short', year: 'numeric' })

/** What tells a snapshot apart within its dataset, part by part: whose teams count most, and the format. */
export function subsetParts(s: MetaSnapshot): string[] {
  const parts: string[] = []
  if (s.cutoff !== undefined) parts.push(players(s.cutoff))
  if (s.bestOf === 3) parts.push(t('meta.bo3'))
  return parts
}

/** A snapshot's subset in short, for where room is tight: "1760+", "All players", "Bo3". */
export function subsetShort(s: MetaSnapshot): string {
  const parts: string[] = []
  if (s.cutoff !== undefined) parts.push(s.cutoff ? `${s.cutoff}+` : t('meta.players.0'))
  if (s.bestOf === 3) parts.push(t('meta.bo3'))
  return parts.join(' · ')
}

/**
 * A dataset: what one source observed over one period, for one regulation ("Showdown ladder · Sep 2026"), as its
 * snapshots, which tell apart whose teams count most (Smogon's cutoffs) or the format. Another month, another source or
 * another regulation is another dataset.
 */
export interface MetaDataset {
  key: string
  regulation: string
  provider: MetaSnapshot['provider']
  from: string
  to: string
  battles?: number
  label: string
  snapshots: MetaSnapshot[]
}

const datasetKey = (s: MetaSnapshot) =>
  [s.regulation, s.provider.url, s.kind, s.season ?? '', s.period, s.from, s.to].join('|')

/** Snapshots by dataset, by regulation (see below), each's snapshots in their order. */
export function metaDatasets(list: readonly MetaSnapshot[]): MetaDataset[] {
  const byKey = new Map<string, MetaDataset>()
  for (const s of list) {
    const key = datasetKey(s)
    let d = byKey.get(key)
    if (!d) {
      d = {
        key,
        regulation: s.regulation,
        provider: s.provider,
        from: s.from,
        to: s.to,
        battles: s.battles,
        label: datasetParts(s).join(' · '),
        snapshots: [],
      }
      byKey.set(key, d)
    }
    d.snapshots.push(s)
  }
  // A regulation's datasets together: the current regulation's first, then the one with the latest, each one's latest
  // first.
  const all = [...byKey.values()]
  const last = new Map<string, string>()
  for (const d of all) if (d.to > (last.get(d.regulation) ?? '')) last.set(d.regulation, d.to)
  return all.sort(
    (a, b) =>
      Number(b.regulation === REGULATION) - Number(a.regulation === REGULATION) ||
      last.get(b.regulation)!.localeCompare(last.get(a.regulation)!) ||
      b.regulation.localeCompare(a.regulation) ||
      b.to.localeCompare(a.to),
  )
}

/** The days a dataset covers, in the reader's language: "1–30 Sep 2026". */
export const datasetDates = (d: Pick<MetaDataset, 'from' | 'to'>) =>
  new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(new Date(`${d.from}T00:00:00Z`), new Date(`${d.to}T00:00:00Z`))

/** Whose teams a cutoff counts most: "Strong players (1760+)". */
export const players = (c: Cutoff) =>
  c ? t('meta.cutoff', { players: t(`meta.players.${c}`), cutoff: c }) : t('meta.players.0')

/** The providers of the snapshots shown, once each, for the credits. */
export const metaProviders = (): MetaSnapshot['provider'][] => [
  ...new Map(snapshots.value.map((s) => [s.provider.url, s.provider])).values(),
]

/** A share as a percentage in the reader's language, to one decimal: "46.6%", "<0.1%" below that. */
export function percent(share: number): string {
  const f = (x: number) =>
    x.toLocaleString(locale.value, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return share > 0 && share < 0.0005 ? `<${f(0.001)}` : f(share)
}
