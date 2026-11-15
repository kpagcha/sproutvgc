import { shallowRef } from 'vue'

export interface ConfirmOptions {
  message: string
  /** Label of the confirming button. */
  confirm: string
  /** What the message is about, a line each under it. */
  details?: string[]
  /** Label of the other button, Cancel unless given; Esc and a click outside choose it too. */
  cancel?: string
  /** Style the confirming button as destructive, and focus Cancel first. */
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/** The open request, rendered by the single ConfirmDialog in App.vue. */
export const pending = shallowRef<Pending | null>(null)

/** A styled replacement for `window.confirm`: resolves true if the user confirms. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  pending.value?.resolve(false)
  return new Promise((resolve) => {
    pending.value = { ...opts, resolve }
  })
}
