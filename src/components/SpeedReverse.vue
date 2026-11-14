<script setup lang="ts">
import { computed } from 'vue'
import { Check, ChevronsDown, ChevronsUp, X } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { SpeedBuild } from '@/lib/speedBuild'
import type { SpeedBuildShare } from '@/lib/speed'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { NATURE_EFFECTS } from '@/lib/speed'
import { reverse, type PointsRange, type SpeedRange, type TableBuild, type Unknowns } from '@/lib/speedReverse'
import PokemonIcon from '@/components/PokemonIcon'

// The comparison read backwards ("Who moves first"): the two picked with their modifiers and what's given of them, and
// which of them moves first, seen or wanted; what's worked out of them (their points, their natures, or both) could
// then be. Each one's points as a range at each nature effect it could have, and a table of their common builds, one's
// against the other's, each pair marked as fitting, a tie or ruled out. A short intro over it says what to do.
type Side = 'a' | 'b'
const props = defineProps<{
  sides: readonly {
    s: Side
    id: PokemonId | null
    name: string | null
    build: SpeedBuild
    work: Unknowns
    builds: SpeedBuildShare[]
  }[]
  first: Side | null
  trickRoom: boolean
}>()
const emit = defineEmits<{ first: [s: Side] }>()

const [sideA, sideB] = [computed(() => props.sides[0]!), computed(() => props.sides[1]!)]
const ready = computed(() => !!sideA.value.id && !!sideB.value.id)
const result = computed(() =>
  ready.value && props.first
    ? reverse(
        { id: sideA.value.id!, build: sideA.value.build, work: sideA.value.work, builds: sideA.value.builds },
        { id: sideB.value.id!, build: sideB.value.build, work: sideB.value.work, builds: sideB.value.builds },
        props.first,
        props.trickRoom,
      )
    : null,
)
const sideOf = (s: Side) => (s === 'a' ? sideA.value : sideB.value)

/** A side's points at one nature effect, in short: any, a stretch, or one number. */
function pointsText(r: PointsRange) {
  if (r.from === 0 && r.to === MAX_POINTS) return t('reverse.pts.any')
  if (r.from === r.to) return t('reverse.pts.exactly', { n: r.from })
  if (r.from === 0) return t('reverse.pts.upTo', { n: r.to })
  if (r.to === MAX_POINTS) return t('reverse.pts.from', { n: r.from })
  return t('reverse.pts.between', { from: r.from, to: r.to })
}
/** A side's Speed where the order puts it, an end it could be at anyway left open. */
function speedText(r: SpeedRange) {
  if (r.from === r.to) return t('reverse.speed.exactly', { n: r.from })
  if (r.from === r.min) return t('reverse.speed.atMost', { n: r.to })
  if (r.to === r.max) return t('reverse.speed.atLeast', { n: r.from })
  return t('reverse.speed.between', { from: r.from, to: r.to })
}
/** An end of it reached only as a speed tie, said so. */
const tieText = (r: SpeedRange) =>
  r.tieTo && r.to < r.max
    ? t('reverse.speed.tie', { n: r.to })
    : r.tieFrom && r.from > r.min
      ? t('reverse.speed.tie', { n: r.from })
      : null
/**
 * What each one could have, but for one with nothing worked out, or one the order doesn't bind: its Speed where the
 * order puts it, then, its nature worked out, a row per nature effect with its points there (its points given, whether
 * it fits), else its points after its Speed.
 */
const lines = computed(() => {
  const r = result.value
  if (!r) return []
  return (['a', 'b'] as const).flatMap((s) => {
    const { id, work } = sideOf(s)
    const speed = s === 'a' ? r.speedA : r.speedB
    const ranges = s === 'a' ? r.rangesA : r.rangesB
    if (!speed || !(work.nature || work.points)) return []
    if (speed.from === speed.min && speed.to === speed.max && !tieText(speed)) return []
    const textOf = (x: PointsRange | undefined) =>
      !x ? t('reverse.fit.no') : work.points ? pointsText(x) : t('reverse.fit.fits')
    return [
      {
        s,
        id: id!,
        speed: speedText(speed),
        tie: tieText(speed),
        // Its nature given, its points after its Speed.
        points: work.nature ? null : textOf(ranges[0]),
        natures: work.nature
          ? NATURE_EFFECTS.map((e) => {
              const x = ranges.find((y) => y.effect === e)
              return { effect: e, text: textOf(x), out: !x }
            })
          : [],
        known: r.known[s],
      },
    ]
  })
})
/** The nature effects as icons, up and down, neutral none, as the Speed editor's common builds have them; only where
 * its nature is worked out. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const effectIcon = (s: Side, e: NatureEffect) => (sideOf(s).work.nature ? EFFECT_ICONS[e] : undefined)
const buildLabel = (b: TableBuild) => t('reverse.build', { n: b.points, speed: b.speed })
</script>

<template>
  <section class="panel reverse" :aria-label="t('reverse.title')">
    <h2 class="heading">{{ t('reverse.question') }}</h2>
    <p class="muted small">{{ t(ready ? 'reverse.intro' : 'reverse.introEmpty') }}</p>
    <template v-if="ready">
      <!-- The order: which of the two moves first. -->
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
        <p v-if="!result.possible" class="warn" role="status">{{ t('reverse.impossible') }}</p>
        <template v-else>
          <!-- What each one could have, at each nature effect where its nature is worked out. -->
          <ul v-if="lines.length" class="lines" role="status">
            <li v-for="l in lines" :key="l.s" class="line" :class="l.s === 'a' ? 'yours' : 'opponent'">
              <!-- Its Speed where the order puts it, the headline; its points after it, its nature given. -->
              <p class="line-head">
                <span class="who"><PokemonIcon :id="l.id" />{{ sideOf(l.s).name }}</span>
                <span class="verdict"
                  >{{ l.speed }}<template v-if="l.points"> · {{ l.points }}</template></span
                >
                <span v-if="l.tie" class="muted small">{{ l.tie }}</span>
                <span v-if="!l.known" class="muted small">{{ t('reverse.noSets') }}</span>
              </p>
              <!-- Its nature worked out: what that Speed takes at each, a row each. -->
              <dl v-if="l.natures.length" class="natures">
                <div v-for="n in l.natures" :key="n.effect" class="nature" :class="{ out: n.out }">
                  <dt>
                    <component :is="EFFECT_ICONS[n.effect]" v-if="EFFECT_ICONS[n.effect]" :size="14" />{{
                      t(`speed.effect.${n.effect}`)
                    }}
                  </dt>
                  <dd>{{ n.text }}</dd>
                </div>
              </dl>
            </li>
          </ul>
          <p v-if="result.known.a || result.known.b" class="muted small">
            {{ result.chance ? t('reverse.chance', { pct: percent(result.chance) }) : t('reverse.noneRun') }}
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
                <th v-for="cb in result.commonB" :key="cb.i" scope="col" class="opponent">
                  <span class="b-build"
                    ><component :is="effectIcon('b', cb.effect)" v-if="effectIcon('b', cb.effect)" :size="14" />{{
                      buildLabel(cb)
                    }}</span
                  >
                  <span v-if="cb.share" v-tip="t('reverse.shareTip')" class="muted share">{{ percent(cb.share) }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ca in result.commonA" :key="ca.i">
                <th scope="row" class="yours">
                  <span class="b-build"
                    ><component :is="effectIcon('a', ca.effect)" v-if="effectIcon('a', ca.effect)" :size="14" />{{
                      buildLabel(ca)
                    }}</span
                  >
                  <span v-if="ca.share" v-tip="t('reverse.shareTip')" class="muted share">{{ percent(ca.share) }}</span>
                </th>
                <td v-for="cb in result.commonB" :key="cb.i" class="cell" :class="result.grid[ca.i]![cb.i]">
                  <Check v-if="result.grid[ca.i]![cb.i] === 'fits'" :size="16" :aria-label="t('reverse.fit.fits')" />
                  <span v-else-if="result.grid[ca.i]![cb.i] === 'tie'">{{ t('reverse.fit.tie') }}</span>
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
/* In the bad color alone: bold, it shifts what's around it as it comes and goes. */
.warn {
  color: var(--bad);
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
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
  border-left: 4px solid var(--accent);
}
.line.opponent {
  border-left-color: var(--opponent);
}
.line-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  margin: 0;
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
}
.verdict {
  font-weight: bold;
}
/* A row per nature effect: its name, then its points, in two columns lined up; one ruled out faded. */
.natures {
  display: grid;
  grid-template-columns: max-content auto;
  gap: 2px 16px;
  margin: 0;
  font-size: 0.875em;
}
.nature {
  display: contents;
}
.nature dt {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
}
.nature dd {
  margin: 0;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.nature.out dd {
  color: var(--muted);
  font-weight: normal;
}
/* Scrolling sideways where it doesn't fit, rather than the page. */
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
.builds thead th.opponent {
  border-top: 3px solid var(--opponent);
}
.builds tbody th.yours {
  border-left: 3px solid var(--accent);
}
.b-build {
  display: flex;
  align-items: center;
  gap: 2px;
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
