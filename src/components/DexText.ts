import { h, type FunctionalComponent } from 'vue'
import type { Ref } from '@/data/dex'
import DexRef from '@/components/DexRef'
import { shortText } from '@/i18n/descriptions'
import { parseDexText } from '@/lib/dexText'

const canHover = window.matchMedia('(hover: hover)').matches
const tip = (ref: Ref) => (canHover ? shortText(ref) : undefined)

// Curated text with references to dex entries embedded as markers (`{type:flying}`, `{move:taunt}`): the markers
// render as the entries' names, in the reader's language, linked once their category has pages. `npm run check-text`
// makes sure every marker names an entry the regulation has. Entries with descriptions (abilities, moves, items,
// conditions) show their short one on hover, where there is hover (on touch screens a tap would show it and follow the
// link at once). Functional, as there can be hundreds on a page.
const DexText: FunctionalComponent<{ text: string }> = (props) =>
  parseDexText(props.text).map((part) => ('ref' in part ? h(DexRef, { to: part.ref, tip: tip(part.ref) }) : part.text))
DexText.props = ['text']

export default DexText
