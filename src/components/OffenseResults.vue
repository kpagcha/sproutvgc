<script setup lang="ts">
import { computed } from 'vue'
import type { Multiplier, TypeId } from '@/data/types'
import { t } from '@/i18n'
import { formatMult, groupByRoot, multClass, offensiveProfile, typesLabel } from '@/lib/typecalc'
import { attackInfo, hasInfo } from '@/lib/interactions'
import TypeIcon from '@/components/TypeIcon'
import SideInteractions from '@/components/SideInteractions.vue'

const props = defineProps<{ types: readonly TypeId[] }>()

const coverage = computed(() => offensiveProfile(props.types))
const info = computed(() => attackInfo(props.types))
// Most to least effective, immunities last; ties keep type order (stable sort). Neutral ones are left out.
const singles = computed(() =>
  coverage.value.filter((e) => e.def.length === 1 && e.best !== 1).sort((a, b) => b.best - a.best),
)
const counts = computed(() => {
  const c: Record<number, number> = { 0: 0, 0.25: 0, 0.5: 0, 1: 0, 2: 0, 4: 0 }
  for (const e of coverage.value) c[e.best]!++
  return c
})
const immune = computed(() => coverage.value.filter((e) => e.best === 0))
const resisted = computed(() => coverage.value.filter((e) => e.best > 0 && e.best <= 0.5))
const immuneGroups = computed(() => groupByRoot(immune.value))
// Every dual type with an immune single type is immune too, so only the single types and the pairs immune only
// together are listed, and counted.
const immuneShown = computed(() => immuneGroups.value.groups.length + immuneGroups.value.pairOnly.length)
const resistedGroups = computed(() => groupByRoot(resisted.value))
const COUNT_ORDER: Multiplier[] = [4, 2, 1, 0.5, 0.25, 0]
function countTip(m: Multiplier) {
  const n = counts.value[m]!
  return `${formatMult(m)}: ${t(n === 1 ? 'matchups.typeCountOne' : 'matchups.typeCount', { n })}`
}
// Resisted combos are split by multiplier, so a chip's background never has to compete with a red type badge.
const RESIST_TIERS: Multiplier[] = [0.5, 0.25]
function tiers<T>(items: readonly T[], mult: (x: T) => Multiplier) {
  return RESIST_TIERS.map((m) => ({ m, items: items.filter((x) => mult(x) === m) })).filter((tier) => tier.items.length)
}
</script>

<template>
  <div v-if="singles.length" class="panel">
    <p class="muted">{{ t('matchups.againstEach') }}</p>
    <div class="single-grid">
      <div v-for="e in singles" :key="e.def[0]" class="single" :class="multClass(e.best)">
        <TypeIcon :type="e.def[0]!" />
        <b class="num">{{ formatMult(e.best) }}</b>
      </div>
    </div>
  </div>

  <div v-if="immuneShown" class="panel">
    <h2>{{ t('matchups.immuneTitle', { n: immuneShown }) }}</h2>
    <div v-if="immuneGroups.groups.length" class="root-row">
      <span class="combos">
        <span v-for="g in immuneGroups.groups" :key="g.root.def[0]" class="chip" :class="multClass(0)">
          <TypeIcon :type="g.root.def[0]!" />
        </span>
      </span>
    </div>
    <div v-if="immuneGroups.pairOnly.length" class="root-row">
      <span class="muted pair-lbl">{{ t('matchups.combosOnly') }}</span>
      <span class="combos">
        <span
          v-for="e in immuneGroups.pairOnly"
          :key="e.def.join()"
          class="chip"
          :class="multClass(0)"
          v-tip:chips="typesLabel(e.def)"
        >
          <TypeIcon v-for="t in e.def" :key="t" :type="t" />
        </span>
      </span>
    </div>
  </div>

  <div v-if="hasInfo(info)" class="panel">
    <h2>{{ t('matchups.effects') }}</h2>
    <SideInteractions :info="info" />
  </div>

  <!-- How the whole moveset fares across every defending type, as one bar. -->
  <div class="panel">
    <h2>{{ t('matchups.coverageTitle') }}</h2>
    <p class="muted counts-title">{{ t('matchups.acrossAll', { n: coverage.length }) }}</p>
    <div class="count-bar">
      <div
        v-for="m in COUNT_ORDER.filter((m) => counts[m])"
        :key="m"
        class="seg"
        :class="multClass(m)"
        :style="{ flexGrow: counts[m] }"
        v-tip:counts="countTip(m)"
      >
        {{ formatMult(m) }}
      </div>
    </div>
  </div>

  <details v-if="resisted.length" class="panel">
    <summary>
      <h2>{{ t('matchups.resistedTitle', { n: resisted.length }) }}</h2>
    </summary>
    <div v-for="g in resistedGroups.groups" :key="g.root.def[0]" class="resist-row">
      <span v-tip:chips="`${typesLabel(g.root.def)}: ${formatMult(g.root.best)}`">
        <TypeIcon :type="g.root.def[0]!" />
      </span>
      <template v-if="g.combos.length">
        <span class="muted">+</span>
        <fieldset v-for="tier in tiers(g.combos, (c) => c.entry.best)" :key="tier.m" class="resist-tier">
          <legend>{{ formatMult(tier.m) }}</legend>
          <span
            v-for="c in tier.items"
            :key="c.partner"
            v-tip:chips="`${typesLabel(c.entry.def)}: ${formatMult(c.entry.best)}`"
          >
            <TypeIcon :type="c.partner" />
          </span>
        </fieldset>
      </template>
    </div>
    <div v-if="resistedGroups.pairOnly.length" class="resist-row">
      <span class="muted pair-lbl">{{ t('matchups.combosOnly') }}</span>
      <fieldset v-for="tier in tiers(resistedGroups.pairOnly, (e) => e.best)" :key="tier.m" class="resist-tier pairs">
        <legend>{{ formatMult(tier.m) }}</legend>
        <span
          v-for="e in tier.items"
          :key="e.def.join()"
          class="pair"
          v-tip:chips="`${typesLabel(e.def)}: ${formatMult(e.best)}`"
        >
          <TypeIcon v-for="t in e.def" :key="t" :type="t" />
        </span>
      </fieldset>
    </div>
    <p class="muted small note">{{ t('matchups.partnersNote') }}</p>
  </details>
</template>

<style scoped>
.single-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 4px;
}
.single {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 3px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
}

.counts-title {
  margin-bottom: 4px;
}
/* Segments grow with their count but never shrink below their label; the count itself is in the tooltip. */
.count-bar {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.seg {
  flex: 0 1 0;
  min-width: 2.4em;
  padding: 1px 4px;
  text-align: center;
  white-space: nowrap;
  font-family: var(--font-num, inherit);
  font-size: calc(9px * var(--text-scale));
  cursor: default;
}
.seg + .seg {
  border-left: 1px solid var(--border);
}
.seg.m-1 {
  background: var(--panel-alt);
}
.combos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.root-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 0;
  border-top: 1px solid var(--border);
}
.root-row > .muted {
  line-height: 22px;
}
.pair-lbl {
  white-space: nowrap;
}
.resist-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding: 4px 0;
}
.resist-tier {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0 6px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.resist-tier legend {
  padding: 0 4px;
  font-family: var(--font-num, inherit);
  font-size: calc(11px * var(--text-scale));
  color: var(--muted);
}
.resist-tier.pairs {
  gap: 4px 10px;
}
.pair {
  display: inline-flex;
  gap: 2px;
}
.note {
  margin: 8px 0 0;
}
.small {
  font-size: calc(11px * var(--text-scale));
}
summary {
  cursor: pointer;
}
summary h2 {
  display: inline;
}
details[open] summary {
  margin-bottom: 8px;
}
</style>
