import { h, withDirectives, type FunctionalComponent } from 'vue'
import { t } from '@/i18n'
import type { Category } from '@/data/moves'
import { vTip } from '@/directives/tip'
import physical from '@/assets/category-icons/physical.png'
import special from '@/assets/category-icons/special.png'
import status from '@/assets/category-icons/status.png'

// Each category's glyph as the badge's style, made once for every badge. Single-color PNGs from the Bulbagarden
// Archives (`<Category>_icon_HOME.png`), used as CSS masks like the type glyphs (`src/data/typeGlyphs.ts`).
const GLYPHS: Record<Category, Record<string, string>> = {
  physical: { '--glyph': `url(${physical})` },
  special: { '--glyph': `url(${special})` },
  status: { '--glyph': `url(${status})` },
}

// A move's category badge, styled like a small type badge (in `src/styles/retro.css`), named on hover unless `tip` is
// false (decorations). Functional, as there can be hundreds on a page.
const CategoryIcon: FunctionalComponent<{ category: Category; tip?: boolean }> = (props) => {
  const name = t(`move.category.${props.category}`)
  return withDirectives(
    h(
      'span',
      { class: 'category-icon category-badge', 'data-category': props.category, role: 'img', 'aria-label': name },
      [h('span', { class: 'glyph', style: GLYPHS[props.category], 'aria-hidden': 'true' })],
    ),
    props.tip === false ? [] : [[vTip, name]],
  )
}
CategoryIcon.props = ['category', 'tip']

export default CategoryIcon
