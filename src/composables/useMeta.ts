import { onActivated, onDeactivated, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { defaultSnapshot, loadMeta, selectSnapshot, selectedSnapshot, snapshots, type MetaData } from '@/data/meta'

// The meta snapshot every page shows (`selectedSnapshot`) and its data, loaded on demand and again whenever the
// reader picks another one (on this page or any other); null until it's in. The page's URL says which (`?meta=<id>`)
// when it isn't the default, so a link opens on the data it was made with, which every page then shows.
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

  // Only while the page is shown: a page kept alive away (`KeepAlive` in App.vue) leaves the URL to the one shown.
  const route = useRoute()
  const router = useRouter()
  const page = route.name
  let active = true
  /** The snapshot the URL names, shown. */
  function fromUrl() {
    const id = route.query.meta
    if (!active || route.name !== page || typeof id !== 'string' || id === selectedSnapshot.value?.id) return
    if (snapshots.value.some((s) => s.id === id)) selectSnapshot(id)
  }
  /** The snapshot shown, in the URL, unless it's the default. After the page's own navigation at its start, if any
   * (it opened bare, as it was left), so as not to undo it: the router replaces the query a moment later. */
  let pending: ReturnType<typeof setTimeout> | undefined
  function toUrl() {
    clearTimeout(pending)
    pending = setTimeout(() => {
      const r = router.currentRoute.value
      if (!active || r.name !== page) return
      const s = selectedSnapshot.value
      const want = s && s !== defaultSnapshot.value ? s.id : undefined
      if (r.query.meta !== want) void router.replace({ query: { ...r.query, meta: want } })
    })
  }
  const sync = () => {
    fromUrl()
    toUrl()
  }
  sync()
  watch(() => route.query.meta, sync)
  watch(selectedSnapshot, toUrl)
  onActivated(() => {
    active = true
    sync()
  })
  onDeactivated(() => (active = false))

  return { snapshot: selectedSnapshot, data }
}
