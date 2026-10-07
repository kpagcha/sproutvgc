<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { BUILD_TOGGLES, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A Pokémon at a Speed build, in short, on one line: its icon, its name, its Speed, its build (but for a neutral nature
// and no points, which go without saying) and its modifiers, items by their icon. Its name only where it fits whole
// beside the rest: cut, it goes, its icon standing for it (the name still read out); gone, it comes back once the room
// left at the line's end takes it, as measured when it was there. On the speed tiers' bar and the comparison's bands.
const props = defineProps<{ id: PokemonId; speed: number; build: SpeedBuild }>()

const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const MOD_ITEMS: Partial<Record<BuildToggle, 'choicescarf' | 'ironball'>> = {
  scarf: 'choicescarf',
  ironball: 'ironball',
}
const stageLabel = (s: number) => (s > 0 ? `+${s}` : String(s).replace('-', '−'))

const root = useTemplateRef<HTMLElement>('root')
const name = useTemplateRef<HTMLElement>('name')
const nameFits = shallowRef(true)
let nameWidth = 0
const GAP = 6
function fit() {
  const el = root.value
  const n = name.value
  if (!el || !n || !el.offsetParent) return
  if (nameFits.value) {
    if (n.scrollWidth > n.clientWidth) {
      nameWidth = n.scrollWidth
      nameFits.value = false
    }
    return
  }
  const last = el.lastElementChild
  if (!last) return
  const room = el.getBoundingClientRect().right - last.getBoundingClientRect().right - GAP
  if (room >= nameWidth + GAP) nameFits.value = true
}
watch([() => props.id, () => props.build, locale], () => {
  nameFits.value = true
  void nextTick(fit)
})
let observer: ResizeObserver | undefined
watch(
  root,
  (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new ResizeObserver(() => fit())
    observer.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <span ref="root" class="build-summary">
    <PokemonIcon :id="props.id" />
    <span class="visually-hidden">{{ refName(pokemon(props.id)) }}</span>
    <span ref="name" class="name" :class="{ gone: !nameFits }" aria-hidden="true">{{
      refName(pokemon(props.id))
    }}</span>
    <span class="speed">{{ props.speed }}</span>
    <span v-if="props.build.effect !== 'neutral' || props.build.points > 0" class="build"
      ><template v-if="props.build.effect !== 'neutral'"
        ><component :is="EFFECT_ICONS[props.build.effect]" :size="14" aria-hidden="true" /><span
          class="visually-hidden"
          >{{ t(`speed.effect.${props.build.effect}`) }}</span
        ></template
      ><template v-if="props.build.points > 0"> {{ t('speed.points', { n: props.build.points }) }}</template></span
    >
    <span v-if="props.build.toggles.length || props.build.stage" class="mods">
      <span
        v-for="k in BUILD_TOGGLES.filter((m) => props.build.toggles.includes(m))"
        :key="k"
        class="mod"
        :class="{ item: MOD_ITEMS[k] }"
        ><template v-if="MOD_ITEMS[k]"
          ><ItemIcon :id="MOD_ITEMS[k]!" :scale="0.67" /><span class="visually-hidden">{{
            t(`speed.modShort.${k}`)
          }}</span></template
        ><template v-else>{{ t(`speed.modShort.${k}`) }}</template></span
      >
      <span v-if="props.build.stage" class="mod">{{ stageLabel(props.build.stage) }}</span>
    </span>
  </span>
</template>

<style scoped>
/* What's around gives it its room: it takes what's left on the line. */
.build-summary {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.build-summary :deep(.sheet-icon) {
  flex: none;
  margin-block: -6px;
}
/* Its name, the first to give way to what follows it: once it would be cut, it goes (`nameFits`). */
.name {
  flex: 0 100000 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.name.gone {
  display: none;
}
.speed {
  font-size: 1.2em;
  font-variant-numeric: tabular-nums;
}
.build {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  font-weight: normal;
  opacity: 0.85;
  white-space: nowrap;
}
/* Its modifiers, in short, each in an outline of the text's color; an ellipsis at the end standing for those that
   don't fit. */
.mods {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mod {
  display: inline-flex;
  align-items: center;
  height: 20px;
  margin-right: 4px;
  padding: 0 4px;
  font-size: 0.8125em;
  font-weight: normal;
  vertical-align: middle;
  border: 1px solid currentColor;
}
.mod.item {
  padding: 0 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
