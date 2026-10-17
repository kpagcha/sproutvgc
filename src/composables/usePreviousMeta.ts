import { computed, shallowRef, watch, type Ref } from 'vue'
import { GENERATED_SNAPSHOTS, loadMeta, type MetaData, type MetaSnapshot } from '@/data/meta'

// The dataset before the one shown in its series (`previous`, the month before), for the trends, and its data, loaded
// on its own: null until it's in, and with none before.
export function usePreviousMeta(snapshot: Readonly<Ref<MetaSnapshot | undefined>>) {
  const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
  const prevData = shallowRef<MetaData | null>(null)
  watch(
    previous,
    async (s) => {
      prevData.value = null
      if (!s) return
      const d = await loadMeta(s)
      if (previous.value === s) prevData.value = d
    },
    { immediate: true },
  )
  return { previous, prevData }
}
