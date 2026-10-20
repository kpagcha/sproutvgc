// Copying text to the clipboard: the speed tiers' links to a row, a tournament team as a paste.

/**
 * Copies `text`, saying whether it could. The clipboard API only exists on secure pages (not the dev server opened
 * over the LAN, as on a phone), so elsewhere it goes through a hidden field and the older copy command. When neither
 * works, the caller says so (the speed tiers: the address bar still has the link).
 */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position: fixed; opacity: 0; pointer-events: none'
    document.body.append(field)
    field.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      field.remove()
    }
  }
}
