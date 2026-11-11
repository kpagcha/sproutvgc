<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Crosshair, Plus, X, Zap } from '@lucide/vue'
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
// moves of the same priority. A row with no result yet counts for nothing (and isn't kept in the URL). What fits it
// (`CalcReverse`, the default slot) is its readout, across its foot; before both are picked, a line on what it's for.
export interface HitDraft {
  by: 'a' | 'b'
  move: MoveId | null
  saw: Saw | null
  before?: number
  opts?: HitOptions
}
const props = defineProps<{ yours: Fighter; theirs: Fighter }>()
const hits = defineModel<HitDraft[]>('hits', { required: true })
const first = defineModel<'a' | 'b' | null>('first', { default: null })

const ids = computed(() => ({ a: battlerOf(props.yours), b: battlerOf(props.theirs) }))
const both = computed(() => !!ids.value.a && !!ids.value.b)
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
function add(by: 'a' | 'b') {
  hits.value = [...hits.value, { by, move: movesOf(by)[0] ?? null, saw: null }]
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
  patch(i, { saw: { kind: h.by === 'a' ? 'pct' : 'hp', n: Math.min(max, Math.max(0, v)) } })
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
const OUTCOMES = ['ko', 'lived', 'two'] as const
const outcome = (i: number, k: (typeof OUTCOMES)[number]) =>
  patch(i, { saw: hits.value[i]!.saw?.kind === k ? null : { kind: k } })
const numberOf = (h: HitDraft) => (h.saw && 'n' in h.saw ? h.saw.n : '')
const spread = (mv: MoveId | null) => !!mv && !!MOVES[mv] && isSpread(MOVES[mv])
</script>

<template>
  <section class="panel banded hits">
    <h2 class="band">{{ t('calc.hits.title') }}</h2>
    <p v-if="!both" class="muted intro">{{ t('calc.reverse.pickBoth') }}</p>
    <p v-else-if="!hits.length" class="muted intro">{{ t('calc.hits.hint') }}</p>
    <ol v-if="both && hits.length" class="hit-list">
      <li v-for="(h, i) in hits" :key="i" class="hit" :class="h.by === 'a' ? 'yours' : 'opponent'">
        <!-- Who hit whom, as their icons. -->
        <span
          class="who"
          role="img"
          :aria-label="t('calc.hits.who', { from: name(h.by), to: name(h.by === 'a' ? 'b' : 'a') })"
        >
          <PokemonIcon :id="ids[h.by]!" />→<PokemonIcon :id="ids[h.by === 'a' ? 'b' : 'a']!" />
        </span>
        <select
          class="move"
          :value="h.move ?? ''"
          :aria-label="t('calc.hits.move')"
          @change="patch(i, { move: (($event.target as HTMLSelectElement).value || null) as MoveId | null })"
        >
          <option v-if="!h.move" value="" disabled>{{ t('calc.pickMove') }}</option>
          <option
            v-if="h.move && !movesOf(h.by).includes(h.move) && !othersOf[h.by].some((o) => o.mv === h.move)"
            :value="h.move"
          >
            {{ refName(move(h.move)) }}
          </option>
          <optgroup v-if="movesOf(h.by).length" :label="t('calc.hits.setMoves')">
            <option v-for="mv in movesOf(h.by)" :key="mv" :value="mv">{{ refName(move(mv)) }}</option>
          </optgroup>
          <optgroup v-if="othersOf[h.by].length" :label="t('calc.hits.otherMoves')">
            <option v-for="o in othersOf[h.by]" :key="o.mv" :value="o.mv">{{ o.name }}</option>
          </optgroup>
        </select>
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
        <!-- What it did: a number, or one of the outcomes, either clearing the other. -->
        <span class="saw">
          <span class="num">
            <input
              class="num-in"
              type="number"
              inputmode="numeric"
              min="0"
              :value="numberOf(h)"
              placeholder="–"
              :aria-label="t(h.by === 'a' ? 'calc.hits.pctLost' : 'calc.hits.hpLost')"
              @input="typed(i, $event)"
            />
            <span class="muted">{{ t(h.by === 'a' ? 'calc.hits.unit.pct' : 'calc.hits.unit.hp') }}</span>
          </span>
          <span class="outcomes" role="group" :aria-label="t('calc.hits.saw')">
            <button
              v-for="k in OUTCOMES"
              :key="k"
              type="button"
              class="btn mod"
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
        </span>
        <button type="button" class="remove" :aria-label="t('calc.hits.remove')" @click="remove(i)">
          <X :size="16" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <div v-if="both" class="foot">
      <!-- A hit added, yours on the opponent or its on yours. -->
      <span class="adds">
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
    <slot v-if="both" />
  </section>
</template>

<style scoped>
/* Its buttons soft, as many as there are: a thin outline, no hard shadow nor lift; one on filled, outlined in ink. */
:root:root .hits .btn {
  border-width: 1px;
  border-color: var(--border);
  box-shadow: none;
  font-weight: normal;
}
:root:root .hits .btn:hover:not(:disabled) {
  transform: none;
  box-shadow: none;
  border-color: var(--ink);
}
:root:root .hits .btn:active:not(:disabled) {
  transform: none;
  background: color-mix(in srgb, var(--text) 10%, var(--panel));
}
:root:root .hits .btn.on {
  border-color: var(--ink);
  font-weight: bold;
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
.intro {
  margin: 0 0 12px;
  font-size: 0.875em;
}
.intro:last-child {
  margin-bottom: 0;
}
.hit-list {
  display: flex;
  flex-direction: column;
  margin: 0 0 12px;
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
.move {
  max-width: 11em;
  padding: 3px 6px;
  font: inherit;
}
.mods,
.outcomes,
.saw,
.num,
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
.saw {
  gap: 8px;
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
.remove {
  display: inline-flex;
  margin-left: auto;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.remove:hover {
  color: var(--bad);
}
.foot {
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
