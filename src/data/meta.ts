// The meta: what players use, as snapshots of one source or another (Smogon's Showdown stats, the game's own Battle
// Data, tournaments). The generator has an adapter per source that turns its data into the one shape typed here,
// and which source it uses is decided there: the app never tells one from another, only what each snapshot has
// (`capabilities`), so a page shows what's there and hides the rest. Generated into `generated/meta/`: `index.json`
// lists the snapshots, `<id>.json` holds each one's data, loaded on demand. With none generated there's no meta,
// and pages show none. Which snapshots the app shows, the first by default, is `VITE_META_SETS` in `.env`: the
// generator writes every one it can (Smogon's four cutoffs), so trying another, or another source, is a matter of
// changing it. On the dev server, the settings page overrides it (`setActiveSnapshots`), saved in this browser.
// Sources and their formats: notes/usage-stats.md.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { computed, ref } from 'vue'
import { REGULATION } from '@/data/format'
import { locale, t } from '@/i18n'

/** The kind of play a snapshot observes, which its label names. */
export type MetaKind = 'showdown' | 'ingame' | 'tournament'

/** What a snapshot has besides each Pokémon's rank, which they all have. */
export type MetaCapability =
  'usage' | 'brought' | 'winRate' | 'leads' | 'moves' | 'items' | 'abilities' | 'teammates' | 'spreads'

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
}

export type MetaData = Partial<Record<PokemonId, PokemonMeta>>

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

/** The ones `.env` picks (`VITE_META_SETS`), what production shows. */
export const DEFAULT_ACTIVE: readonly string[] = (import.meta.env.VITE_META_SETS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
if (import.meta.env.DEV) {
  const missing = DEFAULT_ACTIVE.filter((id) => !GENERATED[id])
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

/** The current regulation's snapshots, the one to show by default first. */
export const currentSnapshots = (): MetaSnapshot[] => snapshots.value.filter((s) => s.regulation === REGULATION)

/** The snapshot to show by default, if there's any for the current regulation. */
export const currentSnapshot = (): MetaSnapshot | undefined => currentSnapshots()[0]

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
export function metaLabel(s: MetaSnapshot): string {
  const parts = [t(`meta.kind.${s.kind}`)]
  if (s.season) parts.push(t('meta.season', { season: s.season }))
  parts.push(
    s.period === 'month'
      ? date(s.from, { month: 'short', year: 'numeric' })
      : date(s.to, { day: 'numeric', month: 'short', year: 'numeric' }),
  )
  if (s.cutoff !== undefined) parts.push(players(s.cutoff))
  if (s.bestOf === 3) parts.push(t('meta.bo3'))
  return parts.join(' · ')
}

/** Whose teams a cutoff counts most: "Strong players (1760+)". */
export const players = (c: Cutoff) =>
  c ? t('meta.cutoff', { players: t(`meta.players.${c}`), cutoff: c }) : t('meta.players.0')

/** The providers of the snapshots shown, once each, for the credits. */
export const metaProviders = (): MetaSnapshot['provider'][] => [
  ...new Map(snapshots.value.map((s) => [s.provider.url, s.provider])).values(),
]
