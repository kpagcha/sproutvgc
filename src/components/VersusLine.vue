<script setup lang="ts">
import { X } from '@lucide/vue'
import { t, tSplit } from '@/i18n'
import { pointsText } from '@/lib/speedBuild'
import type { VersusItem } from '@/components/VersusPanel.vue'
import EffectTag from '@/components/EffectTag'

// Yours against one Pokémon measured against on the speed tiers' ladder: who it is (the slot), whether yours moves
// first, what it takes with yours' nature (what's to spare, or the points that do it; when none do, another nature's),
// and a cross letting it go. A line of `VersusPanel`'s beside the ladder; narrower, under the row tapped, a line each
// (`stacked`): who it is and the cross, the verdict and what it takes, then what's at its foot (the slot).
const props = defineProps<{
  item: VersusItem
  /** Yours: its Speed and Speed points. */
  mineSpeed: number
  points: number
  trickRoom: boolean
  stacked?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
defineSlots<{ default: () => unknown; foot?: () => unknown }>()

const verdict = (): 'first' | 'tie' | 'after' =>
  props.mineSpeed === props.item.speed
    ? 'tie'
    : props.mineSpeed > props.item.speed !== props.trickRoom
      ? 'first'
      : 'after'
const GLYPHS = { first: '▲', tie: '=', after: '▼' } as const
/** What it takes yours with its nature, moving after or tying: the points that do it, how close it gets, or that none
 * do. */
function plan(): string {
  const r = props.item.result
  if (!r) return t('speed.vsCant')
  if ('ties' in r) return t('speed.vsTiesAt', { points: r.ties })
  return t('speed.vsNeeds', { amount: pointsText(r) })
}
// Another nature's, around its effect's arrow.
const needsOther = tSplit('speed.vsNeedsOther', 'effect')
/** What's to spare of yours' points, moving first: how many it could lose (gain, under Trick Room) and still do. */
function spare(): number {
  const r = props.item.result
  if (!r) return 0
  if ('from' in r) return Math.max(0, props.points - r.from)
  if ('upTo' in r) return Math.max(0, r.upTo - props.points)
  return 0
}
</script>

<template>
  <div class="versus-line" :class="{ stacked }">
    <span class="who"><slot /></span>
    <span class="says">
      <strong class="verdict" :class="verdict()"
        ><span aria-hidden="true">{{ GLYPHS[verdict()] }}</span> {{ t(`speed.vsVerdict.${verdict()}`) }}</strong
      >
      <span class="plan">
        <template v-if="verdict() === 'first'">{{
          spare() ? t('speed.vsSpare', { n: spare() }) : t('speed.vsNoSpare')
        }}</template>
        <template v-else-if="item.other"
          >{{ needsOther[0] }}<EffectTag :effect="item.other.effect" />{{
            needsOther[1].replace('{amount}', pointsText(item.other.result))
          }}</template
        >
        <template v-else>{{ plan() }}</template>
      </span>
    </span>
    <button type="button" class="remove" :aria-label="t('speed.unfind', { name: item.name })" @click="emit('close')">
      <X :size="14" aria-hidden="true" />
    </button>
    <div v-if="$slots.foot" class="foot"><slot name="foot" /></div>
  </div>
</template>

<style scoped>
/* Who it is, the verdict and the cross on a line, what it takes under the verdict. */
.versus-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 8px;
}
.who {
  display: inline-flex;
  grid-row: 1;
  grid-column: 1;
}
.says {
  display: contents;
}
.verdict {
  grid-row: 1;
  grid-column: 2;
  white-space: nowrap;
}
.plan {
  grid-row: 2;
  grid-column: 2;
  color: var(--muted);
}
.remove {
  display: inline-flex;
  flex: none;
  grid-row: 1;
  grid-column: 3;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.remove:hover {
  color: var(--text);
}
/* A line each: who it is and the cross, then the verdict and what it takes (wrapping as they need), then the foot. */
.stacked {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
}
.stacked .says {
  display: flex;
  flex-wrap: wrap;
  grid-row: 2;
  grid-column: 1 / -1;
  gap: 0 8px;
}
.stacked .remove {
  grid-column: 2;
  margin: -4px -4px -4px 0;
}
.foot {
  grid-row: 3;
  grid-column: 1 / -1;
  margin-top: 4px;
}
/* The verdict, in the color of how it goes for yours: the ladder's. */
.verdict.first {
  color: var(--accent);
}
.verdict.after {
  color: var(--opponent);
}
.verdict.tie {
  color: var(--muted);
}
.plan :deep(.nature-effect) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
</style>
