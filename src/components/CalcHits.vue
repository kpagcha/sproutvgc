<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChevronDown, Crosshair, Plus, Trash2, Zap } from '@lucide/vue'
import { move, type MoveId } from '@/data/dex'
import { isSpread, MOVES } from '@/data/moves'
import { loadLearnsets, movesOf as learnsetOf } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { battlerOf, damaging, statsOf, type Fighter, type HitOptions } from '@/lib/damage'
import { inPercent, type Partner, type Saw } from '@/lib/damageReverse'
import HpBar from '@/components/HpBar.vue'
import PokemonIcon from '@/components/PokemonIcon'

// The inverse damage calc's "What you saw": the hits seen, in the order entered, each a row: who hit whom (yours the
// opponent, or the opponent yours), the move (one of the attacker's), whether it was a critical hit or, for a spread
// move, hit one target alone, what it did (the opponent's HP lost in whole percent, as the game shows it, or yours' in
// HP; or a knockout, survived, or a knockout on the second hit) and the defender's HP before it (full unless said: the
// opponent's in percent, yours' in HP); the same move as often as it was seen. Then which of the two moved first, with
// moves of the same priority. A row with no result yet counts for nothing (and isn't kept in the URL). Adding a hit
// and which moved first lead, over the hits; with none yet, a line saying what to add. Shown once both are picked.
// With the partners on the field added (`partners`: yours' and the opponent's), their hits on the opponent, its on
// them and which moved first against it too, as icons alone (a partner's hits seen ones, never a goal).
export interface HitDraft {
  by: 'a' | 'b'
  move: MoveId | null
  saw: Saw | null
  before?: number
  opts?: HitOptions
  /** Its number a goal, that or better for yours (`Saw`'s `bound`), kept while it has none or an outcome instead. */
  bound?: boolean
  /** Against a partner on the field rather than yours (`HitSeen`'s `with`). */
  with?: Partner
}
const props = defineProps<{
  yours: Fighter
  theirs: Fighter
  /** The partners on the field, those picked: yours' (`c`) and the opponent's (`d`). */
  partners?: Partial<Record<Partner, Fighter>>
  /** Something of yours is worked out: a hit added then has its number as a goal at first. */
  goal?: boolean
}>()
const emit = defineEmits<{ pickMove: [i: number]; next: []; added: [] }>()
const hits = defineModel<HitDraft[]>('hits', { required: true })
const first = defineModel<'a' | 'b' | null>('first', { default: null })
/** Which was seen moving first between each partner (`a`) and the opponent (`b`). */
const firsts = defineModel<Partial<Record<Partner, 'a' | 'b' | null>>>('firsts', { default: () => ({}) })

/** Each on the field: yours (`a`), the opponent (`b`), and the partners. */
type Slot = 'a' | 'b' | Partner
const fighterOf = (k: Slot): Fighter | undefined =>
  k === 'a' ? props.yours : k === 'b' ? props.theirs : props.partners?.[k]
const idOf = (k: Slot) => {
  const f = fighterOf(k)
  return f ? battlerOf(f) : null
}
/** The partners picked, yours' first. */
const partnerKeys = computed(() => (['c', 'd'] as const).filter((k) => !!idOf(k)))
/** The other end of the opponent's hits and orders: yours, then the partners. */
const others = computed((): ('a' | Partner)[] => ['a', ...partnerKeys.value])
const name = (k: Slot) =>
  t(k === 'a' ? 'calc.yours' : k === 'b' ? 'calc.theirs' : k === 'c' ? 'calc.partner.c' : 'calc.partner.d')
/** A hit's attacker and defender: the other (yours or the partner it's with) and the opponent. */
const attackerOf = (h: { by: 'a' | 'b'; with?: Partner }): Slot => (h.by === 'a' ? (h.with ?? 'a') : 'b')
const defenderOf = (h: { by: 'a' | 'b'; with?: Partner }): Slot => (h.by === 'a' ? 'b' : (h.with ?? 'a'))
/** Whose side a slot is on, for its color: yours and your partner, or the opponent and its. */
const toneOf = (k: Slot) => (k === 'a' || k === 'c' ? 'yours' : 'opponent')
/** The attacker's damaging moves, from its set. */
const movesOf = (k: Slot) =>
  (fighterOf(k)?.member.moves ?? []).filter((mv, i, all): mv is MoveId => damaging(mv) && all.indexOf(mv) === i)
// Every damaging move each learns, so a hit's move needn't be in its set (one or two entered, or none).
const learnsets = shallowRef<Awaited<ReturnType<typeof loadLearnsets>> | null>(null)
void loadLearnsets().then((l) => (learnsets.value = l))
const learns = (k: Slot) => {
  const id = idOf(k)
  return !!id && !!learnsets.value && learnsetOf(learnsets.value, id).some((mv) => damaging(mv))
}
/** A move to start a hit with: its set's first, else none (picked from the list). */
const canAdd = (k: Slot) => !!movesOf(k).length || learns(k)
/** The ways to add a hit: yours on the opponent and its on yours, then each partner's the same way. */
const adds = computed(() =>
  others.value.flatMap((o) => {
    const w = o === 'a' ? undefined : o
    return [
      { by: 'a' as const, with: w },
      { by: 'b' as const, with: w },
    ]
  }),
)
const addLabel = (x: { by: 'a' | 'b'; with?: Partner }) =>
  t('calc.hits.who', { from: name(attackerOf(x)), to: name(defenderOf(x)) })
const maxHpOf = (k: Slot) => statsOf(fighterOf(k) ?? props.yours)?.hp ?? 0

const patch = (i: number, p: Partial<HitDraft>) =>
  (hits.value = hits.value.map((h, j) => (j === i ? { ...h, ...p } : h)))
const remove = (i: number) => (hits.value = hits.value.filter((_, j) => j !== i))
/** A hit added: its defender's HP before it where the last hit on it left it (its HP before less what it lost), else
 * full (none before, a KO, or only Survived or 2 hits known). */
function add(by: 'a' | 'b', w?: Partner) {
  // The last on the same defender: the opponent whoever hit it, or the one the opponent hit.
  const last = hits.value.filter((h) => h.by === by && (by === 'a' || h.with === w)).at(-1)
  const lost = last?.saw && 'n' in last.saw ? last.saw.n : null
  const left = last && lost !== null ? (last.before ?? maxOf(last)) - lost : null
  const before = left !== null && left > 0 && left < maxOf(last!) ? left : undefined
  hits.value = [
    ...hits.value,
    {
      by,
      move: movesOf(attackerOf({ by, with: w }))[0] ?? null,
      saw: null,
      ...(before && { before }),
      // A goal is yours' alone: a partner's hits are seen ones.
      ...(props.goal && !w && { bound: true }),
      ...(w && { with: w }),
    },
  ]
  emit('added')
}
function setOpt(i: number, key: 'crit' | 'single', on: boolean) {
  const opts = { ...hits.value[i]!.opts, [key]: on || undefined }
  patch(i, { opts: Object.values(opts).some(Boolean) ? opts : undefined })
}
/** The number typed: the opponent's side's HP lost in percent, or yours' side's in HP; cleared, no result. */
function typed(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const h = hits.value[i]!
  if (el.value === '') return patch(i, { saw: null })
  const v = Math.round(Number(el.value))
  if (!Number.isFinite(v)) return
  patch(i, { saw: numberSaw(h, Math.min(lostMax(h), Math.max(0, v))) })
}
/** A number it did: the opponent's side's percent or yours' side's HP, a goal while the hit's is. */
const numberSaw = (h: HitDraft, n: number): Saw => ({
  kind: inPercent(h) ? 'pct' : 'hp',
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
  const max = maxOf(h)
  const v = Math.round(Number(el.value))
  if (el.value === '' || !Number.isFinite(v) || v >= max) {
    el.value = String(max)
    return patch(i, { before: undefined })
  }
  patch(i, { before: Math.max(1, v) })
}
/** The defender's HP out of: the opponent's side's in whole percent, so out of 100; yours' side's in HP. */
const maxOf = (h: HitDraft) => (inPercent(h) ? 100 : maxHpOf(defenderOf(h)) || 1)
/** Its HP before it, in percent, for the bar. */
const beforePct = (h: HitDraft) => ((h.before ?? maxOf(h)) / maxOf(h)) * 100
/** The bar moved: its HP points (whole percent, or yours' side's HP), full as none set. */
function slid(i: number, pct: number) {
  const max = maxOf(hits.value[i]!)
  const pts = Math.max(1, Math.round((max * pct) / 100))
  patch(i, { before: pts >= max ? undefined : pts })
}
/** Stepped by one (with Shift, a tenth of its HP): the HP lost, from none set starting at the step up. */
function stepLost(i: number, d: 1 | -1, e: MouseEvent) {
  const h = hits.value[i]!
  const max = lostMax(h)
  const by = e.shiftKey ? Math.max(1, Math.round(max / 10)) : 1
  const now = h.saw && 'n' in h.saw ? h.saw.n : null
  if (now === null && d < 0) return
  const n = Math.min(max, Math.max(0, (now ?? 0) + d * by))
  patch(i, { saw: numberSaw(h, n) })
}
const lostMax = (h: HitDraft) => (inPercent(h) ? 100 : maxHpOf(defenderOf(h)) || 9999)
/** The defender's HP before it, read out: the opponent's or yours, or a partner's. */
const beforeLabel = (h: HitDraft) =>
  t(
    h.by === 'a'
      ? 'calc.hits.beforePct'
      : !h.with
        ? 'calc.hits.beforeHp'
        : inPercent(h)
          ? 'calc.hits.beforeItsPct'
          : 'calc.hits.beforeIts',
  )
const OUTCOMES = ['ko', 'lived', 'two'] as const
const outcome = (i: number, k: (typeof OUTCOMES)[number]) =>
  patch(i, { saw: hits.value[i]!.saw?.kind === k ? null : { kind: k } })
const numberOf = (h: HitDraft) => (h.saw && 'n' in h.saw ? h.saw.n : '')
/** Which moved first between one and the opponent: yours' the `first` model, a partner's its own. */
const firstOf = (o: 'a' | Partner) => (o === 'a' ? first.value : (firsts.value[o] ?? null))
function setFirst(o: 'a' | Partner, k: 'a' | 'b') {
  const now = firstOf(o) === k ? null : k
  if (o === 'a') first.value = now
  else firsts.value = { ...firsts.value, [o]: now }
}
/** A hit with its move and what it did, or which moved first: something to work out from. */
const said = computed(
  () => !!first.value || partnerKeys.value.some((k) => !!firsts.value[k]) || hits.value.some((h) => h.move && h.saw),
)
const spread = (mv: MoveId | null) => !!mv && !!MOVES[mv] && isSpread(MOVES[mv])
</script>

<template>
  <section class="hits panel banded">
    <h2 class="band">{{ t('calc.hits.title') }}</h2>
    <div class="controls">
      <!-- A hit added, yours on the opponent or its on yours; with partners on the field, theirs too, as icons alone. -->
      <span class="adds" :class="{ needed: !hits.length }">
        <button
          v-for="x in adds"
          :key="`${x.by}${x.with ?? ''}`"
          v-tip="x.with ? addLabel(x) : undefined"
          type="button"
          class="btn add"
          :class="toneOf(attackerOf(x))"
          :disabled="!canAdd(attackerOf(x))"
          :aria-label="x.with ? addLabel(x) : undefined"
          @click="add(x.by, x.with)"
        >
          <Plus :size="14" aria-hidden="true" /><PokemonIcon :id="idOf(attackerOf(x))!" />→<PokemonIcon
            :id="idOf(defenderOf(x))!"
          /><span v-if="!x.with">{{ t(x.by === 'a' ? 'calc.hits.addYours' : 'calc.hits.addTheirs') }}</span>
        </button>
      </span>
      <!-- Which moved first, the two as their icons; tapped again, not seen. With partners, a pair each against the
           opponent. -->
      <span class="first" role="group" :aria-label="t('calc.reverse.first')">
        <span v-tip="t('calc.reverse.firstTip')" class="muted about" tabindex="0">{{ t('calc.reverse.first') }}</span>
        <span v-for="o in others" :key="o" class="pair">
          <button
            v-for="k in ['a', 'b'] as const"
            :key="k"
            type="button"
            class="btn choice"
            :class="[toneOf(k === 'a' ? o : 'b'), { on: firstOf(o) === k }]"
            :aria-pressed="firstOf(o) === k"
            :aria-label="name(k === 'a' ? o : 'b')"
            @click="setFirst(o, k)"
          >
            <PokemonIcon :id="idOf(k === 'a' ? o : 'b')!" />
          </button>
        </span>
      </span>
    </div>
    <ol v-if="hits.length" class="hit-list">
      <li v-for="(h, i) in hits" :key="i" class="hit" :class="toneOf(attackerOf(h))">
        <!-- Who hit whom, as their icons. -->
        <span class="who" role="img" :aria-label="addLabel(h)">
          <PokemonIcon :id="idOf(attackerOf(h))!" />→<PokemonIcon :id="idOf(defenderOf(h))!" />
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
              <!-- Exactly as seen, or a goal: at least that lost from the opponent, at most from yours; a partner's hits
                   seen alone. -->
              <button
                v-if="!h.with"
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
                :aria-label="t(inPercent(h) ? 'calc.hits.pctLost' : 'calc.hits.hpLost')"
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
              <span class="unit">{{ t(inPercent(h) ? 'calc.hits.unit.pct' : 'calc.hits.unit.hp') }}</span>
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
            :label="beforeLabel(h)"
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
            :aria-label="beforeLabel(h)"
            @change="typedBefore(i, $event)"
          />
          <span class="muted">{{ inPercent(h) ? '%' : t('calc.hits.unit.hpOf', { max: maxOf(h) }) }}</span>
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
/* A hit: its parts on one line where they fit, edged in the attacker's color; its lines as far apart as its parts, so
   the outlines of what's still wanted (4px out each) never touch. */
.hit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
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
/* Each pair against the opponent joined, apart from the next. */
.pair {
  display: inline-flex;
  gap: 4px;
}
.pair + .pair {
  margin-left: 6px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}
.choice.on.yours {
  background: var(--accent);
}
.choice.on.opponent {
  background: var(--opponent);
}
</style>
