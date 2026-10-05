// The meta: what players use, as snapshots of one source or another (Smogon's Showdown stats, the game's own Battle
// Data, tournaments). The generator has an adapter per source that turns its data into the one shape typed here,
// and which source it uses is decided there: the app never tells one from another, only what each snapshot has
// (`capabilities`), so a page shows what's there and hides the rest. Generated into `generated/meta/`: `index.json`
// lists the snapshots, `<id>.json` holds each one's data, loaded on demand. With none generated there's no meta,
// and pages show none. Sources and their formats: notes/usage-stats.md.

import type { AbilityId, ItemId, MoveId, PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { locale, t } from '@/i18n'

/** The kind of play a snapshot observes, which its label names. */
export type MetaKind = 'showdown' | 'ingame' | 'tournament'

/** What a snapshot has besides each Pokémon's rank, which they all have. */
export type MetaCapability = 'usage' | 'winRate' | 'leads' | 'moves' | 'items' | 'abilities' | 'teammates' | 'spreads'

export interface MetaSnapshot {
  /** Its data's file, `generated/meta/<id>.json`. */
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
  cutoff?: number
  bestOf?: 1 | 3
  battles?: number
  capabilities: MetaCapability[]
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
  winRate?: number
  /** The share of games it leads. */
  lead?: number
  moves?: Share<MoveId>[]
  items?: Share<ItemId>[]
  abilities?: Share<AbilityId>[]
  teammates?: Share<PokemonId>[]
  spreads?: Spread[]
}

export interface MetaData {
  pokemon: Partial<Record<PokemonId, PokemonMeta>>
}

const INDEX = import.meta.glob<MetaSnapshot[]>('./generated/meta/index.json', { eager: true, import: 'default' })
const FILES = import.meta.glob<MetaData>(['./generated/meta/*.json', '!./generated/meta/index.json'], {
  import: 'default',
})

/** Every snapshot generated, in the generator's order of preference. */
export const SNAPSHOTS: readonly MetaSnapshot[] = Object.values(INDEX)[0] ?? []

/** The current regulation's snapshots, the one to show by default first. */
export const currentSnapshots = (): MetaSnapshot[] => SNAPSHOTS.filter((s) => s.regulation === REGULATION)

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
  if (s.cutoff) parts.push(`${s.cutoff}+`)
  if (s.bestOf === 3) parts.push(t('meta.bo3'))
  return parts.join(' · ')
}

/** The providers of the snapshots generated, once each, for the credits. */
export const metaProviders = (): MetaSnapshot['provider'][] => [
  ...new Map(SNAPSHOTS.map((s) => [s.provider.url, s.provider])).values(),
]
