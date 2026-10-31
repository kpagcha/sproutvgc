<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, ChevronUp, Copy, Crosshair, Pencil, Plus, Zap } from '@lucide/vue'
import { move, type MoveId } from '@/data/dex'
import { isSpread, MOVES } from '@/data/moves'
import { t, tSplit, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { copy } from '@/lib/clipboard'
import { DOUBLING, hitChoices, koKind, MAX_STOCKPILE, type Hit } from '@/lib/damage'
import CategoryIcon from '@/components/CategoryIcon'
import TypeIcon from '@/components/TypeIcon'

// One move's damage against the other side, in the damage calculator: its name, the range in percent of the
// defender's HP, and the calc's verdict, over a bar of the defender's HP filling with the damage, in the attacker's
// side's color (what it deals for sure, solid; what it may deal past that, striped; what it had lost already, dark,
// first). Its verdict colored for whose it is (`theirs`: the opponent's moves
// hitting yours, a knockout bad news). Unfolded, its HP numbers, every roll, and the calc's line to share, copied in a
// tap (off for now, `DESC_ON`); a critical hit, for a move whose hits vary how many, and for a spread move whether it hits one target alone
// (no spread reduction), and for a move doubled on what came before it (`DOUBLING`: Stomping Tantrum's last move failing,
// Avalanche hit first, Round after an ally's, Fickle Beam's all-out attack) whether it is, Spit Up's Stockpile layers, set from its row and marked on its name. What the order does to it (a priority move's
// priority, Payback's power) a tag at the end of the verdict's line, so every row is as tall and the two sides' rows line up; a status
// move a row laid out as the rest, dimmed, its bar empty and nothing to unfold. The rows are the side's moves, the set's
// card leaving them out: its name a button picking another in its place (`pick`, `active` while it's being picked), and
// a move not picked yet a placeholder picking one. With no other side yet (`idle`), its name alone.
const props = defineProps<{
  id: MoveId | null
  hit: Hit | null
  idle?: boolean
  active?: boolean
  theirs?: boolean
  crit: boolean
  hits: number | undefined
  single: boolean
  doubled: boolean
  stockpile: number | undefined
}>()
const emit = defineEmits<{
  pick: []
  crit: [on: boolean]
  hits: [n: number]
  single: [on: boolean]
  doubled: [on: boolean]
  stockpile: [n: number]
}>()
const doubling = computed(() => (props.id ? DOUBLING[props.id] : undefined))
// It hits both foes in this battle (Expanding Force in Psychic Terrain too), so it can hit one alone.
const spread = computed(() => props.hit?.spread ?? (!!m.value && isSpread(m.value)))
const open = defineModel<boolean>('open', { default: false })

const m = computed(() => (props.id ? MOVES[props.id] : undefined))
const kind = computed(() => koKind(props.hit))
const status = computed(() => m.value?.category === 'status')
/** Its rolls and the rest to unfold: a damaging move's, against the other side. */
const foldable = computed(() => !status.value && !props.idle)
// Past its HP as it is, overkill and all (as Showdown's calc says it), whole from 100: "212 – 250%".
const fmt = (x: number) => (x >= 100 ? String(Math.floor(x)) : x.toFixed(1))
/** The bar's parts, in percent of the defender's whole HP, from the left: lost before, dealt for sure, may be dealt
 * (the rest of the range), what's left. The damage never past what it had left. */
const bar = computed(() => {
  const h = props.hit
  if (!h) return null
  const lost = ((h.maxHp - h.hp) / h.maxHp) * 100
  const sure = (Math.min(h.min, h.hp) / h.maxHp) * 100
  const maybe = ((Math.min(h.max, h.hp) - Math.min(h.min, h.hp)) / h.maxHp) * 100
  return { lost, sure, maybe }
})

// The calc's line, to share, is off for now (`DESC_ON`); the code is kept to bring it back.
const DESC_ON = false
const copied = ref(false)
async function share() {
  if (!props.hit?.desc) return
  copied.value = await copy(props.hit.desc)
  setTimeout(() => (copied.value = false), 1500)
}
const choices = computed(() => (props.id ? hitChoices(props.id) : null))
// The hits picked, else those the calc hit (its default for the move).
const hitsOn = computed(() => props.hits ?? props.hit?.hits)
const STOCKPILE = Array.from({ length: MAX_STOCKPILE }, (_, i) => i + 1)
/** What the order does to it: a priority move's priority, as the battle has it; one whose power hangs on the order (Payback,
 * Bolt Beak, Analytic's user) at the order the battle has. */
const note = computed(() => {
  const h = props.hit
  const mv = m.value
  if (!mv || mv.category === 'status' || h?.none) return ''
  // Its priority in the battle (Grassy Glide's in Grassy Terrain), else its own.
  const p = h ? h.priority : mv.priority
  if (p) return t('calc.priority', { n: p > 0 ? `+${p}` : `−${-p}` })
  if (!h?.order || h.none) return ''
  const kind =
    props.id === 'payback'
      ? 'payback'
      : props.id === 'boltbeak' || props.id === 'fishiousrend'
        ? 'boltbeak'
        : 'analytic'
  return t(`calc.order.${kind}.${h.order}`)
})
const blockedText = tSplit('calc.blockedBy', 'what')
</script>

<template>
  <!-- No move in its place yet: a placeholder picking one. -->
  <li v-if="!id" class="damage empty">
    <button type="button" class="pick-move placeholder" :class="{ active }" @click="emit('pick')">
      <Plus :size="14" aria-hidden="true" />{{ t('calc.pickMove') }}
    </button>
  </li>
  <li
    v-else
    class="damage"
    :class="[kind, { theirs, open: open && foldable, none: hit?.none, 'status-move': status, idle }]"
  >
    <!-- The row tapped anywhere but its name unfolds it; its name picks another move in its place. -->
    <div class="head" @click="foldable && (open = !open)">
      <span class="name">
        <button
          v-tip="t('calc.changeMove')"
          type="button"
          class="move-btn"
          :class="{ active }"
          :aria-label="`${refName(move(id))}: ${t('calc.changeMove')}`"
          @click.stop="emit('pick')"
        >
          <TypeIcon v-if="m" :type="m.type" />
          <span class="move-name">{{ refName(move(id)) }}</span>
          <Pencil :size="12" class="edit" aria-hidden="true" />
        </button>
        <CategoryIcon v-if="m" :category="m.category" class="cat" />
        <Zap v-if="crit" :size="13" class="crit-mark" :aria-label="t('calc.crit')" />
        <Crosshair v-if="single && spread" :size="13" class="crit-mark" :aria-label="t('calc.single')" />
        <span v-if="doubling && doubled" class="crit-mark doubled-mark" :aria-label="t('calc.doubled')">×2</span>
      </span>
      <span v-if="status || idle" class="range"></span>
      <span v-else-if="!hit || hit.none" class="range muted">{{ t('calc.noEffect') }}</span>
      <span v-else class="range"
        ><span class="pct">{{ fmt(hit.minPct) }} – {{ fmt(hit.maxPct) }}%</span></span
      >
      <!-- Unfolding it: its rolls, and the rest. -->
      <button
        type="button"
        class="fold"
        :class="{ gone: !foldable }"
        :disabled="!foldable"
        :aria-expanded="foldable ? open : undefined"
        :aria-label="t('calc.rolls')"
        @click.stop="open = !open"
      >
        <component :is="open ? ChevronUp : ChevronDown" :size="16" aria-hidden="true" />
      </button>
      <template v-if="!idle">
        <span class="bar" aria-hidden="true">
          <template v-if="bar && !hit!.none">
            <span class="lost" :style="{ width: `${bar.lost}%` }"></span>
            <span class="sure" :style="{ width: `${bar.sure}%` }"></span>
            <span class="maybe" :style="{ width: `${bar.maybe}%` }"></span>
          </template>
        </span>
        <span v-if="status" class="verdict muted">{{ t('calc.status') }}</span>
        <span v-else-if="hit && !hit.none" class="verdict"
          ><span class="ko">{{ hit.ko || t('calc.noKo') }}</span></span
        >
        <span v-else-if="hit?.blocked" class="verdict muted">
          <span v-if="'ref' in hit.blocked"
            >{{ blockedText[0] }}<b>{{ refName(hit.blocked.ref) }}</b
            >{{ blockedText[1] }}</span
          >
          <span v-else>{{ t('calc.immuneType', { type: typeName(hit.blocked.type) }) }}</span>
        </span>
        <!-- Every row a verdict's line, so they're all as tall. -->
        <span v-else class="verdict" aria-hidden="true">&nbsp;</span>
        <span v-if="note" class="note">{{ note }}</span>
      </template>
    </div>
    <div v-if="open && foldable" class="details">
      <div class="toggles">
        <button type="button" class="btn mod" :class="{ on: crit }" :aria-pressed="crit" @click="emit('crit', !crit)">
          <Zap :size="14" aria-hidden="true" />{{ t('calc.crit') }}
        </button>
        <button
          v-if="spread"
          v-tip="t('calc.singleTip')"
          type="button"
          class="btn mod"
          :class="{ on: single }"
          :aria-pressed="single"
          @click="emit('single', !single)"
        >
          <Crosshair :size="14" aria-hidden="true" />{{ t('calc.single') }}
        </button>
        <button
          v-if="doubling"
          v-tip="t(`calc.doubledTip.${doubling}`)"
          type="button"
          class="btn mod"
          :class="{ on: doubled }"
          :aria-pressed="doubled"
          @click="emit('doubled', !doubled)"
        >
          {{ t(`calc.doubled.${doubling}`) }}
        </button>
        <span v-if="choices" class="hits" role="group" :aria-label="t('calc.hits')">
          <span v-if="id === 'beatup'" v-tip="t('calc.beatUpTip')" class="muted estimate">{{ t('calc.hits') }}</span>
          <span v-else class="muted">{{ t('calc.hits') }}</span>
          <button
            v-for="n in choices"
            :key="n"
            type="button"
            class="btn mod"
            :class="{ on: hitsOn === n }"
            :aria-pressed="hitsOn === n"
            @click="emit('hits', n)"
          >
            {{ n }}
          </button>
        </span>
        <span v-if="id === 'spitup'" class="hits" role="group" :aria-label="t('calc.stockpile')">
          <span class="muted">{{ t('calc.stockpile') }}</span>
          <button
            v-for="n in STOCKPILE"
            :key="n"
            type="button"
            class="btn mod"
            :class="{ on: (stockpile ?? 1) === n }"
            :aria-pressed="(stockpile ?? 1) === n"
            @click="emit('stockpile', n)"
          >
            {{ n }}
          </button>
        </span>
        <!-- Its HP numbers at the row's end, on a row of their own where they don't fit. -->
        <span v-if="hit && !hit.none" class="hp muted">{{
          t('calc.hpRange', { min: hit.min, max: hit.max, of: hit.maxHp })
        }}</span>
      </div>
      <template v-if="hit && !hit.none">
        <p class="rolls">
          <span class="muted">{{ t('calc.rolls') }}</span>
          <span class="roll-list">{{ hit.rolls.join(', ') }}</span>
        </p>
        <p v-if="hit.extra" class="extra muted">{{ hit.extra }}</p>
        <div v-if="DESC_ON" class="desc-row">
          <code class="desc">{{ hit.desc }}</code>
          <button
            v-tip.brief="copied ? t('calc.copied') : t('calc.copy')"
            type="button"
            class="copy"
            :class="{ copied }"
            :aria-label="copied ? t('calc.copied') : t('calc.copy')"
            @click="share"
          >
            <component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />
          </button>
        </div>
      </template>
    </div>
  </li>
</template>

<style scoped>
.damage {
  /* The damage in the attacker's side's color: yours the accent, the opponent's its red. */
  --dmg: var(--accent);
}
.head {
  --icon-scale: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: 'name range fold' 'bar bar bar' 'verdict note note';
  align-items: center;
  gap: 8px 10px;
  padding: 10px 0;
  cursor: pointer;
}
/* A status move: as the rest, dimmed, nothing to unfold (its fold's room kept). */
.damage.status-move .head,
.damage.idle .head {
  cursor: default;
}
.damage.status-move .head > :not(.name),
.damage.status-move .cat {
  opacity: 0.5;
}
/* Unfolding it: its arrow alone. */
.fold {
  grid-area: fold;
  display: inline-flex;
  align-items: center;
  padding: 2px 0 2px 4px;
  font: inherit;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.head:hover .fold:not(:disabled),
.fold:focus-visible {
  color: var(--text);
}
.fold.gone {
  visibility: hidden;
}
/* Its name, picking another in its place: a link's color, a pencil after it saying so. */
.move-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: var(--link);
  text-align: left;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
.move-btn:hover .move-name {
  text-decoration: underline;
}
.move-btn .edit {
  flex: none;
  color: var(--muted);
}
.move-btn:hover .edit {
  color: var(--link);
}
.move-btn.active,
.pick-move.active {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
/* No move there yet: a dashed box picking one. */
.damage.empty {
  padding: 6px 0;
}
.pick-move {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  padding: 4px 10px;
  font: inherit;
  font-size: 0.9em;
  color: var(--muted);
  text-align: left;
  background: none;
  border: 1px dashed var(--border);
  cursor: pointer;
}
.pick-move:hover {
  color: var(--link);
  border-color: var(--link);
}
.name {
  grid-area: name;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.move-name {
  overflow: hidden;
  font-weight: bold;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cat {
  flex: none;
}
.crit-mark {
  flex: none;
  color: var(--accent);
}
.estimate {
  text-decoration: underline dotted;
}
.doubled-mark {
  font-size: 0.75rem;
  font-weight: 700;
}
.range {
  grid-area: range;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pct {
  font-size: 1.1em;
  font-weight: bold;
}
/* The defender's HP: left for sure, may be left (striped), taken for sure (empty), lost before (dark). */
.bar {
  grid-area: bar;
  display: flex;
  height: 10px;
  overflow: hidden;
  background: var(--panel-alt);
  border: 1px solid var(--ink);
}
.bar > span {
  flex: none;
  height: 100%;
}
.damage.theirs {
  --dmg: var(--opponent);
}
.sure {
  background: var(--dmg);
}
.maybe {
  background: repeating-linear-gradient(
    -45deg,
    var(--dmg) 0 3px,
    color-mix(in srgb, var(--dmg) 35%, transparent) 3px 6px
  );
}
.lost {
  background: color-mix(in srgb, var(--ink) 55%, var(--panel));
}
.verdict {
  grid-area: verdict;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 10px;
  font-size: 0.875em;
}
.ko {
  font-weight: bold;
}
/* What the order does to it, a tag at the end of the verdict's line (beside it, not of it). */
.note {
  grid-area: note;
  justify-self: end;
  padding: 0 6px;
  font-size: 0.8em;
  font-weight: bold;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.hp {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
/* The verdict colored for whose it is: yours knocking out good news, theirs bad. */
.damage.ohko:not(.theirs) .ko {
  color: var(--good);
}
.damage.two:not(.theirs) .ko {
  color: color-mix(in srgb, var(--good) 70%, var(--text));
}
.damage.ohko.theirs .ko {
  color: var(--bad);
}
.damage.two.theirs .ko {
  color: color-mix(in srgb, var(--bad) 70%, var(--text));
}
.damage.none .move-name {
  color: var(--muted);
}
.details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 0 14px;
  font-size: 0.875em;
}
.details p {
  margin: 0;
}
.toggles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.hits {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
.rolls {
  display: flex;
  gap: 8px;
}
.roll-list {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
/* The calc's line in a box, the way to copy it an icon in its top right corner, the text kept clear of it. */
.desc-row {
  position: relative;
}
.copy {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  padding: 3px;
  color: var(--muted);
  background: var(--panel-alt);
  border: 1px solid transparent;
  cursor: pointer;
}
.copy:hover {
  color: var(--text);
  border-color: var(--border);
}
.copy.copied {
  color: var(--good);
}
.desc {
  display: block;
  min-width: 0;
  padding: 4px 32px 4px 6px;
  font-size: 0.95em;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  overflow-wrap: anywhere;
}
/* Narrow, its name across the top, the range at the verdict's end, and what the order does to it under them, so the
   name isn't cut short. */
@media (max-width: 480px) {
  .head {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'name fold' 'bar bar' 'verdict range';
    gap: 6px 8px;
  }
  .note {
    grid-area: auto;
    grid-row: 4;
    grid-column: 1 / -1;
    justify-self: start;
  }
  .move-name {
    white-space: normal;
  }
}
</style>
