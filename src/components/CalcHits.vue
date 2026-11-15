<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChevronDown, Crosshair, Plus, Trash2, Zap } from '@lucide/vue'
import { move, type MoveId } from '@/data/dex'
import { isSpread, MOVES } from '@/data/moves'
import { loadLearnsets, movesOf as learnsetOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, damaging, statsOf, type Fighter, type HitOptions } from '@/lib/damage'
import type { Saw } from '@/lib/damageReverse'
import HpBar from '@/components/HpBar.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's "What you saw": the hits seen, in the order entered, each a row: who hit whom (yours the
// opponent, or the opponent yours), the move (one of the attacker's), whether it was a critical hit or, for a spread
// move, hit one target alone, what it did (the opponent's HP lost in whole percent, as the game shows it, or yours' in
// HP; or a knockout, survived, or a knockout on the second hit) and the defender's HP before it (full unless said: the
// opponent's in percent, yours' in HP); the same move as often as it was seen. Then which of the two moved first, with
// moves of the same priority. A row with no result yet counts for nothing (and isn't kept in the URL). Adding a hit
// and which moved first lead, over the hits; with none yet, a line saying what to add. Shown once both are picked.
export interface HitDraft {
  by: 'a' | 'b'
  move: MoveId | null
  saw: Saw | null
  before?: number
  opts?: HitOptions
  /** Its number a goal, that or better for yours (`Saw`'s `bound`), kept while it has none or an outcome instead. */
  bound?: boolean
}
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  /** Something of yours is worked out: a hit added then has its number as a goal at first. */
  goal?: boolean
}>()
const emit = defineEmits<{ pickMove: [i: number]; next: []; added: [] }>()
const hits = defineModel<HitDraft[]>('hits', { required: true })
const first = defineModel<'a' | 'b' | null>('first', { default: null })

const ids = computed(() => ({ a: battlerOf(props.yours), b: battlerOf(props.theirs) }))
const sideOf = (k: 'a' | 'b') => (k === 'a' ? props.yours : props.theirs)
const name = (k: 'a' | 'b') => t(k === 'a' ? 'calc.yours' : 'calc.theirs')
/** The attacker's damaging moves, from its set. */
const movesOf = (k: 'a' | 'b') =>
  sideOf(k).member.moves.filter((mv, i, all): mv is MoveId => damaging(mv) && all.indexOf(mv) === i)
// Every damaging move each learns, so a hit's move needn't be in its set (one or two entered, or none): its set's
// first, then the rest by name.
const learnsets = shallowRef<Awaited<ReturnType<typeof loadLearnsets>> | null>(null)
void loadLearnsets().then((l) => (learnsets.value = l))
const othersOf = computed(() => {
  const of = (k: 'a' | 'b') => {
    const id = ids.value[k]
    if (!id || !learnsets.value) return []
    const set = new Set(movesOf(k))
    return learnsetOf(learnsets.value, id)
      .filter((mv) => damaging(mv) && !set.has(mv))
      .map((mv) => ({ mv, name: refName(move(mv)) }))
      .sort((x, y) => x.name.localeCompare(y.name))
  }
  return { a: of('a'), b: of('b') }
})
/** A move to start a hit with: its set's first, else none (picked from the list). */
const canAdd = (k: 'a' | 'b') => !!movesOf(k).length || !!othersOf.value[k].length
const yourMaxHp = computed(() => statsOf(props.yours)?.hp ?? 0)

const patch = (i: number, p: Partial<HitDraft>) =>
  (hits.value = hits.value.map((h, j) => (j === i ? { ...h, ...p } : h)))
const remove = (i: number) => (hits.value = hits.value.filter((_, j) => j !== i))
/** A hit added: its defender's HP before it where the last hit on it left it (its HP before less what it lost), else
 * full (none before, a KO, or only Survived or 2 hits known). */
function add(by: 'a' | 'b') {
  const last = hits.value.filter((h) => h.by === by).at(-1)
  const lost = last?.saw && 'n' in last.saw ? last.saw.n : null
  const left = last && lost !== null ? (last.before ?? maxOf(last)) - lost : null
  const before = left !== null && left > 0 && left < maxOf(last!) ? left : undefined
  hits.value = [
    ...hits.value,
    { by, move: movesOf(by)[0] ?? null, saw: null, ...(before && { before }), ...(props.goal && { bound: true }) },
  ]
  emit('added')
}
function setOpt(i: number, key: 'crit' | 'single', on: boolean) {
  const opts = { ...hits.value[i]!.opts, [key]: on || undefined }
  patch(i, { opts: Object.values(opts).some(Boolean) ? opts : undefined })
}
/** The number typed: the opponent's HP lost in percent, or yours' in HP; cleared, no result. */
function typed(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const h = hits.value[i]!
  if (el.value === '') return patch(i, { saw: null })
  const v = Math.round(Number(el.value))
  if (!Number.isFinite(v)) return
  const max = h.by === 'a' ? 100 : yourMaxHp.value || 9999
  patch(i, { saw: numberSaw(h, Math.min(max, Math.max(0, v))) })
}
/** A number it did: the opponent's percent or yours' HP, a goal while the hit's is. */
const numberSaw = (h: HitDraft, n: number): Saw => ({
  kind: h.by === 'a' ? 'pct' : 'hp',
  n,
  ...(h.bound && { bound: true }),
})
/** Its number a goal or what was seen, toggled; its number following. */
function toggleBound(i: number) {
  const h = hits.value[i]!
  const bound = !h.bound
  const saw = h.saw && 'n' in h.saw ? numberSaw({ ...h, bound }, h.saw.n) : h.saw
  patch(i, { bound: bound || undefined, saw })
}
/** The defender's HP before it; cleared or full, full. */
function typedBefore(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const h = hits.value[i]!
  const max = h.by === 'a' ? 100 : yourMaxHp.value
  const v = Math.round(Number(el.value))
  if (el.value === '' || !Number.isFinite(v) || v >= max) {
    el.value = String(max)
    return patch(i, { before: undefined })
  }
  patch(i, { before: Math.max(1, v) })
}
/** The defender's HP out of: the opponent's in whole percent, so out of 100; yours' in HP. */
const maxOf = (h: HitDraft) => (h.by === 'a' ? 100 : yourMaxHp.value || 1)
/** Its HP before it, in percent, for the bar. */
const beforePct = (h: HitDraft) => ((h.before ?? maxOf(h)) / maxOf(h)) * 100
/** The bar moved: its HP points (whole percent, or yours' HP), full as none set. */
function slid(i: number, pct: number) {
  const max = maxOf(hits.value[i]!)
  const pts = Math.max(1, Math.round((max * pct) / 100))
  patch(i, { before: pts >= max ? undefined : pts })
}
/** Stepped by one (with Shift, a tenth of its HP): the HP lost, from none set starting at the step up. */
function stepLost(i: number, d: 1 | -1, e: MouseEvent) {
  const h = hits.value[i]!
  const max = h.by === 'a' ? 100 : yourMaxHp.value || 9999
  const by = e.shiftKey ? Math.max(1, Math.round(max / 10)) : 1
  const now = h.saw && 'n' in h.saw ? h.saw.n : null
  if (now === null && d < 0) return
  const n = Math.min(max, Math.max(0, (now ?? 0) + d * by))
  patch(i, { saw: numberSaw(h, n) })
}
const lostMax = (h: HitDraft) => (h.by === 'a' ? 100 : yourMaxHp.value || 9999)
const OUTCOMES = ['ko', 'lived', 'two'] as const
const outcome = (i: number, k: (typeof OUTCOMES)[number]) =>
  patch(i, { saw: hits.value[i]!.saw?.kind === k ? null : { kind: k } })
const numberOf = (h: HitDraft) => (h.saw && 'n' in h.saw ? h.saw.n : '')
/** A hit with its move and what it did, or which moved first: something to work out from. */
const said = computed(() => !!first.value || hits.value.some((h) => h.move && h.saw))
const spread = (mv: MoveId | null) => !!mv && !!MOVES[mv] && isSpread(MOVES[mv])
</script>

<template>
  <section class="hits panel banded">
    <h2 class="band">{{ t('calc.hits.title') }}</h2>
    <div class="controls">
      <!-- A hit added, yours on the opponent or its on yours. -->
      <span class="adds" :class="{ needed: !hits.length }">
        <button
          v-for="k in ['a', 'b'] as const"
          :key="k"
          type="button"
          class="btn add"
          :class="k === 'a' ? 'yours' : 'opponent'"
          :disabled="!canAdd(k)"
          @click="add(k)"
        >
          <Plus :size="14" aria-hidden="true" /><PokemonIcon :id="ids[k]!" />→<PokemonIcon
            :id="ids[k === 'a' ? 'b' : 'a']!"
          /><span>{{ t(k === 'a' ? 'calc.hits.addYours' : 'calc.hits.addTheirs') }}</span>
        </button>
      </span>
      <!-- Which moved first, the two as their icons; tapped again, not seen. -->
      <span class="first" role="group" :aria-label="t('calc.reverse.first')">
        <span v-tip="t('calc.reverse.firstTip')" class="muted about" tabindex="0">{{ t('calc.reverse.first') }}</span>
        <button
          v-for="k in ['a', 'b'] as const"
          :key="k"
          v-tip="name(k)"
          type="button"
          class="btn choice"
          :class="[k === 'a' ? 'yours' : 'opponent', { on: first === k }]"
          :aria-pressed="first === k"
          :aria-label="name(k)"
          @click="first = first === k ? null : k"
        >
          <PokemonIcon :id="ids[k]!" />
        </button>
      </span>
    </div>
    <ol v-if="hits.length" class="hit-list">
      <li v-for="(h, i) in hits" :key="i" class="hit" :class="h.by === 'a' ? 'yours' : 'opponent'">
        <!-- Who hit whom, as their icons. -->
        <span
          class="who"
          role="img"
          :aria-label="t('calc.hits.who', { from: name(h.by), to: name(h.by === 'a' ? 'b' : 'a') })"
        >
          <PokemonIcon :id="ids[h.by]!" />→<PokemonIcon :id="ids[h.by === 'a' ? 'b' : 'a']!" />
        </span>
        <!-- Its move: a field opening the drawer's move list, searched and filtered as the team builder's. -->
        <button
          type="button"
          class="move"
          :class="{ empty: !h.move, needed: !h.move }"
          :aria-label="`${t('calc.hits.move')}: ${h.move ? refName(move(h.move)) : t('calc.pickMove')}`"
          @click="emit('pickMove', i)"
        >
          <span class="move-name">{{ h.move ? refName(move(h.move)) : t('calc.pickMove') }}</span>
          <ChevronDown :size="16" class="caret" aria-hidden="true" />
        </button>
        <span class="mods">
          <button
            v-tip="t('calc.crit')"
            type="button"
            class="btn mod"
            :class="{ on: h.opts?.crit }"
            :aria-pressed="!!h.opts?.crit"
            :aria-label="t('calc.crit')"
            @click="setOpt(i, 'crit', !h.opts?.crit)"
          >
            <Zap :size="14" aria-hidden="true" />
          </button>
          <button
            v-if="spread(h.move)"
            v-tip="t('calc.singleTip')"
            type="button"
            class="btn mod"
            :class="{ on: h.opts?.single }"
            :aria-pressed="!!h.opts?.single"
            :aria-label="t('calc.single')"
            @click="setOpt(i, 'single', !h.opts?.single)"
          >
            <Crosshair :size="14" aria-hidden="true" />
          </button>
        </span>
        <!-- What it did: a number, or one of the outcomes, either clearing the other; one group of joined choices, the one
             picked lit. Until one is, its outline pulses, softly, in the warning's color. -->
        <span class="saw" :class="{ needed: !h.saw }">
          <span class="choices" role="group" :aria-label="t('calc.hits.saw')">
            <span class="seg num" :class="{ on: !!h.saw && 'n' in h.saw }">
              <!-- Exactly as seen, or a goal: at least that lost from the opponent, at most from yours. -->
              <button
                v-tip="t(h.bound ? `calc.hits.bound.${h.by}` : `calc.hits.exact.${h.by}`)"
                type="button"
                class="bound"
                :class="{ lit: h.bound }"
                :aria-pressed="!!h.bound"
                :aria-label="t(`calc.hits.bound.${h.by}`)"
                @click="toggleBound(i)"
              >
                {{ h.by === 'a' ? '≥' : '≤' }}
              </button>
              <button
                type="button"
                class="step"
                tabindex="-1"
                :disabled="numberOf(h) === '' || numberOf(h) === 0"
                :aria-label="t('calc.hits.less')"
                @click="stepLost(i, -1, $event)"
              >
                −
              </button>
              <input
                class="num-in"
                type="number"
                inputmode="numeric"
                min="0"
                :max="lostMax(h)"
                :value="numberOf(h)"
                placeholder="–"
                :aria-label="t(h.by === 'a' ? 'calc.hits.pctLost' : 'calc.hits.hpLost')"
                @input="typed(i, $event)"
              />
              <button
                type="button"
                class="step"
                tabindex="-1"
                :disabled="numberOf(h) === lostMax(h)"
                :aria-label="t('calc.hits.more')"
                @click="stepLost(i, 1, $event)"
              >
                +
              </button>
              <span class="unit">{{ t(h.by === 'a' ? 'calc.hits.unit.pct' : 'calc.hits.unit.hp') }}</span>
            </span>
            <button
              v-for="k in OUTCOMES"
              :key="k"
              type="button"
              class="seg"
              :class="{ on: h.saw?.kind === k }"
              :aria-pressed="h.saw?.kind === k"
              @click="outcome(i, k)"
            >
              {{ t(`calc.hits.outcome.${k}`) }}
            </button>
          </span>
        </span>
        <!-- The defender's HP before it: full unless said. -->
        <span class="before">
          <span class="muted">{{ t('calc.hits.from') }}</span>
          <!-- The calc's HP bar, compact: the opponent's by whole percent (as the game shows it), yours' by HP. -->
          <HpBar
            :model-value="beforePct(h)"
            :max="maxOf(h)"
            :label="t(h.by === 'a' ? 'calc.hits.beforePct' : 'calc.hits.beforeHp')"
            compact
            class="before-bar"
            @update:model-value="slid(i, $event)"
          />
          <input
            class="num-in"
            type="number"
            inputmode="numeric"
            min="1"
            :max="maxOf(h)"
            :value="h.before ?? maxOf(h)"
            :aria-label="t(h.by === 'a' ? 'calc.hits.beforePct' : 'calc.hits.beforeHp')"
            @change="typedBefore(i, $event)"
          />
          <span class="muted">{{ h.by === 'a' ? '%' : t('calc.hits.unit.hpOf', { max: yourMaxHp }) }}</span>
          <!-- In the HP's group, so it never wraps onto a line of its own. -->
          <button type="button" class="remove" :aria-label="t('calc.hits.remove')" @click="remove(i)">
            <Trash2 :size="16" aria-hidden="true" />
          </button>
        </span>
      </li>
    </ol>
    <!-- Nothing said yet, in the warning's color as the controls pulsing for it; else on to what to work out. -->
    <p v-if="!said" class="needs" role="status">
      {{ t(hits.length ? 'calc.hits.needsParts' : 'calc.hits.needs') }}
    </p>
    <p v-else class="next">
      <span class="muted">{{ t('calc.hits.another') }}</span
      ><button type="button" class="btn primary small" @click="emit('next')">{{ t('calc.hits.next') }} →</button>
    </p>
  </section>
</template>

<style scoped>
/* Its buttons soft, as many as there are: a thin outline, no hard shadow nor lift; one on filled, outlined in ink. */
:root:root .hits .btn:not(.primary) {
  border-width: 1px;
  border-color: var(--border);
  box-shadow: none;
  font-weight: normal;
}
:root:root .hits .btn:not(.primary):hover:not(:disabled) {
  transform: none;
  box-shadow: none;
  border-color: var(--ink);
}
:root:root .hits .btn:not(.primary):active:not(:disabled) {
  transform: none;
  background: color-mix(in srgb, var(--text) 10%, var(--panel));
}
:root:root .hits .btn.on {
  border-color: var(--ink);
}
:root:root .hits .add.yours {
  border-left: 3px solid var(--accent);
}
:root:root .hits .add.opponent {
  border-left: 3px solid var(--opponent);
}
.hits {
  margin: 0;
}
.needs {
  margin: 12px 0 0;
  font-size: 0.875em;
  color: color-mix(in srgb, var(--warn) 65%, var(--muted));
}
/* No hit yet: the ways to add one outlined in the warning's color, pulsing softly, as a hit's missing result is. */
.adds.needed .add {
  outline: 2px dashed var(--warn);
  outline-offset: 2px;
  animation: wanted 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .adds.needed .add {
    animation: none;
  }
}
.next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 10px;
  margin: 12px 0 0;
  font-size: 0.875em;
}
/* Its button in the line's words, as large. */
:root:root .next .btn {
  font-size: inherit;
}
.hit-list {
  display: flex;
  flex-direction: column;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
/* A hit: its parts on one line where they fit, edged in the attacker's color. */
.hit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 0 8px 8px;
  font-size: 0.9em;
  border-left: 4px solid var(--accent);
  border-bottom: 1px solid var(--border);
}
.hit.opponent {
  border-left-color: var(--opponent);
}
.who {
  display: inline-flex;
  align-items: center;
  color: var(--muted);
}
/* Its move, drawn as a field: its type and name, an arrow at its end; none yet, what it asks for, muted. */
.move {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 12em;
  max-width: 100%;
  padding: 3px 6px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--panel);
  border: 1px solid var(--border-strong, var(--border));
  cursor: pointer;
}
.move:hover,
.move:focus-visible {
  background: var(--panel-alt);
}
.move.empty {
  color: var(--muted);
}
/* No move yet: outlined in the warning's color, pulsing softly, as a missing result is; a hit needs both. */
.move.needed {
  outline: 2px dashed var(--warn);
  outline-offset: 2px;
  animation: wanted 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .move.needed {
    animation: none;
  }
}
.move-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.move .caret {
  flex: none;
  color: var(--muted);
}
.mods,
.saw,
.before {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* The HP before it: the bar taking the room the row has left. */
.before {
  flex: 1 1 220px;
  min-width: 0;
}
.before-bar {
  flex: 1;
  min-width: 90px;
}
/* What it did: its choices joined, the one picked lit in the selection's color, its border ink; none picked, a dashed
   outline in the warning's color pulsing softly, so it's clear it's wanted. Picked or not, the same weight, nothing
   shifting. */
.saw {
  flex-wrap: wrap;
}
.choices {
  display: inline-flex;
  align-items: stretch;
  outline: 2px dashed transparent;
  outline-offset: 2px;
}
.saw.needed .choices {
  outline-color: var(--warn);
  animation: wanted 1.6s ease-in-out infinite;
}
@keyframes wanted {
  50% {
    outline-color: color-mix(in srgb, var(--warn) 25%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .saw.needed .choices {
    animation: none;
  }
}
.seg {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: var(--panel);
  border: 1px solid var(--border);
  cursor: pointer;
}
.seg + .seg {
  margin-left: -1px;
}
button.seg:hover {
  z-index: 1;
  border-color: var(--ink);
}
.seg.on {
  z-index: 2;
  background: var(--sel);
  border-color: var(--ink);
}
/* The number: its box, steps either side, and its unit, one choice of the group, lit once a number's in. */
.seg.num {
  padding: 2px 6px 2px 2px;
  cursor: default;
}
/* Its box no box of its own within the group's, the group's lines being enough: a field's wash and an underline
   under the number, between its steps, so it reads as one to type in; a dash in it while empty. */
:root:root .seg.num .num-in {
  width: 2.8em;
  padding: 1px 4px 0;
  border: 0;
  border-bottom: 2px solid var(--muted);
  outline-offset: 0;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
  box-shadow: none;
  text-align: center;
}
:root:root .seg.num .num-in:focus {
  border-bottom-color: var(--accent);
}
.num-in::placeholder {
  color: var(--muted);
}
.unit {
  color: var(--muted);
}
.seg.on .unit {
  color: inherit;
}
/* Its number a goal or exact: a sign, faint until on, then in the accent, bold. */
.bound {
  flex: none;
  width: 18px;
  padding: 0;
  font: inherit;
  font-weight: bold;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: 0;
  opacity: 0.55;
  cursor: pointer;
}
.bound:hover,
.bound:focus-visible {
  opacity: 1;
}
.bound.lit {
  color: var(--accent);
  opacity: 1;
}
/* As the HP bar's steps beside it, compact. */
.step {
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  font: inherit;
  font-size: 0.85em;
  font-weight: bold;
  line-height: 1;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.step:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (pointer: coarse) {
  .step {
    width: 24px;
    height: 24px;
  }
}
.mod {
  min-height: 0;
  gap: 4px;
  padding: 2px 8px;
  line-height: inherit;
}
.mod.on {
  background: var(--sel);
}
.num-in {
  width: 3.6em;
  padding: 2px 6px;
  font: inherit;
  text-align: right;
  appearance: textfield;
  -moz-appearance: textfield;
}
.num-in::-webkit-inner-spin-button,
.num-in::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}
/* Taking a hit off: destructive, in the bad color, as the side's Clear is, a wash of it when pointed at. */
.remove {
  display: inline-flex;
  margin-left: auto;
  padding: 4px;
  color: var(--bad);
  background: none;
  border: 0;
  cursor: pointer;
}
.remove:hover,
.remove:focus-visible {
  background: color-mix(in srgb, var(--bad) 14%, var(--panel));
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}
.adds,
.first {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.add {
  gap: 2px;
  font-size: 0.875em;
}
.add > span {
  margin-left: 4px;
}
.first {
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
</style>
