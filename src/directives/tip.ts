import tippy, { createSingleton, type CreateSingletonInstance, type Instance } from 'tippy.js'
import type { Directive } from 'vue'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/dist/border.css'

tippy.setDefaultProps({ theme: 'mondex', delay: [200, 0], duration: [120, 80] })

type TipEl = HTMLElement & { _tip?: Instance; _tipContent?: string }
type TipValue = string | false | null | undefined

// Grouped tips share one singleton tooltip that glides between its targets.
// Membership changes are batched per tick so a table mounting doesn't rebuild it per cell.
interface Group {
  members: Set<Instance>
  singleton?: CreateSingletonInstance
  queued: boolean
}
const groups = new Map<string, Group>()

function sync(name: string, group: Group) {
  if (group.queued) return
  group.queued = true
  queueMicrotask(() => {
    group.queued = false
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
  })
}

function create(el: TipEl, content: string, groupName?: string) {
  el._tip = tippy(el, { content })
  if (!groupName) return
  let group = groups.get(groupName)
  if (!group) groups.set(groupName, (group = { members: new Set(), queued: false }))
  group.members.add(el._tip)
  sync(groupName, group)
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

// A tip outside a group is only created once its element is first pointed at or focused, then given that same event:
// long lists (the Pokémon's abilities, the references in descriptions) would otherwise create hundreds on mounting.
const TRIGGERS = ['mouseenter', 'focus'] as const
function arm(el: TipEl, content: string) {
  el._tipContent = content
  for (const type of TRIGGERS) el.addEventListener(type, wake)
}
function disarm(el: TipEl) {
  delete el._tipContent
  for (const type of TRIGGERS) el.removeEventListener(type, wake)
}
function wake(this: TipEl, e: Event) {
  const content = this._tipContent!
  disarm(this)
  create(this, content)
  this.dispatchEvent(new (e.constructor as typeof Event)(e.type, e))
}

// v-tip="text": a tooltip in place of the native title. A falsy value shows none.
// v-tip:group="text": joins a named group sharing one moving tooltip.
export const vTip: Directive<TipEl, TipValue> = {
  mounted(el, { value, arg }) {
    if (!value) return
    if (arg) create(el, value, arg)
    else arm(el, value)
  },
  updated(el, { value, oldValue, arg }) {
    if (value === oldValue) return
    if (!value) {
      disarm(el)
      destroy(el, arg)
    } else if (el._tip) el._tip.setContent(value)
    else if (arg) create(el, value, arg)
    else arm(el, value)
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
