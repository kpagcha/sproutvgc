import { h, render } from 'vue'
import EffectTag from '@/components/EffectTag'
import { natureEffects } from '@/data/natures'
import { t } from '@/i18n'

// A nature says what it does on hover, or tapped, as an item's, ability's or move's name gives its short description:
// the stat it raises and the one it lowers, each with its chevron, as the speed pages show a nature's effect on Speed,
// after what's given to lead it (a share of sets) when there's one. Drawn once per nature and lead, the tooltips
// sharing it; a neutral one says so.
const natureTips = new Map<string, Element>()
export function natureTip(id: string, lead?: string): string | Element {
  const e = natureEffects(id)
  if (!e) return lead ? `${lead} · ${t('usageMon.natureNeutral')}` : t('usageMon.natureNeutral')
  const key = lead ? `${id}|${lead}` : id
  let el = natureTips.get(key)
  if (!el) {
    // Drawn once the render asking for it is done: `render` runs Vue's pending post-render work at once, a deferred
    // Teleport among it, which would look for its target before the page is in the document.
    const tip = (el = document.createElement('span'))
    queueMicrotask(() =>
      render(
        h('span', [
          ...(lead ? [h('strong', lead), ' · '] : []),
          h(EffectTag, { effect: 'up', stat: e.plus }),
          ' ',
          h(EffectTag, { effect: 'down', stat: e.minus }),
        ]),
        tip,
      ),
    )
    natureTips.set(key, el)
  }
  return el
}
