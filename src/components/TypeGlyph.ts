import { h, type FunctionalComponent } from 'vue'
import { TYPE_GLYPHS } from '@/data/typeGlyphs'
import type { TypeId } from '@/data/types'

// A type's glyph alone, in the text's color: no badge, no outline, an icon among Lucide's (the damage calculator's
// terrains). Styled in `main.css`.
const TypeGlyph: FunctionalComponent<{ type: TypeId }> = (props) =>
  h('span', {
    class: 'type-glyph',
    'data-type': props.type,
    style: { '--glyph': `url(${TYPE_GLYPHS[props.type]})` },
    'aria-hidden': 'true',
  })
TypeGlyph.props = ['type']

export default TypeGlyph
