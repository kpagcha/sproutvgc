<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Box } from '@lucide/vue'
import { move, pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { has, percent, usageRanks } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { commonBuilds, pointsToMoveFirst, speedBuilds, speedStat } from '@/lib/speed'
import { FASTEST, buildQuery, buildSpeed, modsOf, pointsText, readBuild, type SpeedBuild } from '@/lib/speedBuild'
import { commonSpeed, exactSpread, odds, setSpread, type Odds } from '@/lib/speedLineup'
import { immunities, threatOf, type Threat } from '@/lib/threats'
import { formatMult, multClass } from '@/lib/typecalc'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import AppLink from '@/components/AppLink'
import DexRef from '@/components/DexRef'
import HelpToggle from '@/components/HelpToggle.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SetupStar from '@/components/SetupStar.vue'
import SpeedEditor from '@/components/SpeedEditor.vue'
import SpeedShare from '@/components/SpeedShare.vue'
import TypeIcon from '@/components/TypeIcon'

// What hits yours super effectively, and how it does on Speed against each: the Pokémon of the meta whose sets run a
// super-effective damaging move against it (`threatOf`), on at least `THREAT_SHARE` of them, in three groups: those
// hitting with priority, those moving before it, and those it moves before. Yours as on the speed tiers, under the
// same letters (`mine`, `mynat`, `mypts`, `mymods`, `mystage`), so the two link to each other with it; the opponents at
// their sets, with no modifiers of their own. With `trickroom`, the slower moves first.
const route = useRoute()
const router = useRouter()
const replace = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })

/** The least share of a Pokémon's sets running a super-effective move for it to count as a threat. */
const THREAT_SHARE = 0.2
/** The most of a threat's moves listed. */
const MOVES_SHOWN = 4

const { snapshot, data, loading } = useMeta()
const hasMoves = computed(() => !!snapshot.value && has(snapshot.value, 'moves') && has(snapshot.value, 'speeds'))
const ranks = computed(() => (data.value ? usageRanks(data.value) : undefined))
const canHover = window.matchMedia('(hover: hover)').matches
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.threats.helpOpen', false)

const trickRoom = computed(() => route.query.trickroom === '1')
const toggleTrickRoom = () => replace({ trickroom: trickRoom.value ? undefined : '1' })

// Yours.
const mine = computed(() => {
  const id = route.query.mine
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
const myBuild = computed(() => readBuild(route.query, 'my'))
const buildsOf = (id: PokemonId) => speedBuilds(data.value?.[id]?.speeds ?? [])
const myCommon = computed(() => (mine.value ? commonBuilds(buildsOf(mine.value)) : []))
const myStat = computed(() =>
  mine.value ? speedStat(POKEMON[mine.value].stats[5], myBuild.value.points, myBuild.value.effect) : null,
)
const mySpeed = computed(() => (mine.value ? buildSpeed(mine.value, myBuild.value) : null))
const myName = computed(() => (mine.value ? refName(pokemon(mine.value)) : ''))
/** Picks yours, at the meta's most common build of it, else the fastest; its modifiers kept. */
function pickMine(id: PokemonId) {
  const b = buildsOf(id)[0]
  const build: SpeedBuild = { ...FASTEST, ...(b && { effect: b.effect, points: b.points }), toggles: [], stage: 0 }
  void replace({ mine: id, ...buildQuery({ ...build, toggles: myBuild.value.toggles }, 'my') })
}
const setBuild = (b: Partial<SpeedBuild>) => void replace(buildQuery({ ...myBuild.value, ...b }, 'my'))
const clearMine = () => void replace({ mine: undefined, mynat: undefined, mypts: undefined, mymods: undefined })

interface Row {
  id: PokemonId
  name: string
  usage: number
  threat: Threat
  /** Of its threatening sets, the share hitting with priority. */
  priority: number
  /** How yours does against its sets: priority's counted as moving first, whatever the Speeds. */
  odds: Odds
  /** Its sets' most common Speed, and its slowest and fastest. */
  speed: number
  range: readonly [number, number]
  /** What it takes yours to move before its most common Speed. */
  toMoveFirst: string
  /** Its weight in the summary: its usage, times the share of its sets threatening yours. */
  weight: number
}

/** Every threat to yours, the heaviest first. */
const rows = computed<Row[]>(() => {
  const id = mine.value
  const meta = data.value
  if (!id || !meta || !hasMoves.value || mySpeed.value === null) return []
  const immune = immunities(id, meta[id])
  const mySpread = exactSpread(id, myBuild.value)
  const mods = modsOf(myBuild.value, id)
  const list: Row[] = []
  for (const [k, m] of Object.entries(meta)) {
    const opp = k as PokemonId
    if (!(opp in POKEMON) || !m.speeds?.length) continue
    const threat = threatOf(opp, m, POKEMON[id].types, immune)
    if (!threat || threat.share < THREAT_SHARE) continue
    const spread = setSpread(opp, speedBuilds(m.speeds), { ...FASTEST, toggles: [], stage: 0 })
    if (!spread.length) continue
    const o = odds(mySpread, spread, trickRoom.value)
    const priority = threat.priority / threat.share
    const speed = commonSpeed(spread)
    list.push({
      id: opp,
      name: refName(pokemon(opp)),
      usage: m.usage ?? 0,
      threat,
      priority,
      odds: {
        first: o.first * (1 - priority),
        tie: o.tie * (1 - priority),
        after: o.after * (1 - priority) + priority,
      },
      speed,
      range: [spread[spread.length - 1]!.speed, spread[0]!.speed],
      toMoveFirst: pointsText(
        pointsToMoveFirst(POKEMON[id].stats[5], myBuild.value.effect, mods, speed, trickRoom.value),
      ),
      weight: (m.usage ?? 0) * threat.share,
    })
  }
  return list.sort((a, b) => b.weight - a.weight)
})

const GROUPS = ['priority', 'before', 'after'] as const
type Group = (typeof GROUPS)[number]
/** Its group: hitting with priority on at least `THREAT_SHARE` of its sets; else moving before yours in at least half
 * its matchups, or not. */
function groupOf(r: Row): Group {
  if (r.threat.priority >= THREAT_SHARE) return 'priority'
  return r.odds.first < 0.5 ? 'before' : 'after'
}
const groups = computed(() =>
  GROUPS.map((g) => ({ g, rows: rows.value.filter((r) => groupOf(r) === g) })).filter((x) => x.rows.length),
)

/** How yours does against them all, each by its weight. */
const summary = computed(() => {
  const total = rows.value.reduce((n, r) => n + r.weight, 0)
  if (!total) return null
  const sum = (f: (r: Row) => number) => rows.value.reduce((n, r) => n + f(r) * r.weight, 0) / total
  return {
    odds: { first: sum((r) => r.odds.first), tie: sum((r) => r.odds.tie), after: sum((r) => r.odds.after) },
    priority: sum((r) => r.priority),
  }
})

const speedRange = (r: Row) => (r.range[0] === r.range[1] ? String(r.range[0]) : `${r.range[0]}–${r.range[1]}`)
/** Yours against it on the comparison, at its sets. */
const compareTo = (id: PokemonId) => ({
  name: 'speedCompare',
  query: {
    a: mine.value!,
    ...buildQuery(myBuild.value, 'a'),
    b: id,
    bsets: '1',
    trickroom: trickRoom.value ? '1' : undefined,
  },
})
</script>

<template>
  <div class="threats-page">
    <!-- The heading, as the other speed pages': the title and its star, the data shown, how to read the page. -->
    <section class="panel page-head">
      <div class="head">
        <h1>{{ t('title.speedThreats') }}<SetupStar /></h1>
        <MetaDialog v-if="hasMoves" class="head-meta" />
        <HelpToggle class="head-help" :open="helpOpen" controls="threats-help" fit icon-only @toggle="toggleHelp" />
      </div>
      <div v-if="helpOpen" id="threats-help" class="help-body panel sunken small">
        <dl class="help-options">
          <dt>{{ t('threats.helpThreatsLabel') }}</dt>
          <dd class="muted">{{ t('threats.helpThreats', { pct: percent(THREAT_SHARE) }) }}</dd>
          <dt>{{ t('threats.helpShareLabel') }}</dt>
          <dd class="muted">{{ t('threats.helpShare') }}</dd>
          <dt>{{ t('threats.helpGroupsLabel') }}</dt>
          <dd class="muted">{{ t('threats.helpGroups', { pct: percent(THREAT_SHARE) }) }}</dd>
          <dt>{{ t('speed.mod.trickroom') }}</dt>
          <dd class="muted">{{ t('compare.trickroomTip') }}</dd>
        </dl>
      </div>
    </section>

    <div class="panel toolbar">
      <button
        v-tip="canHover && t('compare.trickroomTip')"
        type="button"
        class="btn switch"
        :class="{ on: trickRoom }"
        :aria-pressed="trickRoom"
        @click="toggleTrickRoom"
      >
        <Box :size="16" aria-hidden="true" />{{ t('speed.mod.trickroom') }}
      </button>
    </div>

    <div class="layout">
      <section class="panel banded yours">
        <div class="band">{{ t('speed.yours') }}</div>
        <SpeedEditor
          :id="mine"
          :build="myBuild"
          :speed="mySpeed"
          :stat="myStat"
          :common="myCommon"
          :title="t('speed.yours')"
          tone="yours"
          :ranks
          @pick="pickMine"
          @build="setBuild"
          @clear="clearMine"
        />
      </section>

      <div class="results" :class="{ 'meta-stale': loading }" :aria-busy="loading">
        <p v-if="!hasMoves" class="panel muted">{{ t('threats.noMoves') }}</p>
        <p v-else-if="!mine" class="panel muted">{{ t('threats.pick') }}</p>
        <p v-else-if="data && !rows.length" class="panel muted">
          {{ t('threats.none', { name: myName, pct: percent(THREAT_SHARE) }) }}
        </p>
        <template v-else-if="summary">
          <!-- How yours does against them all. -->
          <section class="panel summary">
            <h2>{{ t('threats.summary', { name: myName }) }}</h2>
            <SpeedShare :odds="summary.odds" :name="myName" :other="t('threats.them')" tone="yours" />
            <p class="small">
              <strong v-if="summary.priority">{{
                t('threats.priorityShare', { pct: percent(summary.priority) })
              }}</strong>
              <span class="muted"> {{ t('threats.summaryNote') }}</span>
            </p>
          </section>

          <!-- The threats, by group, the heaviest first. -->
          <section v-for="grp in groups" :key="grp.g" class="panel group" :class="grp.g">
            <h2>
              {{ t(`threats.group.${grp.g}`, { name: myName }) }} <span class="muted">({{ grp.rows.length }})</span>
            </h2>
            <ul class="rows">
              <li v-for="r in grp.rows" :key="r.id" class="row">
                <div class="who">
                  <AppLink :to="{ name: 'pokemon', params: { id: r.id } }" class="mon"
                    ><PokemonIcon :id="r.id" /><strong>{{ r.name }}</strong></AppLink
                  >
                  <span class="muted small">{{ t('threats.usage', { pct: percent(r.usage) }) }}</span>
                  <AppLink :to="compareTo(r.id)" class="btn compare small">{{ t('threats.compare') }}</AppLink>
                </div>
                <ul class="moves small">
                  <li v-for="m in r.threat.moves.slice(0, MOVES_SHOWN)" :key="m.id" class="move">
                    <TypeIcon :type="m.type" />
                    <DexRef :to="move(m.id)" />
                    <span class="mult" :class="multClass(m.mult)">{{ formatMult(m.mult) }}</span>
                    <span class="muted">{{ percent(m.share) }}</span>
                    <span v-if="m.priority" class="prio">{{ t('threats.priority') }}</span>
                  </li>
                </ul>
                <p class="speeds small">
                  {{ t('threats.speeds', { speed: r.speed, range: speedRange(r) }) }}
                  <template v-if="grp.g === 'before'">
                    · {{ t('threats.toMoveFirst', { text: r.toMoveFirst }) }}</template
                  >
                </p>
                <SpeedShare :odds="r.odds" :name="myName" :other="r.name" tone="yours" />
              </li>
            </ul>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.head h1 {
  display: flex;
  flex: none;
  align-items: center;
  margin: 0;
}
.head-meta {
  flex: 0 1 auto;
}
@media (max-width: 720px) {
  .head-help :deep(span) {
    display: none;
  }
}
.help-body {
  margin: 12px 0 0;
  padding: 8px 10px;
}
.help-options {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 0;
}
.help-options dt {
  font-weight: bold;
}
.help-options dd {
  margin: 0;
}
@media (max-width: 720px) {
  .help-options {
    grid-template-columns: 1fr;
  }
  .help-options dd {
    margin-bottom: 4px;
  }
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.switch {
  justify-content: flex-start;
  gap: 6px;
  font-weight: bold;
}
.switch.on {
  background: var(--sel);
}
.small {
  font-size: 0.875em;
}
/* Yours beside the results on wide screens, stuck as they scroll; over them on phones. */
.layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.yours {
  position: sticky;
  top: 8px;
}
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .yours {
    position: static;
  }
}
.results {
  display: grid;
  gap: 12px;
  transition: opacity 0.15s;
}
.meta-stale {
  opacity: 0.5;
}
.results > p {
  margin: 0;
}
h2 {
  margin: 0 0 8px;
  font-size: 1.05em;
}
.summary p {
  margin: 8px 0 0;
}
.rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: grid;
  gap: 4px;
  padding: 10px 0;
}
.row + .row {
  border-top: 1px solid var(--border);
}
.row:last-child {
  padding-bottom: 0;
}
.who {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}
.mon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
}
.compare {
  min-height: 0;
  margin-left: auto;
  padding: 2px 8px;
}
.moves {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.move {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.mult {
  padding: 0 4px;
  font-weight: bold;
}
.prio {
  padding: 0 4px;
  font-weight: bold;
  background: var(--sel);
}
.speeds {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
