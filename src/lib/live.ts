// What's said of a tournament under way (`LIVE_EVENTS`): how long ago its standings last changed.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

/** How long ago a time was, in the largest unit that fits: "25 minutes ago", "3 hours ago"; under a minute, "now". */
export function ago(iso: string, locale: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) if (Math.abs(ms) >= size) return format.format(Math.round(ms / size), unit)
  return format.format(0, 'minute')
}
