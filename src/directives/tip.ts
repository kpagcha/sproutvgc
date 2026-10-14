import tippy, { createSingleton, type CreateSingletonInstance, type Instance, type Plugin } from 'tippy.js'
import type { Directive } from 'vue'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/dist/border.css'

// On a touch screen, tapping what a tooltip is of toggles it: tippy shows it on the first tap but leaves it shown on the
// next (a tap on it counts neither as outside nor as toggling it), and once hidden that way, a tap there shows it no
// more (the emulated mouse never left, the focus is still there). Not those placed by hand (`manual`), which say for
// themselves.
const tapToggle: Plugin = {
  fn(instance) {
    let touch = false
    let shown = false
    const onDown = (e: PointerEvent) => {
      touch = e.pointerType !== 'mouse'
      shown = touch && instance.state.isVisible
    }
    const onClick = () => {
      if (!touch) return
      if (shown) instance.hide()
      else if (!instance.state.isVisible) instance.show()
      touch = shown = false
    }
    const manual = () => /manual|click/.test(instance.props.trigger)
    const el = instance.reference as HTMLElement
    return {
      onCreate() {
        if (manual()) return
        el.addEventListener('pointerdown', onDown)
        el.addEventListener('click', onClick)
      },
      onDestroy() {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('click', onClick)
      },
    }
  },
}

// A tap on a tooltip hides it (tippy, as the finger lifts), and is then over: the mouse events and click a touch screen
// fires after lifting, and the focus they bring, would otherwise land on what's under it, the tooltip gone or going.
// None of ours has anything to tap in it.
document.addEventListener(
  'touchend',
  (e) => {
    if ((e.target as Element | null)?.closest?.('[data-tippy-root]')) e.preventDefault()
  },
  { capture: true, passive: false },
)

// On a screen with no hover (phones), a tap shows a tooltip and the next hides it (tippy's own toggling): not the mouse
// events a touch screen makes up, which come on their own when the page moves under where the finger last was (the
// speed tiers' ladder narrowing to the Pokémon found, a tooltip then opening over whatever came under it). Only where
// nothing can hover (`any-hover`): a laptop with a touch screen and a mouse keeps hovering with its mouse, its taps
// still toggling (`tapToggle`).
const noHover = window.matchMedia('(any-hover: none)').matches
tippy.setDefaultProps({
  theme: 'sproutvgc',
  delay: [200, 0],
  duration: [120, 80],
  plugins: [tapToggle],
  ...(noHover && { trigger: 'click', delay: 0 }),
})

type TipEl = HTMLElement & { _tip?: Instance; _tipContent?: string; _tipGroup?: string }
type TipValue = string | false | null | undefined

// Grouped tips share one singleton tooltip that glides between its targets.
// Membership changes are batched per tick so several joining at once don't rebuild it each time, except for a tip just
// pointed at (`wake`), whose group is updated right away so that it shows.
interface Group {
  members: Set<Instance>
  singleton?: CreateSingletonInstance
  queued: boolean
}
const groups = new Map<string, Group>()

function update(name: string, group: Group) {
  const members = [...group.members]
  if (!members.length) {
    group.singleton?.destroy()
    groups.delete(name)
  } else if (group.singleton) {
    group.singleton.setInstances(members)
  } else {
    // A short hide delay keeps it visible while the pointer crosses to a neighbour.
    group.singleton = createSingleton(members, { delay: [200, 60], moveTransition: 'transform 0.12s ease-out' })
  }
}

function sync(name: string, group: Group) {
  if (group.queued) return
  group.queued = true
  queueMicrotask(() => {
    group.queued = false
    if (groups.get(name) === group) update(name, group)
  })
}

function create(el: TipEl, content: string, groupName?: string, now = false) {
  el._tip = tippy(el, { content })
  if (!groupName) return
  let group = groups.get(groupName)
  if (!group) groups.set(groupName, (group = { members: new Set(), queued: false }))
  group.members.add(el._tip)
  if (now) update(groupName, group)
  else sync(groupName, group)
}

function destroy(el: TipEl, groupName?: string) {
  if (!el._tip) return
  const group = groupName ? groups.get(groupName) : undefined
  if (group) {
    group.members.delete(el._tip)
    sync(groupName!, group)
  }
  el._tip.destroy()
  delete el._tip
}

// A tip is only created once its element is first pointed at or focused, then given that same event (after joining its
// group, if it has one): long lists (the Pokémon's abilities, the references in descriptions, the type chart's cells)
// would otherwise create hundreds on mounting.
const TRIGGERS = ['mouseenter', 'focus'] as const
function arm(el: TipEl, content: string, groupName?: string) {
  el._tipContent = content
  el._tipGroup = groupName
  for (const type of TRIGGERS) el.addEventListener(type, wake)
}
function disarm(el: TipEl) {
  delete el._tipContent
  delete el._tipGroup
  for (const type of TRIGGERS) el.removeEventListener(type, wake)
}
function wake(this: TipEl, e: Event) {
  const content = this._tipContent!
  const groupName = this._tipGroup
  disarm(this)
  create(this, content, groupName, true)
  this.dispatchEvent(new (e.constructor as typeof Event)(e.type, e))
}

// v-tip="text": a tooltip in place of the native title. A falsy value shows none.
// v-tip:group="text": joins a named group sharing one moving tooltip.
export const vTip: Directive<TipEl, TipValue> = {
  mounted(el, { value, arg }) {
    if (value) arm(el, value, arg)
  },
  updated(el, { value, oldValue, arg }) {
    if (value === oldValue) return
    if (!value) {
      disarm(el)
      destroy(el, arg)
    } else if (el._tip) el._tip.setContent(value)
    else arm(el, value, arg)
  },
  beforeUnmount(el, { arg }) {
    disarm(el)
    destroy(el, arg)
  },
}

declare module 'vue' {
  interface GlobalDirectives {
    vTip: typeof vTip
  }
}
