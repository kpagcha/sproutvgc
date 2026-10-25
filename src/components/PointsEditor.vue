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
// meta's) in a drop-down beside the points left, each setting the points and the nature and closing it.
const props = defineProps<{ pokemon: PokemonId; nature: string | null; spreads: readonly Spread[] }>()
const points = defineModel<Points>('points', { required: true })
const emit = defineEmits<{ preset: [spread: Spread] }>()

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
      <button v-if="spent" type="button" class="link-btn" @click="points = [0, 0, 0, 0, 0, 0]">
        {{ t('builder.pointsClear') }}
      </button>
      <OptionsMenu v-if="presets.length" class="presets-menu" :title="t('builder.presets')" :icon="ChartColumn">
        <template #default="{ close }">
          <span class="muted small">{{ t('builder.presets') }}</span>
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
            <span v-if="sp.share" class="muted">{{ percent(sp.share) }}</span>
          </button>
        </template>
      </OptionsMenu>
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
.link-btn {
  margin-left: auto;
  padding: 0;
  font: inherit;
  font-weight: normal;
  color: var(--link);
  background: none;
  border: 0;
  cursor: pointer;
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
/* The common spreads' drop-down at the line's end, after Clear when it's there; in the text's color, not the line's. */
.presets-menu {
  margin-left: auto;
  color: var(--text);
  font-weight: normal;
}
.link-btn + .presets-menu {
  margin-left: 0;
}
.preset {
  display: flex;
  justify-content: space-between;
  text-align: left;
  gap: 6px;
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
.preset-points {
  font-variant-numeric: tabular-nums;
}
</style>
