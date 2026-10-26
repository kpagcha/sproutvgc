<script setup lang="ts">
import { computed } from 'vue'
import type { PokemonId } from '@/data/dex'
import { percent, type Spread } from '@/data/meta'
import { natureEffectOn, natureName } from '@/data/natures'
import { POKEMON, STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { MAX_POINTS, TOTAL_POINTS } from '@/lib/stats'
import type { Points } from '@/lib/team'
import { natureTip } from '@/components/natureTip'
import PointsBar from '@/components/PointsBar.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import { ChartColumn } from '@lucide/vue'

// A slot's stats and stat points, set by hand: the meta page's spread card made to be played with, a row per stat (its
// name and its bar, `PointsBar`: its points, the stat they give, the nature's marks), and how many of the
// `TOTAL_POINTS` are left to spend. Each stat takes no more than are left. Its most common spreads (`spreads`, the
// meta's) in a drop-down at its foot, each setting the points and the nature and closing it, on one row with Clear and
// Confirm (which folds it).
const props = defineProps<{ pokemon: PokemonId; nature: string | null; spreads: readonly Spread[] }>()
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
/** Sets a common spread, closing the drop-down it's picked from. */
function choose(s: Spread, close: () => void) {
  emit('preset', s)
  close()
}
const isPreset = (s: Spread) => s.nature === props.nature && s.points.every((p, i) => p === points.value[i])
</script>

<template>
  <div class="points-editor">
    <div class="left" :class="{ over: left < 0, open: left > 0 }">
      <span aria-live="polite">{{
        left < 0
          ? left === -1
            ? t('builder.pointOver')
            : t('builder.pointsOver', { n: -left })
          : left
            ? left === 1
              ? t('builder.pointLeft')
              : t('builder.pointsLeft', { n: left })
            : ''
      }}</span>
    </div>
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
      <OptionsMenu
        v-if="presets.length"
        class="presets-menu"
        :title="t('builder.presets')"
        :label="t('builder.presets')"
        :icon="ChartColumn"
        align="left"
      >
        <template #default="{ close }">
          <div class="presets">
            <button
              v-for="(sp, i) in presets"
              :key="i"
              type="button"
              class="preset"
              :class="{ on: isPreset(sp) }"
              @click="choose(sp, close)"
            >
              <span v-tip="natureTip(sp.nature)" class="preset-nature">{{ natureName(sp.nature) }}</span>
              <span class="preset-points">{{ sp.points.join('/') }}</span>
              <span class="preset-share muted">{{ sp.share ? percent(sp.share) : '' }}</span>
            </button>
          </div>
        </template>
      </OptionsMenu>
      <button type="button" class="btn quiet small clear" :disabled="!spent" @click="points = [0, 0, 0, 0, 0, 0]">
        {{ t('builder.pointsClear') }}
      </button>
      <button type="button" class="btn quiet small confirm" @click="emit('confirm')">
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
.left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--good);
}
.left.open {
  color: var(--accent);
}
.left.over {
  color: var(--bad);
}
/* The spreads' drop-down at the left, Clear and Confirm at the right; one row, the buttons as tight as they read. */
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
/* The spreads one grid, so their nature, points and share line up in columns from one to the next. */
.presets {
  display: grid;
  grid-template-columns: auto auto auto;
  gap: 4px;
}
.preset {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  text-align: left;
  column-gap: 10px;
  padding: 2px 6px;
  font: inherit;
  font-size: 0.85em;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
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
