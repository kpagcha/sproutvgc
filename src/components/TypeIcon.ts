import { h, type FunctionalComponent } from 'vue'
import { iconUrl, TYPES, type TypeId } from '@/data/types'
import { TYPE_GLYPHS } from '@/data/typeGlyphs'
import { typeName } from '@/i18n'
import { useStyle } from '@/composables/useStyle'

// Each type's glyph as the badge's style, made once for every badge.
const GLYPHS = {} as Record<TypeId, Record<string, string>>
for (const t of TYPES) GLYPHS[t] = { '--glyph': `url(${TYPE_GLYPHS[t]})` }

const { style } = useStyle()

// A type's badge. The retro style swaps the sprites for fixed-width CSS badges (styled in `src/styles/retro.css`): the
// type glyph, then the name on large badges; small ones are just the glyph. Functional, as there can be hundreds on a
// page.
const TypeIcon: FunctionalComponent<{ type: TypeId; scale?: 1 | 2; lazy?: boolean }> = (props) => {
  const scale = props.scale ?? 1
  const name = typeName(props.type)
  if (style.value === 'retro')
    return h(
      'span',
      {
        class: ['type-icon', 'type-badge', scale === 1 ? 's1' : 's2'],
        'data-type': props.type,
        role: 'img',
        'aria-label': name,
      },
      [
        h('span', { class: 'glyph', style: GLYPHS[props.type], 'aria-hidden': 'true' }),
        scale === 2 ? h('span', { class: 'label', 'aria-hidden': 'true' }, name) : null,
      ],
    )
  return h('img', {
    class: ['pixel', 'type-icon', { s1: scale === 1 }],
    src: iconUrl(props.type),
    alt: name,
    width: 32 * scale,
    height: 14 * scale,
    loading: props.lazy ? 'lazy' : undefined,
    decoding: 'async',
    draggable: 'false',
  })
}
TypeIcon.props = ['type', 'scale', 'lazy']

export default TypeIcon
