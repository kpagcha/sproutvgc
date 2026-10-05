import { shallowRef, watch } from 'vue'
import { loadMeta, selectedSnapshot, type MetaData } from '@/data/meta'

// The meta snapshot every page shows (`selectedSnapshot`) and its data, loaded on demand and again whenever the
// reader picks another one (on this page or any other); null until it's in.
export function useMeta() {
  const data = shallowRef<MetaData | null>(null)
  watch(
    selectedSnapshot,
    async (s) => {
      data.value = null
      if (!s) return
      const d = await loadMeta(s)
      if (selectedSnapshot.value === s) data.value = d
    },
    { immediate: true },
  )
  return { snapshot: selectedSnapshot, data }
}
