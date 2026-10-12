<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonId } from '@/data/dex'
import { t } from '@/i18n'
import { MAX_POINTS } from '@/lib/stats'
import { moveFirstPlan, pointsText, type SpeedBuild } from '@/lib/speedBuild'
import EffectTag from '@/components/EffectTag'

// What it takes a Pokémon to move before another at Speed `target`, under its heading, in short (`moveFirstPlan`): with
// its nature, the points that do it, its answer in a pill colored by how it goes (any points, some, only a tie, none),
// with what's to spare, or how close it gets; when its nature can't, the nature that would; when none can, the
// modifiers that would, each with what it takes, folded. The comparison's: in each side's panel, and on phones together under
// the two, where its heading is a band of its side's color (`banded`, the color from `--side` and `--side-text`).
const props = defineProps<{
  title: string
  id: PokemonId
  build: SpeedBuild
  target: number
  trickRoom: boolean
  banded?: boolean
}>()

const plan = computed(() => moveFirstPlan(props.id, props.build, props.target, props.trickRoom))

type Result = ReturnType<typeof moveFirstPlan>['current']['result']
/** How an answer goes: whatever the points, with some, only to a tie, or not at all. */
function kind(r: Result): 'any' | 'some' | 'tie' | 'never' {
  if (!r) return 'never'
  if ('ties' in r) return 'tie'
  return ('from' in r && r.from === 0) || ('upTo' in r && r.upTo === MAX_POINTS) ? 'any' : 'some'
}
/** Beside its nature's answer: what's to spare, or, when nothing does it, how close it gets. */
const note = computed(() => {
  const c = plan.value.current
  if (c.spare) return t('speed.spare', { n: c.spare })
  if (c.result) return ''
  return t(props.trickRoom ? 'speed.reachOver' : 'speed.reachShort', { speed: c.reach, n: c.off })
})
</script>

<template>
  <strong class="small title" :class="{ band: banded }">{{ title }}</strong>
  <div class="plan small" :class="{ padded: banded }">
    <p class="line">
      <EffectTag :effect="plan.current.effect" class="effect current" />
      <span class="answer" :class="kind(plan.current.result)">{{ pointsText(plan.current.result) }}</span>
      <span v-if="note" class="muted">{{ note }}</span>
    </p>
    <p v-if="plan.other" class="line">
      <EffectTag :effect="plan.other.effect" class="effect" />
      <span class="answer" :class="kind(plan.other.result)">{{ pointsText(plan.other.result) }}</span>
    </p>
    <!-- Folded, saying how many there are. -->
    <details v-if="plan.mods" class="would">
      <summary class="muted">
        {{ t('speed.wouldDo') }}<template v-if="plan.mods.length"> ({{ plan.mods.length }})</template>
      </summary>
      <ul v-if="plan.mods.length" class="mods">
        <li v-for="m in plan.mods" :key="m.label" class="mod">
          <span class="mod-name">{{ m.label }}</span>
          <EffectTag v-if="m.effect !== build.effect" :effect="m.effect" class="effect" />
          <span class="answer" :class="kind(m.result)">{{ pointsText(m.result) }}</span>
        </li>
      </ul>
      <p v-else class="muted">{{ t('speed.nothingDoes') }}</p>
    </details>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
/* As a band: across the top of its card, in its side's color. */
.title.band {
  display: block;
  padding: 6px 8px;
  line-height: 1.3;
  color: var(--side-text);
  background: var(--side);
  border-bottom: 2px solid var(--ink);
}
.plan {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.plan.padded {
  margin: 0;
  padding: 8px;
}
.plan p {
  margin: 0;
}
/* A nature and its answer, then what's beside it, wrapping on a narrow card. */
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.effect {
  color: var(--muted);
}
.effect.current {
  font-weight: bold;
  color: var(--text);
}
.would summary {
  width: fit-content;
  font-weight: bold;
  cursor: pointer;
}
.would[open] summary {
  margin-bottom: 6px;
}
/* The modifiers that would do it, each a chip of its own: its name, the nature it'd take when not its own, and what. */
.mods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mod {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 2px 6px;
  border: 1px solid var(--border);
}
.mod-name {
  font-weight: bold;
}
.answer {
  display: inline-block;
  padding: 1px 6px;
  font-weight: bold;
  border: 1px solid var(--ink);
}
.answer.any {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.answer.some {
  color: var(--text);
  background: var(--sel);
}
.answer.tie {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
.answer.never {
  color: var(--m0-fg);
  background: var(--m0-bg);
}
</style>
