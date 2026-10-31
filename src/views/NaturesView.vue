<script setup lang="ts">
import { t } from '@/i18n'
import { NATURE_IDS, natureEffects, natureName } from '@/data/natures'

// The natures as the chart players know: a row per stat raised, a column per stat lowered, each nature in its cell;
// the five that raise and lower the same stat, and so change nothing, on the diagonal.
const STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const
const effects = NATURE_IDS.map((id) => ({ id, effect: natureEffects(id) }))
// The neutral ones where the game's own table has them: Hardy raises and lowers Attack, Docile Defense, and so on.
const neutral = ['hardy', 'docile', 'bashful', 'quirky', 'serious']
const cell = (plus: string, minus: string, i: number) =>
  plus === minus ? neutral[i] : effects.find((n) => n.effect?.plus === plus && n.effect.minus === minus)?.id
</script>

<template>
  <div class="panels">
    <div class="panel">
      <h1>{{ t('title.natures') }}</h1>
      <div class="chart-wrap">
        <table class="chart">
          <thead>
            <tr>
              <th class="corner" scope="col"><span class="plus">+</span> \ <span class="minus">−</span></th>
              <th v-for="s in STATS" :key="s" scope="col" class="minus">−{{ t(`stat.${s}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in STATS" :key="p">
              <th scope="row" class="plus">+{{ t(`stat.${p}`) }}</th>
              <td v-for="m in STATS" :key="m" :class="{ neutral: p === m }">
                <template v-if="cell(p, m, i)">{{ natureName(cell(p, m, i)!) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">{{ t('natures.intro') }}</p>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  overflow-x: auto;
}
.chart {
  border-collapse: collapse;
  width: 100%;
  max-width: 640px;
  table-layout: fixed;
}
.chart th,
.chart td {
  border: 1px solid var(--border);
  padding: 8px 4px;
  text-align: center;
}
.chart th {
  font-weight: bold;
  white-space: nowrap;
}
.corner {
  color: var(--muted);
  font-weight: normal;
}
.plus {
  color: var(--good);
}
.minus {
  color: var(--bad);
}
.neutral {
  color: var(--muted);
  background: var(--panel-alt);
}
.small {
  font-size: 0.875em;
  margin: 10px 0 0;
}
@media (max-width: 560px) {
  .chart th,
  .chart td {
    padding: 6px 2px;
    font-size: 0.8rem;
  }
}
</style>
