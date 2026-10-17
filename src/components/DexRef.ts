import { h, withDirectives, type FunctionalComponent } from 'vue'
import type { Ref } from '@/data/dex'
import { vTip } from '@/directives/tip'
import { refName } from '@/i18n/refName'
import { follow, metaHref, refHref } from '@/lib/links'

// A dex entry by name: a link to its page once its category has one (see `PAGES`), plain text until then; with `meta`
// (on the meta's pages), to its meta page where it has one (`metaHref`). `tip`, if given, shows on hovering the link,
// sharing one tooltip with the rest of `tipGroup` if given (see `v-tip`). A plain link the router follows (`follow`),
// and functional, as there can be hundreds on a page.
const DexRef: FunctionalComponent<{ to: Ref; tip?: string; tipGroup?: string; meta?: boolean }> = (props) => {
  const href = props.meta ? metaHref(props.to) : refHref(props.to)
  const name = refName(props.to)
  return href ? withDirectives(h('a', { href, onClick: follow }, name), [[vTip, props.tip, props.tipGroup]]) : name
}
// `meta` a Boolean, so that `<DexRef :to meta>` is true: a prop declared by name alone takes the attribute's "".
DexRef.props = { to: Object, tip: String, tipGroup: String, meta: Boolean }

export default DexRef
