import { ref, watch } from 'vue'
import type { TypeId } from '@/data/types'
import type { Ids, NamedKind, Ref } from '@/data/dex'
import type { ConditionId, MoveNamedCondition } from '@/data/conditions'
import * as en from './en'
import * as es from './es'
import { LOCALES, type Locale } from './locales'

export { LOCALES, type Locale }
export type MessageKey = keyof typeof en.messages

/** Categories whose names are generated from the games' data (`npm run gen-data`), for every locale. */
export type GeneratedKind = 'ability' | 'move' | 'item' | 'pokemon'
/**
 * A locale's names of every entry of the categories it names, per category: one missing is a compile error.
 * Conditions named after their move (Taunt, Tailwind) take its name instead.
 */
export type Names = {
  condition: Record<Exclude<ConditionId, MoveNamedCondition>, string>
  group: Record<Ids['group'], string>
}

const BUNDLES: Record<Locale, { messages: Record<MessageKey, string>; types: Record<TypeId, string>; names: Names }> = {
  en,
  es,
}

const KEY = 'mondex.lang'

function isLocale(s: unknown): s is Locale {
  return typeof s === 'string' && s in LOCALES
}

function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Storage unavailable.
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.slice(0, 2).toLowerCase()
    if (isLocale(base)) return base
  }
  return 'en'
}

export const locale = ref<Locale>(detect())

watch(
  locale,
  (l) => {
    document.documentElement.lang = l
  },
  { immediate: true },
)

export function setLocale(l: Locale) {
  locale.value = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
}

/** Translate `key`, replacing `{name}` placeholders with `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const s = BUNDLES[locale.value].messages[key] ?? en.messages[key]
  return params ? s.replace(/\{(\w+)\}/g, (m, p: string) => String(params[p] ?? m)) : s
}

/**
 * Split a message around one `{slot}` so a component (e.g. a type badge) can
 * be rendered in its place: returns [before, after].
 */
export function tSplit(key: MessageKey, slot: string): [string, string] {
  const s = t(key)
  const i = s.indexOf(`{${slot}}`)
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + slot.length + 2)]
}

/**
 * A message split around all its `{slot}`s, so components can be rendered in their places: text parts are strings,
 * slots `{ slot: name }`. "Mega Evolves from {pokemon} holding {item}." gives the text, `pokemon`, the text, `item`...
 */
export function tSlots(key: MessageKey): (string | { slot: string })[] {
  return t(key)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => (/^\{\w+\}$/.test(part) ? { slot: part.slice(1, -1) } : part))
}

export function typeName(type: TypeId): string {
  return BUNDLES[locale.value].types[type]
}

/**
 * Official name of a condition or group, from the locale's names; `undefined` for conditions named after their move
 * (`refName` in `@/i18n/refName` names those, and any entry).
 */
export function termName(ref: Ref<Exclude<NamedKind, GeneratedKind>>): string | undefined {
  return (BUNDLES[locale.value].names[ref.kind] as Record<string, string>)[ref.id]
}
