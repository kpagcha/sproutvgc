import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { afterPageEnter, pageKey } from '@/lib/pageExit'

// Whether the page has finished coming in, for parts slow enough to render that they would stall the transition: they
// show a skeleton until then. A page left before it got there (clicking through the header) never renders them.
// Going back, forward or reloading, they render at once, so the router can restore the scroll position (vue-router
// keeps it in `history.state.scroll`, which a new history entry doesn't have).
export function usePageEntered() {
  const entered = ref(Boolean(window.history.state?.scroll))
  if (entered.value) return entered
  const router = useRouter()
  const page = pageKey(router.currentRoute.value)
  let mounted = true
  onBeforeUnmount(() => (mounted = false))
  void afterPageEnter().then(() => {
    if (mounted && pageKey(router.currentRoute.value) === page) entered.value = true
  })
  return entered
}
