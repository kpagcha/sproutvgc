<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PokemonId } from '@/data/dex'
import type { Spread } from '@/data/meta'
import { natureEffectOn } from '@/data/natures'
import { POKEMON, STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { MAX_POINTS, TOTAL_POINTS } from '@/lib/stats'
import type { Points } from '@/lib/team'
import PointsBar from '@/components/PointsBar.vue'
import SpreadPresets, { PRESETS } from '@/components/SpreadPresets.vue'
import { ChartColumn } from '@lucide/vue'

// A slot's stats and stat points, set by hand: the meta page's spread card made to be played with, a row per stat (its
// name and its bar, `PointsBar`: its points, the stat they give, the nature's marks); how many of the `TOTAL_POINTS`
// are left to spend is on `TeamSlot`'s line it unfolds from. Each stat takes no more than are left. Its most common
// spreads (`spreads`, the meta's) in a dialog over the page (`SpreadPresets`) from a button at its foot, each setting the
// points and the nature and closing it, those of the nature it has already tinted; the button on one row with Clear and
// Confirm (which folds it).
const props = defineProps<{
  pokemon: PokemonId
  nature: string | null
  spreads: readonly Spread[]
  /** Nothing to fold it into: no Confirm. */
  noConfirm?: boolean
  /** Its common spreads' button left out, the page having its own (the damage calculator's). */
  noPresets?: boolean
}>()
const points = defineModel<Points>('points', { required: true })
const emit = defineEmits<{ preset: [spread: Spread]; confirm: [] }>()

const spent = computed(() => points.value.reduce((a, b) => a + b, 0))
const left = computed(() => TOTAL_POINTS - spent.value)
const rows = computed(() =>
  STATS.map((stat, i) => {
    const effect = props.nature ? natureEffectOn(props.nature, stat) : 'neutral'
    const base = POKEMON[props.pokemon].stats[i]!
    const p = points.value[i]!
    const limit = Math.max(p, Math.min(MAX_POINTS, p + left.value))
    return { stat, i, effect, base, points: p, limit }
  }),
)
function set(i: number, p: number) {
  const next = [...points.value] as Points
  next[i] = p
  points.value = next
}
const presets = computed(() => props.spreads.slice(0, PRESETS))
const open = ref(false)
</script>

<template>
  <div class="points-editor">
    <div class="rows">
      <template v-for="r in rows" :key="r.stat">
        <span class="name" :class="r.effect" aria-hidden="true">{{ t(`stat.${r.stat}`) }}</span>
        <PointsBar
          :model-value="r.points"
          :base="r.base"
          :effect="r.effect"
          :hp="r.i === 0"
          :limit="r.limit"
          :label="t('builder.pointsIn', { stat: t(`stat.${r.stat}`) })"
          @update:model-value="set(r.i, $event)"
        />
      </template>
    </div>
    <!-- Its common spreads to pick from, and clearing or confirming the points (which folds it), on one row. -->
    <div class="actions">
      <button
        v-if="presets.length && !noPresets"
        type="button"
        class="btn quiet small presets-button"
        :class="{ on: open }"
        aria-haspopup="dialog"
        @click="open = true"
      >
        <ChartColumn :size="14" aria-hidden="true" />
        <span>{{ t('builder.presets') }}</span>
      </button>
      <SpreadPresets v-model:open="open" :spreads :nature :points @pick="emit('preset', $event)" />
      <button type="button" class="btn quiet small clear" :disabled="!spent" @click="points = [0, 0, 0, 0, 0, 0]">
        {{ t('builder.pointsClear') }}
      </button>
      <button v-if="!noConfirm" type="button" class="btn quiet small confirm" @click="emit('confirm')">
        {{ t('builder.pointsConfirm') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.85em;
}
.points-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* The spreads' button at the left, Clear and Confirm at the right; one row, the buttons as tight as they read. */
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.actions :deep(.btn) {
  padding-inline: 6px;
}
.clear {
  margin-left: auto;
}
/* Clear and Confirm quiet, with the faintest tint of the bad and the good, a little more pointed at. */
.actions .btn.quiet.clear:not(:disabled) {
  color: color-mix(in srgb, var(--bad) 30%, var(--muted));
  border-color: color-mix(in srgb, var(--bad) 12%, var(--border));
}
.actions .btn.quiet.confirm {
  color: color-mix(in srgb, var(--good) 30%, var(--muted));
  border-color: color-mix(in srgb, var(--good) 12%, var(--border));
}
.actions .btn.quiet.clear:hover:not(:disabled) {
  color: color-mix(in srgb, var(--bad) 65%, var(--text));
  background: color-mix(in srgb, var(--bad) 5%, transparent);
  border-color: color-mix(in srgb, var(--bad) 40%, var(--border));
}
.actions .btn.quiet.confirm:hover {
  color: color-mix(in srgb, var(--good) 65%, var(--text));
  background: color-mix(in srgb, var(--good) 5%, transparent);
  border-color: color-mix(in srgb, var(--good) 40%, var(--border));
}
.rows {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 8px;
  align-items: center;
}
/* The stats named down the left, as on the spread card. */
.name {
  font-size: 0.85em;
  color: var(--muted);
}
</style>
