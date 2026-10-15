<script setup lang="ts">
import { computed } from 'vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import type { Benchmark } from '@/lib/stats'
import { MARK_SHARE } from '@/lib/speed'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'
import type { OddsRow } from '@/components/SpeedOdds.vue'

// A row of the speed tiers' ladder (`SpeedOdds`), a component of its own so that it's drawn again only when what it
// shows changes: everything it shows worked out once, from its props, rather than over and over in the template. The
// marks carry their Speed (`data-s`) and, a benchmark, which (`data-bench`), for the ladder's tooltip to find them; the
// one the tooltip is on, and those at a Speed of the column hovered, are marked by the ladder on the elements
// themselves (`active`, `hprobed`), so pointing at them draws nothing again.
const props = defineProps<{
  row: OddsRow
  /** The axis: its start and its span. */
  lo: number
  span: number
  mine: number | null
  trickRoom: boolean
  possible: boolean
  /** The first row at its Speed: its number in the column, a link to the page with it picked (`href`). */
  first: boolean
  href: string
  /** The Speed picked (`?at=`): a line down the row at it, the marks at it outlined. */
  probe: number | null
  /** The Speed yours is measured against, on the row it's against (null on the rest). */
  versusSpeed: number | null
  /** Its Speed's link just copied. */
  copied: boolean
}>()
const emit = defineEmits<{ chip: [event: MouseEvent]; share: [] }>()
defineSlots<{ tags?: (props: { row: OddsRow }) => unknown }>()

const canHover = window.matchMedia('(hover: hover)').matches
/** The benchmarks as the bar runs, slowest first: a row with no sets' marks. */
const ALONG: readonly Benchmark[] = ['min', 'none', 'maxNeutral', 'max']
const benchLabel = (b: Benchmark) => t(`stat.bench.${b}`)

const v = computed(() => {
  const { row: r, lo, span, mine, trickRoom, possible, probe, versusSpeed } = props
  const inside = (speed: number) => speed >= lo && speed <= lo + span
  const pct = (speed: number) => Math.min(100, Math.max(0, ((speed - lo) / span) * 100))
  const at = (speed: number) => `${pct(speed)}%`
  const between = (a: number, b: number) => ({ left: at(a), width: `calc(${at(b)} - ${at(a)})` })
  const verdict = (speed: number): 'yours' | 'theirs' | 'tie' | undefined => {
    if (mine === null) return undefined
    if (speed === mine) return 'tie'
    return speed < mine !== trickRoom ? 'yours' : 'theirs'
  }
  /** The Speeds drawn: those on at least `MARK_SHARE` of its sets (the rest count in its odds, undrawn). */
  const drawn = r.builds.filter((b) => b.share >= MARK_SHARE)
  const benchMarks = ALONG.filter((b) => inside(r.bench[b])).map((b) => ({
    bench: b,
    speed: r.bench[b],
    kind: verdict(r.bench[b]),
  }))

  // Each Speed drawn's height by its share, against the row's most common (the height itself is the CSS's).
  const top = Math.max(...r.builds.map((b) => b.share), 0.0001)
  const marks = r.noSets
    ? []
    : drawn
        .filter((b) => inside(b.speed))
        .map((b) => ({
          speed: b.speed,
          cls: [
            r.mine ? 'own-mine' : verdict(b.speed),
            r.own !== undefined && b.speed !== r.own && 'faint',
            r.versus && b.speed === versusSpeed && 'picked',
            b.speed === probe && 'probed',
          ],
          style: { left: at(b.speed), '--tall': b.share / top },
        }))
  const benches = r.noSets
    ? benchMarks.map((b) => ({
        ...b,
        cls: [
          b.kind,
          b.speed === r.own && 'own',
          r.versus && b.speed === versusSpeed && 'picked',
          b.speed === probe && 'probed',
        ],
        left: at(b.speed),
      }))
    : []
  /** At what they could reach, a row with sets' benchmarks too: ticks across its baseline, under its marks. */
  const ticks = possible && !r.noSets ? benchMarks.map((b) => ({ ...b, left: at(b.speed) })) : []

  /** The range its sets span, on the axis. */
  const s = drawn.map((b) => b.speed)
  const spanStyle = r.noSets ? undefined : between(Math.min(...s), Math.max(...s))
  /** The Speed said under its mark: its own build's, or its most common; not when the column says it already, nor
   * when it's past the axis. */
  const labelSpeed = r.own ?? r.builds[0]?.speed
  const label =
    r.noSets || labelSpeed === undefined || labelSpeed === r.speed || !inside(labelSpeed)
      ? null
      : { speed: labelSpeed, kind: verdict(labelSpeed), left: at(labelSpeed) }

  // Its Speeds past the axis's ends (a boost's), below it and above it: said as a tag at that end rather than drawn,
  // as marks piled at the end would say nothing; the Speed, or the slowest and fastest of them, in the color of who
  // moves first at all of them.
  const all = r.noSets ? Object.values(r.bench) : s
  const tag = (list: number[]) => {
    if (!list.length) return null
    const [a, b] = [Math.min(...list), Math.max(...list)]
    const kinds = new Set(list.map(verdict))
    return { text: a === b ? String(a) : `${a}–${b}`, kind: kinds.size === 1 ? [...kinds][0] : undefined }
  }
  const past = { lo: tag(all.filter((x) => x < lo)), hi: tag(all.filter((x) => !inside(x) && x > lo)) }

  // With no sets: whether yours moves first against the whole of what it could reach, none of it, or part of it;
  // with them, against how many of its sets yours moves first, and ties with.
  let reachVerdict: 'always' | 'never' | 'depends' | null = null
  let odds: { first: number; ties: number } | null = null
  if (mine !== null && r.noSets) {
    const ends = [verdict(r.reach.min), verdict(r.reach.max)]
    reachVerdict = ends.every((x) => x === 'yours') ? 'always' : ends.every((x) => x === 'theirs') ? 'never' : 'depends'
  } else if (mine !== null && r.builds.length) {
    const total = r.builds.reduce((n, b) => n + b.share, 0)
    if (total) {
      let first = 0
      let ties = 0
      for (const b of r.builds) {
        const k = verdict(b.speed)
        if (k === 'yours') first += b.share
        else if (k === 'tie') ties += b.share
      }
      odds = { first: first / total, ties: ties / total }
    }
  }

  const name = [r.species, r.forme].filter(Boolean).join(' ')
  return {
    hidden: r.noSets
      ? t('speed.oddsNoSets', { name, list: ALONG.map((b) => `${benchLabel(b)} ${r.bench[b]}`).join(', ') })
      : drawn.map((b) => `${b.speed} ${percent(b.share)}`).join(', '),
    reach: between(r.reach.min, r.reach.max),
    spanStyle,
    marks,
    benches,
    ticks,
    label,
    noSetsLeft: at((r.reach.min + r.reach.max) / 2),
    past,
    probeLeft: probe === null ? null : at(probe),
    mineLeft: mine === null ? null : at(mine),
    reachVerdict,
    odds,
  }
})
</script>

<template>
  <li
    class="row tier"
    :class="{
      starts: first,
      hit: row.hit,
      'has-mine': row.mine,
      versus: row.versus,
      rival: row.rival,
      extra: row.extra,
      boost: row.boost,
      at: row.speed === probe,
    }"
    :data-key="row.key"
    :data-speed="first ? row.speed : undefined"
  >
    <!-- Its Speed, on the first row at it: a link to the page with it picked, copied when clicked. -->
    <a
      v-if="first"
      v-tip="canHover && t('speed.rowLink')"
      :href
      class="speed num"
      :aria-current="row.speed === probe ? 'true' : undefined"
      @click.prevent="emit('share')"
      >{{ row.speed }}<span v-if="copied" class="copied" role="status">{{ t('speed.copied') }}</span></a
    >
    <span v-else class="speed" aria-hidden="true"></span>
    <AppLink
      :to="{ name: 'metaPokemon', params: { id: row.id } }"
      class="who mon"
      :class="{ hit: row.hit, mine: row.mine }"
      @click.capture="emit('chip', $event)"
    >
      <PokemonIcon :id="row.id" /><span class="names"
        ><span class="name">{{ row.species }}</span
        ><span class="sub"
          ><span v-if="row.forme" class="forme">{{ row.forme }}</span
          ><slot name="tags" :row="row" /></span
      ></span>
    </AppLink>
    <span class="track">
      <span class="visually-hidden">{{ v.hidden }}</span>
      <span class="reach" :style="v.reach" aria-hidden="true"></span>
      <template v-if="!row.noSets">
        <span class="span" :style="v.spanStyle" aria-hidden="true"></span>
        <span
          v-for="b in v.marks"
          :key="b.speed"
          :data-s="b.speed"
          class="mark"
          :class="b.cls"
          :style="b.style"
          aria-hidden="true"
        ></span>
        <span
          v-if="v.label"
          class="value num"
          :class="v.label.kind"
          :style="{ left: v.label.left }"
          aria-hidden="true"
          >{{ v.label.speed }}</span
        >
      </template>
      <template v-else>
        <span
          v-for="b in v.benches"
          :key="b.bench"
          :data-s="b.speed"
          :data-bench="b.bench"
          class="mark bench"
          :class="b.cls"
          :style="{ left: b.left }"
          aria-hidden="true"
        ></span>
        <span class="value num no-sets" :style="{ left: v.noSetsLeft }">{{ t('speed.noSets') }}</span>
      </template>
      <span
        v-for="b in v.ticks"
        :key="b.bench"
        :data-s="b.speed"
        :data-bench="b.bench"
        class="tick"
        :style="{ left: b.left }"
        aria-hidden="true"
      ></span>
      <span v-if="v.past.lo" class="past lo num" :class="v.past.lo.kind" aria-hidden="true"
        >◂ {{ v.past.lo.text }}</span
      >
      <span v-if="v.past.hi" class="past hi num" :class="v.past.hi.kind" aria-hidden="true"
        >{{ v.past.hi.text }} ▸</span
      >
      <span v-if="v.probeLeft !== null" class="probe" :style="{ left: v.probeLeft }" aria-hidden="true"></span>
      <span v-if="v.mineLeft !== null" class="line" :style="{ left: v.mineLeft }" aria-hidden="true"></span>
    </span>
    <!-- On phones, where the bar's under the rest of the row: yours' line down the whole of it. -->
    <span v-if="v.mineLeft !== null" class="row-line" aria-hidden="true"
      ><span class="line" :style="{ left: v.mineLeft }"></span
    ></span>
    <span v-if="mine !== null" class="odds-cell num">
      <template v-if="row.mine"></template>
      <span v-else-if="v.reachVerdict" class="reach-verdict" :class="v.reachVerdict">{{
        t(`speed.oddsReach.${v.reachVerdict}`)
      }}</span>
      <template v-else-if="v.odds">
        <span class="first">{{ percent(v.odds.first) }}</span>
        <span v-if="v.odds.ties" class="ties">{{ t('speed.oddsTies', { pct: percent(v.odds.ties) }) }}</span>
      </template>
      <span v-else class="muted">—</span>
    </span>
  </li>
</template>

<style scoped>
/* A row: its Speed (on the first row at it), the Pokémon, its Speeds on the axis, and, with yours, how yours does
   against its sets; on phones, the Speed beside the Pokémon and how yours does on a line, the Speeds under them. The
   columns are the ladder's (`--cols`, on `SpeedOdds`). */
.row {
  display: grid;
  grid-template-columns: var(--cols);
  grid-template-areas: 'speed who track odds';
  align-items: center;
  gap: 4px 10px;
  position: relative;
  padding: 2px 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
}
.speed {
  grid-area: speed;
  position: relative;
  align-self: start;
  padding-top: 6px;
  text-align: right;
}
/* In the text's color, as a number rather than a link (retro.css colors links). */
:root:root a.speed {
  color: var(--text);
  text-decoration: none;
}
:root:root a.speed:hover {
  text-decoration: underline;
}
.who {
  grid-area: who;
}
.track {
  grid-area: track;
  position: relative;
  min-height: 40px;
  /* The baseline: low in the row, the marks rising from it and a Speed under it. */
  --bar-y: calc(100% - 15px);
  --mark-w: 5px;
  --mark-max: 19px;
  align-self: stretch;
  /* Dragging along it moves the tooltip; up and down still scroll the page. */
  touch-action: pan-y pinch-zoom;
}
.odds-cell {
  grid-area: odds;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
/* The rows at one Speed together: a rule over the first, a fainter one between the rest. */
.row.starts {
  border-top-color: var(--border);
}
.row:first-child {
  border-top: none;
}
.row-line {
  display: none;
}
.row.has-mine {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
/* The one found: a neutral gray, darker than the panel, as the rest fade around it. */
.row.hit {
  background: var(--found);
}
/* The Speed picked by its link. */
.row.at {
  background: var(--sel);
  box-shadow: inset 3px 0 var(--accent);
}
/* The one yours is measured against: tinted the opponents' red, as yours is its color, rather than marked found too;
   the same Pokémon's other rows in a faint wash of it. */
.row.versus {
  background: color-mix(in srgb, var(--opponent) 14%, transparent);
}
.row.rival {
  background: color-mix(in srgb, var(--opponent) 6%, transparent);
}
/* The row found from the comparison's card: a ring in the opponents' red pulsing twice, softly. */
.row.flash {
  animation: row-flash 0.6s ease-out 2;
}
@keyframes row-flash {
  40% {
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--opponent) 45%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .row.flash {
    animation: none;
  }
}
/* Shown though the view leaves it out, with no sets, or under the least share: a dotted rule over it. */
.row.extra {
  border-top-style: dotted;
}
/* An item or ability its sets run, as what could be: dashed around its name, as the ladder's chips were. */
.row.boost .mon {
  outline: 1px dashed var(--muted);
  outline-offset: -1px;
}
/* The Pokémon: its icon and name; yours outlined (the one yours is measured against is its row's tint). */
.mon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-right: 4px;
  color: var(--text);
  border-radius: 2px;
}
.mon:hover {
  text-decoration: none;
  background: var(--hover);
}
/* On a tinted row, a deeper tint of its own color rather than the hover's yellow. */
.row.versus .mon:hover {
  background: color-mix(in srgb, var(--opponent) 28%, transparent);
}
.row.has-mine .mon:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
/* The name, and its forme and what the row is of (its build, its boost) on a line under it, smaller, wrapping. */
.names {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  font-size: 0.8em;
  color: var(--muted);
}
.sub:empty {
  display: none;
}
.forme {
  white-space: nowrap;
}
.mon.mine {
  font-weight: bold;
  box-shadow: inset 0 0 0 2px var(--accent);
}
.num {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.copied {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 3;
  padding: 1px 6px;
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border-strong);
}
/* The axis as a faint groove (a track, not a rule that would read as a second divider), the range it could reach a
   deeper stretch of it, the range its sets span as a baseline on it, a mark rising from it at each Speed (as tall as
   it's common, a hairline of the panel between marks side by side), yours a line through. */
.track::before {
  content: '';
  position: absolute;
  inset: var(--bar-y) 0 auto;
  height: 4px;
  translate: 0 -50%;
  background: color-mix(in srgb, var(--text) 7%, var(--panel));
}
.reach {
  position: absolute;
  top: var(--bar-y);
  height: 4px;
  translate: 0 -50%;
  background: color-mix(in srgb, var(--text) 16%, var(--panel));
}
.span {
  position: absolute;
  top: var(--bar-y);
  height: 2px;
  translate: 0 -50%;
  background: var(--range-plain);
}
/* A row with no sets' benchmarks: hollow and all alike, as how common each is isn't known, outlined in the color of
   who moves first at it; the row's own, filled. */
.mark.bench {
  height: 11px;
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--range-plain),
    0 0 0 1px var(--panel);
}
.mark.bench.yours {
  box-shadow:
    inset 0 0 0 1px var(--range-yours),
    0 0 0 1px var(--panel);
}
.mark.bench.theirs {
  box-shadow:
    inset 0 0 0 1px var(--range-theirs),
    0 0 0 1px var(--panel);
}
.mark.bench.tie {
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel);
}
.mark.bench.own {
  background: var(--range-plain);
}
.mark.bench.own.yours {
  background: var(--range-yours);
}
.mark.bench.own.theirs {
  background: var(--range-theirs);
}
.track .mark.bench.active {
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
}
.mark {
  position: absolute;
  top: var(--bar-y);
  width: var(--mark-w);
  height: calc(3px + var(--tall) * var(--mark-max));
  translate: -50% -100%;
  background: var(--range-plain);
  box-shadow: 0 0 0 1px var(--panel);
}
/* At what they could reach, a row with sets' benchmarks: thin ticks across its baseline, under its marks; the one the
   tooltip is on in ink. */
.tick {
  position: absolute;
  top: var(--bar-y);
  width: 2px;
  height: 8px;
  translate: -50% -3px;
  background: color-mix(in srgb, var(--text) 55%, var(--panel));
}
.tick.active {
  background: var(--text);
}
/* A row of one build: the others faint. */
.mark.faint {
  opacity: 0.35;
}
/* The one the tooltip is on, the one yours is measured against, and those at the Speed probed (hovered in the column,
   `hprobed`, or else picked): outlined, over their neighbours (whoever moves first). */
.track .mark:is(.active, .picked, .hprobed),
.rows:not(.hovering) .track .mark.probed {
  z-index: 2;
  opacity: 1;
  box-shadow:
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
}
.mark.yours {
  background: var(--range-yours);
}
.mark.theirs {
  background: var(--range-theirs);
}
.mark.tie {
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--ink),
    0 0 0 1px var(--panel);
}
/* Yours' own row: its Speed, in its color, full height. */
.mark.own-mine {
  background: var(--accent);
}
/* A Speed under its mark (the most common, sorting by another), in its mark's color. */
.value {
  position: absolute;
  z-index: 1;
  top: calc(var(--bar-y) + 2px);
  translate: -50% 0;
  padding: 0 2px;
  font-size: 0.75em;
  line-height: 1.3;
  white-space: nowrap;
}
.value.yours {
  color: var(--accent);
}
.value.theirs {
  color: var(--opponent);
}
.value.no-sets {
  top: calc(var(--bar-y) + 2px);
  font-weight: normal;
  color: var(--muted);
}
.line {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  translate: -50% 0;
  background: var(--accent);
}
/* Speeds past the axis's ends (a boost's): a tag at that end, over the baseline, in the color of who moves first. */
.past {
  position: absolute;
  z-index: 1;
  top: var(--bar-y);
  translate: 0 calc(-100% - 2px);
  padding: 0 3px;
  font-size: 0.75em;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--muted);
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--border);
}
.past.lo {
  left: 0;
}
.past.hi {
  right: 0;
}
.past.yours {
  color: var(--accent);
}
.past.theirs {
  color: var(--opponent);
}
/* The Speed picked: a dashed line in ink, under yours'; a Speed of the column hovered has the ladder's own instead. */
.probe {
  position: absolute;
  top: -3px;
  bottom: -3px;
  translate: -50% 0;
  border-left: 1px dashed var(--ink);
  pointer-events: none;
}
.hovering .probe {
  display: none;
}
.first {
  color: var(--accent);
}
/* With no sets, a word rather than a share, in the color of who moves first. */
.reach-verdict.always {
  color: var(--accent);
}
.reach-verdict.never {
  color: var(--opponent);
}
.reach-verdict.depends {
  color: var(--muted);
}
.ties {
  font-size: 0.75em;
  font-weight: normal;
  color: var(--muted);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 720px) {
  /* Yours' line down the whole row, the bar's own left out (it would stop at the bar). */
  .row .track > .line {
    display: none;
  }
  /* Over the Pokémon and its bar, beside the Speed's column, as wide as the bar. */
  .row-line {
    display: block;
    grid-column: 2 / -1;
    grid-row: 1 / span 2;
    position: relative;
    align-self: stretch;
    margin-block: -2px;
    pointer-events: none;
  }
  .row-line > .line {
    top: -1px;
    bottom: -1px;
  }
  /* The marks taller, as the bar has the row's whole width. */
  .track {
    min-height: 44px;
    --mark-max: 24px;
  }
  /* Behind the Pokémon. */
  .who {
    position: relative;
    z-index: 1;
  }
  .row {
    gap: 2px 8px;
    grid-template-areas:
      'speed who odds'
      'speed track track';
  }
  /* How yours does, its ties under it, so the Pokémon and what its row is of have the line's room; over yours' line. */
  .odds-cell {
    position: relative;
    z-index: 1;
    align-self: start;
    padding-top: 2px;
    line-height: 1.15;
  }
}
</style>
