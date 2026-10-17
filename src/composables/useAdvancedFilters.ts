import { shallowRef } from 'vue'

// Whether the reader filters lists in the advanced mode (`FilterSearch`: the filters in groups joined by AND or OR,
// any of them negated): one choice for every list on the site, remembered.
const KEY = 'sproutvgc.filters.advanced'
function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const advanced = shallowRef(read())

export function useAdvancedFilters() {
  function setAdvanced(on: boolean) {
    advanced.value = on
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      // Storage unavailable: the choice lasts until the page is closed.
    }
  }
  return { advanced, setAdvanced }
}
