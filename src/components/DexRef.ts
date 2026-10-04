import { h, withDirectives, type FunctionalComponent } from 'vue'
import type { Ref } from '@/data/dex'
import { vTip } from '@/directives/tip'
import { refName } from '@/i18n/refName'
import { follow, refHref } from '@/lib/links'

// A dex entry by name: a link to its page once its category has one (see `PAGES`), plain text until then. `tip`, if
// given, shows on hovering the link, sharing one tooltip with the rest of `tipGroup` if given (see `v-tip`). A plain link the router follows (`follow`), and functional, as there can be
// hundreds on a page.
const DexRef: FunctionalComponent<{ to: Ref; tip?: string; tipGroup?: string }> = (props) => {
  const href = refHref(props.to)
  const name = refName(props.to)
  return href ? withDirectives(h('a', { href, onClick: follow }, name), [[vTip, props.tip, props.tipGroup]]) : name
}
DexRef.props = ['to', 'tip', 'tipGroup']

export default DexRef
