// Apart from the speed pages' code, as the app's frame reads it for the comparison's way back, and it loads with every
// page.

import { shallowRef, watch } from 'vue'
import type { LocationQuery } from 'vue-router'

// A speed page as the reader last left it (its URL's query), saved in the browser: the page opened bare (from the menu,
// nothing in its URL) comes back so, and the comparison's way back finds the speed tiers so. Reset all clears it, the
// URL emptied. `legacy`, from before the whole page was kept: the choices kept then, taken once and cleared.
function remembered(key: string, legacy: (saved: string) => LocationQuery, legacyKey: string) {
  function read(): LocationQuery {
    try {
      const v = localStorage.getItem(key)
      if (v) return JSON.parse(v) as LocationQuery
      const old = localStorage.getItem(legacyKey)
      localStorage.removeItem(legacyKey)
      return old ? legacy(old) : {}
    } catch {
      return {}
    }
  }
  const last = shallowRef<LocationQuery>(read())
  watch(last, (q) => {
    try {
      if (Object.keys(q).length) localStorage.setItem(key, JSON.stringify(q))
      else localStorage.removeItem(key)
    } catch {
      // Storage unavailable: remembered until the page reloads.
    }
  })
  return last
}

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
