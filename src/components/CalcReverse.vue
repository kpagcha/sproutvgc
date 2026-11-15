<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Check, Info, X } from '@lucide/vue'
import { item, pokemon, type ItemId } from '@/data/dex'
import { percent, type MetaData } from '@/data/meta'
import { STATS } from '@/data/pokemon'
import { locale, t, tSplit } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, type Battlefield, type Fighter } from '@/lib/damage'
import { goalDamage, THRESHOLDS, type GoalBuild, type GoalResult, type GoalRow } from '@/lib/damageGoal'
import {
  reverseDamage,
  type Observation,
  type OpponentUnknowns,
  type ReverseColumn,
  type ReverseResult,
  type ReverseRow,
  type StatRange,
} from '@/lib/damageReverse'
import { runSliced } from '@/lib/slices'
import { MAX_POINTS } from '@/lib/stats'
import { setsAs, type Points } from '@/lib/team'
import ItemIcon from '@/components/ItemIcon.vue'
import SpreadText from '@/components/SpreadText.vue'
import { spreadParts } from '@/components/solverText'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's "What fits": from what was seen (`obs`: the hits and which moved first, `CalcHits`), what
// the opponent's set could then be (`damageReverse.ts`): each stat in play's points where some build fits, how
// likely what was seen was at its sets, and its common spreads against its common items, each pair marked as fitting
// (on what share of the damage rolls) or ruled out; joined by the nearest that fits when none of them does. What's
// worked out of it is the opponent's card's Work out (`work`: its nature, item and points, each given or not; its
// points given, a row per nature it could have at them). A build used (`use`) sets the opponent to what was worked out
// of it, with the item likeliest to go with it. Worked out a slice at a time once the sides have
// settled, what it showed kept, faded, until the new one's in. It's the readout of Hits (in its slot, both picked): a
// sunken tray across that panel's foot, the answer under what it's worked out from. With something of yours worked out
// too (`workYours`, `damageGoal.ts`), two answers side by side: yours, for each of your items the fewest points getting
// what the hits say against half, nine in ten and all of the opponent's sets (or rolls, it being one set), and the most
// it gets, each a build to use (`useYours`); and, something of it worked out, the opponent's common builds against your
// sets.
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  field: Battlefield
  data: MetaData | null
  obs: readonly Observation[]
  work: OpponentUnknowns
  /** What of yours is worked out; null with nothing. */
  workYours: OpponentUnknowns | null
}>()
const emit = defineEmits<{
  use: [build: { nature: string | null; points: Points; item?: ItemId | null }]
  useYours: [build: { nature: string | null; points: Points; item: ItemId | null }]
}>()

const theirId = computed(() => battlerOf(props.theirs))
const theirName = computed(() => (theirId.value ? refName(pokemon(theirId.value)) : ''))
const yourId = computed(() => battlerOf(props.yours))

const result = shallowRef<ReverseResult | null>(null)
const goal = shallowRef<GoalResult | null>(null)
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
    goal.value = null
    progress.value = null
    return
  }
  const entryTheirs = props.data?.[setsAs(props.theirs.member) ?? id] ?? undefined
  const job = props.workYours
    ? goalDamage({
        yours: props.yours,
        theirs: props.theirs,
        field: props.field,
        entryYours: props.data?.[setsAs(props.yours.member) ?? yourId.value] ?? undefined,
        entryTheirs,
        workYours: props.workYours,
        workTheirs: props.work,
        obs: props.obs,
      })
    : reverseDamage({
        yours: props.yours,
        theirs: props.theirs,
        field: props.field,
        entry: entryTheirs,
        work: props.work,
        obs: props.obs,
      })
  const { total } = job
  const steps = job.steps as Generator<unknown, ReverseResult | GoalResult | null>
  progress.value = 0
  clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => (slow.value = true), SLOW_MS)
  stop = runSliced(
    steps,
    total,
    (p) => (progress.value = p),
    (r) => {
      const g = r && 'ours' in r ? r : null
      goal.value = g
      result.value = g ? g.theirs : (r as ReverseResult | null)
      progress.value = null
      clearTimeout(slowTimer)
      slow.value = false
      stop = null
    },
  )
}
watch(() => [props.work, props.workYours, props.obs, props.data] as const, start, { immediate: true })
watchDebounced(() => [props.yours, props.theirs, props.field] as const, start, { debounce: 150 })

/** What's being answered, in a line: the parts of each set worked out, or none (whether what's set fits). */
const partsOf = (w: OpponentUnknowns | null) => {
  const parts = (['nature', 'item', 'points'] as const)
    .filter((k) => w?.[k])
    .map((k) => t(k === 'nature' ? 'builder.nature' : k === 'item' ? 'builder.item' : 'builder.points').toLowerCase())
  return parts.length ? new Intl.ListFormat(locale.value).format(parts) : null
}
const asks = computed(() => {
  const mine = partsOf(props.workYours)
  const theirs = partsOf(props.work)
  if (mine && theirs) return t('calc.reverse.asksBoth', { mine, theirs })
  if (mine) return t('calc.reverse.asksYours', { parts: mine })
  return theirs ? t('calc.reverse.asks', { parts: theirs }) : t('calc.reverse.asksNone')
})
const statName = (s: number) => t(`stat.${STATS[s]!}`)
/** A build's spread in the stats in play, its nature's effect on each (`SpreadText`): "32 HP / 20⏶⏶ Def". */
const spreadOf = (r: { nature: string | null; points: readonly number[] }, stats: readonly number[]) =>
  spreadParts(r.nature, r.points, stats)
/** The widest a spread of those stats is written: every point in each, all but HP marked. Unseen in the table's corner,
 * it keeps the spreads' column as wide from one answer to the next. */
const widestOf = (stats: readonly number[]) =>
  stats.map((s) => ({ n: MAX_POINTS, stat: s, effect: s ? ('up' as const) : ('neutral' as const) }))
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
/** A threshold's label: how often the hits come out as entered ("Half the time with"). */
const thresholdLabel = (th: (typeof THRESHOLDS)[number]) =>
  t(`calc.goal.sets.${th === 0.5 ? '50' : th === 0.9 ? '90' : '100'}` as const)
/** Whether a strip's cell (its `k`th stat in play's) is one of the row's goals' (a threshold's fewest points, or the
 * most's). */
const marked = (r: GoalRow, k: number, p: number) =>
  [...r.cells, r.best].some((c) => c && c.points[goal.value!.ours[k]!] === p)
/**
 * A strip's goals as tags over their cells ("50%", "90%", "Always", "Best"), those at one number of points as one
 * ("50% · 90%"). A tag too near the one before (its cells too few to keep the two apart) goes up a level, so none
 * overlap; `levels` the most there are.
 */
function marksOf(r: GoalRow, k: number) {
  const s = goal.value!.ours[k]!
  const named = [
    ...r.cells.map(
      (c, ci) => c && { c, name: t(`calc.goal.tag.${ci === 0 ? '50' : ci === 1 ? '90' : '100'}` as const) },
    ),
    // The best only short of always: there, the same build.
    r.best && !r.cells.at(-1) && { c: r.best, name: t('calc.goal.tag.best', { pct: percent(r.best.coverage) }) },
  ].filter((x): x is { c: GoalBuild; name: string } => !!x)
  const byP = new Map<number, { p: number; names: string[] }>()
  for (const { c, name } of named) {
    const p = c.points[s]!
    const was = byP.get(p)
    if (was) was.names.push(name)
    else byP.set(p, { p, names: [name] })
  }
  const marks = [...byP.values()].sort((x, y) => x.p - y.p).map((m) => ({ ...m, label: m.names.join(' · '), level: 0 }))
  // Apart by about a tag's width in cells (a phone's strip a few px a cell), else up a level from the one before.
  marks.forEach((m, i) => {
    const prev = marks[i - 1]
    if (prev && prev.level === 0 && m.p - prev.p < 4 + 3 * (prev.names.length - 1)) m.level = 1
  })
  return marks
}
/** Only your item worked out, its points and nature as set: each item's row how often it gives what was entered, the
 * likeliest first, rather than the points it needs. */
const itemOnly = computed(() => !!props.workYours?.item && !props.workYours.points && !props.workYours.nature)
const goalRows = computed(() =>
  !goal.value
    ? []
    : itemOnly.value
      ? [...goal.value.rows].sort((x, y) => (y.best?.coverage ?? 0) - (x.best?.coverage ?? 0))
      : goal.value.rows,
)
/** What the rows say, a sentence before them, naming the opponent. */
/** One row alone: your item as set (its Mega Stone, or one it holds), or none of them changing the hits; then the item
 * has nothing to do with the answer, and goes unsaid. */
const oneRow = computed(() => !itemOnly.value && goalRows.value.length === 1)
const goalNote = computed(() => {
  if (itemOnly.value) return t('calc.goal.noteItemSets')
  const mon = theirName.value
  // With strips (your points worked out), their bars said; else the fewest points alone.
  const strip = goalRows.value.find((r) => r.curves)
  if (!strip) return t(oneRow.value ? 'calc.goal.noteFlat' : 'calc.goal.noteFlatItems', { mon })
  const [s0, s1] = goal.value!.ours.map(statName)
  if (s1) return t(oneRow.value ? 'calc.goal.noteSetsTwo' : 'calc.goal.noteSetsTwoItems', { mon, a: s0!, b: s1 })
  return t(oneRow.value ? 'calc.goal.noteSetsOne' : 'calc.goal.noteSets', { mon, stat: s0! })
})
/** A strip's bar tapped (its row, its strip and points): its chance said under it, with the way to use it, rather
 * than used at once, so a phone, with no tooltips, can read one. One at a time; gone with a new answer. */
const pickedBar = shallowRef<{ ri: number; k: number; p: number } | null>(null)
watch(goal, () => (pickedBar.value = null))
const isPicked = (ri: number, k: number, p: number) =>
  pickedBar.value?.ri === ri && pickedBar.value.k === k && pickedBar.value.p === p
/** The bar picked on a strip, if it's on that one. */
const pickedOn = (ri: number, k: number, curve: GoalBuild[]) =>
  pickedBar.value?.ri === ri && pickedBar.value.k === k ? (curve[pickedBar.value.p] ?? null) : null
function pickBar(ri: number, k: number, p: number) {
  // A drag along the strip just ended on it: picked already, not unpicked by the click that follows.
  if (dragged) return void (dragged = false)
  pickedBar.value = isPicked(ri, k, p) ? null : { ri, k, p }
}
/** Dragged along the strip (a finger can't land on a cell a few px wide), the bar under it picked as it goes. It takes
 * over once it's moved sideways a few px; a tap alone is the cell's click, a vertical move the page's scroll
 * (`touch-action: pan-y`). */
let drag: { ri: number; k: number; x: number; id: number; on: boolean } | null = null
let dragged = false
function stripDown(ri: number, k: number, e: PointerEvent) {
  if (e.button !== 0) return
  dragged = false
  drag = { ri, k, x: e.clientX, id: e.pointerId, on: false }
}
function stripMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const strip = e.currentTarget as HTMLElement
  if (!drag.on) {
    if (Math.abs(e.clientX - drag.x) < 4) return
    drag.on = dragged = true
    strip.setPointerCapture(e.pointerId)
  }
  const r = strip.getBoundingClientRect()
  const p = Math.max(0, Math.min(MAX_POINTS, Math.floor(((e.clientX - r.left) / r.width) * (MAX_POINTS + 1))))
  if (!isPicked(drag.ri, drag.k, p)) pickedBar.value = { ri: drag.ri, k: drag.k, p }
}
function stripUp() {
  // Its click lands on the strip, not a cell, once captured: nothing to swallow then.
  if (drag?.on) setTimeout(() => (dragged = false))
  drag = null
}
const pickedText = computed(() => tSplit('calc.goal.picked', 'build'))
/** An item's row's tooltip: those alike merged into it, and its share of your sets. */
const itemTip = (r: GoalRow) =>
  [
    r.items.length > 1 ? r.items.map(itemName).join(', ') : '',
    r.share ? t('calc.goal.itemTip', { pct: percent(r.share) }) : '',
  ]
    .filter(Boolean)
    .join(' · ') || undefined
const useYours = (b: GoalBuild) => emit('useYours', { nature: b.nature, points: b.points, item: b.item })
const itemName = (id: ItemId | null) => (id ? refName(item(id)) : t('builder.noItem'))
/** A column's tooltip: its items by name, and how often its Pokémon's sets run them. */
const columnTip = (c: ReverseColumn) =>
  [c.items.map(itemName).join(', '), c.share ? t('calc.reverse.itemTip', { pct: percent(c.share) }) : '']
    .filter(Boolean)
    .join(' · ')
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
      <!-- How it works, the method behind every answer, on hover of the ⓘ by the heading, so the lines under it can just
           say what they show. -->
      <h3 class="title">
        {{ t('calc.reverse.title')
        }}<span
          v-tip="goal ? `${t('calc.reverse.how')} ${t('calc.reverse.howYours')}` : t('calc.reverse.how')"
          class="how"
          tabindex="0"
          role="img"
          :aria-label="t('calc.reverse.howLabel')"
          ><Info :size="14" aria-hidden="true"
        /></span>
      </h3>
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
    <!-- What it works out, a choice its page gives it, and what that finds: a rule under them, apart from the answers. -->
    <div class="choice">
      <slot />
      <p class="muted small asks">{{ asks }}</p>
    </div>
    <template v-if="theirId && yourId && obs.length && (result || goal)">
      <div class="body answers" :class="{ stale: slow, two: goal && result }">
        <!-- Yours: for each of your items, the fewest points getting what the hits say against half, nine in ten and all
             of the opponent, and the most it gets; each a build to use. -->
        <div v-if="goal" class="answer yours">
          <h4 class="answer-head"><PokemonIcon :id="yourId!" />{{ t('calc.goal.yoursHead') }}</h4>
          <!-- What its rows say, before them. -->
          <p v-if="!goal.tooMany" class="muted small">{{ goalNote }}</p>
          <p v-if="goal.tooMany" class="warn" role="status">{{ t('calc.goal.tooMany') }}</p>
          <p v-else-if="!goal.rows.some((r) => r.best)" class="warn" role="status">{{ t('calc.goal.never') }}</p>
          <!-- A line per item: what it reaches of the thresholds and the most, each a build to use. -->
          <ul v-else class="goal-list">
            <li v-for="(r, ri) in goalRows" :key="ri" class="goal-row" :class="{ curved: r.curves }">
              <span v-if="!oneRow" class="goal-item">
                <ItemIcon v-if="r.items[0]" :id="r.items[0]" />
                <span v-else class="no-icon" aria-hidden="true"></span>
                <!-- Its share of your sets, and those alike merged into it, on hover. -->
                <span v-tip="itemTip(r)" class="goal-item-name"
                  >{{ itemName(r.items[0] ?? null)
                  }}<template v-if="r.items.length > 1"> +{{ r.items.length - 1 }}</template></span
                >
              </span>
              <!-- Only the item worked out: how likely what was entered is with it, and the way to hold it. -->
              <span v-if="itemOnly" class="goal-picks">
                <span class="goal-chance" :class="{ muted: !r.best }">{{ percent(r.best?.coverage ?? 0) }}</span>
                <button v-if="r.best" type="button" class="btn small pick" @click="useYours(r.best)">
                  {{ t('calc.goal.useItem') }}
                </button>
              </span>
              <span v-else class="goal-main">
                <!-- Your points worked out: a strip per stat of yours in play, a cell per number of its points, none to
                   all, filled to the best chance there (the other stat at its best for it); tapped or slid to, that
                   build said under it with its Use; the goals' outlined. -->
                <span v-for="(curve, k) in r.curves ?? []" :key="k" class="strip-wrap">
                  <!-- Its goals as tags over their cells, so the line under it reads off the strip. -->
                  <span
                    class="ticks"
                    aria-hidden="true"
                    :style="{ '--levels': Math.max(1, ...marksOf(r, k).map((m) => m.level + 1)) }"
                  >
                    <span
                      v-for="m in marksOf(r, k)"
                      :key="m.p"
                      class="tick"
                      :style="{ '--at': (m.p + 0.5) / (MAX_POINTS + 1), '--lv': m.level }"
                      >{{ m.label }}</span
                    >
                  </span>
                  <span
                    class="strip"
                    role="group"
                    :aria-label="t('calc.goal.stripLabel', { stat: statName(goal.ours[k]!) })"
                    @pointerdown="stripDown(ri, k, $event)"
                    @pointermove="stripMove"
                    @pointerup="stripUp"
                    @pointercancel="stripUp"
                  >
                    <button
                      v-for="(c, p) in curve"
                      :key="p"
                      type="button"
                      class="strip-cell"
                      :class="{ mark: marked(r, k, p), picked: isPicked(ri, k, p) }"
                      :style="{ '--cov': `${Math.round(c.coverage * 100)}%` }"
                      :aria-label="t('calc.goal.stripTip', { n: p, pct: percent(c.coverage) })"
                      :aria-pressed="isPicked(ri, k, p)"
                      @click="pickBar(ri, k, p)"
                    ></button>
                  </span>
                  <span class="strip-ends muted"
                    ><span>0</span><span>{{ statName(goal.ours[k]!) }}</span
                    ><span>{{ MAX_POINTS }}</span></span
                  >
                  <!-- The bar tapped: its chance, and the way to set yours to it. -->
                  <span v-if="pickedOn(ri, k, curve)" class="picked-line" role="status"
                    >{{ pickedText[0] }}<SpreadText :parts="spreadOf(pickedOn(ri, k, curve)!, goal.ours)" />{{
                      pickedText[1].replace('{pct}', percent(pickedOn(ri, k, curve)!.coverage))
                    }}
                    <button
                      v-tip="t('calc.goal.useTip', { pct: percent(pickedOn(ri, k, curve)!.coverage) })"
                      type="button"
                      class="btn small pick"
                      @click="useYours(pickedOn(ri, k, curve)!)"
                    >
                      {{ t('calc.reverse.use') }}
                    </button></span
                  >
                </span>
                <span class="goal-picks" :class="{ curved: r.curves }">
                  <template v-for="(c, ci) in r.cells" :key="ci">
                    <span v-if="c" class="goal-pick">
                      <span class="muted">{{ thresholdLabel(THRESHOLDS[ci]!) }}</span>
                      <button
                        v-tip="t('calc.goal.useTip', { pct: percent(c.coverage) })"
                        type="button"
                        class="btn small pick"
                        @click="useYours(c)"
                      >
                        <SpreadText :parts="spreadOf(c, goal.ours)" />
                      </button>
                    </span>
                  </template>
                  <span v-if="r.best && !r.cells.at(-1)" class="goal-pick">
                    <span class="muted">{{ t('calc.goal.mostAt', { pct: percent(r.best.coverage) }) }}</span>
                    <button
                      v-tip="t('calc.goal.useTip', { pct: percent(r.best.coverage) })"
                      type="button"
                      class="btn small pick"
                      @click="useYours(r.best)"
                    >
                      <SpreadText :parts="spreadOf(r.best, goal.ours)" />
                    </button>
                  </span>
                  <span v-else-if="!r.best" class="muted">{{ t('calc.goal.none') }}</span>
                </span>
              </span>
            </li>
          </ul>
        </div>
        <div v-if="result" class="answer theirs">
          <h4 v-if="goal" class="answer-head"><PokemonIcon :id="theirId!" />{{ t('calc.goal.theirsHead') }}</h4>
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
                      mon: theirName,
                    })
                  : t('calc.reverse.noneRun', { mon: theirName })
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
                    <SpreadText class="spread sizer" aria-hidden="true" :parts="widestOf(result.stats)" />
                  </th>
                  <th v-for="(c, ci) in result.columns" :key="ci" scope="col" class="col">
                    <span v-if="!result.itemsVary || result.columns.length === 1" class="muted">{{
                      t('calc.reverse.fits')
                    }}</span>
                    <!-- Its items' icons alone, three or more alike its most common's and how many more; what they
                         are and how often they're run on hover (a tap on phones), so no number here reads as how
                         likely what was entered is. -->
                    <span v-else v-tip="columnTip(c)" class="items" role="img" tabindex="0" :aria-label="columnTip(c)">
                      <template v-for="it in c.items.length > 2 ? c.items.slice(0, 1) : c.items" :key="it ?? '-'">
                        <span v-if="it" class="item"><ItemIcon :id="it" /></span>
                        <span v-else class="muted no-item">{{ itemName(null) }}</span>
                      </template>
                      <span v-if="c.items.length > 2" class="more-items">+{{ c.items.length - 1 }}</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, ri) in result.rows" :key="ri">
                  <th scope="row">
                    <SpreadText class="spread" :parts="spreadOf(r, result.stats)" />
                    <!-- Its share, and the way to set the opponent to it. -->
                    <span class="row-foot">
                      <span v-if="r.share" v-tip="t('calc.reverse.shareTip')" class="muted">{{
                        percent(r.share)
                      }}</span>
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
                    v-tip="
                      f > 0 ? (goal ? t('calc.goal.theirTip', { pct: percent(f) }) : fitTip(f)) : t('reverse.fit.no')
                    "
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
          <p v-if="!goal" class="muted small">{{ t('calc.reverse.note') }}</p>
        </div>
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 0 0;
  font-size: 1em;
}
.how {
  display: inline-flex;
  color: var(--muted);
  cursor: help;
}
.how:hover,
.how:focus-visible {
  color: var(--text);
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
  margin: 10px 0 0;
}
.choice {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
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
.body > p,
.answer > p {
  margin: 0;
}
/* Two answers, yours over the opponent's, each headed by whose it is, a rule between them. */
.answers.two {
  gap: 16px;
}
.answers.two > .answer + .answer {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.answer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.answer-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.95em;
}
/* Yours: a line per item, its name and share, then what it reaches, each a label over its build, wrapping. */
/* One grid for all of them, each row its subgrid: the items' column as wide as the widest, so what follows lines up. */
.goal-list {
  display: grid;
  grid-template-columns: minmax(9em, max-content) minmax(0, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
}
.goal-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  gap: 4px 16px;
  padding: 8px 0;
}
.goal-row + .goal-row {
  border-top: 1px solid var(--border);
}
.goal-chance {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.goal-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}
/* With the strip, the item level with it, its top line, rather than the middle of the strip and the picks under it. */
.goal-row.curved {
  align-items: start;
}
.no-icon {
  width: 24px;
  height: 24px;
}
.goal-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
/* The strip: a cell per point, none to all, filled with the fits' green as far as it gets the opponent. */
.strip-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* A second strip (two of your stats in play) set apart from the first's line under it. */
.strip-wrap + .strip-wrap {
  margin-top: 10px;
}
.strip {
  position: relative;
  display: grid;
  grid-template-columns: repeat(33, minmax(0, 1fr));
  height: 40px;
  border: 1px solid var(--border);
  /* Dragged sideways, the bars picked in turn; vertically, the page scrolls. */
  touch-action: pan-y;
  user-select: none;
}
/* Each cell a bar filled up to its chance, so the chance is seen rising with the points. */
.strip-cell {
  min-width: 0;
  padding: 0;
  background: linear-gradient(to top, var(--m2-bg) var(--cov), var(--panel-alt) var(--cov));
  border: 0;
  cursor: pointer;
}
.strip-cell + .strip-cell {
  border-left: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}
/* Faint lines across at 50% and 90%, so a tag's bar is seen as the first to cross its line. */
.strip::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(to top, transparent calc(50% - 1px), var(--guide) calc(50% - 1px) 50%, transparent 50%),
    linear-gradient(to top, transparent calc(90% - 1px), var(--guide) calc(90% - 1px) 90%, transparent 90%);
  --guide: color-mix(in srgb, var(--text) 35%, transparent);
}
/* Picked, hovered or focused: an outline around the cell, over its neighbours, so a goal's mark inside it stays whole,
   the two nested rather than drawn over each other. */
.strip-cell.picked {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--ink);
}
.picked-line {
  display: block;
  margin-top: 4px;
  font-size: 0.875em;
}
.picked-line .pick {
  margin-left: 8px;
}
/* Hover only where there's a pointer that hovers: a tap's would stay on the cell once it's unpicked. */
@media (hover: hover) {
  .strip-cell:hover {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--ink);
  }
}
.strip-cell:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--ink);
}
.strip-cell.mark {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.strip-ends {
  display: flex;
  justify-content: space-between;
  font-size: 0.75em;
}
/* Its goals' tags over the strip, each over its cell: its place along the strip both where it's anchored and how far
   it's shifted back by its own width, so the first is flush left, the last flush right, and none past the edges; a tag
   too near the one before a level up. A tick under each down to its cell. */
.ticks {
  position: relative;
  height: calc(var(--levels) * 1.5em);
  font-size: 0.75em;
}
.tick {
  position: absolute;
  bottom: calc(var(--lv) * 1.5em);
  left: calc(var(--at) * 100%);
  padding-bottom: 4px;
  line-height: 1.2;
  font-weight: bold;
  white-space: nowrap;
  color: var(--accent);
  transform: translateX(calc(var(--at) * -100%));
}
@media (max-width: 720px) {
  /* Phones: the picks under the strip a line each, what it gets beside the build that gets it. */
  .goal-picks.curved {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 6px 10px;
  }
  .goal-picks.curved .goal-pick {
    display: contents;
  }
  .goal-picks.curved .pick {
    justify-self: start;
  }
}
.goal-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  font-size: 0.875em;
}
.goal-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pick {
  min-height: 0;
  padding: 1px 8px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 720px) {
  .goal-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
.small {
  font-size: 0.85em;
}
/* In the bad color alone: bold, it shifts what's around it as it comes and goes. */
.warn {
  color: var(--bad);
}
.stale {
  opacity: 0.5;
  transition: opacity 0.15s;
}
/* Its points where they're bound, after its icon. */
.lines {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}
.line {
  white-space: nowrap;
}
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
}
/* Its left column stuck as it scrolls sideways: borders drawn per cell (collapsed ones would scroll away from it), its
   cells opaque over those passing under them. */
.builds {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875em;
}
.builds th,
.builds td {
  padding: 4px 8px;
  border: 0 solid var(--border);
  border-right-width: 1px;
  border-bottom-width: 1px;
}
.builds thead th {
  border-top-width: 1px;
}
.builds tr > :first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--panel);
  border-left-width: 1px;
}
.builds th {
  font-weight: normal;
  white-space: nowrap;
  text-align: left;
}
/* A spread's cell as wide whatever its row ends with (its share, "Nearest fit"). */
.builds tbody th {
  min-width: 10.5em;
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
  cursor: help;
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
