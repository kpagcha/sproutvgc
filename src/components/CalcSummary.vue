<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ability, condition, pokemon } from '@/data/dex'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import {
  abilityOf,
  BOOSTED,
  battlerOf,
  bestHit,
  hit,
  hpShown,
  koKind,
  type Battlefield,
  type Fighter,
} from '@/lib/damage'
import { conditionName, sideOf } from '@/components/calcConditions'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// A damage calculator's side in short, on one line, for its band on phones: the Pokémon's icon and its name (`named`;
// else read out alone), its item's icon, what the battle has changed of it (HP left, status, stat stages, its allies
// fainted, the times it's been hit, its ability's condition met, what's on its side; nothing while as it came in), a
// row sliding sideways where they don't all fit, and, at the end, its hardest hit's verdict against the other side ("OHKO", "62% 2HKO"), colored as
// the damage rows' are: yours knocking out good news, theirs bad (`theirs`).
const props = defineProps<{
  fighter: Fighter
  other: Fighter
  field: Battlefield
  theirs?: boolean
  /** Its name shown after its icon, where there's the room (a band across the page), cut short if need be. */
  named?: boolean
  /** No verdict at its end (the inverse calc's, where its damage isn't what's read). */
  noVerdict?: boolean
}>()

const id = computed(() => battlerOf(props.fighter))
const best = computed(() => {
  if (props.noVerdict || !id.value || !battlerOf(props.other)) return null
  const moves = props.fighter.member.moves.filter((m) => !!m)
  return bestHit(moves.map((m) => hit(props.fighter, props.other, m!, props.field)))
})
const verdict = computed(() => {
  if (props.noVerdict) return ''
  const h = best.value
  if (!h) return ''
  if (!h.koHits) return `${h.maxPct.toFixed(0)}%`
  const n = h.koHits === 1 ? 'OHKO' : `${h.koHits}HKO`
  return h.koChance >= 1 ? n : `${Math.round(h.koChance * 100)}% ${n}`
})
const kind = computed(() => koKind(best.value))
/** The rest of what the battle has changed of it, after its stages: its allies fainted, the times it's been hit, its
 * ability's condition met, and what's on its side. */
const more = computed(() => {
  const f = props.fighter
  const list: string[] = []
  if (f.fainted) list.push(t('calc.band.fainted', { n: f.fainted }))
  if (f.attacked) list.push(t('calc.band.attacked', { n: f.attacked }))
  const a = abilityOf(f)
  if (f.abilityOn && a) list.push(refName(ability(a)))
  for (const e of f.side) {
    const c = sideOf(e)
    if (c) list.push(conditionName(c))
  }
  if (f.spikes) list.push(`${refName(condition('spikes'))} ×${f.spikes}`)
  return list
})
// Whether there's more of them past the row's end, to fade it out: as it's sized, scrolled or they change.
const extras = useTemplateRef<HTMLElement>('extras')
const overflows = shallowRef(false)
function measure() {
  const el = extras.value
  overflows.value = !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
useResizeObserver(extras, measure)
const stages = computed(() =>
  BOOSTED.flatMap((s, i) => {
    const n = props.fighter.boosts[i]!
    return n ? [`${n > 0 ? '+' : '−'}${Math.abs(n)} ${t(`stat.${s}`)}`] : []
  }),
)
watch([stages, more], () => void nextTick(measure))
</script>

<template>
  <span v-if="id" class="summary" :class="[kind, { theirs }]">
    <PokemonIcon :id class="mon" />
    <span :class="named ? 'name' : 'sr-only'">{{ refName(pokemon(id)) }}</span>
    <ItemIcon v-if="fighter.member.item" :id="fighter.member.item" class="item" />
    <span ref="extras" class="extras" :class="{ overflows }" @scroll.passive="measure">
      <span v-if="fighter.hp < 100" class="tag">{{ hpShown(fighter.hp) }}%</span>
      <span v-if="fighter.status" class="tag">{{ t(`status.${fighter.status}`) }}</span>
      <span v-for="s in stages" :key="s" class="tag">{{ s }}</span>
      <span v-for="m in more" :key="m" class="tag">{{ m }}</span>
    </span>
    <span v-if="verdict" class="ko">{{ verdict }}</span>
  </span>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.mon,
.item,
.ko {
  flex: none;
}
/* What the battle changed, before the verdict: a row sliding sideways where it doesn't fit, no scrollbar. */
.extras {
  display: flex;
  flex: 1;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.extras::-webkit-scrollbar {
  display: none;
}
/* Sliding sideways, its end fading out, so what's past it reads as more. */
.extras.overflows {
  mask-image: linear-gradient(to right, #000 calc(100% - 16px), transparent);
}
.tag {
  flex: none;
  padding: 0 4px;
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
  border: 1px solid var(--border);
}
.ko {
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.none .ko,
.more .ko {
  font-weight: normal;
  color: var(--muted);
}
.ohko:not(.theirs) .ko {
  color: var(--good);
}
.two:not(.theirs) .ko {
  color: color-mix(in srgb, var(--good) 70%, var(--text));
}
.ohko.theirs .ko {
  color: var(--bad);
}
.two.theirs .ko {
  color: color-mix(in srgb, var(--bad) 70%, var(--text));
}
.name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
