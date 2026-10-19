import { computed, onActivated, onBeforeUnmount, onDeactivated, shallowReactive, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  defaultSnapshot,
  findSnapshot,
  loadMeta,
  selectSnapshot,
  selectedSnapshot,
  type MetaData,
  type MetaSnapshot,
} from '@/data/meta'

/** The pages shown still on other data than the one picked: its data loading, or about to be drawn. */
const behind = shallowReactive(new Set<object>())
/** Whether the data picked is still on its way to the page (`MetaDialog`'s button says so). */
export const metaLoading = computed(() => behind.size > 0)

/** After the next frame: what's changed so far painted. */
const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done)))

// The meta snapshot every page shows (`selectedSnapshot`) and its data, loaded on demand and again whenever the
// reader picks another one (on this page or any other); null until it's in. The page's URL says which (`?meta=<id>`)
// when it isn't the default, so a link opens on the data it was made with, which every page then shows.
// Another one picked, the page keeps what it shows (`snapshot`, the one its data is of, so its labels stay true to its
// numbers) until the new data is in (`loading`, meanwhile), and a frame more, for the pick to show at once: on a phone
// the download takes a moment, and drawing the page again a moment more.
export function useMeta() {
  // Only while the page is shown: a page kept alive away (`KeepAlive` in App.vue) leaves the URL to the one shown.
  const route = useRoute()
  const router = useRouter()
  const page = route.name
  let active = true

  const data = shallowRef<MetaData | null>(null)
  const shown = shallowRef<MetaSnapshot | undefined>()
  const self = {}
  watch(
    selectedSnapshot,
    async (s) => {
      // Nothing drawn yet: the page waits for it as it is (its skeleton).
      if (!s || !data.value) {
        shown.value = s
        data.value = null
      }
      if (!s) return void behind.delete(self)
      if (active) behind.add(self)
      try {
        const d = await loadMeta(s)
        if (shown.value !== s) await nextFrame()
        if (selectedSnapshot.value !== s) return
        shown.value = s
        data.value = d
      } finally {
        if (selectedSnapshot.value === s) behind.delete(self)
      }
    },
    { immediate: true },
  )
  const loading = computed(() => behind.has(self))
  /** The snapshot the URL names, shown. */
  function fromUrl() {
    const id = route.query.meta
    if (!active || route.name !== page || typeof id !== 'string' || id === selectedSnapshot.value?.id) return
    if (findSnapshot(id)) selectSnapshot(id)
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
  onDeactivated(() => {
    active = false
    behind.delete(self)
  })
  onBeforeUnmount(() => behind.delete(self))

  return { snapshot: shown, data, loading }
}
