// Where the page transition (App.vue) and the router's scrolling meet. On desktop the leaving page fades out before
// the next one mounts, so scrolling waits for it: scrolling at once would jump the leaving page mid-fade, and a saved
// position (going back) can't be restored on a page that isn't there yet. On phones the two pages slide side by side,
// the next one mounted from the start, so nothing waits.

let waits = false
let exited: (() => void) | undefined

/** App.vue: whether page changes wait for the leaving page to go. */
export function setPageWaits(value: boolean) {
  waits = value
}

/** App.vue: the leaving page is gone. */
export function pageExited() {
  exited?.()
}

/** Resolves once the leaving page is gone (or after a second, should it never say so), or at once when nothing waits. */
export function afterPageExit(): Promise<void> {
  exited?.()
  if (!waits) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      exited = undefined
      resolve()
    }
    const timer = setTimeout(done, 1000)
    exited = done
  })
}
