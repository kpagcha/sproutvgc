import { shallowRef, watch } from 'vue'

// How the meta's lists show (a Pokémon's usage page's abilities, moves and items), the same in all of them and
// remembered: for now, whether each entry's short description shows (not unless the reader asks).
const KEY = 'sproutvgc.metaLists.descriptions'

function saved(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const descriptions = shallowRef(saved())
watch(descriptions, (on) => {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
})

export function useListOptions() {
  return { descriptions }
}
