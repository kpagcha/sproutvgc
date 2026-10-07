// Apart from the speed pages' code, as the app's frame reads it for the comparison's way back, and it loads with every
// page.

import { shallowRef, watch } from 'vue'
import type { LocationQuery } from 'vue-router'

// The speed tiers as the reader last left them (their URL's query), so coming back from the comparison finds them so.
// Kept for the tab's session, so a reload of the comparison keeps it too.
const TIERS_KEY = 'sproutvgc.speedTiers.last'
function savedTiers(): LocationQuery {
  try {
    return JSON.parse(sessionStorage.getItem(TIERS_KEY) ?? '{}') as LocationQuery
  } catch {
    return {}
  }
}
export const lastTiersQuery = shallowRef<LocationQuery>(savedTiers())
watch(lastTiersQuery, (q) => {
  try {
    sessionStorage.setItem(TIERS_KEY, JSON.stringify(q))
  } catch {
    // Storage unavailable: remembered until the page reloads.
  }
})
/** The speed tiers' query keys for yours, the Pokémon found and what's picked on the ladder. */
export const TIERS_PICKS = ['mine', 'mynat', 'mypts', 'mymods', 'mystage', 'vs', 'find', 'at'] as const
