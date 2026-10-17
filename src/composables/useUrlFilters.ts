import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { formatTermFilters, parseTermFilters, type TermFilters, type TermKind } from '@/lib/searchTerms'

/** A list's filters of `kinds` (`FilterSearch`), kept in the URL (`?f=`, `?fm=`), so a link opens on them. */
export function useUrlFilters(kinds: () => readonly TermKind[]) {
  const query = useActiveQuery()
  const router = useRouter()
  return computed<TermFilters>({
    get: () => parseTermFilters(query.value.f, query.value.fm, kinds()),
    set: (f) => void router.replace({ query: { ...query.value, ...formatTermFilters(f) } }),
  })
}
