<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Check, X } from '@lucide/vue'
import { item, type ItemId, type MoveId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { natureEffectOn } from '@/data/natures'
import { STATS } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, damaging, type Battlefield, type Fighter } from '@/lib/damage'
import {
  reverseDamage,
  type Observation,
  type ReverseResult,
  type ReverseRow,
  type StatRange,
} from '@/lib/damageReverse'
import { runSliced } from '@/lib/slices'
import { MAX_POINTS } from '@/lib/stats'
import { setsAs } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The damage calculator read backwards ("What fits"): what its moves' rows say each was seen to do (the sides' `saw`),
// and what the opponent's set could then be (`damageReverse.ts`): each stat in play's points where some build fits, how
// likely what was seen was at its sets, and its common spreads against its common items, each pair marked as fitting
// (on what share of the damage rolls) or ruled out; joined by the nearest that fits when none of them does. At its team
// sheet (`sheet`, shared with the threats), its item and nature as set, only its points varying. Which of the two moved
// first (`first`, the page's `?first=`) narrows its Speed in the same spread, within the same 66 points. Worked out a slice at
// a time once the sides have settled, what it showed kept, faded, until the new one's in.
const props = defineProps<{ yours: Fighter; theirs: Fighter; field: Battlefield; data: MetaData | null }>()
const sheet = defineModel<boolean>('sheet', { default: false })
/** Which was seen moving first, with moves of the same priority; tapped again, not seen. */
const first = defineModel<'a' | 'b' | null>('first', { default: null })

const theirId = computed(() => battlerOf(props.theirs))
const yourId = computed(() => battlerOf(props.yours))

/** What was seen, from both sides' rows: yours' hitting the opponent, its hitting yours. */
const obs = computed<Observation[]>(() => [
  ...(first.value ? [{ by: 'speed' as const, first: first.value }] : []),
  ...(['a', 'b'] as const).flatMap((by) => {
    const f = by === 'a' ? props.yours : props.theirs
    return f.member.moves
      .filter((mv, i, all): mv is MoveId => damaging(mv) && all.indexOf(mv) === i)
      .flatMap((mv) => {
        const saw = f.saw?.[mv]
        return saw ? [{ by, move: mv, saw, opts: f.hitOpts?.[mv] }] : []
      })
  }),
])

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
  if (!id || !yourId.value || !obs.value.length) {
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
    obs: obs.value,
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
watch(() => [sheet.value, first.value, props.data] as const, start, { immediate: true })
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
        v-tip="t('calc.threats.sheetTip')"
        type="button"
        class="btn switch sheet"
        :class="{ on: sheet }"
        :aria-pressed="sheet"
        @click="sheet = !sheet"
      >
        {{ t('calc.threats.sheet') }}
      </button>
      <span class="muted at">{{ sheet ? t('calc.threats.atSheet') : t('calc.reverse.atSets') }}</span>
    </div>
    <p v-if="!theirId || !yourId" class="muted intro">{{ t('calc.threats.pickBoth') }}</p>
    <!-- Which moved first, the two as their icons: its Speed narrowed in the same spread. -->
    <div v-else class="first" role="group" :aria-label="t('calc.reverse.first')">
      <span v-tip="t('calc.reverse.firstTip')" class="muted about" tabindex="0">{{ t('calc.reverse.first') }}</span>
      <button
        v-for="k in ['a', 'b'] as const"
        :key="k"
        v-tip="k === 'a' ? t('calc.yours') : t('calc.theirs')"
        type="button"
        class="btn choice"
        :class="[k === 'a' ? 'yours' : 'opponent', { on: first === k }]"
        :aria-pressed="first === k"
        :aria-label="k === 'a' ? t('calc.yours') : t('calc.theirs')"
        @click="first = first === k ? null : k"
      >
        <PokemonIcon :id="k === 'a' ? yourId : theirId" />
      </button>
    </div>
    <p v-if="theirId && yourId && !obs.length" class="muted intro">{{ t('calc.reverse.hint') }}</p>
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
                <th v-for="(c, ci) in result.columns" :key="ci" scope="col" class="col">
                  <span v-if="!result.itemsVary || result.columns.length === 1" class="muted">{{
                    t('calc.reverse.fits')
                  }}</span>
                  <template v-else>
                    <span class="items">
                      <template v-for="it in c.items" :key="it ?? '-'">
                        <span v-if="it" v-tip="itemName(it)" class="item" role="img" :aria-label="itemName(it)"
                          ><ItemIcon :id="it"
                        /></span>
                        <span v-else class="muted no-item">{{ itemName(null) }}</span>
                      </template>
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
                  <span v-if="r.share" v-tip="t('calc.reverse.shareTip')" class="muted share">{{
                    percent(r.share)
                  }}</span>
                  <span v-else-if="r.nearest" class="muted share">{{ t('calc.reverse.nearest') }}</span>
                  <span v-else class="muted share">{{ t('calc.reverse.ownSet') }}</span>
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
/* Which moved first: the two's icons, the one picked in its side's color. */
.first {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 0.875em;
}
.about {
  margin-right: 4px;
  text-decoration: underline dotted;
  text-underline-offset: 4px;
  cursor: help;
}
.choice {
  min-height: 0;
  padding: 0 6px;
}
.choice.on.yours {
  background: var(--accent);
}
.choice.on.opponent {
  background: var(--opponent);
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
.items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  max-width: 120px;
}
.item {
  display: inline-flex;
}
.no-item {
  font-size: 0.875em;
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
