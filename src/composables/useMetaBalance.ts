import { shallowRef, watch, type Ref } from 'vue'
import type { MetaData, MetaSnapshot } from '@/data/meta'
import { loadMetaBalance, type MetaBalance } from '@/lib/teamBalance'

/**
 * The meta's physical and special side (`loadMetaBalance`), for the data a page shows: worked out once per dataset
 * when the browser is idle, so the page isn't held up; undefined until then, null with no meta.
 */
export function useMetaBalance(snapshot: Ref<MetaSnapshot | undefined>, data: Ref<MetaData | null | undefined>) {
  const balance = shallowRef<MetaBalance | null | undefined>(undefined)
  watch(
    [snapshot, data],
    ([s, d]) => {
      balance.value = s ? undefined : null
      if (d) loadMetaBalance(d).then((b) => data.value === d && (balance.value = b))
    },
    { immediate: true },
  )
  return balance
}
