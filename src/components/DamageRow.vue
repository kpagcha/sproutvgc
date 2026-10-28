<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, ChevronUp, Copy, Crosshair, Zap } from '@lucide/vue'
import { move, type MoveId } from '@/data/dex'
import { isSpread, MOVES } from '@/data/moves'
import { t, tSplit, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { copy } from '@/lib/clipboard'
import { koKind, variableHits, type Hit } from '@/lib/damage'
import CategoryIcon from '@/components/CategoryIcon'
import TypeIcon from '@/components/TypeIcon'

// One move's damage against the other side, in the damage calculator: its name, the range in percent of the
// defender's HP, and the calc's verdict, over a bar of the defender's HP filling with the damage, in the attacker's
// side's color (what it deals for sure, solid; what it may deal past that, striped; what it had lost already, dark,
// first). Its verdict colored for whose it is (`theirs`: the opponent's moves
// hitting yours, a knockout bad news). Unfolded, its HP numbers, every roll, and the calc's line to share, copied in a
// tap (off for now, `DESC_ON`); a critical hit, for a move whose hits vary how many, and for a spread move whether it hits one target alone
// (no spread reduction), set from its row and marked on its name. What the order does to it (a priority move's
// priority, Payback's power) a tag at the end of the verdict's line, so every row is as tall and the two sides' rows line up; a status
// move a row laid out as the rest, dimmed, its bar empty and nothing to unfold.
const props = defineProps<{
  id: MoveId
  hit: Hit | null
  theirs?: boolean
  crit: boolean
  hits: number | undefined
  single: boolean
}>()
const emit = defineEmits<{ crit: [on: boolean]; hits: [n: number]; single: [on: boolean] }>()
const open = defineModel<boolean>('open', { default: false })

const m = computed(() => MOVES[props.id])
const kind = computed(() => koKind(props.hit))
const status = computed(() => m.value?.category === 'status')
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
const HITS = [2, 3, 4, 5]
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
  <li class="damage" :class="[kind, { theirs, open: open && !status, none: hit?.none, 'status-move': status }]">
    <button
      type="button"
      class="head no-lift"
      :disabled="status"
      :aria-expanded="status ? undefined : open"
      @click="open = !open"
    >
      <span class="name">
        <TypeIcon v-if="m" :type="m.type" />
        <span class="move-name">{{ refName(move(id)) }}</span>
        <CategoryIcon v-if="m" :category="m.category" class="cat" />
        <Zap v-if="crit" :size="13" class="crit-mark" :aria-label="t('calc.crit')" />
        <Crosshair v-if="single" :size="13" class="crit-mark" :aria-label="t('calc.single')" />
      </span>
      <span v-if="status" class="range"></span>
      <span v-else-if="!hit || hit.none" class="range muted">{{ t('calc.noEffect') }}</span>
      <span v-else class="range"
        ><span class="pct">{{ fmt(hit.minPct) }} – {{ fmt(hit.maxPct) }}%</span></span
      >
      <component
        :is="open ? ChevronUp : ChevronDown"
        :size="14"
        class="chev"
        :class="{ gone: status }"
        aria-hidden="true"
      />
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
    </button>
    <div v-if="open && !status" class="details">
      <div class="toggles">
        <button type="button" class="btn mod" :class="{ on: crit }" :aria-pressed="crit" @click="emit('crit', !crit)">
          <Zap :size="14" aria-hidden="true" />{{ t('calc.crit') }}
        </button>
        <button
          v-if="m && isSpread(m)"
          v-tip="t('calc.singleTip')"
          type="button"
          class="btn mod"
          :class="{ on: single }"
          :aria-pressed="single"
          @click="emit('single', !single)"
        >
          <Crosshair :size="14" aria-hidden="true" />{{ t('calc.single') }}
        </button>
        <span v-if="variableHits(id)" class="hits" role="group" :aria-label="t('calc.hits')">
          <span class="muted">{{ t('calc.hits') }}</span>
          <button
            v-for="n in HITS"
            :key="n"
            type="button"
            class="btn mod"
            :class="{ on: (hits ?? 0) === n }"
            :aria-pressed="(hits ?? 0) === n"
            @click="emit('hits', n)"
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
  border-bottom: 1px solid var(--border);
}
.head {
  --icon-scale: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: 'name range chev' 'bar bar bar' 'verdict note note';
  align-items: center;
  gap: 6px 10px;
  width: 100%;
  padding: 10px 6px 12px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.head:hover:not(:disabled) {
  background: var(--panel-alt);
}
/* A status move: as the rest, dimmed, nothing to unfold (its chevron's room kept). */
.head:disabled {
  color: inherit;
  cursor: default;
}
.damage.status-move .head {
  opacity: 0.5;
}
.chev.gone {
  visibility: hidden;
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
.range {
  grid-area: range;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pct {
  font-size: 1.1em;
  font-weight: bold;
}
/* Narrow, the range no bigger than the name, so the name isn't cut short. */
@media (max-width: 480px) {
  .pct {
    font-size: 1em;
  }
  .head {
    gap: 4px 6px;
  }
}
.chev {
  grid-area: chev;
  color: var(--muted);
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
  gap: 8px;
  padding: 6px 6px 14px;
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
</style>
