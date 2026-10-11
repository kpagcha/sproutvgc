<script setup lang="ts">
import { computed } from 'vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import { pointsText, toMoveFirst } from '@/lib/speedBuild'
import { movesBefore, odds, reachOf } from '@/lib/speedLineup'
import EffectTag from '@/components/EffectTag'
import SpeedSpread from '@/components/SpeedSpread.vue'
import type { VersusMon } from '@/components/SpeedVersus.vue'

// One of yours against an opponent, either at its sets, in the matchups: the chart of the one at its sets (the
// opponent's when both are), the other on it; then, the opponent at its sets, its common Speeds (the builds on at least
// `MIN_SHARE` of its sets, the `MAX_ROWS` most common, as its build chips are), each with its share and build, and
// whether yours moves before it and the points it needs to at its nature (at its sets too, the share of them that do).
const props = defineProps<{ yours: VersusMon; opponent: VersusMon; trickRoom: boolean }>()

const MIN_SHARE = 0.03
const MAX_ROWS = 4
const charted = computed(() =>
  props.opponent.sets
    ? { me: props.opponent, them: props.yours, tone: 'opponent' as const }
    : { me: props.yours, them: props.opponent, tone: 'yours' as const },
)
const common = computed(() =>
  props.opponent.sets
    ? props.opponent.spread
        .flatMap((p) => p.builds.map((b) => ({ ...b, speed: p.speed })))
        .filter((b) => b.share >= MIN_SHARE)
        .sort((a, b) => b.share - a.share)
        .slice(0, MAX_ROWS)
    : [],
)
const KIND = { 1: 'first', 0: 'tie', [-1]: 'after' } as const
/** How yours does against one of its Speeds: who moves first, and what it takes (at its sets, the share it moves first
 * in). */
function versus(speed: number) {
  const y = props.yours
  if (y.sets) {
    const o = odds(y.spread, [{ speed, share: 1, builds: [] }], props.trickRoom)
    return { kind: o.first > 0.5 ? 'first' : o.after > 0.5 ? 'after' : 'tie', text: percent(o.first) }
  }
  const kind = KIND[movesBefore(y.speed, speed, props.trickRoom)]
  const r = toMoveFirst(y.id, y.build, speed, props.trickRoom).find((x) => x.effect === y.build.effect)!.result
  return { kind, text: `${t(`compare.cell.${kind}`)} · ${pointsText(r)}` }
}
</script>

<template>
  <div class="sets-detail">
    <SpeedSpread
      :title="t('compare.spread', { name: charted.me.name })"
      :spread="charted.me.spread"
      :tone="charted.tone"
      :other="{ name: charted.them.name, spread: charted.them.spread, sets: charted.them.sets }"
      :reach="reachOf(charted.me.id, charted.me.build)"
      :trick-room="trickRoom"
    />
    <section v-if="common.length" class="common">
      <h3 class="small title">{{ t('compare.commonSpeeds', { name: opponent.name }) }}</h3>
      <div class="table small" role="table">
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
        <div v-for="b in common" :key="`${b.effect}:${b.points}`" class="trow" role="row">
          <span role="cell" class="num">{{ b.speed }}</span>
          <span role="cell" class="num muted">{{ percent(b.share) }}</span>
          <span role="cell" class="build"
            ><EffectTag :effect="b.effect" /><span>{{ t('speed.points', { n: b.points }) }}</span></span
          >
          <span role="cell" class="c-yours" :class="versus(b.speed).kind">{{ versus(b.speed).text }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sets-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
}
.small {
  font-size: 0.875em;
}
.title {
  margin: 0 0 6px;
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
.c-yours {
  text-align: right;
}
.thead .c-yours {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0 4px;
}
.trow:not(.thead) .c-yours {
  font-weight: bold;
}
.c-yours.first {
  color: var(--accent);
}
.c-yours.after {
  color: var(--opponent);
}
/* On phones, how yours does under the rest of its row. */
@media (max-width: 720px) {
  .table {
    grid-template-columns: max-content max-content minmax(0, 1fr);
  }
  .c-yours {
    grid-column: 1 / -1;
    text-align: left;
  }
  .thead .c-yours {
    justify-content: flex-start;
  }
}
</style>
