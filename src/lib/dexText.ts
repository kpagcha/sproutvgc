import type { Ref } from '@/data/dex'

/** A piece of curated text: plain text, or a marker (`{move:taunt}`) referencing a dex entry. */
export type DexTextPart = { text: string } | { ref: Ref }

/** Curated text split into its plain text and its markers (rendered by `DexText`). */
export function parseDexText(text: string): DexTextPart[] {
  return text.split(/(\{\w+:\w+\})/).map((part) => {
    const marker = part.match(/^\{(\w+):(\w+)\}$/)
    return marker ? { ref: { kind: marker[1], id: marker[2] } as Ref } : { text: part }
  })
}
