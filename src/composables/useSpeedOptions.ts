import { shallowRef, watch } from 'vue'

// How a Pokémon's usage page measures its Speed against the meta, the same on every Pokémon and remembered: at its
// sets or at its most common Speed alone, against every Pokémon of the dataset or its top 50 or 100, and whether the
// opponents' builds under `MIN_SHARE` of their sets are left out (as the speed tiers leave them out).
const KEY = 'sproutvgc.usageSpeed.v1'

export type SpeedMine = 'sets' | 'common'
export type SpeedField = 'all' | '50' | '100'
interface SpeedOptions {
  mine: SpeedMine
  field: SpeedField
  rare: boolean
}
const DEFAULTS: SpeedOptions = { mine: 'sets', field: 'all', rare: false }

function saved(): SpeedOptions {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SpeedOptions>
    return {
      mine: o.mine === 'common' ? 'common' : 'sets',
      field: o.field === '50' || o.field === '100' ? o.field : 'all',
      rare: o.rare === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}
const first = saved()
const mine = shallowRef(first.mine)
const field = shallowRef(first.field)
const rare = shallowRef(first.rare)
watch([mine, field, rare], ([m, f, r]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ mine: m, field: f, rare: r }))
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
})

export function useSpeedOptions() {
  return { mine, field, rare }
}
