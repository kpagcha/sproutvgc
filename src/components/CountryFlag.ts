import { h, withDirectives, type FunctionalComponent } from 'vue'
import { vTip } from '@/directives/tip'
import { locale } from '@/i18n'

// Every country's round flag (circle-flags), by its lowercase ISO 3166 code (the package's regions' flags left out):
// only the URLs are bundled, each file fetched when a flag is shown.
const FLAGS = import.meta.glob<string>('/node_modules/circle-flags/flags/[a-z][a-z].svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
})
const urlOf = (code: string) => FLAGS[`/node_modules/circle-flags/flags/${code}.svg`]

// Limitless's codes are ISO 3166's but for the United Kingdom's.
const iso = (code: string) => (code === 'UK' ? 'GB' : code).toLowerCase()

const names = new Map<string, Intl.DisplayNames>()
function countryName(code: string): string {
  let n = names.get(locale.value)
  if (!n) names.set(locale.value, (n = new Intl.DisplayNames([locale.value], { type: 'region' })))
  try {
    return n.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

// A player's or an event's country as its flag, its name on hover and read out; the code as text when there's no flag
// for it, nothing when it isn't known. Functional, as the standings have one on each of a thousand rows.
const CountryFlag: FunctionalComponent<{ code: string }> = (props) => {
  if (!props.code) return null
  const code = iso(props.code)
  const src = urlOf(code)
  if (!src) return h('span', { class: 'muted small' }, props.code)
  const name = countryName(code)
  return withDirectives(h('img', { class: 'flag', src, alt: name, loading: 'lazy', decoding: 'async' }), [[vTip, name]])
}
CountryFlag.props = ['code']

export default CountryFlag
