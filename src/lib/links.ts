import type { RouteLocationNamedRaw } from 'vue-router'
import { PAGES, type Ref } from '@/data/dex'
import { router } from '@/router'

// Links for where there are many (the dex tables' rows, references in text): plain <a href>s, followed by the router
// on a click (`follow`), rather than a RouterLink each, a component of its own that resolves its route as it mounts.
// Their hrefs are resolved once and kept.

const hrefs = new Map<string, string>()

/** A named route with string params: what `hrefOf` and `AppLink` take. */
export type NamedLocation = RouteLocationNamedRaw & { name: string; params?: Record<string, string> }

/** The href of a named route with string params, resolved once; one with a query, each time, as the key leaves it out. */
export function hrefOf(to: NamedLocation): string {
  if (to.query && Object.keys(to.query).length) return router.resolve(to).href
  const key = `${to.name}/${Object.values(to.params ?? {}).join('/')}`
  let href = hrefs.get(key)
  if (href === undefined) hrefs.set(key, (href = router.resolve(to).href))
  return href
}

/** The href of a dex entry's page, if its category has pages (see `PAGES`). */
export function refHref(ref: Ref): string | undefined {
  const page = PAGES[ref.kind]
  return page && hrefOf({ name: page.route, params: { [page.param ?? 'id']: ref.id } })
}

/**
 * A click handler that has the router follow a plain click on a link of the app's, the clicked one or one it's in (so
 * a list can have one for all its links). Clicks with a modifier key or another button, and links elsewhere, are left
 * to the browser (a new tab, a download).
 */
export function follow(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element).closest('a')
  if (!a || a.target || a.origin !== location.origin) return
  const base = router.options.history.base
  if (!a.pathname.startsWith(base)) return
  e.preventDefault()
  void router.push(a.pathname.slice(base.length) + a.search + a.hash)
}
