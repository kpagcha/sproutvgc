import { h, type FunctionalComponent } from 'vue'
import { follow, hrefOf, type NamedLocation } from '@/lib/links'

// A link to one of the app's pages, for where there are many (the dex tables' rows): a functional component around a
// plain <a>, with its href resolved once (`hrefOf`) and the router following it (`follow`), rather than a RouterLink,
// which sets up a computed route and more as each one mounts.
const AppLink: FunctionalComponent<{ to: NamedLocation }> = (props, { slots }) =>
  h('a', { href: hrefOf(props.to), onClick: follow }, slots.default?.())
AppLink.props = ['to']

export default AppLink
