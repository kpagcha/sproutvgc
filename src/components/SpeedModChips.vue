<script setup lang="ts">
import { t } from '@/i18n'
import { moveFirstKind, pointsText, type moveFirstPlan } from '@/lib/speedBuild'
import type { NatureEffect } from '@/lib/stats'
import EffectTag from '@/components/EffectTag'

// The modifiers that would move a Pokémon first when no nature does (`moveFirstPlan`'s `mods`), each a chip of its own:
// its name, the nature it'd take when not the Pokémon's own, and the points, in a pill colored by how it goes; with
// none, a line saying so.
defineProps<{
  mods: NonNullable<ReturnType<typeof moveFirstPlan>['mods']>
  /** The Pokémon's own nature effect. */
  effect: NatureEffect
}>()
</script>

<template>
  <ul v-if="mods.length" class="mods">
    <li v-for="m in mods" :key="m.label" class="mod">
      <span class="mod-name">{{ m.label }}</span>
      <EffectTag v-if="m.effect !== effect" :effect="m.effect" class="effect" />
      <span class="answer" :class="moveFirstKind(m.result)">{{ pointsText(m.result) }}</span>
    </li>
  </ul>
  <p v-else class="muted none">{{ t('speed.nothingDoes') }}</p>
</template>

<style scoped>
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
.effect {
  color: var(--muted);
}
.none {
  margin: 0;
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
</style>
