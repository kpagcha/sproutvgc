import { onActivated, onDeactivated, shallowRef, watch } from 'vue'
import { useRoute, type LocationQuery } from 'vue-router'

// The route's query, for a page kept alive while away (`KeepAlive` in App.vue): it follows the route only while the
// page is shown, so a page away doesn't react to every other page's navigation (and re-render all its rows), and it
// catches up on coming back.
export function useActiveQuery() {
  const route = useRoute()
  const query = shallowRef<LocationQuery>(route.query)
  let active = true
  watch(
    () => route.query,
    (q) => {
      if (active) query.value = q
    },
  )
  onActivated(() => {
    active = true
    if (query.value !== route.query) query.value = route.query
  })
  onDeactivated(() => (active = false))
  return query
}
