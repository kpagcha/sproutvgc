<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Check, X } from '@lucide/vue'
import { item, type ItemId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { natureEffectOn } from '@/data/natures'
import { STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Battlefield, type Fighter } from '@/lib/damage'
import {
  reverseDamage,
  type Observation,
  type ReverseResult,
  type ReverseRow,
  type StatRange,
} from '@/lib/damageReverse'
import { runSliced } from '@/lib/slices'
import { MAX_POINTS } from '@/lib/stats'
import { setsAs, type Points } from '@/lib/team'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's "What fits": from what was seen (`obs`: the hits and which moved first, `CalcHits`), what
// the opponent's set could then be (`damageReverse.ts`): each stat in play's points where some build fits, how
// likely what was seen was at its sets, and its common spreads against its common items, each pair marked as fitting
// (on what share of the damage rolls) or ruled out; joined by the nearest that fits when none of them does. At its team
// sheet (`sheet`, shared with the threats), its item and nature as set, only its points varying. A spread used (`use`)
// sets the opponent to it, with the item likeliest to go with it. Worked out a slice at a time once the sides have
// settled, what it showed kept, faded, until the new one's in.
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  field: Battlefield
  data: MetaData | null
  obs: readonly Observation[]
}>()
const sheet = defineModel<boolean>('sheet', { default: false })
const emit = defineEmits<{ use: [build: { nature: string | null; points: Points; item?: ItemId | null }] }>()

const theirId = computed(() => battlerOf(props.theirs))
const yourId = computed(() => battlerOf(props.yours))

const result = shallowRef<ReverseResult | null>(null)
const progress = shallowRef<number | null>(null)
/** Past `SLOW_MS`, its progress shown and what's there faded, so a quick one swaps in one step. */
const slow = shallowRef(false)
const SLOW_MS = 300
let slowTimer = 0
let stop: (() => void) | null = null
onUnmounted(() => {
  stop?.()
  clearTimeout(slowTimer)
})
function start() {
  stop?.()
  stop = null
  const id = theirId.value
  if (!id || !yourId.value || !props.obs.length) {
    result.value = null
    progress.value = null
    return
  }
  const { total, steps } = reverseDamage({
    yours: props.yours,
    theirs: props.theirs,
    field: props.field,
    entry: props.data?.[setsAs(props.theirs.member) ?? id] ?? undefined,
    sheet: sheet.value,
    obs: props.obs,
  })
  progress.value = 0
  clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => (slow.value = true), SLOW_MS)
  stop = runSliced(
    steps,
    total,
    (p) => (progress.value = p),
    (r) => {
      result.value = r
      progress.value = null
      clearTimeout(slowTimer)
      slow.value = false
      stop = null
    },
  )
}
watch(() => [sheet.value, props.obs, props.data] as const, start, { immediate: true })
watchDebounced(() => [props.yours, props.theirs, props.field] as const, start, { debounce: 150 })

const statName = (s: number) => t(`stat.${STATS[s]!}`)
/** A build in Showdown's short way, its points in the stats in play, `+` or `−` after those its nature raises or
 * lowers: "32 HP / 20+ Def". */
const spreadLabel = (r: ReverseRow, stats: readonly number[]) =>
  stats
    .map((s) => {
      const e = s && r.nature ? natureEffectOn(r.nature, STATS[s]!) : 'neutral'
      return `${r.points[s]}${e === 'up' ? '+' : e === 'down' ? '−' : ''} ${statName(s)}`
    })
    .join(' / ')
/** A stat's points where something fits, but for one that can be anything (the table says as much). */
const shownRanges = computed(() =>
  (result.value?.ranges ?? []).filter(
    (r) => !(r.from === 0 && r.to === MAX_POINTS && (r.stat === 0 || sheet.value || r.effects.length === 3)),
  ),
)
const rangeText = (r: StatRange) => {
  const pts =
    r.from === r.to
      ? t('calc.reverse.exactly', { n: r.from })
      : r.from === 0
        ? t('calc.reverse.atMost', { n: r.to })
        : r.to === MAX_POINTS
          ? t('calc.reverse.atLeast', { n: r.from })
          : t('calc.reverse.between', { from: r.from, to: r.to })
  // Off its team sheet, a nature it must have for it, when only one effect fits.
  const e = r.effects.length === 1 ? r.effects[0]! : 'neutral'
  return !sheet.value && r.stat && e !== 'neutral' ? `${pts}, ${t(`calc.reverse.nature.${e}`)}` : pts
}
const itemName = (id: ItemId | null) => (id ? refName(item(id)) : t('builder.noItem'))
const fitTip = (f: number) => t('calc.reverse.fitTip', { pct: percent(f) })
/** A row's fits: one, its item known (or no items apart); else the items it fits with, the likeliest first (its fit
 * by the item's share), each named (those that can't change the hits as "any other item", or "any item" when every
 * item fits alike), with its share of the rolls and, on hover, its share of the sets. */
function fitsOf(r: ReverseRow): { key: string; label: string; fit: number; tip: string }[] {
  const res = result.value
  if (!res) return []
  const cols = res.columns.map((c, ci) => ({ c, fit: r.fits[ci]! }))
  if (!res.itemsVary || cols.length === 1)
    return cols[0]!.fit > 0 ? [{ key: '-', label: '', fit: cols[0]!.fit, tip: fitTip(cols[0]!.fit) }] : []
  const fitting = cols.filter((x) => x.fit > 0)
  if (fitting.length === cols.length && fitting.every((x) => x.fit === fitting[0]!.fit))
    return [{ key: 'any', label: t('calc.reverse.anyItem'), fit: fitting[0]!.fit, tip: fitTip(fitting[0]!.fit) }]
  return fitting
    .sort((x, y) => y.fit * (y.c.share ?? 0) - x.fit * (x.c.share ?? 0))
    .map(({ c, fit }) => ({
      key: c.items.join(),
      label:
        c.inert && c.items.length > 1
          ? t('calc.reverse.otherItem')
          : c.items.length > 2
            ? t('calc.reverse.itemAndMore', { item: itemName(c.items[0]!), n: c.items.length - 1 })
            : c.items.map(itemName).join(' / '),
      fit,
      tip: [
        ...c.items.map((it) => itemName(it)),
        ...(c.share ? [t('calc.reverse.itemShare', { pct: percent(c.share) })] : []),
        fitTip(fit),
      ].join(' · '),
    }))
}
/** A spread used: its nature and points, and off its team sheet, the item likeliest to go with it (its fit by the
 * item's share), else its most run. */
function use(r: ReverseRow) {
  const res = result.value
  if (!res) return
  let item: ItemId | null | undefined
  if (res.itemsVary) {
    const score = res.columns.map((c, ci) => r.fits[ci]! * (c.share ?? 0))
    const best = score.indexOf(Math.max(...score))
    item = res.columns[Math.max(0, best)]!.items[0]
  }
  emit('use', { nature: r.nature, points: r.points, ...(item !== undefined && { item }) })
}
</script>

<template>
  <section class="panel banded reverse">
    <h2 class="band">{{ t('calc.reverse.title') }}</h2>
    <div class="reverse-head">
      <!-- Working it out, past a moment: how far it's got, a line over the row's top, moving nothing. -->
      <div
        v-if="slow && progress !== null"
        class="progress"
        role="progressbar"
        :aria-valuenow="Math.round(progress * 100)"
      >
        <span :style="{ width: `${progress * 100}%` }"></span>
      </div>
      <button
        v-tip="t('calc.reverse.sheetTip')"
        type="button"
        class="btn switch sheet"
        :class="{ on: sheet }"
        :aria-pressed="sheet"
        @click="sheet = !sheet"
      >
        {{ t('calc.threats.sheet') }}
      </button>
      <span class="muted at"
        >{{ sheet ? t('calc.reverse.atSheet') : t('calc.reverse.atSets') }}
        {{ theirs.member.item ? t('calc.reverse.itemSet') : t('calc.reverse.itemVaries') }}</span
      >
    </div>
    <p v-if="!theirId || !yourId" class="muted intro">{{ t('calc.threats.pickBoth') }}</p>
    <p v-else-if="!obs.length" class="muted intro">{{ t('calc.reverse.hint') }}</p>
    <template v-if="theirId && yourId && obs.length && result">
      <div class="body" :class="{ stale: slow }">
        <p v-if="!result.ranges.length" class="warn" role="status">{{ t('calc.reverse.impossible') }}</p>
        <template v-else>
          <!-- What its points can be, where the hits bind them (none bound, the table says which fit). -->
          <p v-if="shownRanges.length" class="lines" role="status">
            <PokemonIcon :id="theirId" class="who" />
            <span v-for="r in shownRanges" :key="r.stat" class="line">
              <b>{{ statName(r.stat) }}</b> {{ rangeText(r) }}
            </span>
          </p>
          <p v-if="result.chance !== null" class="muted small">
            {{
              result.chance
                ? t(sheet ? 'calc.reverse.chanceSheet' : 'calc.reverse.chance', { pct: percent(result.chance) })
                : t('calc.reverse.noneRun')
            }}
          </p>
        </template>

        <!-- Its common spreads down, its items across (merged where alike), each pair fitting or not. -->
        <div class="table-wrap">
          <table class="builds">
            <thead>
              <tr>
                <th scope="col" class="corner muted">{{ t('calc.reverse.spread') }}</th>
                <th scope="col" class="col muted">{{ t('calc.reverse.fits') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in result.rows" :key="ri">
                <th scope="row">
                  <span class="spread">{{ spreadLabel(r, result.stats) }}</span>
                  <!-- Its share, and the way to set the opponent to it. -->
                  <span class="row-foot">
                    <span v-if="r.share" v-tip="t('calc.reverse.shareTip')" class="muted">{{ percent(r.share) }}</span>
                    <span v-else-if="r.nearest" class="muted">{{ t('calc.reverse.nearest') }}</span>
                    <span v-else class="muted">{{ t('calc.reverse.ownSet') }}</span>
                    <button v-tip="t('calc.reverse.useTip')" type="button" class="btn small use" @click="use(r)">
                      {{ t('calc.reverse.use') }}
                    </button>
                  </span>
                </th>
                <!-- Whether it fits: with its item known (or none tried apart), on what share of the rolls; with its
                     items worked out, which it fits with, each by name and the share of the rolls, the likeliest
                     first. -->
                <td class="cell" :class="[fitsOf(r).length ? 'fits' : 'no', { named: fitsOf(r).some((w) => w.label) }]">
                  <template v-if="fitsOf(r).length">
                    <Check :size="16" class="mark" :aria-label="t('reverse.fit.fits')" />
                    <span class="with">
                      <span v-for="w in fitsOf(r)" :key="w.key" v-tip="w.tip" class="fit-item">
                        <span class="fit-name">{{ w.label }}</span
                        ><span v-if="w.fit < 1" class="part">{{ percent(w.fit) }}</span>
                      </span>
                    </span>
                  </template>
                  <X v-else :size="16" class="mark" :aria-label="t('reverse.fit.no')" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">{{ t('calc.reverse.note') }}</p>
      </div>
    </template>
    <p v-else-if="theirId && yourId && obs.length" class="muted intro">{{ t('calc.reverse.working') }}</p>
  </section>
</template>

<style scoped>
/* Its buttons soft, as many as there are: a thin outline, no hard shadow nor lift; one on filled, outlined in ink. */
:root:root .reverse .btn {
  border-width: 1px;
  border-color: var(--border);
  box-shadow: none;
  font-weight: normal;
}
:root:root .reverse .btn:hover:not(:disabled) {
  transform: none;
  box-shadow: none;
  border-color: var(--ink);
}
:root:root .reverse .btn:active:not(:disabled) {
  transform: none;
  background: color-mix(in srgb, var(--text) 10%, var(--panel));
}
:root:root .reverse .btn.on {
  border-color: var(--ink);
  font-weight: bold;
}
.reverse {
  margin: 0;
}
.reverse-head {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.at {
  font-size: 0.85em;
}
.row-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.875em;
}
.use {
  min-height: 0;
  padding: 0 8px;
}
.sheet.on {
  background: var(--sel);
}
.progress {
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--panel-alt);
}
.progress > span {
  display: block;
  height: 100%;
  background: var(--accent);
}
.intro {
  margin: 10px 0 0;
  font-size: 0.85em;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.body > p {
  margin: 0;
}
.small {
  font-size: 0.85em;
}
.warn {
  color: var(--bad);
  font-weight: bold;
}
.stale {
  opacity: 0.5;
  transition: opacity 0.15s;
}
/* Its points where they're bound, after its icon, edged in the opponent's color. */
.lines {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  padding-left: 8px;
  border-left: 4px solid var(--opponent);
}
.line {
  white-space: nowrap;
}
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
}
.builds {
  border-collapse: collapse;
  font-size: 0.875em;
}
.builds th,
.builds td {
  padding: 4px 8px;
  border: 1px solid var(--border);
}
.builds th {
  font-weight: normal;
  white-space: nowrap;
  text-align: left;
}
.builds thead th.col {
  border-top: 3px solid var(--opponent);
}
.builds tbody th {
  border-left: 3px solid var(--opponent);
}
.corner {
  vertical-align: bottom;
}
.spread {
  display: block;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.share {
  display: block;
  font-size: 0.875em;
}
.cell {
  min-width: 56px;
  text-align: center;
  vertical-align: middle;
  font-weight: bold;
}
.cell .lucide {
  display: block;
  margin-inline: auto;
}
/* Fitting with items named: the mark at the left, the items one under another, each its share of the rolls. */
.cell.named {
  text-align: left;
  white-space: nowrap;
}
.cell.named .mark {
  display: inline-block;
  margin: 0 6px 0 0;
  vertical-align: top;
}
.with {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}
.fit-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.cell.named .part {
  display: inline;
}
.part {
  display: block;
  font-size: 0.8em;
  font-weight: normal;
}
.cell.fits {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.cell.no {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
</style>
