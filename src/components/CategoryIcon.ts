import { h, withDirectives, type FunctionalComponent } from 'vue'
import { t } from '@/i18n'
import type { Category } from '@/data/moves'
import { vTip } from '@/directives/tip'
import { CATEGORY_ICONS } from '@/lib/sprites'

// A move's category badge (Showdown's), the size of a type badge, named on hover. Functional, as there can be
// hundreds on a page.
const CategoryIcon: FunctionalComponent<{ category: Category }> = (props) => {
  const name = t(`move.category.${props.category}`)
  return withDirectives(
    h('img', {
      class: 'pixel category-icon',
      src: CATEGORY_ICONS[props.category],
      alt: name,
      width: 32,
      height: 14,
      draggable: 'false',
    }),
    [[vTip, name]],
  )
}
CategoryIcon.props = ['category']

export default CategoryIcon
