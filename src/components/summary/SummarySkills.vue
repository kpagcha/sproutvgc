<script setup lang="ts">
import { computed } from 'vue'
import { available, item, move, type PokemonId } from '@/data/dex'
import { POKEMON, STATS, total } from '@/data/pokemon'
import { t, tSlots, type MessageKey } from '@/i18n'
import { PAGE_STAT_BARS, setPercentiles, usePageStatBars } from '@/composables/useStatReference'
import { statAt50, statRange, MAX_SP } from '@/lib/stats'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The summary's stats page: each base stat with its bar, and what it comes to at level 50, from the lowest to the
// highest it can be; then the speeds that decide who moves first.
const props = defineProps<{ id: PokemonId }>()
const mon = computed(() => POKEMON[props.id])

// Each stat's bar, out of 200 (the few above it fill it). Plain (`usePageStatBars`), colored by Showdown's scale for
// stats: red for low, through yellow, to green and blue for high. Set against a set of Pokémon: a tick at its median, a
// band over its middle half, the bar blue above the median and red below, and on hover how many it beats.
const bars = usePageStatBars()
const statColor = (v: number) => `hsl(${Math.min(Math.floor((v * 180) / 255), 360)}, 75%, 45%)`
const at = (v: number) => Math.min(100, v / 2)
const along = (v: number) => `${at(v)}%`
const stats = computed(() => {
  const p = bars.value === 'plain' ? null : setPercentiles(bars.value)
  return STATS.map((s, i) => {
    const v = mon.value.stats[i]!
    const rank = p?.rank(i, v) ?? null
    const median = p?.quantile(i, 0.5) ?? null
    const low = p?.quantile(i, 0.25) ?? null
    const high = p?.quantile(i, 0.75) ?? null
    return {
      s,
      v,
      range: statRange(s, v),
      side: rank === null ? null : rank >= 0.5 ? 'hi' : 'lo',
      color: p ? undefined : statColor(v),
      tip: rank === null ? undefined : t('pokemon.statRank', { pct: Math.round(rank * 100) }),
      median: median === null ? null : along(median),
      band: low === null || high === null ? null : { left: along(low), width: `${at(high) - at(low)}%` },
    }
  })
})

// The speeds worth knowing in a doubles game: its fastest, doubled by Tailwind or raised by a Choice Scarf, and its
// slowest, for Trick Room. Each only when the regulation has what it takes.
const speed = computed(() => {
  const base = mon.value.stats[5]
  const max = statAt50('spe', base, MAX_SP, 'plus')
  const rows: { key: MessageKey; value: number; ref?: ReturnType<typeof move> | ReturnType<typeof item> }[] = [
    { key: 'summary.speedMax', value: max },
  ]
  const scarf = item('choicescarf')
  if (available(scarf)) rows.push({ key: 'summary.speedWith', value: Math.floor(max * 1.5), ref: scarf })
  const tailwind = move('tailwind')
  if (available(tailwind)) rows.push({ key: 'summary.speedUnder', value: max * 2, ref: tailwind })
  const trickRoom = move('trickroom')
  rows.push({ key: 'summary.speedMin', value: statAt50('spe', base, 0, 'minus'), ref: trickRoom })
  return rows
})
</script>

<template>
  <div class="skills">
    <SegmentedControl
      v-model="bars"
      class="bars-mode"
      :label="t('pokemon.statBars')"
      :options="PAGE_STAT_BARS.map((b) => ({ value: b, label: b === 'plain' ? t('stats.plain') : t(`stats.vs.${b}`) }))"
    />
    <table class="stats">
      <thead>
        <tr>
          <th></th>
          <th class="r muted">{{ t('summary.base') }}</th>
          <th class="bar-cell"></th>
          <th colspan="3" class="lv muted">{{ t('summary.atLevel') }}</th>
        </tr>
        <tr class="sub">
          <th></th>
          <th></th>
          <th class="bar-cell"></th>
          <th v-tip="t('summary.minTip')" class="r muted">{{ t('summary.min') }}</th>
          <th v-tip="t('summary.neutralTip')" class="r muted">{{ t('summary.neutral') }}</th>
          <th v-tip="t('summary.maxTip', { sp: MAX_SP })" class="r muted">{{ t('summary.max') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="st in stats" :key="st.s" v-tip="st.tip">
          <th class="label">
            <span class="pill">{{ t(`stat.${st.s}`) }}</span>
          </th>
          <td class="r num base">{{ st.v }}</td>
          <td class="bar-cell">
            <span class="track" :class="{ plain: bars === 'plain' }">
              <span v-if="st.band" class="band" :style="st.band"></span>
              <span class="bar" :class="st.side" :style="{ width: along(st.v), background: st.color }"></span>
              <span v-if="st.median" class="median" :style="{ left: st.median }"></span>
            </span>
          </td>
          <td class="r num lvl">{{ st.s === 'hp' ? '' : st.range.min }}</td>
          <td class="r num lvl">{{ st.range.neutral }}</td>
          <td class="r num lvl hi">{{ st.range.max }}</td>
        </tr>
        <tr class="total">
          <th v-tip="t('stat.bstFull')" class="label">
            <span class="pill">{{ t('stat.bst') }}</span>
          </th>
          <td class="r num base">{{ total(mon) }}</td>
          <td class="bar-cell"></td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
    <p v-if="bars !== 'plain'" class="legend muted">{{ t(`stats.about.${bars}`) }} {{ t('pokemon.statLegend') }}</p>

    <section class="summary-memo">
      <h3>{{ t('summary.speed') }}</h3>
      <ul>
        <li v-for="row in speed" :key="row.key">
          <span>
            <template v-for="(part, i) in tSlots(row.key)" :key="i">
              <template v-if="typeof part === 'string'">{{ part }}</template>
              <span v-else-if="row.ref?.kind === 'item'" class="with-icon"
                ><ItemIcon :id="row.ref.id" /><DexRef :to="row.ref"
              /></span>
              <DexRef v-else-if="row.ref" :to="row.ref" />
            </template>
          </span>
          <span class="num">{{ row.value }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.bars-mode {
  justify-content: flex-end;
  margin-bottom: 8px;
}
.stats {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 3px;
}
.stats th,
.stats td {
  padding: 0 6px 0 0;
  white-space: nowrap;
}
.stats thead th {
  font-weight: normal;
  font-size: 0.8em;
}
.stats .lv {
  text-align: center;
  border-bottom: 1px solid var(--border);
}
.r {
  text-align: right;
}
.label {
  width: 1%;
  text-align: left;
}
/* The games' stat names, on a pill tinted by the Pokémon's type. */
.pill {
  display: block;
  min-width: 3.4em;
  padding: 1px 8px;
  background: var(--summary-tint);
  color: var(--summary-on-tint);
  font-weight: bold;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.base {
  width: 1%;
  font-weight: bold;
}
.lvl {
  width: 1%;
  padding-left: 6px;
  min-width: 2.6em;
}
.lvl.hi {
  font-weight: bold;
}
.bar-cell {
  width: 100%;
  min-width: 60px;
}
.track {
  position: relative;
  display: block;
  height: 12px;
  background: color-mix(in srgb, var(--border) 40%, transparent);
}
.band,
.bar,
.median {
  position: absolute;
  left: 0;
}
.band {
  top: 0;
  bottom: 0;
  background: var(--border);
}
.bar {
  top: 3px;
  bottom: 3px;
  background: var(--muted);
}
.bar.hi {
  background: var(--stat-hi);
}
.bar.lo {
  background: var(--stat-lo);
}
.track.plain {
  height: 10px;
  background: none;
}
.plain .bar {
  top: 0;
  bottom: 0;
}
.median {
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--text);
}
.total th,
.total td {
  padding-top: 6px;
}
.legend {
  margin: 6px 0 0;
  font-size: 0.8em;
}
.with-icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  vertical-align: middle;
}
@media (max-width: 560px) {
  .bar-cell {
    display: none;
  }
}
</style>
