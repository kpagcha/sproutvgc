<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import type { SpeedBuildShare } from '@/lib/speed'
import { MAX_POINTS } from '@/lib/stats'
import { reverse, type PointsRange } from '@/lib/speedReverse'
import PokemonIcon from '@/components/PokemonIcon'

// The comparison read backwards ("Who moved first"): the two picked with their natures and modifiers, and which of
// them was seen moving first; what their Speed points could then be. Each one's points as a range with the spreads it
// most likely was (weighed by the meta's sets at those natures), and a table of their common builds, one's against the
// other's, each pair marked as fitting, a tie or ruled out.
type Side = 'a' | 'b'
const props = defineProps<{
  sides: readonly { s: Side; id: PokemonId | null; name: string | null; build: SpeedBuild; builds: SpeedBuildShare[] }[]
  first: Side | null
  trickRoom: boolean
}>()
const emit = defineEmits<{ first: [s: Side] }>()

const [sideA, sideB] = [computed(() => props.sides[0]!), computed(() => props.sides[1]!)]
const ready = computed(() => !!sideA.value.id && !!sideB.value.id)
const result = computed(() =>
  ready.value && props.first
    ? reverse(
        { id: sideA.value.id!, build: sideA.value.build, builds: sideA.value.builds },
        { id: sideB.value.id!, build: sideB.value.build, builds: sideB.value.builds },
        props.first,
        props.trickRoom,
      )
    : null,
)
const nameOf = (s: Side) => (s === 'a' ? sideA.value.name : sideB.value.name)!

/** A side's points in short: any, a stretch, one number. */
function rangeText(r: PointsRange) {
  if (r.from === 0 && r.to === MAX_POINTS) return t('reverse.anyPoints')
  if (r.from === r.to) return t('reverse.exactly', { n: r.from, speed: r.speeds[0] })
  if (r.from === 0) return t('reverse.atMost', { n: r.to, speed: r.speeds[1] })
  if (r.to === MAX_POINTS) return t('reverse.atLeast', { n: r.from, speed: r.speeds[0] })
  return t('reverse.between', { from: r.from, to: r.to, speed: `${r.speeds[0]}–${r.speeds[1]}` })
}
const lines = computed(() => {
  const r = result.value
  if (!r) return []
  return (['a', 'b'] as const).map((s) => ({
    s,
    id: s === 'a' ? sideA.value.id! : sideB.value.id!,
    range: s === 'a' ? r.rangeA : r.rangeB,
    likely: (s === 'a' ? r.likelyA : r.likelyB).filter((x) => x.share >= 0.01).slice(0, 3),
    known: r.known[s],
  }))
})
const buildLabel = (b: { points: number; speed: number }) => t('reverse.build', { n: b.points, speed: b.speed })
</script>

<template>
  <section class="panel reverse" :aria-label="t('reverse.title')">
    <h2 class="heading">{{ t('reverse.question') }}</h2>
    <p v-if="!ready" class="muted small">{{ t('reverse.pickBoth') }}</p>
    <template v-else>
      <!-- The order seen: which of the two moved first. -->
      <div class="choices" role="radiogroup" :aria-label="t('reverse.question')">
        <button
          v-for="side in props.sides"
          :key="side.s"
          type="button"
          role="radio"
          class="btn choice"
          :class="[side.s === 'a' ? 'yours' : 'opponent', { on: props.first === side.s }]"
          :aria-checked="props.first === side.s"
          @click="emit('first', side.s)"
        >
          <PokemonIcon :id="side.id!" />{{ side.name }}
        </button>
      </div>

      <template v-if="props.first && result">
        <p v-if="!result.rangeA" class="warn" role="status">{{ t('reverse.impossible') }}</p>
        <template v-else>
          <!-- What each one's points can be, and the spreads most likely at its nature. -->
          <ul class="lines" role="status">
            <li v-for="l in lines" :key="l.s" class="line" :class="l.s === 'a' ? 'yours' : 'opponent'">
              <span class="who"><PokemonIcon :id="l.id" />{{ nameOf(l.s) }}</span>
              <span class="range">{{ rangeText(l.range!) }}</span>
              <span v-if="l.known && l.likely.length" class="likely">
                <span class="muted small">{{ t('reverse.likely') }}</span>
                <span v-for="x in l.likely" :key="x.points" class="pill"
                  >{{ t('speed.points', { n: x.points }) }} <span class="muted">{{ percent(x.share) }}</span></span
                >
              </span>
              <span v-else-if="!l.known" class="muted small">{{ t('reverse.noSets') }}</span>
            </li>
          </ul>
          <p v-if="result.known.a || result.known.b" class="muted small">
            {{ t('reverse.chance', { pct: percent(result.chance) }) }}
          </p>
        </template>

        <!-- Their common builds, one's down, the other's across, each pair marked as fitting, a tie or ruled out. -->
        <div class="table-wrap">
          <table class="builds">
            <thead>
              <tr>
                <th class="corner" scope="col">
                  <span class="corner-mon"><PokemonIcon :id="sideA.id!" />↓</span>
                  <span class="corner-mon"><PokemonIcon :id="sideB.id!" />→</span>
                </th>
                <th v-for="cb in result.commonB" :key="cb.points" scope="col" class="opponent">
                  <span class="b-build">{{ buildLabel(cb) }}</span>
                  <span v-if="cb.share !== null" v-tip="t('reverse.shareTip')" class="muted share">{{
                    percent(cb.share)
                  }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ca in result.commonA" :key="ca.points">
                <th scope="row" class="yours">
                  <span class="b-build">{{ buildLabel(ca) }}</span>
                  <span v-if="ca.share !== null" v-tip="t('reverse.shareTip')" class="muted share">{{
                    percent(ca.share)
                  }}</span>
                </th>
                <td
                  v-for="cb in result.commonB"
                  :key="cb.points"
                  class="cell"
                  :class="result.grid[ca.points]![cb.points]"
                >
                  <Check
                    v-if="result.grid[ca.points]![cb.points] === 'fits'"
                    :size="16"
                    :aria-label="t('reverse.fit.fits')"
                  />
                  <span v-else-if="result.grid[ca.points]![cb.points] === 'tie'">{{ t('reverse.fit.tie') }}</span>
                  <X v-else :size="16" :aria-label="t('reverse.fit.no')" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.reverse {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reverse > p {
  margin: 0;
}
.heading {
  margin: 0;
  font-size: 1.125em;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.choice {
  gap: 6px;
}
.choice.on.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.choice.on.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.warn {
  color: var(--bad);
  font-weight: bold;
}
.lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding-left: 8px;
  border-left: 4px solid var(--accent);
}
.line.opponent {
  border-left-color: var(--opponent);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.range {
  font-weight: bold;
}
.likely {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.pill {
  padding: 1px 6px;
  font-size: 0.875em;
  border: 1px solid var(--border);
}
/* Scrolling sideways where it doesn't fit, rather than the page. */
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
.builds thead th.opponent {
  border-top: 3px solid var(--opponent);
}
.builds tbody th.yours {
  border-left: 3px solid var(--accent);
}
.b-build {
  display: block;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.share {
  display: block;
  font-size: 0.875em;
}
.corner {
  vertical-align: bottom;
}
.corner-mon {
  display: flex;
  align-items: center;
  gap: 2px;
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
.cell.fits {
  color: var(--m2-fg);
  background: var(--m2-bg);
}
.cell.tie {
  background: var(--panel-alt);
}
.cell.no {
  color: var(--m05-fg);
  background: var(--m05-bg);
}
</style>
