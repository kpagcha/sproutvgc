import { h, type FunctionalComponent } from 'vue'
import { pokemon } from '@/data/dex'
import { REGULATION } from '@/data/format'
import type { MoveTag as Tag } from '@/data/moves'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import PokemonIcon from '@/components/PokemonIcon'

// A move's tag for how few learn it (`moveTag`), in short, after its name: the Pokémon it's of, its icon, and Signature
// or Exclusive, what it means read out (and on hover: `moveTagTip`). Functional, as the move tables have hundreds of
// rows.
const MoveTag: FunctionalComponent<{ tag: Tag }> = (props) =>
  h('span', { class: ['move-tag', props.tag.kind], role: 'img', 'aria-label': moveTagTip(props.tag) }, [
    props.tag.of && h(PokemonIcon, { id: props.tag.of, scale: 0.5 }),
    h('span', { 'aria-hidden': 'true' }, t(`move.tag.${props.tag.kind}`)),
  ])
MoveTag.props = ['tag']

export default MoveTag

/** The tag's tooltip: whose signature move it is, or who alone learns it. */
export const moveTagTip = (tag: Tag) =>
  !tag.of
    ? t('move.tagTip.signatureOfNone')
    : t(`move.tagTip.${tag.kind}`, { name: refName(pokemon(tag.of)), reg: REGULATION })
