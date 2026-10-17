import { computed, ref, watch, type Ref } from 'vue'
import { useSearch, type SectionKind } from '@/composables/useSearch'
import { refName } from '@/i18n/refName'
import { fold, split, type Marks } from '@/lib/search'
import { extraOptions, isExtraKind, type Term, type TermKind } from '@/lib/searchTerms'

export interface TermOption {
  term: Term
  name: string
  parts: Marks
  /** How many of the list it'd leave. */
  n: number
}
export interface TermGroup {
  kind: TermKind
  options: TermOption[]
}

/** A kind lists this many at most. */
const PER_KIND = 5
/** The dex entries a term can be, as the dex's search finds them. */
const SECTION_KINDS: readonly SectionKind[] = ['pokemon', 'ability', 'move', 'item']

/**
 * The terms a search box's `text` finds, for a filter search (`FilterSearch`) and its groups' adders: of `kinds`, by
 * kind (types first, then what isn't a dex entry, then the dex's search, `useSearch`), a few of each, each with how many
 * of the list it'd leave (`count`), those leaving none and those `taken` left out. `lead` options come before them (a
 * search by name), highlighted at first; the arrow keys move through them all, Enter picks (`onPick`, the lead's index
 * for one of those), Escape closes them until the text changes.
 */
export function useTermPicker(opts: {
  text: Ref<string>
  kinds: () => readonly TermKind[]
  count: (term: Term) => number
  taken: () => readonly Term[]
  lead?: () => number
  onPick: (option: TermOption | number) => void
}) {
  // The dex's search over every kind of entry a term can be, its sections then narrowed to `kinds` (which can change:
  // a snapshot without sets has no moves or items to filter by), and with none of them, not run at all.
  const searched = computed(() => opts.kinds().some((k) => k === 'type' || !isExtraKind(k)))
  const { results } = useSearch(() => (searched.value ? opts.text.value : ''), SECTION_KINDS)

  const groups = computed((): TermGroup[] => {
    const q = fold(opts.text.value.trim())
    if (!q) return []
    const kinds = opts.kinds()
    const taken = opts.taken()
    const offer = (term: Term, name: string, parts: Marks): TermOption[] => {
      if (taken.some((x) => x.kind === term.kind && x.id === term.id)) return []
      const n = opts.count(term)
      return n ? [{ term, name, parts, n }] : []
    }
    const r = results.value
    const types = kinds.includes('type')
      ? (r?.types ?? []).flatMap((x) => offer({ kind: 'type', id: x.id }, refName({ kind: 'type', id: x.id }), x.parts))
      : []
    const extras = kinds.filter(isExtraKind).map((kind) => ({
      kind: kind as TermKind,
      options: extraOptions(kind)
        .flatMap((o) => {
          const parts = split(o.name, q)
          return parts ? offer({ kind, id: o.id } as Term, o.name, parts) : []
        })
        .slice(0, PER_KIND),
    }))
    const sections = (r?.sections ?? [])
      .filter((s) => kinds.includes(s.kind as TermKind))
      .map((s) => ({
        kind: s.kind as TermKind,
        options: s.hits.flatMap((h) => offer({ kind: s.kind, id: h.id } as Term, h.name, h.parts)).slice(0, PER_KIND),
      }))
    return [{ kind: 'type' as TermKind, options: types.slice(0, PER_KIND) }, ...extras, ...sections].filter(
      (g) => g.options.length,
    )
  })
  const options = computed(() => groups.value.flatMap((g) => g.options))
  const lead = computed(() => opts.lead?.() ?? 0)

  const focused = ref(false)
  const dismissed = ref(false)
  const open = computed(() => focused.value && !dismissed.value && options.value.length + lead.value > 0)
  const active = ref(0)
  watch(options, () => (active.value = 0))
  watch(opts.text, () => (dismissed.value = false))
  /** The term highlighted while the options are open; undefined otherwise, or with a lead option highlighted. */
  const highlighted = computed(() =>
    open.value && active.value >= lead.value ? options.value[active.value - lead.value]?.term : undefined,
  )
  /** Each option's place in the flat list, for the arrow keys. */
  const indexOf = (o: TermOption) => options.value.indexOf(o) + lead.value

  function onKey(e: KeyboardEvent) {
    if (!open.value) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = options.value.length + lead.value
      active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
    } else if (e.key === 'Enter') {
      e.preventDefault()
      opts.onPick(active.value < lead.value ? active.value : options.value[active.value - lead.value]!)
    } else if (e.key === 'Escape') dismissed.value = true
  }

  return { groups, options, open, focused, dismissed, active, highlighted, indexOf, onKey }
}
