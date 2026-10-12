<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import { moveFirstPlan, pointsText, works } from '@/lib/speedBuild'
import { movesBefore, odds, toBeatAll } from '@/lib/speedLineup'
import EffectTag from '@/components/EffectTag'
import SpeedModChips from '@/components/SpeedModChips.vue'
import type { VersusMon } from '@/components/SpeedVersus.vue'

// One of yours against an opponent at its sets: the opponent's common Speeds (the builds on at least `MIN_SHARE` of its
// sets, the `MAX_ROWS` most common, as its build chips are; and the one to beat them all, its fastest (its slowest
// under Trick Room), when it isn't among them), each with its share and build, and how yours does against it: who
// moves first, and what yours takes to (`moveFirstPlan`): at its nature the points that do it (with what's to spare)
// or how far off it is, the nature that would when its can't, and, when none can, the modifiers that would, unfolded
// from the row. Yours at its sets, the share of them that move first. Folded under the opponent's chart (`foldable`),
// in the matchups and in the pair, where its heading is a band of its side's color (`banded`): a mark tapped there
// unfolds it at that Speed (`focus`), its rows marked, and added when it isn't among them.
const props = defineProps<{
  yours: VersusMon
  opponent: VersusMon
  trickRoom: boolean
  banded?: boolean
  foldable?: boolean
  /** The Speed tapped on the chart. */
  focus?: number | null
}>()
const open = defineModel<boolean>('open', { default: true })

const MIN_SHARE = 0.03
const MAX_ROWS = 4
const KIND = { 1: 'first', 0: 'tie', [-1]: 'after' } as const

const rows = computed(() => {
  const spread = props.opponent.spread
  const list = spread
    .flatMap((p) => p.builds.map((b) => ({ ...b, speed: p.speed })))
    .filter((b) => b.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_ROWS)
  const edge = toBeatAll(spread, props.trickRoom)
  if (!list.some((b) => b.speed === edge)) {
    const top = [...(spread.find((p) => p.speed === edge)?.builds ?? [])].sort((a, b) => b.share - a.share)[0]
    if (top) list.push({ ...top, speed: edge })
  }
  const at =
    props.focus != null && !list.some((b) => b.speed === props.focus) && spread.find((p) => p.speed === props.focus)
  if (at) list.push(...[...at.builds].sort((a, b) => b.share - a.share).map((b) => ({ ...b, speed: at.speed })))
  return list.map((b) => ({ ...b, key: `${b.speed}:${b.effect}:${b.points}`, versus: versus(b.speed) }))
})

/** How yours does against one of its Speeds: who moves first, and what it takes (at its sets, the share that do). */
function versus(speed: number) {
  const y = props.yours
  if (y.sets) {
    const o = odds(y.spread, [{ speed, share: 1, builds: [] }], props.trickRoom)
    return { kind: o.first > 0.5 ? 'first' : o.after > 0.5 ? 'after' : 'tie', text: percent(o.first), plan: null }
  }
  const kind = KIND[movesBefore(y.speed, speed, props.trickRoom)]
  const plan = moveFirstPlan(y.id, y.build, speed, props.trickRoom)
  const c = plan.current
  const how = works(c.result)
    ? `${pointsText(c.result)}${c.spare ? ` · ${t('speed.spare', { n: c.spare })}` : ''}`
    : c.result
      ? pointsText(c.result)
      : t(props.trickRoom ? 'speed.over' : 'speed.short', { n: c.off })
  return { kind, text: `${t(`compare.cell.${kind}`)} · ${how}`, plan }
}

// The Speed tapped, once its rows are drawn, brought into view.
const root = useTemplateRef<HTMLElement>('root')
watch(
  [() => props.focus, open],
  () => {
    if (open.value && props.focus != null)
      root.value?.querySelector('.trow.focus')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
  { flush: 'post' },
)

/** The rows whose modifiers are unfolded. */
const unfolded = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(unfolded.value)
  if (!next.delete(key)) next.add(key)
  unfolded.value = next
}
</script>

<template>
  <section ref="root" class="common">
    <h3 class="small title" :class="{ band: banded, folded: foldable && !open }">
      <button v-if="foldable" type="button" class="fold" :aria-expanded="open" @click="open = !open">
        {{ t('compare.commonSpeeds', { name: opponent.name })
        }}<ChevronDown :size="16" class="chevron" :class="{ open }" aria-hidden="true" />
      </button>
      <template v-else>{{ t('compare.commonSpeeds', { name: opponent.name }) }}</template>
    </h3>
    <div v-if="open" class="table small" :class="{ padded: banded }" role="table">
      <div class="trow thead muted" role="row">
        <span role="columnheader">{{ t('compare.colSpeed') }}</span>
        <span role="columnheader">{{ t('compare.ofSets') }}</span>
        <span role="columnheader">{{ t('compare.build') }}</span>
        <!-- Yours and its build, laid out as the rows' builds are, so its arrow lines up with the text. -->
        <span role="columnheader" class="c-yours"
          ><span>{{ yours.name }}</span
          ><span v-if="!yours.sets" class="build"
            >(<EffectTag :effect="yours.build.effect" /><span
              >{{ t('speed.points', { n: yours.build.points }) }})</span
            ></span
          ></span
        >
      </div>
      <template v-for="r in rows" :key="r.key">
        <div class="trow" :class="{ focus: r.speed === focus }" role="row">
          <span role="cell" class="num">{{ r.speed }}</span>
          <span role="cell" class="num muted">{{ percent(r.share) }}</span>
          <span role="cell" class="build"
            ><EffectTag :effect="r.effect" /><span>{{ t('speed.points', { n: r.points }) }}</span></span
          >
          <span role="cell" class="c-yours">
            <span class="verdict" :class="r.versus.kind">{{ r.versus.text }}</span>
            <!-- The nature that would, when its own can't. -->
            <span v-if="r.versus.plan?.other" class="other muted"
              ><EffectTag :effect="r.versus.plan.other.effect" /><span>{{
                pointsText(r.versus.plan.other.result)
              }}</span></span
            >
            <!-- When no nature would, what would: unfolded under the row. -->
            <button
              v-if="r.versus.plan?.mods"
              type="button"
              class="would"
              :aria-expanded="unfolded.has(r.key)"
              :aria-controls="`would-${r.key}`"
              @click="toggle(r.key)"
            >
              {{ t('speed.wouldDo')
              }}<template v-if="r.versus.plan.mods.length"> ({{ r.versus.plan.mods.length }})</template
              ><ChevronDown :size="14" class="chevron" :class="{ open: unfolded.has(r.key) }" aria-hidden="true" />
            </button>
          </span>
        </div>
        <div v-if="r.versus.plan?.mods && unfolded.has(r.key)" :id="`would-${r.key}`" class="trow mods-row" role="row">
          <span role="cell" class="mods-cell"
            ><SpeedModChips :mods="r.versus.plan.mods" :effect="yours.build.effect"
          /></span>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* Measured for its narrow layout, so its width can't come from what's in it: as wide as where it is. */
.common {
  align-self: stretch;
  width: 100%;
  container-type: inline-size;
}
.small {
  font-size: 0.875em;
}
.title {
  margin: 0 0 6px;
}
/* As a band: across the top of its card, in its side's color. */
.title.band {
  display: block;
  margin: 0;
  padding: 6px 8px;
  line-height: 1.3;
  color: var(--side-text);
  background: var(--side);
  border-bottom: 2px solid var(--ink);
}
/* Folded, its heading alone. */
.title.folded,
.title.band.folded {
  margin: 0;
  border-bottom: none;
}
.fold {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.table.padded {
  padding: 2px 8px 6px;
}
/* A row per common Speed: its Speed, share and build, each column as wide as its widest (the rows sharing the table's
   columns), then how yours does against it. */
.table {
  display: grid;
  grid-template-columns: max-content max-content max-content minmax(0, 1fr);
  column-gap: 12px;
}
.trow {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  row-gap: 2px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
/* The Speed tapped on the chart. */
.trow.focus {
  background: var(--sel);
}
.thead {
  font-weight: bold;
  white-space: nowrap;
}
.num {
  font-variant-numeric: tabular-nums;
}
.trow > .num:first-child {
  font-weight: bold;
}
.build {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
/* How yours does: who moves first and what it takes, then the nature that would and the way to what would, wrapping. */
.c-yours {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 2px 10px;
  text-align: right;
}
.thead .c-yours {
  gap: 0 4px;
}
.verdict {
  font-weight: bold;
}
.verdict.first {
  color: var(--accent);
}
.verdict.after {
  color: var(--opponent);
}
.other {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.would {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  font: inherit;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.would:hover {
  color: var(--text);
}
.chevron {
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
/* What would do it, under its row, across the table. */
.mods-cell {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}
/* Narrow, how yours does under the rest of its row. */
@container (max-width: 520px) {
  .table {
    grid-template-columns: max-content max-content minmax(0, 1fr);
  }
  .c-yours {
    grid-column: 1 / -1;
    justify-content: flex-start;
    text-align: left;
  }
  .mods-cell {
    justify-content: flex-start;
  }
  /* Its column's heading, yours and its build, left out (read out still): on a line of its own under the others' it
     would read as a row. Whose the answers are is plain from where the table is: yours' panel, or the pair tapped. */
  .thead .c-yours {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
/* Yours' build in its heading: the bracket against its arrow. */
.thead .build {
  gap: 0;
}
.thead .build > :last-child {
  margin-left: 4px;
}
</style>
