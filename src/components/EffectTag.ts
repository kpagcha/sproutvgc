import { h, type FunctionalComponent } from 'vue'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { t } from '@/i18n'
import type { NatureEffect as Effect } from '@/lib/stats'

const ICONS = { up: ChevronsUp, down: ChevronsDown }

// A nature's effect on Speed in short, as the nature choices show it: an arrow up or down beside "Spe" (the effect
// read out), neutral as a word. Functional, as the speed tiers' ladder has one on most of its chips.
const EffectTag: FunctionalComponent<{ effect: Effect }> = (props) => {
  if (props.effect === 'neutral') return h('span', { class: 'nature-effect' }, t('speed.effect.neutral'))
  return h('span', { class: 'nature-effect', role: 'img', 'aria-label': t(`speed.effect.${props.effect}`) }, [
    h(ICONS[props.effect], { size: 14, 'aria-hidden': 'true' }),
    h('span', { 'aria-hidden': 'true' }, t('stat.spe')),
  ])
}
EffectTag.props = ['effect']

export default EffectTag
