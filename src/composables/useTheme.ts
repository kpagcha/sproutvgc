import { computed, nextTick, ref } from 'vue'

export type Theme = 'light' | 'dark'
/** `auto` follows the OS preference (live). */
export type ThemeMode = Theme | 'auto'

export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark']

const KEY = 'sproutvgc.theme'

function readChoice(): Theme | null {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    // Storage unavailable.
  }
  return null
}

const choice = ref<Theme | null>(readChoice())
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => (systemDark.value = e.matches))

const mode = computed<ThemeMode>(() => choice.value ?? 'auto')
const theme = computed<Theme>(() => choice.value ?? (systemDark.value ? 'dark' : 'light'))

/**
 * Runs a DOM update that restyles the whole page, cross-fading between the old and new looks where the browser
 * supports view transitions (timing in main.css); elsewhere, and with reduced motion, it switches at once.
 */
export function crossFade(update: () => void) {
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => {
      update()
      return nextTick()
    })
  } else {
    update()
  }
}

export function useTheme() {
  const apply = (next: Theme | null) => {
    choice.value = next
    const root = document.documentElement
    if (next) root.dataset.theme = next
    else delete root.dataset.theme
  }
  const setMode = (m: ThemeMode) => {
    const next = m === 'auto' ? null : m
    crossFade(() => apply(next))
    try {
      if (next) localStorage.setItem(KEY, next)
      else localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  }
  return { mode, theme, setMode }
}
