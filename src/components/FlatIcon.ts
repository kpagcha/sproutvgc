import { h, type FunctionalComponent } from 'vue'
import { FLATICON_EM, FLATICONS, type FlaticonName } from '@/components/flaticons.generated'

// A Flaticon UIcon (its Regular Straight family, `scripts/flaticons.ts`) as an inline SVG, taking the same `size` a
// Lucide icon does and drawn in the text's color. Its glyph fills its em edge to edge where Lucide's sit 1 in from
// the edge of their 24, so the view box leaves that much around it: at one size the two look alike, strokes and all.
const PAD = Math.round(FLATICON_EM / 22)
const BOX = `${-PAD} ${-PAD} ${FLATICON_EM + 2 * PAD} ${FLATICON_EM + 2 * PAD}`

const FlatIcon: FunctionalComponent<{ name: FlaticonName; size?: number | string }> = (props) =>
  h(
    'svg',
    {
      class: 'flaticon',
      xmlns: 'http://www.w3.org/2000/svg',
      width: props.size ?? 24,
      height: props.size ?? 24,
      viewBox: BOX,
      fill: 'currentColor',
      'aria-hidden': 'true',
    },
    [h('path', { d: FLATICONS[props.name] })],
  )
FlatIcon.props = ['name', 'size']

/** One icon as a component of its own, to stand where a Lucide icon's component does (`<component :is>`). */
export const flaticon = (name: FlaticonName) => {
  const icon: FunctionalComponent<{ size?: number | string }> = (props) => h(FlatIcon, { name, size: props.size })
  icon.props = ['size']
  return icon
}

export default FlatIcon
