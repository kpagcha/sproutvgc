import { ref } from 'vue'
import type { PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'

// What the Pokémon pickers share: the Pokémon picked lately in any of them (with `recent`), most recent first, saved
// in this browser; and their groups browsed with an empty search (Recent, Favorites), each folded away or not
// (remembered too) and showing all its Pokémon or its first `GROUP_CAP` (for as long as the page is open).

const RECENT_KEY = 'sproutvgc.picker.recent.v1'
const FOLDED_KEY = 'sproutvgc.picker.folded.v1'
/** The most picks kept. */
const RECENT_LIMIT = 24
/** The most a group shows until it's asked for all. */
export const GROUP_CAP = 8

export type PickerGroup = 'recent' | 'favorites'
const GROUPS: readonly PickerGroup[] = ['recent', 'favorites']

function load<T>(key: string, valid: (v: unknown) => v is T): T[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter(valid) : []
  } catch {
    return []
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode, full): kept for this visit only.
  }
}

const isPokemon = (v: unknown): v is PokemonId => typeof v === 'string' && v in POKEMON
const isGroup = (v: unknown): v is PickerGroup => GROUPS.includes(v as PickerGroup)

const recent = ref<PokemonId[]>(load(RECENT_KEY, isPokemon))
const folded = ref(new Set<PickerGroup>(load(FOLDED_KEY, isGroup)))
const expanded = ref(new Set<PickerGroup>())

export function usePickerGroups() {
  /** Records a pick, moving it to the front. */
  function recordPick(id: PokemonId) {
    recent.value = [id, ...recent.value.filter((x) => x !== id)].slice(0, RECENT_LIMIT)
    save(RECENT_KEY, recent.value)
  }
  function toggleFold(g: PickerGroup) {
    const next = new Set(folded.value)
    if (!next.delete(g)) next.add(g)
    folded.value = next
    save(FOLDED_KEY, [...next])
  }
  function toggleExpanded(g: PickerGroup) {
    const next = new Set(expanded.value)
    if (!next.delete(g)) next.add(g)
    expanded.value = next
  }
  return { recent, folded, expanded, recordPick, toggleFold, toggleExpanded }
}
