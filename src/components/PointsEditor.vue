<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent, type Spread } from '@/data/meta'
import { natureEffectOn, natureName } from '@/data/natures'
import { POKEMON, STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { MAX_POINTS, TOTAL_POINTS } from '@/lib/stats'
import type { Points } from '@/lib/team'
import { natureTip } from '@/components/natureTip'
import PointsBar from '@/components/PointsBar.vue'
import ModalDialog from '@/components/ModalDialog.vue'
import { ChartColumn, X } from '@lucide/vue'

// A slot's stats and stat points, set by hand: the meta page's spread card made to be played with, a row per stat (its
// name and its bar, `PointsBar`: its points, the stat they give, the nature's marks); how many of the `TOTAL_POINTS`
// are left to spend is on `TeamSlot`'s line it unfolds from. Each stat takes no more than are left. Its most common
// spreads (`spreads`, the meta's) in a dialog over the page (`ModalDialog`) from a button at its foot, each setting the
// points and the nature and closing it, those of the nature it has already tinted; the button on one row with Clear and
// Confirm (which folds it).
const props = defineProps<{
  pokemon: PokemonId
  nature: string | null
  spreads: readonly Spread[]
  /** Nothing to fold it into: no Confirm. */
  noConfirm?: boolean
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
const PRESETS = 4
const presets = computed(() => props.spreads.slice(0, PRESETS))
const open = ref(false)
/** Sets a common spread, closing the dialog it's picked from. */
function choose(s: Spread) {
  emit('preset', s)
  open.value = false
}
const isPreset = (s: Spread) => s.nature === props.nature && s.points.every((p, i) => p === points.value[i])
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
        v-if="presets.length"
        type="button"
        class="btn quiet small presets-button"
        :class="{ on: open }"
        aria-haspopup="dialog"
        @click="open = true"
      >
        <ChartColumn :size="14" aria-hidden="true" />
        <span>{{ t('builder.presets') }}</span>
      </button>
      <ModalDialog v-if="presets.length" v-model:open="open" :label="t('builder.presets')">
        <div class="panel banded presets-card">
          <div class="band">
            <span>{{ t('builder.presets') }}</span>
            <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="open = false">
              <X :size="16" aria-hidden="true" />
            </button>
          </div>
          <div class="presets">
            <button
              v-for="(sp, i) in presets"
              :key="i"
              type="button"
              class="preset"
              :class="{ on: isPreset(sp), same: sp.nature === nature }"
              @click="choose(sp)"
            >
              <span v-tip="natureTip(sp.nature)" class="preset-nature">{{ natureName(sp.nature) }}</span>
              <span class="preset-points">{{ sp.points.join('/') }}</span>
              <span class="preset-share muted">{{ sp.share ? percent(sp.share) : '' }}</span>
            </button>
          </div>
        </div>
      </ModalDialog>
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
/* Its card no wider than its spreads read; its band what it is, its close at the end. */
:global(.modal-dialog) > .presets-card {
  max-width: 360px;
}
:root:root .presets-card.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
.close {
  min-height: 0;
  padding: 2px 4px;
}
/* The spreads one grid, so their nature, points and share line up in columns from one to the next. */
.presets {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px;
  padding-top: 10px;
}
.preset {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  text-align: left;
  column-gap: 10px;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.preset:hover {
  background: var(--hover);
}
/* Of the nature it has already: the faintest tint of the accent, an edge of it down its left; the one it's at
   outlined too. */
.preset.same {
  background: color-mix(in srgb, var(--accent) 8%, var(--panel-alt));
  box-shadow: inset 3px 0 0 var(--accent);
}
.preset.same:hover {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel-alt));
}
.preset.on {
  border-color: var(--accent);
}
.preset-nature {
  font-weight: bold;
}
.preset-points,
.preset-share {
  font-variant-numeric: tabular-nums;
}
.preset-share {
  text-align: right;
}
</style>
