import { h, withDirectives, type FunctionalComponent } from 'vue'
import type { Ref } from '@/data/dex'
import { vTip } from '@/directives/tip'
import { refName } from '@/i18n/refName'
import { follow, refHref } from '@/lib/links'

// A dex entry by name: a link to its page once its category has one (see `PAGES`), plain text until then. `tip`, if
// given, shows on hovering the link. A plain link the router follows (`follow`), and functional, as there can be
// hundreds on a page.
const DexRef: FunctionalComponent<{ to: Ref; tip?: string }> = (props) => {
  const href = refHref(props.to)
  const name = refName(props.to)
  return href ? withDirectives(h('a', { href, onClick: follow }, name), [[vTip, props.tip]]) : name
}
DexRef.props = ['to', 'tip']

export default DexRef
