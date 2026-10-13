// Apart from the speed pages' code, as the app's frame reads it for the comparison's way back, and it loads with every
// page.

import { customRef, type Ref } from 'vue'
import type { LocationQuery } from 'vue-router'

/** How long a speed page's state is remembered since last changed: past it, the page opens bare. */
const TTL = 2 * 24 * 60 * 60 * 1000

// A speed page as the reader last left it (its URL's query), saved in the browser with when it was left: the page
// opened bare (from the menu, nothing in its URL) comes back so, and the comparison's way back finds the speed tiers
// so, for `TTL` since it was last changed, after which it's forgotten. Reset all clears it, the URL emptied. `legacy`,
// from before the whole page was kept: the choices kept then, taken once and cleared.
function remembered(key: string, legacy: (saved: string) => LocationQuery, legacyKey: string): Ref<LocationQuery> {
  interface Saved {
    at: number
    q: LocationQuery
  }
  function read(): Saved {
    try {
      const v = localStorage.getItem(key)
      if (v) {
        const saved = JSON.parse(v) as Saved | LocationQuery
        // Saved before it said when: as if left now.
        return typeof saved.at === 'number' && saved.q && typeof saved.q === 'object'
          ? (saved as Saved)
          : { at: Date.now(), q: saved as LocationQuery }
      }
      const old = localStorage.getItem(legacyKey)
      localStorage.removeItem(legacyKey)
      return { at: Date.now(), q: old ? legacy(old) : {} }
    } catch {
      return { at: Date.now(), q: {} }
    }
  }
  let saved = read()
  return customRef((track, trigger) => ({
    get() {
      track()
      return Date.now() - saved.at > TTL ? {} : saved.q
    },
    set(q) {
      saved = { at: Date.now(), q }
      try {
        if (Object.keys(q).length) localStorage.setItem(key, JSON.stringify(saved))
        else localStorage.removeItem(key)
      } catch {
        // Storage unavailable: remembered until the page reloads.
      }
      trigger()
    },
  }))
}

/** A page's query but for the meta snapshot shown (`?meta=`): the reader's choice across pages, not the page's. */
export const withoutMeta = <Q extends Record<string, unknown>>(q: Q): Q =>
  Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'meta')) as Q

/** The speed tiers as last left. Who's shown and how they were drawn, kept before as `show=…&view=…` ('all' older). */
export const lastTiersQuery = remembered(
  'sproutvgc.speedTiers.last',
  (v) => (v === 'all' ? {} : Object.fromEntries(new URLSearchParams(v))),
  'sproutvgc.speedTiers.view',
)
/** The speed comparison as last left. Its view, kept before: 'order', or nothing for yours against opponents. */
export const lastCompareQuery = remembered(
  'sproutvgc.compare.last',
  (v): LocationQuery => (v === 'order' ? { mode: 'order' } : {}),
  'sproutvgc.compare.view',
)

/** The speed tiers' query keys for yours, the Pokémon found and what's picked on the ladder. */
export const TIERS_PICKS = ['mine', 'mynat', 'mypts', 'mymods', 'mystage', 'vs', 'find', 'at'] as const
