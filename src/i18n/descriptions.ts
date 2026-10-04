// Our curated descriptions, one file per language and category (`src/i18n/<locale>/<category>.ts`), each a chunk of
// its own loaded on demand like the generated names: routes that show descriptions wait for their categories'
// (`meta.descriptions` in the router), and `description` loads them itself if a page shows one before that.

import { shallowReactive } from 'vue'
import type { Ref } from '@/data/dex'
import { locale, type Locale } from '@/i18n'
import { refName } from '@/i18n/refName'
import type { Description } from '@/i18n/en/abilities'

type Descriptions = Record<string, Pick<Description, 'short' | 'long'>>

/** The categories with descriptions, and the files they're in. */
const FOLDERS = { ability: 'abilities', move: 'moves', item: 'items', condition: 'conditions' } as const
export type DescribedKind = keyof typeof FOLDERS

const FILES = import.meta.glob<Descriptions>('./*/*.ts', { import: 'descriptions' })

const loaded = shallowReactive<Partial<Record<`${Locale}/${DescribedKind}`, Descriptions>>>({})
const loading: Partial<Record<`${Locale}/${DescribedKind}`, Promise<void>>> = {}

/** Loads the descriptions of `kinds` in `l` (the current locale by default), once. A category with none gets none. */
export function loadDescriptions(kinds: readonly DescribedKind[], l: Locale = locale.value): Promise<unknown> {
  return Promise.all(
    kinds.map(
      (kind) =>
        (loading[`${l}/${kind}`] ??= (async () => {
          const load = FILES[`./${l}/${FOLDERS[kind]}.ts`]
          loaded[`${l}/${kind}`] = load ? await load() : {}
        })()),
    ),
  )
}

/**
 * An entry's description in the current locale, or in English while it has no translation (`npm run gen-data` lists
 * those). `undefined` for one with no description, and until the descriptions load.
 */
export function description(kind: DescribedKind, id: string): Pick<Description, 'short' | 'long'> | undefined {
  const own = loaded[`${locale.value}/${kind}`]
  if (!own) {
    void loadDescriptions([kind])
    return undefined
  }
  if (own[id] || locale.value === 'en') return own[id]
  const en = loaded[`en/${kind}`]
  if (!en) void loadDescriptions([kind], 'en')
  return en?.[id]
}

/** Whether a category has descriptions: the kinds of `ref`s `description` can describe. */
export const isDescribed = (kind: string): kind is DescribedKind => kind in FOLDERS

/** An entry's short description as plain text, its markers swapped for the names they mark: for a tooltip. */
export function shortText(ref: Ref): string | undefined {
  const short = isDescribed(ref.kind) ? description(ref.kind, ref.id)?.short : undefined
  return short?.replace(/\{(\w+):(\w+)\}/g, (_, kind: string, id: string) => refName({ kind, id } as Ref))
}
