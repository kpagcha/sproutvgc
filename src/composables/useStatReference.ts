import { ref, watch } from 'vue'

// What the Pokémon list marks each base stat against: every Pokémon (`all`), the ones listed at the moment
// (`shown`), or nothing (`off`). Datasets weighted by usage join this list, each with its own weights.
export const STAT_REFERENCES = ['all', 'shown', 'off'] as const
export type StatReference = (typeof STAT_REFERENCES)[number]

const KEY = 'sproutvgc.statReference'

function read(): StatReference {
  try {
    const v = localStorage.getItem(KEY)
    if ((STAT_REFERENCES as readonly string[]).includes(v ?? '')) return v as StatReference
  } catch {
    // Storage unavailable.
  }
  return 'all'
}

const reference = ref<StatReference>(read())
watch(reference, (v) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
})

export const useStatReference = () => reference
