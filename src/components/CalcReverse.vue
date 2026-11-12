<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Check, X } from '@lucide/vue'
import { item, type ItemId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { natureEffectOn } from '@/data/natures'
import { STATS } from '@/data/pokemon'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Battlefield, type Fighter } from '@/lib/damage'
import {
  reverseDamage,
  type Observation,
  type OpponentUnknowns,
  type ReverseResult,
  type ReverseRow,
  type StatRange,
} from '@/lib/damageReverse'
import { runSliced } from '@/lib/slices'
import { MAX_POINTS } from '@/lib/stats'
import { setsAs, type Points } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's "What fits": from what was seen (`obs`: the hits and which moved first, `CalcHits`), what
// the opponent's set could then be (`damageReverse.ts`): each stat in play's points where some build fits, how
// likely what was seen was at its sets, and its common spreads against its common items, each pair marked as fitting
// (on what share of the damage rolls) or ruled out; joined by the nearest that fits when none of them does. What's
// worked out of it is the opponent's card's Work out (`work`: its nature, item and points, each given or not; its
// points given, a row per nature it could have at them). A build used (`use`) sets the opponent to what was worked out
// of it, with the item likeliest to go with it. Worked out a slice at a time once the sides have
// settled, what it showed kept, faded, until the new one's in. It's the readout of "What you saw" (in its slot, both
// picked): a sunken tray across that panel's foot, the answer under what it's worked out from.
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  field: Battlefield
  data: MetaData | null
  obs: readonly Observation[]
  work: OpponentUnknowns
}>()
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
    work: props.work,
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
watch(() => [props.work, props.obs, props.data] as const, start, { immediate: true })
watchDebounced(() => [props.yours, props.theirs, props.field] as const, start, { debounce: 150 })

/** What's being answered, in a line: the parts of the opponent's set worked out, or none (whether what's set fits). */
const asks = computed(() => {
  const parts = (['nature', 'item', 'points'] as const)
    .filter((k) => props.work[k])
    .map((k) => t(k === 'nature' ? 'builder.nature' : k === 'item' ? 'builder.item' : 'builder.points').toLowerCase())
  return parts.length
    ? t('calc.reverse.asks', { parts: new Intl.ListFormat(locale.value).format(parts) })
    : t('calc.reverse.asksNone')
})
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
/** The widest a build of those stats is written, with a nature's mark: every point in each, all but HP marked. Unseen
 * in the table's corner, one per mark, it keeps the spreads' column as wide from one answer to the next. */
const MARKS = ['+', '−'] as const
const widestLabel = (stats: readonly number[], mark: string) =>
  stats.map((s) => `${MAX_POINTS}${s ? mark : ''} ${statName(s)}`).join(' / ')
/** A stat's points where something fits, but for one that can be anything (the table says as much). */
const shownRanges = computed(() =>
  (result.value?.ranges ?? []).filter(
    (r) => !(r.from === 0 && r.to === MAX_POINTS && (r.stat === 0 || !props.work.nature || r.effects.length === 3)),
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
  // Its nature worked out, one it must have for it, when only one effect fits.
  const e = r.effects.length === 1 ? r.effects[0]! : 'neutral'
  return props.work.nature && r.stat && e !== 'neutral' ? `${pts}, ${t(`calc.reverse.nature.${e}`)}` : pts
}
const itemName = (id: ItemId | null) => (id ? refName(item(id)) : t('builder.noItem'))
const fitTip = (f: number) => t('calc.reverse.fitTip', { pct: percent(f) })
/** A build used: its nature and points, and its item worked out, the item likeliest to go with it (its fit by the
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
  <section class="reverse">
    <div class="reverse-head">
      <h3 class="title">{{ t('calc.reverse.title') }}</h3>
      <!-- Working it out, past a moment: how far it's got, a line over the row's top, moving nothing. -->
      <div
        v-if="slow && progress !== null"
        class="progress"
        role="progressbar"
        :aria-valuenow="Math.round(progress * 100)"
      >
        <span :style="{ width: `${progress * 100}%` }"></span>
      </div>
    </div>
    <p class="muted small asks">{{ asks }}</p>
    <p v-if="!obs.length" class="muted intro">{{ t('calc.reverse.hint') }}</p>
    <template v-if="theirId && yourId && obs.length && result">
      <div class="body" :class="{ stale: slow }">
        <p v-if="!result.possible" class="warn" role="status">{{ t('calc.reverse.impossible') }}</p>
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
                ? t(props.work.nature ? 'calc.reverse.chance' : 'calc.reverse.chanceSheet', {
                    pct: percent(result.chance),
                  })
                : t('calc.reverse.noneRun')
            }}
          </p>
        </template>

        <!-- Its common spreads down, its items across (merged where alike), each pair fitting or not. -->
        <div class="table-wrap">
          <table class="builds">
            <thead>
              <tr>
                <th scope="col" class="corner muted">
                  {{ t('calc.reverse.spread') }}
                  <span v-for="m in MARKS" :key="m" class="spread sizer" aria-hidden="true">{{
                    widestLabel(result.stats, m)
                  }}</span>
                </th>
                <th v-for="(c, ci) in result.columns" :key="ci" scope="col" class="col">
                  <span v-if="!result.itemsVary || result.columns.length === 1" class="muted">{{
                    t('calc.reverse.fits')
                  }}</span>
                  <template v-else>
                    <!-- Its items' icons; three or more alike, its most common's and how many more, every one named on
                         hover. -->
                    <span class="items">
                      <template v-for="it in c.items.length > 2 ? c.items.slice(0, 1) : c.items" :key="it ?? '-'">
                        <span v-if="it" v-tip="itemName(it)" class="item" role="img" :aria-label="itemName(it)"
                          ><ItemIcon :id="it"
                        /></span>
                        <span v-else class="muted no-item">{{ itemName(null) }}</span>
                      </template>
                      <span
                        v-if="c.items.length > 2"
                        v-tip="c.items.map(itemName).join(', ')"
                        class="more-items"
                        :aria-label="c.items.map(itemName).join(', ')"
                        >+{{ c.items.length - 1 }}</span
                      >
                    </span>
                    <span v-if="c.share" v-tip="t('calc.reverse.itemTip')" class="muted share">{{
                      percent(c.share)
                    }}</span>
                  </template>
                </th>
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
                <td
                  v-for="(f, ci) in r.fits"
                  :key="ci"
                  v-tip="f > 0 ? fitTip(f) : t('reverse.fit.no')"
                  class="cell"
                  :class="f > 0 ? 'fits' : 'no'"
                >
                  <template v-if="f > 0">
                    <Check :size="16" :aria-label="t('reverse.fit.fits')" />
                    <span v-if="f < 1" class="part">{{ percent(f) }}</span>
                  </template>
                  <X v-else :size="16" :aria-label="t('reverse.fit.no')" />
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
/* The readout: a tray across the panel's foot, to its edges, sunk under the hits it's worked out from. */
.reverse {
  position: relative;
  margin: var(--panel-pad) calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad));
  padding: 10px var(--panel-pad) var(--panel-pad);
  background: color-mix(in srgb, var(--ink) 6%, var(--panel));
  border-top: 2px solid var(--ink);
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--ink) 8%, transparent);
}
.reverse-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.row-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.875em;
}
.title {
  margin: 0 auto 0 0;
  font-size: 1em;
}
.use {
  min-height: 0;
  padding: 0 8px;
}
.progress {
  position: absolute;
  top: 0;
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
.asks {
  margin: 4px 0 0;
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
/* A spread's cell as wide whatever its row ends with (its share, "Nearest fit"). */
.builds tbody th {
  min-width: 10.5em;
  border-left: 3px solid var(--opponent);
}
/* An item's column: one width whatever it's of (an icon or two, how many more, its share), its content centered as
   its cells' is. */
.builds .col,
.builds .cell {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  text-align: center;
}
.corner {
  vertical-align: bottom;
}
.items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  white-space: normal;
}
.item {
  display: inline-flex;
}
.no-item {
  font-size: 0.875em;
}
/* How many more items, alike, after the most common one's icon: a small badge, every one named on hover. */
.more-items {
  padding: 0 4px;
  font-size: 0.8em;
  font-weight: bold;
  color: var(--muted);
  border: 1px solid var(--border);
  cursor: help;
}
.spread {
  display: block;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
/* The widest a spread is written, in the corner: taking its width, no height, unseen. */
.sizer {
  height: 0;
  overflow: hidden;
  visibility: hidden;
}
.share {
  display: block;
  font-size: 0.875em;
}
.cell {
  vertical-align: middle;
  font-weight: bold;
}
.cell .lucide {
  display: block;
  margin-inline: auto;
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
