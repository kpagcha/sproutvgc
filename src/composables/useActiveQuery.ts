import { onActivated, onDeactivated, shallowRef, watch } from 'vue'
import { useRoute, type LocationQuery } from 'vue-router'

// The route's query, for a page kept alive while away (`KeepAlive` in App.vue): it follows the route only while the
// page is shown, so a page away doesn't react to every other page's navigation (and re-render all its rows), and it
// catches up on coming back. It changes only when the query does: the router makes a new one on every navigation.
export function useActiveQuery() {
  const route = useRoute()
  const query = shallowRef<LocationQuery>(route.query)
  let active = true
  const take = (q: LocationQuery) => {
    if (!sameQuery(q, query.value)) query.value = q
  }
  watch(
    () => route.query,
    (q) => active && take(q),
  )
  onActivated(() => {
    active = true
    take(route.query)
  })
  onDeactivated(() => (active = false))
  return query
}

function sameQuery(a: LocationQuery, b: LocationQuery): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => String(a[k]) === String(b[k]))
}
