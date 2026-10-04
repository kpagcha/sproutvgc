import { defineComponent, h, type Component } from 'vue'
import { motion } from 'motion-v'

// The element a page animates in and out with (App.vue), under two names so that `KeepAlive` can keep some pages
// (`KeptPage`: the dex tables, slow to render) and not the rest (`Page`). Everything it's given goes to the motion.div.
const frame = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup:
      (_, { attrs, slots }) =>
      () =>
        h(motion.div as Component, attrs, slots),
  })

export const Page = frame('Page')
export const KeptPage = frame('KeptPage')
