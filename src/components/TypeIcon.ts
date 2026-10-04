import { h, type FunctionalComponent } from 'vue'
import { TYPES, type TypeId } from '@/data/types'
import { TYPE_GLYPHS } from '@/data/typeGlyphs'
import { typeName } from '@/i18n'

// Each type's glyph as the badge's style, made once for every badge.
const GLYPHS = {} as Record<TypeId, Record<string, string>>
for (const t of TYPES) GLYPHS[t] = { '--glyph': `url(${TYPE_GLYPHS[t]})` }

// A type's badge: a fixed-width CSS badge (styled in `src/styles/retro.css`) with the type glyph, then the name on
// large badges; small ones are just the glyph. Functional, as there can be hundreds on a page.
const TypeIcon: FunctionalComponent<{ type: TypeId; scale?: 1 | 2 }> = (props) => {
  const scale = props.scale ?? 1
  const name = typeName(props.type)
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
}
TypeIcon.props = ['type', 'scale']

export default TypeIcon
