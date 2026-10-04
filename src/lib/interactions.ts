// Interactions beyond the type chart for one side of a matchup: a Pokémon's types defending, or a set of move types
// attacking. Each side is split by relevance: the key rows up front (statuses, weather and terrain); the other major
// ones collapsed, then the minor ones, and last the "more" rows about specific moves and abilities.

import { condition, move, refKey, sameRef, type Ref } from '@/data/dex'
import { chart, TYPES, type TypeId } from '@/data/types'
import {
  ATK_ROWS,
  DEF_ROWS,
  MORE_ROWS,
  isKey,
  isMajor,
  resistBerry,
  typeInfo,
  type Entry,
  type EntryKey,
  type TypeInfo,
} from '@/data/typeinfo'
import { t, typeName, type MessageKey } from '@/i18n'
import { defensiveProfile, effectiveness, formatMult } from '@/lib/typecalc'

/** An entry, with the move type it's about when a row mixes several. */
export interface InfoEntry extends Entry {
  of?: TypeId
}
export interface InfoNote {
  text: string
  of?: TypeId
}
export interface InfoRow {
  label: string
  entries?: InfoEntry[]
  notes?: InfoNote[]
}
export interface SideInfo {
  major: InfoRow[]
  /** The major rows that aren't key (`isKey`), shown collapsed ahead of the minor ones. */
  other: InfoRow[]
  minor: InfoRow[]
  more: InfoRow[]
}

export const hasInfo = (i: SideInfo) => i.major.length + i.other.length + i.minor.length + i.more.length > 0

/** `info` with only the key interactions up front (`isKey`), and the rest of the major ones in `other`: the type
 * pages keep to the essentials. Notes are never key. */
function keyOnly(info: SideInfo): SideInfo {
  const major: InfoRow[] = []
  const other: InfoRow[] = []
  for (const row of info.major) {
    const key = row.entries?.filter(isKey) ?? []
    const rest = row.entries?.filter((e) => !isKey(e)) ?? []
    if (key.length) major.push({ label: row.label, entries: key })
    if (rest.length) other.push({ label: row.label, entries: rest })
    if (row.notes) other.push(row)
  }
  return { ...info, major, other }
}

/** What an entry does besides its multiplier: "+1 SpA", "Def 1.5×", "+1 priority", "sound moves", or several of
 * them ("redirects, +1 SpA"). */
export function effectText(e: Entry): string {
  const parts: string[] = []
  if (e.fx) parts.push(t(e.fx))
  if (e.priority) parts.push(t('info.priority', { n: e.priority }))
  if (e.stat) {
    const stat = t(`stat.${e.stat}`)
    parts.push(e.stages ? `+${e.stages} ${stat}` : `${stat} ${formatMult(e.statMult ?? 1)}`)
  }
  return parts.join(', ')
}

/** An interaction beyond the type chart that mentions an entry: the type it's about, its row, and the entry. */
export interface RefInteraction {
  type: TypeId
  row: EntryKey
  entry: Entry
}

/** Every interaction mentioning `ref`, by type in chart order (for an ability's page: what Levitate does to Ground). */
export function interactionsOf(ref: Ref): RefInteraction[] {
  return TYPES.flatMap((type) => {
    const info = typeInfo(type)
    return [...DEF_ROWS, ...ATK_ROWS, ...MORE_ROWS].flatMap((row) =>
      (info[row] ?? []).filter((entry) => sameRef(entry.ref, ref)).map((entry) => ({ type, row, entry })),
    )
  })
}

const label = (k: EntryKey | 'berries', type?: TypeId) =>
  t(`info.${k}` as MessageKey, { type: type ? typeName(type) : '' })

/** Adds a row's entries to `out`, split by relevance into a major and a minor row under the same label. */
function addRow(out: SideInfo, text: string, entries: InfoEntry[]) {
  const major = entries.filter(isMajor)
  const minor = entries.filter((e) => !isMajor(e))
  if (major.length) out.major.push({ label: text, entries: major })
  if (minor.length) out.minor.push({ label: text, entries: minor })
}

function addNotes(out: SideInfo, notes: (InfoNote & { major?: boolean })[]) {
  const pick = (major: boolean) => notes.filter((n) => !!n.major === major).map(({ text, of }) => ({ text, of }))
  for (const [list, major] of [
    [out.major, true],
    [out.minor, false],
  ] as const) {
    const ns = pick(major)
    if (ns.length) list.push({ label: t('info.notes'), notes: ns })
  }
}

/** One row per type for the "more" interactions, as their labels name the type ("Becomes Fire"). */
function addMore(out: SideInfo, infos: [TypeId, TypeInfo][], keys: readonly EntryKey[]) {
  for (const k of keys) {
    for (const [ty, info] of infos) {
      if (info[k]?.length) out.more.push({ label: label(k, ty), entries: info[k] })
    }
  }
}

/** Entries in order, keeping the first of each entry (and condition): Poison and Steel both block poison. */
function dedupe(entries: Entry[]): Entry[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    const id = `${refKey(e.ref)}/${e.cond?.id ?? ''}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const FREEZE_DRY = move('freezedry')

/** What a Pokémon of `types` (one or two) takes from beyond the chart. */
export function defenseInfo(types: readonly TypeId[]): SideInfo {
  const out: SideInfo = { major: [], other: [], minor: [], more: [] }
  const infos = types.map((ty) => [ty, typeInfo(ty)] as [TypeId, TypeInfo])
  const flying = types.includes('flying')

  for (const k of DEF_ROWS) {
    let entries = dedupe(infos.flatMap(([, info]) => info[k] ?? []))
    if (k === 'hurt') {
      // Both of these come from the two types together. Freeze-Dry is Ice that hits Water 2×.
      entries = entries.filter((e) => !sameRef(e.ref, FREEZE_DRY))
      if (types.includes('water')) {
        const m = types.reduce((p, ty) => p * (ty === 'water' ? 2 : chart('ice', ty)), 1)
        entries.unshift({ ref: FREEZE_DRY, mult: m })
      }
      const rock = effectiveness('rock', types)
      if (rock !== 1) entries.push({ ref: condition('stealthrock'), mult: rock })
    }
    addRow(out, label(k), entries)
  }

  // The berry for each weakness halves it, so a 4× weakness still takes 2×.
  const profile = defensiveProfile(types)
  const berries = [...profile[4], ...profile[2]].map((ty) => ({ ref: resistBerry(ty), vs: ty }))
  addRow(out, label('berries'), berries)

  addNotes(
    out,
    infos.flatMap(([, info]) =>
      (info.notes ?? [])
        .filter((n) => !n.side)
        // A Flying type never touches Toxic Spikes, so it can't pick them up either.
        .filter((n) => !(flying && n.key === 'info.note.toxicSpikes'))
        .map((n) => ({ text: t(n.key), major: n.major })),
    ),
  )
  // What changes the Pokémon's own types.
  addMore(out, infos, ['gives', 'loses'])
  return keyOnly(out)
}

/** What changes how moves of `types` (up to four) hit. Rows mixing several types tag each entry with its type. */
export function attackInfo(types: readonly TypeId[]): SideInfo {
  const out: SideInfo = { major: [], other: [], minor: [], more: [] }
  const infos = types.map((ty) => [ty, typeInfo(ty)] as [TypeId, TypeInfo])
  const tag = types.length > 1
  for (const k of ATK_ROWS) {
    addRow(
      out,
      label(k),
      infos.flatMap(([ty, info]) => (info[k] ?? []).map((e) => (tag ? { ...e, of: ty } : e))),
    )
  }
  addNotes(
    out,
    infos.flatMap(([ty, info]) =>
      (info.notes ?? [])
        .filter((n) => n.side === 'atk')
        .map((n) => ({ text: t(n.key), of: tag ? ty : undefined, major: n.major })),
    ),
  )
  // What turns into the type, and moves of it with their own conditions.
  addMore(out, infos, ['becomes', 'specific'])
  return keyOnly(out)
}
