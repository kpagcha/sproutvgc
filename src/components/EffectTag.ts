import { h, type FunctionalComponent } from 'vue'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { t } from '@/i18n'
import type { StatId } from '@/data/pokemon'
import type { NatureEffect as Effect } from '@/lib/stats'

const ICONS = { up: ChevronsUp, down: ChevronsDown }

// A nature's effect on a stat (Speed unless given) in short, as the nature choices show it: an arrow up or down beside
// the stat's short name (the effect read out), neutral as a word. Functional, as the speed tiers' ladder has one on
// most of its chips.
const EffectTag: FunctionalComponent<{ effect: Effect; stat?: StatId }> = (props) => {
  if (props.effect === 'neutral') return h('span', { class: 'nature-effect' }, t('speed.effect.neutral'))
  const stat = props.stat ?? 'spe'
  const label =
    stat === 'spe' ? t(`speed.effect.${props.effect}`) : `${props.effect === 'up' ? '+' : '−'}${t(`stat.${stat}`)}`
  return h('span', { class: 'nature-effect', role: 'img', 'aria-label': label }, [
    h(ICONS[props.effect], { size: 14, 'aria-hidden': 'true' }),
    h('span', { 'aria-hidden': 'true' }, t(`stat.${stat}`)),
  ])
}
EffectTag.props = ['effect', 'stat']

export default EffectTag
