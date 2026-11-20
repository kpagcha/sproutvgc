// A page's stylesheet that fails to load (a request dropped on a phone's patchy connection) is loaded again. Vite's
// loader marks each stylesheet as loaded once it has asked for it, failed or not, and never asks again until a reload,
// so a failure once left every page using it unstyled (a dialog's options run together on one line). Here a failure
// (`vite:preloadError`, its message naming the file) is taken off Vite's hands, so the page still shows, and the file is
// asked for again, a few times with a growing wait, in place of the failed one.

const TRIES = 4
const WAIT_MS = 1000

function retry(href: string, attempt: number) {
  const old = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find((l) => l.href === href)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.crossOrigin = ''
  // A query, so the browser doesn't hand back the failure it may have kept.
  link.href = `${href}${href.includes('?') ? '&' : '?'}retry=${attempt}`
  link.addEventListener('load', () => old?.remove())
  link.addEventListener('error', () => {
    link.remove()
    if (attempt < TRIES) setTimeout(() => retry(href, attempt + 1), WAIT_MS * 2 ** attempt)
  })
  document.head.appendChild(link)
}

export function retryFailedStylesheets() {
  window.addEventListener('vite:preloadError', (e) => {
    const reason = (e as Event & { payload?: unknown }).payload
    const href = reason instanceof Error ? /Unable to preload CSS for (\S+)/.exec(reason.message)?.[1] : undefined
    if (!href) return
    e.preventDefault()
    retry(href, 1)
  })
}
