<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Info } from '@lucide/vue'
import { ability, available, availableIds, move, pokemon, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import { ITEMS } from '@/data/items'
import { MOVES } from '@/data/moves'
import {
  POKEMON,
  STATS,
  barAt,
  gameStats,
  gameTotal,
  loadLearnsets,
  movesOf,
  speciesOf,
  spriteUrl,
  statColor,
} from '@/data/pokemon'
import { datasetDates, GENERATED_SNAPSHOTS, loadHistory, pastRoster, percent, type MetaHistory } from '@/data/meta'
import {
  baselineOf,
  buildsRegulation,
  EVENTS,
  eventsOf,
  loadEventUsage,
  loadRegulationBuilds,
  type EventUsage,
  type RegulationBuilds,
  type TournamentEvent,
} from '@/data/tournaments'
import { natureEffectOn, natureName } from '@/data/natures'
import { locale, t, tSlots, typeName } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { MIN_SHARE, speedBuilds } from '@/lib/speed'
import { FASTEST, type SpeedBuild } from '@/lib/speedBuild'
import { commonSpeed, odds, reachOf, setSpread, type SpreadPoint } from '@/lib/speedLineup'
import { holdScroll } from '@/lib/scroll'
import { MAX_POINTS, statValue } from '@/lib/stats'
import { percentiles } from '@/lib/statPercentiles'
import { MIN_MATCHES, pooledUsage } from '@/lib/tournamentStats'
import { useListOptions } from '@/composables/useListOptions'
import { useMeta } from '@/composables/useMeta'
import { useUnfolded } from '@/composables/useUnfolded'
import { useSpeedOptions } from '@/composables/useSpeedOptions'
import AppLink from '@/components/AppLink'
import BuildCards from '@/components/BuildCards.vue'
import CountryFlag from '@/components/CountryFlag'
import DefenseResults from '@/components/DefenseResults.vue'
import ItemList from '@/components/ItemList.vue'
import MoveTable from '@/components/MoveTable.vue'
import DexRef from '@/components/DexRef'
import DexText from '@/components/DexText'
import EntryTitle from '@/components/EntryTitle.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonChips from '@/components/PokemonChips.vue'
import PokemonIcon from '@/components/PokemonIcon'
import ListOptions from '@/components/ListOptions.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import SectionNav from '@/components/SectionNav.vue'
import ShareSplit from '@/components/ShareSplit.vue'
import SpeedShare from '@/components/SpeedShare.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'
import TeammateList from '@/components/TeammateList.vue'
import TypeIcon from '@/components/TypeIcon'
import { natureTip } from '@/components/natureTip'
import UsageShift from '@/components/UsageShift.vue'

// One Pokémon in the meta shown (`useMeta`, picked on the back row). Its heading has what matters most to a player: its
// stats as the game shows them, set against the Pokémon it'll face, each marked when its most common nature raises or
// lowers it; then, smaller, its rank, usage and how often it's brought. Then what its sets run (moves, items,
// abilities, each with its share of them), its natures and most common exact spreads (each a row of bars: the points in each
// stat, and the stat they give), its Speeds as the speed tiers draw them, its usage over the months of the dataset's
// series, and last its teammates. After its moves and items, its whole builds (the same item, ability, nature and moves
// together), from tournaments' team lists: the data shown's own when it has them, else every official event of its
// regulation's. The dex has the rest of it, a link away.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const ref_ = computed(() => pokemon(id.value))
const exists = computed(() => available(ref_.value))
const mon = computed(() => POKEMON[id.value])
// The species' other formes the dex has (Megas, regional formes, Rotom's appliances; not those that only look
// different), this one among them, each leading to its meta page. Shown only when it has others.
const formes = computed(() => {
  const species = speciesOf(id.value)
  return availableIds('pokemon').filter((p) => speciesOf(p) === species && !POKEMON[p].cosmetic)
})
const { snapshot, data, loading } = useMeta()
const m = computed(() => data.value?.[id.value])
// Whether its lists show what each entry does (`ListOptions`, at the top right of each).
const { descriptions: showDescriptions } = useListOptions()

// Its rank's change since the dataset before (as the list marks it), and its usage's.
const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
const climb = computed(() => (m.value?.prev ? m.value.prev.rank - m.value.rank : undefined))
const change = computed(() =>
  m.value?.usage !== undefined && m.value.prev?.usage !== undefined ? m.value.usage - m.value.prev.usage : undefined,
)
const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

// Its stats as the game shows them (`gameStats`), each a bar colored by its base stat (`statColor`), marked when its
// sets' most common nature raises or lowers it, and set against the Pokémon it'll face: every Pokémon in the snapshot,
// each counting as much as it's used (its usage, the share of teams with it), so the long tail barely counts. Their
// middle half is a band behind the bar, their median a tick through it, and the share of them it's above is said on
// the bar's hover (its base stat on its number's). Base stats go in (Megas as their own, as the meta has them): a stat's place among theirs is the same as the
// game's stat's, which only adds 20 (HP 75) to every one.
const natures = computed(() =>
  (m.value?.natures ?? [])
    .filter((n) => (n.share ?? 0) >= 0.03)
    .slice(0, 3)
    .map((n) => ({ key: n.id, share: n.share })),
)
const topNature = computed(() => natures.value[0]?.key)
const field = computed(() =>
  data.value
    ? percentiles(
        Object.entries(data.value).flatMap(([pid, x]) => {
          const p = POKEMON[pid as PokemonId]
          return p && x?.usage ? [{ stats: p.stats, weight: x.usage }] : []
        }),
      )
    : null,
)
/** A base stat as the game shows it, where it falls along the bar. */
const at = (base: number, i: number) => barAt(statValue(base, 0, 'neutral', i === 0))
const stats = computed(() => {
  const values = gameStats(mon.value)
  const f = field.value
  return STATS.map((s, i) => {
    const base = mon.value.stats[i]!
    const rank = f?.rank(i, base) ?? null
    const median = f?.quantile(i, 0.5) ?? null
    const low = f?.quantile(i, 0.25) ?? null
    const high = f?.quantile(i, 0.75) ?? null
    return {
      s,
      v: values[i]!,
      width: `${barAt(values[i]!)}%`,
      base,
      color: statColor(base),
      effect: topNature.value ? natureEffectOn(topNature.value, s) : 'neutral',
      tip: rank === null ? undefined : t('usageMon.statRank', { pct: Math.round(rank * 100) }),
      median: median === null ? null : `${at(median, i)}%`,
      band: low === null || high === null ? null : { left: `${at(low, i)}%`, width: `${at(high, i) - at(low, i)}%` },
    }
  })
})

// What its sets run: its moves, a table as the dex's (type, category, power, accuracy) with the share of its sets
// running each; its items and abilities, a list each, the share as a bar (out of all of them) and a number.
const moves = computed(() =>
  (m.value?.moves ?? []).flatMap((x) => (MOVES[x.id] ? [{ ref: move(x.id), share: x.share }] : [])),
)
const moveShares = computed(() => Object.fromEntries(moves.value.map((x) => [x.ref.id, x.share])))
// Or its whole movepool, as its dex entry has it, searchable (the link under the table): the moves its sets run with
// their share, the rest on under `LIST_MIN` of them. Remembered for the visit, per Pokémon (`useUnfolded`).
const movepool = useUnfolded(() => `movepool:${id.value}`)
// Unfolded, the page kept where it is (`holdScroll`).
function toggleMovepool() {
  if (!movepool.value) holdScroll()
  movepool.value = !movepool.value
}
/** What its whole movepool is filtered by, as the move rankings are, but for the Pokémon: it's this one's. */
const MOVE_KINDS = ['type', 'category', 'flag', 'reach', 'priority'] as const
// Its sets' view, the most run, as Smogon's own moveset files show them; the data keeps every one over `LIST_MIN`.
const SETS_MOVES = 10
const learnset = shallowRef<MoveId[] | null>(null)
watch(id, () => (learnset.value = null))
watch(movepool, async (on) => {
  if (!on || learnset.value) return
  const current = id.value
  const sets = await loadLearnsets()
  if (id.value === current) learnset.value = movesOf(sets, current)
})
const moveIds = computed(() => {
  const used = moves.value.map((x) => x.ref.id)
  if (!movepool.value || !learnset.value) return used.slice(0, SETS_MOVES)
  const seen = new Set(used)
  return [...used, ...learnset.value.filter((x) => !seen.has(x) && MOVES[x])]
})
// Its abilities, in its heading: every one it can have, with the share of its sets running it, the most run first. The
// data keeps those on at least `LIST_MIN` of its sets: one it doesn't have is under that.
const LIST_MIN = 0.01
const abilities = computed(() =>
  mon.value.abilities
    .map((a) => ({ key: a, ref: ability(a), share: m.value?.abilities?.find((x) => x.id === a)?.share }))
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0)),
)
// Its items. The data counts a Mega apart from its base forme, its Mega Stone only on the Mega's sets, so a base forme's
// items count its Megas' teams too, each holding its stone: every item's share out of both's (their usage added up, a
// team having one of them at most).
const megaStones = computed(() => {
  const d = data.value
  if (!d || !m.value?.usage) return []
  return (Object.keys(ITEMS) as ItemId[]).flatMap((i) => {
    const mega = ITEMS[i].megas?.[id.value]
    const usage = mega ? d[mega]?.usage : undefined
    return usage ? [{ id: i, usage }] : []
  })
})
const itemShares = computed(() => {
  const own = m.value?.items ?? []
  const base = m.value?.usage ?? 0
  const total = base + megaStones.value.reduce((sum, x) => sum + x.usage, 0)
  if (!megaStones.value.length) return Object.fromEntries(own.map((x) => [x.id, x.share]))
  return Object.fromEntries([
    ...own.map((x) => [x.id, x.share === undefined ? undefined : (x.share * base) / total]),
    ...megaStones.value.map((x) => [x.id, x.usage / total]),
  ])
})
const items = computed(() => Object.keys(itemShares.value).map((x) => ({ id: x as ItemId })))

// Its most common exact spreads, a row each: its share, its nature, and a bar per stat of the points put there (out of
// `MAX_POINTS`), the one its nature raises in the good color, the one it lowers outlined in the bad; on hover, the stat
// it gives.
const spreads = computed(() =>
  (m.value?.spreads ?? []).map((s) => ({
    ...s,
    stats: STATS.map((stat, i) => {
      const effect = natureEffectOn(s.nature, stat)
      const value = statValue(mon.value.stats[i]!, s.points[i]!, effect, stat === 'hp')
      return { stat, points: s.points[i]!, effect, value }
    }),
  })),
)

// Its most common builds, a card each: its rank and share of its sets, then its item, ability and nature, then its
// moves, the most run of them first, as its moves' list has them, each with its type's badge. The data shown's own
// when it has them (a tournament snapshot), else those of every official event of its regulation (generated whole,
// `loadRegulationBuilds`): the most sets there are under one set of rules, a regulation lasting a couple of months, so
// a Pokémon's builds aren't scattered thin as they would be at an event or two, nor at Day 2's teams alone.
// Until its regulation has had an event, those of the regulation before it, said so over them (`buildsRegulation`).
const regulationBuilds = shallowRef<{
  /** The regulation shown, and the one the builds are of. */
  shown: string
  regulation: string
  fallback: boolean
  builds: Partial<Record<PokemonId, RegulationBuilds>>
}>()
/** The day a regulation's data starts: its earliest dataset's. */
const regulationStart = (r: string) =>
  GENERATED_SNAPSHOTS.filter((s) => s.regulation === r).reduce<string | undefined>(
    (a, s) => (!a || s.from < a ? s.from : a),
    undefined,
  )
watch(
  () => (snapshot.value && !snapshot.value.capabilities.includes('builds') ? snapshot.value.regulation : undefined),
  async (shown) => {
    if (!shown || regulationBuilds.value?.shown === shown) return
    const from = buildsRegulation(shown, regulationStart(shown))
    const b = from ? await loadRegulationBuilds(from.regulation) : {}
    if (snapshot.value?.regulation === shown)
      regulationBuilds.value = {
        shown,
        regulation: from?.regulation ?? shown,
        fallback: !!from?.fallback,
        builds: b,
      }
  },
  { immediate: true },
)
const buildsFrom = computed(() => {
  if (m.value?.builds) return { builds: m.value.builds, sets: m.value.teams, events: undefined }
  const r = regulationBuilds.value
  const own = r && r.shown === snapshot.value?.regulation ? r.builds[id.value] : undefined
  return own
    ? {
        builds: own.builds,
        sets: own.sets,
        events: eventsOf(r!.regulation),
        regulation: r!.regulation,
        fallback: r!.fallback ? r!.shown : undefined,
      }
    : { builds: [], sets: undefined, events: undefined }
})
const builds = computed(() =>
  buildsFrom.value.builds.map((b) => ({
    ...b,
    moves: [...b.moves].sort((x, y) => (moveShares.value[y] ?? 0) - (moveShares.value[x] ?? 0)),
    // How many teams ran it, from its share of the sets.
    teams: Math.round(b.share * (buildsFrom.value.sets ?? 0)),
  })),
)

// Its Speeds at its sets, as the speed tiers draw a row, with nothing on: the Speeds its builds reach.
const BARE: SpeedBuild = { ...FASTEST, effect: 'neutral', points: 0 }
const spread = computed(() => (m.value?.speeds ? setSpread(id.value, speedBuilds(m.value.speeds), BARE) : []))
// Against the Pokémon it'll face, as the comparison sets one against another at its sets: every Pokémon of the dataset
// (or its top 50 or 100, as the options at the panel's top right say, `useSpeedOptions`) at its sets, as one spread,
// each counting as much as it's used; with its rare builds left out, as much as what's left of it. Its marks take the color of who moves first against
// most of them, and a bar says how often it moves first, ties or moves after (`odds`, `SpeedShare`); the speed pages
// have the rest.
const speedOptions = useSpeedOptions()
const metaSpeeds = computed((): SpreadPoint[] => {
  const d = data.value
  if (!d) return []
  const top = speedOptions.field.value === 'all' ? Infinity : Number(speedOptions.field.value)
  const bySpeed = new Map<number, number>()
  let total = 0
  for (const [pid, x] of Object.entries(d)) {
    if (!x?.usage || !x.speeds || !POKEMON[pid as PokemonId] || x.rank > top) continue
    const builds = speedBuilds(x.speeds)
    const kept = speedOptions.rare.value ? builds.filter((b) => b.share >= MIN_SHARE) : builds
    const w = (x.usage * kept.reduce((n, b) => n + b.share, 0)) / builds.reduce((n, b) => n + b.share, 0)
    if (!w) continue
    for (const p of setSpread(pid as PokemonId, kept, BARE)) {
      bySpeed.set(p.speed, (bySpeed.get(p.speed) ?? 0) + p.share * w)
    }
    total += w
  }
  return [...bySpeed].map(([speed, w]) => ({ speed, share: w / total, builds: [] })).sort((a, b) => b.speed - a.speed)
})
// The speed tiers with it as yours, at its most common build (as picking it there puts it).
const commonBuild = computed(() => m.value?.speeds && speedBuilds(m.value.speeds)[0])
const tiersQuery = computed(() => {
  const b = commonBuild.value
  return { mine: id.value, ...(b && { mynat: b.effect, mypts: String(b.points) }) }
})
// The comparison with it as yours, at its most common build too.
const compareQuery = computed(() => {
  const b = commonBuild.value
  return { a: id.value, ...(b && { anat: b.effect, apts: String(b.points) }) }
})
// Its side: its sets, or its most common Speed alone.
const mostCommon = computed(() => (spread.value.length ? commonSpeed(spread.value) : null))
const mySpeeds = computed((): SpreadPoint[] =>
  speedOptions.mine.value === 'common' && mostCommon.value !== null
    ? [{ speed: mostCommon.value, share: 1, builds: [] }]
    : spread.value,
)
const fieldOdds = computed(() =>
  mySpeeds.value.length && metaSpeeds.value.length ? odds(mySpeeds.value, metaSpeeds.value, false) : null,
)
// What the share is of, as the options say: over the bar, and in more words in its tooltip.
const fieldVs = computed(() => {
  const { mine, field } = speedOptions
  const against = field.value === 'all' ? t('usageMon.vsAll') : t('usageMon.vsTop', { n: field.value })
  return mine.value === 'common'
    ? t('usageMon.fieldVsCommon', { speed: mostCommon.value ?? '', field: against })
    : t('usageMon.fieldVsSets', { field: against })
})
const fieldTip = computed(() => {
  const { mine, field, rare } = speedOptions
  return [
    mine.value === 'common'
      ? t('usageMon.fieldTipCommon', { speed: mostCommon.value ?? '' })
      : t('usageMon.fieldTipSets'),
    field.value === 'all' ? t('usageMon.fieldTipAll') : t('usageMon.fieldTipTop', { n: field.value }),
    rare.value && t('usageMon.fieldTipRare', { pct: percent(MIN_SHARE) }),
  ]
    .filter(Boolean)
    .join(' ')
})

// Its usage over the dataset's series, a month each, when the series has more than one.
const history = shallowRef<MetaHistory | null>(null)
watch(
  snapshot,
  async (s) => {
    history.value = null
    const h = s ? await loadHistory(s) : null
    if (snapshot.value === s) history.value = h
  },
  { immediate: true },
)
const months = computed(() => {
  const h = history.value
  const row = h?.pokemon[id.value]
  if (!h || !row) return []
  return h.snapshots.map((s, i) => ({
    id: s.id,
    label: new Date(`${s.from}T00:00:00Z`).toLocaleDateString(locale.value, { month: 'short', timeZone: 'UTC' }),
    dates: datasetDates(s),
    rank: row[i]?.[0],
    usage: row[i]?.[1],
    current: s.id === snapshot.value?.id,
  }))
})
const topMonth = computed(() => Math.max(...months.value.map((x) => x.usage ?? 0), 0.0001))

// Its official tournaments, every regulation's, the latest first, each regulation's a run of its own: how many of each
// event's teams had it, the whole field's and the top cut's, from every event's few numbers (`loadEventUsage`), so no standings load. Its usage set against the events before each, pooled, as the
// event's own page sets its movers' (`baselineOf`: its regulation's earlier ones, or for its first the regulation's
// before), but for the first event of all. A regulation it wasn't legal in is its divider alone. Not of the
// meta shown, so shown with or without its data, and only when some event had it.
const eventUsage = shallowRef<Record<string, EventUsage> | null>(null)
void loadEventUsage().then((u) => (eventUsage.value = u))
// Its teams' win rate at the official tournaments of the regulation shown, every event's matches added up (as each
// event's Pokémon tab counts them), from the same few numbers; none under the whole field's minimum of matches.
const winRate = computed(() => {
  const u = eventUsage.value
  const r = snapshot.value?.regulation
  if (!u || !r) return null
  let wins = 0
  let losses = 0
  for (const e of eventsOf(r)) {
    const [, , , , w = 0, l = 0] = u[e.id]?.pokemon[id.value] ?? []
    wins += w
    losses += l
  }
  return wins + losses >= MIN_MATCHES.all
    ? { rate: wins / (wins + losses), wins, games: wins + losses, regulation: r }
    : null
})
interface EventRow {
  event: TournamentEvent
  usage: number
  /** Its share of the teams at the events before, pooled, and what they are; null for the first event of all. */
  before: number | null
  beforeLabel: string
  cut: number
  cutOf: number
}
const tournaments = computed(() => {
  const u = eventUsage.value
  if (!u) return []
  const runs: { regulation: string; legal: boolean; events: EventRow[] }[] = []
  for (const e of EVENTS) {
    const x = u[e.id]
    if (e.category !== 'official' || !x) continue
    let run = runs.at(-1)
    if (run?.regulation !== e.regulation) runs.push((run = { regulation: e.regulation, legal: false, events: [] }))
    const [all = 0, , cut = 0] = x.pokemon[id.value] ?? []
    const [teams, , cutTeams] = x.teams
    const b = baselineOf(e)
    const pooled = b.events.length
      ? pooledUsage(
          u,
          b.events.map((y) => y.id),
          'all',
        )
      : null
    run.events.push({
      event: e,
      usage: teams ? all / teams : 0,
      before: pooled?.teams ? (pooled.share.get(id.value) ?? 0) : null,
      beforeLabel: b.regulation
        ? t('tournaments.trendBeforeReg', { reg: b.regulation })
        : b.events.length === 1
          ? b.events[0]!.name
          : t('tournaments.trendBefore', { n: b.events.length }),
      cut,
      cutOf: cutTeams,
    })
  }
  for (const r of runs) {
    const roster = pastRoster(r.regulation)
    r.legal = !roster || roster.includes(id.value) || r.events.some((x) => x.usage > 0)
  }
  return runs.some((r) => r.events.some((x) => x.usage > 0)) ? runs : []
})
const topEvent = computed(() =>
  Math.max(...tournaments.value.flatMap((r) => r.events.flatMap((x) => [x.usage, x.before ?? 0])), 0.0001),
)
const eventDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

// Its teammates, the least of it, last: the data keeps the ten most common, those on at least this share of its teams.
const TEAMMATE_MIN = LIST_MIN
const teammates = computed(() => (m.value?.teammates ?? []).filter((x) => available(pokemon(x.id))))

// What its stats are and, when there's a meta, what they're set against: the tooltip of the icon by their total, drawn
// hidden in the page and handed to it.
const statsTipBody = useTemplateRef<HTMLElement>('statsTipBody')

// Its sections, as the row of links at its top lists them: those it shows.
const sections = computed(() =>
  [
    { id: 'sec-stats', label: t('usageMon.secStats'), shown: true },
    { id: 'sec-abilities', label: t('usageMon.abilities'), shown: true },
    { id: 'sec-moves', label: t('usageMon.moves'), shown: moves.value.length > 0 },
    { id: 'sec-items', label: t('usageMon.items'), shown: items.value.length > 0 },
    { id: 'sec-builds', label: t('usageMon.secBuilds'), shown: builds.value.length > 0 },
    { id: 'sec-speed', label: t('usageMon.speed'), shown: spread.value.length > 0 },
    { id: 'sec-spreads', label: t('usageMon.secSpreads'), shown: spreads.value.length > 0 || natures.value.length > 0 },
    { id: 'sec-history', label: t('usageMon.secHistory'), shown: months.value.length > 1 },
    { id: 'sec-teammates', label: t('usageMon.teammates'), shown: teammates.value.length > 0 },
    { id: 'sec-tournaments', label: t('usageMon.secTournaments'), shown: tournaments.value.length > 0 },
    { id: 'sec-matchups', label: t('pokemon.defense'), shown: true },
  ].filter((x) => x.shown),
)
</script>

<template>
  <template v-if="exists">
    <!-- The data shown, on the row of the way back: what the whole page is of. -->
    <Teleport to="#back-actions-metaPokemon" defer>
      <MetaDialog />
    </Teleport>

    <!-- The heading: who, its stats and what its sets do to them, and how much it's used. -->
    <!-- Its sections, a row of links stuck to the top, the one being read marked. -->
    <SectionNav v-if="m" :sections="sections" />

    <div id="sec-stats" class="panel head" :class="{ 'meta-stale': loading }">
      <!-- The sprite, and its weight in the panel's bottom left corner (on phones, last, at the left). -->
      <div class="sprite-col">
        <img
          v-if="!mon.noSprite"
          class="pixel sprite"
          :src="spriteUrl(id)"
          :alt="refName(ref_)"
          width="96"
          height="96"
          draggable="false"
        />
        <span v-else class="sprite icon-sprite"><PokemonIcon :id="id" :scale="2" /></span>
        <p class="weight muted">
          {{ t('pokemon.weight') }} <span class="num">{{ mon.weight }} kg</span>
        </p>
      </div>
      <div class="facts">
        <EntryTitle :to="ref_" meta />
        <div class="types">
          <AppLink v-for="ty in mon.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
            <TypeIcon v-tip="typeName(ty)" :type="ty" />
          </AppLink>
        </div>
        <!-- Its other formes, each a link to its meta page. -->
        <div v-if="formes.length > 1" class="formes">
          <span class="muted">{{ t('pokemon.formes') }}</span>
          <PokemonChips :ids="formes" :current="id" formes meta />
        </div>
        <!-- How much it's used, smaller: its rank and usage, with their changes, and under them its teams' win rate and how
             often it's brought. -->
        <div v-if="m" class="used">
          <p class="used-row">
            <span class="used-part"
              ><strong>#{{ m.rank }}</strong>
              <span v-if="climb" class="climb" :class="climb > 0 ? 'up' : 'down'"
                >{{ climb > 0 ? '▲' : '▼' }}{{ Math.abs(climb) }}</span
              ><span v-else-if="previous && !m.prev" class="climb fresh">{{ t('usage.new') }}</span></span
            >
            <span v-if="m.usage !== undefined" class="used-part"
              ><strong>{{ percent(m.usage) }}</strong>
              <span v-tip="t('usage.usageTip')" class="muted tipped">{{ t('usageMon.usage') }}</span>
              <span v-if="change !== undefined" class="climb" :class="change > 0 ? 'up' : change < 0 && 'down'">{{
                points(change)
              }}</span></span
            >
          </p>
          <p v-if="winRate || m.brought !== undefined" class="used-row">
            <span v-if="winRate" class="used-part"
              ><strong>{{ percent(winRate.rate) }}</strong>
              <span
                v-tip="
                  t('usageMon.winRateTip', {
                    wins: winRate.wins.toLocaleString(locale),
                    games: winRate.games.toLocaleString(locale),
                    regulation: winRate.regulation,
                  })
                "
                class="muted tipped"
                >{{ t('usageMon.winRate') }}</span
              ></span
            >
            <span v-if="m.brought !== undefined" class="used-part"
              ><strong>{{ percent(m.brought) }}</strong>
              <span v-tip="t('usage.broughtTip')" class="muted tipped">{{ t('usageMon.brought') }}</span></span
            >
          </p>
        </div>
      </div>
      <!-- Its stats as the dex has them, each with its sets' most common nature's mark. -->
      <div class="stats-col">
        <table class="stats">
          <tbody>
            <tr v-for="st in stats" :key="st.s">
              <th class="muted" :class="st.effect">
                {{ t(`stat.${st.s}`)
                }}<component
                  :is="st.effect === 'up' ? ChevronsUp : ChevronsDown"
                  v-if="st.effect !== 'neutral'"
                  class="nature-mark"
                  :size="14"
                  :stroke-width="3"
                  aria-hidden="true"
                />
              </th>
              <td v-tip="t('stats.base', { base: st.base })" class="r num">{{ st.v }}</td>
              <td v-tip="st.tip" class="bar-cell">
                <span class="track" :class="{ compared: st.band }">
                  <span v-if="st.band" class="band" :style="st.band"></span>
                  <span class="stat-bar" :style="{ width: st.width, background: st.color }"></span>
                  <span v-if="st.median" class="median" :style="{ left: st.median }"></span>
                </span>
              </td>
            </tr>
            <tr class="total">
              <th v-tip="t('stat.bstFull')" class="muted">{{ t('stat.bst') }}</th>
              <td class="r num">{{ gameTotal(mon) }}</td>
              <!-- What the stats are, and what they're set against, an icon's tooltip (tapped on phones). -->
              <td>
                <span
                  v-tip="statsTipBody"
                  class="stats-info"
                  tabindex="0"
                  role="img"
                  :aria-label="statsTipBody?.textContent ?? undefined"
                >
                  <Info :size="14" aria-hidden="true" />
                </span>
                <div hidden>
                  <div ref="statsTipBody" class="stats-tip">
                    <p class="tip-title">{{ t('usageMon.statsTip.head') }}</p>
                    <ul>
                      <li>{{ t('usageMon.statsTip.base') }}</li>
                      <li>{{ t('usageMon.statsTip.points') }}</li>
                      <li>{{ t('usageMon.statsTip.nature') }}</li>
                    </ul>
                    <p v-if="stats.some((st) => st.effect !== 'neutral')" class="tip-key">
                      <span class="up"><ChevronsUp :size="12" :stroke-width="3" aria-hidden="true" /></span
                      ><span class="down"><ChevronsDown :size="12" :stroke-width="3" aria-hidden="true" /></span>
                      {{ t('usageMon.statsTip.marked') }}
                    </p>
                    <template v-if="field">
                      <p class="tip-title">{{ t('usageMon.statsTip.vsHead') }}</p>
                      <p>{{ t('usageMon.statsTip.vs') }}</p>
                      <p class="tip-key"><span class="key-band"></span>{{ t('usageMon.statsTip.band') }}</p>
                      <p class="tip-key"><span class="key-median"></span>{{ t('usageMon.statsTip.median') }}</p>
                    </template>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="!m && data" class="panel">
      <p class="muted">{{ t('usageMon.none', { name: refName(ref_) }) }}</p>
    </div>

    <template v-else-if="m">
      <!-- Its abilities, a panel of their own: each with the share of its sets running it and what it does. -->
      <section id="sec-abilities" class="panel abilities-panel" :class="{ 'meta-stale': loading }">
        <div class="panel-head">
          <h2>{{ t('usageMon.abilities') }}</h2>
          <ListOptions />
        </div>
        <ul class="abilities">
          <li v-for="(a, i) in abilities" :key="a.key" :class="{ main: i === 0 && a.share }">
            <span class="ability-head">
              <DexRef :to="a.ref" meta class="ability-name" />
              <span class="num">{{ a.share === undefined ? `<${percent(LIST_MIN)}` : percent(a.share) }}</span>
            </span>
            <span class="bar" :style="{ '--share': a.share ?? 0 }"></span>
            <p v-if="showDescriptions" class="muted small ability-desc">
              <DexText :text="description('ability', a.key)?.short ?? ''" />
            </p>
          </li>
        </ul>
      </section>
      <!-- What its sets run: moves, items, abilities. -->
      <div class="cards" :class="{ 'meta-stale': loading }">
        <section v-if="moves.length" id="sec-moves" class="panel card moves-card">
          <div class="panel-head">
            <h2>{{ t('usageMon.moves') }}</h2>
            <!-- A toggle, not a way to another page: muted, with a chevron saying it unfolds here, as the pickers' "show
                 all"; cut short where the header has no room for it. -->
            <button type="button" class="more-toggle" :aria-pressed="movepool" @click="toggleMovepool">
              <component :is="movepool ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" /><span
                class="more-label"
                >{{ t(movepool ? 'usageMon.setsMoves' : 'usageMon.movepool') }}</span
              >
            </button>
            <ListOptions class="head-options" />
          </div>
          <MoveTable
            :key="movepool ? 'pool' : 'sets'"
            :ids="moveIds"
            :shares="moveShares"
            :under="`<${percent(LIST_MIN)}`"
            :descriptions="showDescriptions"
            :kinds="MOVE_KINDS"
            :no-filters="!movepool"
            no-pp
            stacked
          />
        </section>
        <section v-if="items.length" id="sec-items" class="panel card items-card">
          <div class="panel-head">
            <h2>{{ t('usageMon.items') }}</h2>
            <ListOptions />
          </div>
          <p v-if="megaStones.length" class="muted small builds-of">{{ t('usageMon.itemsMegas') }}</p>
          <ItemList :items="items" :shares="itemShares" :no-descriptions="!showDescriptions" />
        </section>
      </div>

      <!-- Its most common whole builds, a card each, side by side, wrapping. -->
      <section v-if="builds.length" id="sec-builds" class="panel" :class="{ 'meta-stale': loading }">
        <h2>{{ t('usageMon.builds') }}</h2>
        <!-- Its regulation with no events yet: the builds are the one before's, said so first. -->
        <p v-if="buildsFrom.fallback" class="builds-fallback small">
          <Info :size="14" aria-hidden="true" />{{
            t('usageMon.buildsFallback', { regulation: buildsFrom.fallback, previous: buildsFrom.regulation! })
          }}
        </p>
        <p v-if="buildsFrom.events?.length" class="muted small builds-of">
          <template v-for="(part, i) in tSlots('usageMon.buildsFromEvents')" :key="i">
            <template v-if="typeof part === 'string'">{{ part }}</template>
            <template v-else-if="part.slot === 'n'">{{ buildsFrom.sets!.toLocaleString(locale) }}</template>
            <AppLink
              v-else-if="buildsFrom.events.length === 1"
              :to="{ name: 'tournament', params: { id: buildsFrom.events[0]!.id } }"
              >{{ buildsFrom.events[0]!.name }}</AppLink
            >
            <AppLink v-else :to="{ name: 'tournaments' }">{{
              t('usageMon.buildsEvents', { n: buildsFrom.events.length, regulation: buildsFrom.regulation! })
            }}</AppLink>
          </template>
        </p>
        <p v-else-if="buildsFrom.sets" class="muted small builds-of">
          {{ t('usageMon.buildsOf', { n: buildsFrom.sets }) }}
        </p>
        <BuildCards
          :pokemon="id"
          :builds
          :regulation="buildsFrom.regulation ?? snapshot?.regulation"
          :remember="`builds:${id}`"
        />
      </section>

      <!-- Its Speeds, as the speed tiers draw a row, and the ways to them. -->
      <section v-if="spread.length" id="sec-speed" class="panel" :class="{ 'meta-stale': loading }">
        <div class="panel-head">
          <h2>{{ t('usageMon.speed') }}</h2>
          <OptionsMenu :title="t('usageMon.speedOptions')">
            <fieldset>
              <legend>{{ t('usageMon.optMine') }}</legend>
              <label
                ><input v-model="speedOptions.mine.value" type="radio" value="sets" />{{ t('usageMon.optSets') }}</label
              >
              <label
                ><input v-model="speedOptions.mine.value" type="radio" value="common" />{{
                  t('usageMon.optCommon')
                }}</label
              >
            </fieldset>
            <fieldset>
              <legend>{{ t('usageMon.optField') }}</legend>
              <label
                ><input v-model="speedOptions.field.value" type="radio" value="all" />{{ t('usageMon.optAll') }}</label
              >
              <label v-for="n in ['50', '100']" :key="n"
                ><input v-model="speedOptions.field.value" type="radio" :value="n" />{{
                  t('usageMon.optTop', { n })
                }}</label
              >
            </fieldset>
            <label
              ><input v-model="speedOptions.rare.value" type="checkbox" />{{
                t('usageMon.optRare', { pct: percent(MIN_SHARE) })
              }}</label
            >
          </OptionsMenu>
        </div>
        <SpeedSpread
          :spread="spread"
          tone="yours"
          :other="metaSpeeds.length ? { name: t('usageMon.field'), spread: metaSpeeds, sets: true } : null"
          :reach="reachOf(id, BARE)"
          :trick-room="false"
        />
        <template v-if="fieldOdds">
          <p class="muted small field-note">
            <span v-tip="fieldTip" class="tipped">{{ fieldVs }}</span>
          </p>
          <SpeedShare :odds="fieldOdds" :name="refName(ref_)" :other="t('usageMon.field')" tone="yours" />
        </template>
        <p class="links">
          <AppLink :to="{ name: 'speedTiers', query: tiersQuery }">{{ t('usageMon.toTiers') }} ›</AppLink>
          <AppLink :to="{ name: 'speedCompare', query: compareQuery }">{{ t('usageMon.toCompare') }} ›</AppLink>
        </p>
      </section>

      <!-- Its most common exact spreads, a card each, side by side: its rank and share of its sets on top, then its
           nature, then a bar per stat of the points put there; the stats named down the left, staying there as the
           cards scroll sideways on phones. -->
      <section
        v-if="spreads.length || natures.length"
        id="sec-spreads"
        class="panel"
        :class="{ 'meta-stale': loading }"
      >
        <h2 v-tip="t('usageMon.spreadsTip')" class="tipped-head">{{ t('usageMon.spreads') }}</h2>
        <!-- Its natures, each with the share of its sets running it, what it does on hover or tapped. -->
        <ShareSplit
          v-if="natures.length"
          class="natures"
          :label="t('usageMon.natures')"
          :parts="natures"
          :min="LIST_MIN"
          :tip="(n) => natureTip(n.key)"
        >
          <template #part="{ part }">{{ natureName(part.key) }}</template>
        </ShareSplit>
        <div v-if="spreads.length" class="spreads-scroll">
          <div class="spreads" role="table">
            <div class="spread-labels" aria-hidden="true">
              <span></span>
              <span>{{ t('usageMon.nature') }}</span>
              <span v-for="stat in STATS" :key="stat">{{ t(`stat.${stat}`) }}</span>
            </div>
            <div v-for="(s, i) in spreads" :key="i" class="spread-card" :class="{ main: i === 0 }" role="row">
              <span role="cell" class="spread-head meter" :style="{ '--share': s.share ?? 0 }"
                ><strong>#{{ i + 1 }}</strong> · {{ percent(s.share ?? 0) }}</span
              >
              <!-- The tooltip on its name alone, the cell being as wide as its column. -->
              <span role="cell" class="spread-nature"
                ><span v-tip:group.right="natureTip(s.nature)">{{ natureName(s.nature) }}</span></span
              >
              <span
                v-for="x in s.stats"
                :key="x.stat"
                role="cell"
                class="invest"
                :class="x.effect"
                :aria-label="t('usageMon.spreadStat', { stat: t(`stat.${x.stat}`), points: x.points, value: x.value })"
              >
                <span class="invest-bar" :style="{ '--share': x.points / MAX_POINTS }"></span>
                <span class="invest-text" aria-hidden="true"
                  ><span class="invest-pts" :class="{ none: !x.points }">{{ x.points }}</span
                  ><span class="invest-val"
                    ><component
                      :is="x.effect === 'up' ? ChevronsUp : ChevronsDown"
                      v-if="x.effect !== 'neutral'"
                      :size="12"
                      :stroke-width="3"
                    />{{ x.value }}</span
                  ></span
                >
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Its usage over the months of the dataset's series. -->
      <section v-if="months.length > 1" id="sec-history" class="panel">
        <h2>{{ t('usageMon.history') }}</h2>
        <ol class="months" :aria-label="t('usageMon.history')">
          <li
            v-for="x in months"
            :key="x.id"
            v-tip="
              x.usage === undefined
                ? t('usageMon.monthNone', { dates: x.dates })
                : t('usageMon.month', { dates: x.dates, usage: percent(x.usage), rank: x.rank ?? '' })
            "
            :class="{ current: x.current }"
          >
            <span class="month-value">{{ x.usage === undefined ? '—' : percent(x.usage) }}</span>
            <span class="month-bar" :style="{ '--share': (x.usage ?? 0) / topMonth }"></span>
            <span class="month-label">{{ x.label }}</span>
            <span class="month-rank muted">{{ x.rank ? `#${x.rank}` : '' }}</span>
          </li>
        </ol>
      </section>

      <!-- Its teammates, each a link to its own page here: the least of it, last. -->
      <section v-if="teammates.length" id="sec-teammates" class="panel" :class="{ 'meta-stale': loading }">
        <h2 v-tip="t('usageMon.teammatesTip', { share: percent(TEAMMATE_MIN) })" class="tipped-head">
          {{ t('usageMon.teammates') }}
        </h2>
        <TeammateList :mates="teammates" />
      </section>
    </template>

    <!-- Its official tournaments, the latest first, by regulation: each event's share of teams with it against the
         events before's, and the top cut's teams with it, each event leading to its standings narrowed to them. -->
    <section v-if="tournaments.length" id="sec-tournaments" class="panel">
      <h2>{{ t('usageMon.tournaments') }}</h2>
      <div class="events-table" role="table" :aria-label="t('usageMon.tournaments')">
        <div class="ev-row ev-head muted small" role="row">
          <!-- Each heading's tooltip on its text, not across its column. -->
          <span role="columnheader">{{ t('usageMon.evEvent') }}</span>
          <span role="columnheader"
            ><span v-tip="t('usageMon.evUsageTip')" class="tipped">{{ t('tournaments.col.usage') }}</span></span
          >
          <span role="columnheader" class="r"
            ><span v-tip="t('usageMon.evChangeTip')" class="tipped">{{ t('usageMon.evChange') }}</span></span
          >
          <span role="columnheader" class="r"
            ><span v-tip="t('usageMon.evCutTip')" class="tipped">{{ t('tournaments.day.cut') }}</span></span
          >
        </div>
        <template v-for="r in tournaments" :key="r.regulation">
          <div class="ev-reg" role="row">
            <span role="cell"
              >{{ t('meta.regulation', { reg: r.regulation })
              }}<span v-if="!r.legal" class="muted"> · {{ t('usageMon.evNotLegal') }}</span></span
            >
          </div>
          <template v-if="r.legal">
            <div v-for="x in r.events" :key="x.event.id" class="ev-row" role="row">
              <span role="cell" class="ev-what">
                <AppLink
                  :to="{ name: 'tournament', params: { id: x.event.id }, query: { f: `pokemon:${id}` } }"
                  class="ev-name"
                  >{{ x.event.name }}</AppLink
                >
                <span class="muted small"
                  ><time :datetime="x.event.date">{{ eventDate(x.event.date) }}</time> ·
                  <CountryFlag :code="x.event.country"
                /></span>
              </span>
              <!-- Its usage against the events before, a bar with the numbers on it, then the change in points. -->
              <span
                v-tip="x.before === null ? undefined : t('usageMon.evShiftTip', { before: x.beforeLabel })"
                role="cell"
                class="ev-usage"
              >
                <UsageShift :before="x.before" :usage="x.usage" :max="topEvent" />
              </span>
              <span
                role="cell"
                class="num ev-change"
                :class="x.before === null || x.usage === x.before ? '' : x.usage > x.before ? 'up' : 'down'"
                ><template v-if="x.before !== null"
                  ><span class="ev-label muted">{{ t('usageMon.evChange') }} </span
                  >{{ points(x.usage - x.before) }}</template
                ></span
              >
              <span role="cell" class="num ev-cut"
                ><span class="ev-label muted">{{ t('tournaments.day.cut') }} </span>{{ x.cut }}/{{ x.cutOf }}</span
              >
            </div>
          </template>
        </template>
      </div>
    </section>

    <!-- Its types' matchups defending, last: not of the meta, so shown with or without its data. -->
    <section id="sec-matchups" class="panel">
      <h2>{{ t('pokemon.defense') }}</h2>
      <DefenseResults :types="mon.types" bare />
    </section>

    <!-- How many battles the data shown covers, at the page's end. -->
    <p v-if="snapshot?.battles" class="muted battles">
      {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
    </p>
  </template>
  <div v-else class="panel">
    <p>{{ t('usageMon.notFound', { id }) }}</p>
  </div>
</template>

<style scoped>
/* The sprite, centered in what's left over its weight, which sits at the bottom left. */
.sprite-col {
  flex: none;
  align-self: stretch;
  display: flex;
  flex-direction: column;
}
.sprite-col .sprite {
  margin: auto 0;
}
.weight {
  margin: 0;
  font-size: 0.85em;
}
/* Room above each section for the row of links stuck to the top, when scrolled to it; the moves' and items' table
   headers stick under that row rather than behind it. */
.panel {
  scroll-margin-top: 48px;
}
:deep(.dex-table .head) {
  top: 37px;
}
.battles {
  margin: 0;
  font-size: 0.85em;
  text-align: right;
}
/* The heading, as the dex's: the sprite, the facts, the stats at the right. */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.sprite {
  flex: none;
  width: 192px;
  height: 192px;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.facts {
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.facts .entry-title {
  margin: 0;
}
.types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.formes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
/* How much it's used: two lines of their own (rank and usage, then win rate and brought), smaller than the stats. */
.used {
  display: grid;
  gap: 2px;
}
.used-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin: 0;
}
.used-part {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.used strong {
  font-variant-numeric: tabular-nums;
}
.tipped,
.tipped-head {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.tipped-head {
  width: fit-content;
}
.climb {
  margin-left: 4px;
  font-size: 0.85em;
  font-weight: bold;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
.fresh {
  color: var(--accent);
}
/* The stats, as the dex's: label, base, bar; then the points its sets put there. */
.stats-col {
  flex: 1 1 360px;
  min-width: 0;
  max-width: 520px;
  margin-left: auto;
}
/* Its abilities: a card each, side by side as there's room, its name and share over a bar, what it does under them;
   the one its sets run most outlined. */
.abilities {
  display: grid;
  /* No wider than the panel, when that's narrower than a card. */
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: 10px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.abilities li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.abilities li.main {
  border-color: var(--accent);
}
.ability-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ability-name {
  font-weight: bold;
}
.ability-desc {
  margin: 0;
}
/* Its natures, over its spreads. */
.natures {
  margin-bottom: 12px;
}
.stats {
  width: 100%;
  border-collapse: collapse;
}
.stats th {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}
/* The stat its most common nature raises or lowers: its label in that color, marked. */
.stats th.up,
.stats th.down {
  font-weight: bold;
}
.nature-mark {
  margin-left: 1px;
  vertical-align: -2px;
}
.stats td.r {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: right;
}
.bar-cell {
  width: 100%;
  min-width: 60px;
}
.track {
  position: relative;
  display: block;
  height: 10px;
  background: color-mix(in srgb, var(--border) 35%, transparent);
  border-radius: 2px;
}
.stat-bar {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 2px;
}
/* Set against the Pokémon it'll face, a bullet chart: their middle half a band, the bar thinner over it, their median a
   tick through both. */
.track.compared {
  height: 12px;
  border-radius: 0;
}
.band,
.median {
  position: absolute;
}
.band {
  top: 0;
  bottom: 0;
  background: var(--border);
}
.compared .stat-bar {
  inset: 3px auto 3px 0;
  border-radius: 0;
}
.median {
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--text);
}
/* What the stats are, and what they're set against, explained on hover or tapped. */
.stats-info {
  display: inline-flex;
  vertical-align: -2px;
  color: var(--muted);
  cursor: help;
}
.stats-info:hover,
.stats-info:focus-visible {
  color: var(--text);
}
/* Its tooltip: a heading over what the numbers are, then one over what the bars set them against, with a key to the
   marks. */
.stats-tip {
  max-width: 280px;
}
.stats-tip p,
.stats-tip ul {
  margin: 0;
}
.stats-tip ul {
  padding-left: 14px;
}
.stats-tip .tip-title {
  font-weight: bold;
}
.stats-tip .tip-title + * {
  margin-top: 2px;
}
.stats-tip * + .tip-title {
  margin-top: 8px;
}
.stats-tip .tip-key {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.stats-tip .tip-key > .up,
.stats-tip .tip-key > .down {
  display: inline-flex;
}
.stats-tip .tip-key > .down {
  margin-left: -6px;
}
.key-band {
  flex: none;
  width: 18px;
  height: 10px;
  background: var(--border);
}
.key-median {
  flex: none;
  width: 2px;
  height: 14px;
  margin: 0 8px;
  background: var(--text);
}
.stats .total td,
.stats .total th {
  padding-top: 6px;
  font-weight: bold;
}
/* The moves at the left, the items at the right (their descriptions under them), each as tall as it is; one under the
   other where they don't fit side by side. */
.cards {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  grid-template-areas: 'moves items';
  gap: 0 16px;
  align-items: start;
}
.moves-card {
  grid-area: moves;
}
.items-card {
  grid-area: items;
}
@media (max-width: 900px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'moves' 'items';
  }
}
/* The share, as the usage list's: its number, its bar under it, out of all of its sets. */
.meter {
  position: relative;
  padding-bottom: 5px;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
}
.meter::before {
  right: 0;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc(100% * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
/* Its builds from the regulation before, said in a strip over them. */
.builds-fallback {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: -4px 0 8px;
  padding: 6px 8px;
  background: var(--panel-alt);
  border-left: 3px solid var(--accent);
}
.builds-fallback .lucide {
  flex: none;
  margin-top: 0.2em;
}
/* Its builds, a card each, as many to a row as fit: five on wide screens, its ten in two even rows. */
.builds-of {
  margin: -4px 0 8px;
}
/* A list's heading, its options at the right (`ListOptions`): whether the short descriptions show. */
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-head h2 {
  margin-bottom: 0;
}
/* Beside the moves' heading, whether they're its sets' top or its whole movepool: as long as there's room for. */
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-right: auto;
  padding: 2px 6px 2px 2px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.more-toggle > svg {
  flex: none;
}
.more-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.panel-head h2,
.head-options {
  flex: none;
}
.more-toggle:hover {
  color: var(--text);
  background: var(--hover);
}
h2 {
  margin-top: 0;
}
/* A list of shares: what, its bar (out of all of its sets), its number. */
.bar {
  position: relative;
  height: 6px;
  background: color-mix(in srgb, var(--border) 50%, transparent);
}
.bar::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--share, 0));
  background: var(--accent);
}
.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.small {
  font-size: 0.85em;
}
/* The spreads: the stats' names down the left, then a card per spread, side by side, each the same rows (its head,
   its nature, a stat each) at the same heights as the names, so they line up across. The most used outlined. */
.spreads-scroll {
  overflow-x: auto;
}
.spreads {
  --spread-rows: 36px 24px repeat(6, 26px);
  display: flex;
  gap: 8px;
}
.spread-labels,
.spread-card {
  display: grid;
  grid-template-rows: var(--spread-rows);
  row-gap: 6px;
  align-items: center;
}
/* The stats' names: past the cards' border and padding at their top, so they're level with their rows; scrolling
   sideways (phones), they stay at the left, on the panel's color, the cards passing under them. */
.spread-labels {
  position: sticky;
  left: 0;
  z-index: 1;
  flex: none;
  width: 3em;
  padding: 9px 0;
  font-size: 0.85em;
  color: var(--muted);
  background: var(--panel);
  box-shadow: 8px 0 0 var(--panel);
}
.spread-card {
  flex: 1 0 110px;
  min-width: 110px;
  padding: 8px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.spread-card.main {
  border-color: var(--accent);
}
/* Its rank and share of its sets, its bar under them, out of all of them. */
.spread-head {
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  white-space: nowrap;
}
.spread-nature {
  font-weight: bold;
  white-space: nowrap;
}
/* A stat of a spread: a bar of its points, on a faint track, with over it the points at its start and the stat
   they give at its end, the nature's mark after it: the bar the good color under the stat the nature raises, the cell
   outlined in the bad around the one it lowers. */
.invest {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 22px;
  background: color-mix(in srgb, var(--border) 40%, transparent);
}
.invest-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--share, 0));
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.invest.up .invest-bar {
  background: color-mix(in srgb, var(--good) 55%, transparent);
}
.invest.down {
  box-shadow: inset 0 0 0 1px var(--bad);
}
.invest-text {
  position: relative;
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0 5px;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
/* Its points: those put in it set off a little, in the text's color; none, faded back. */
.invest-pts {
  font-weight: 500;
}
.invest-pts.none {
  font-weight: normal;
  color: var(--muted);
  opacity: 0.5;
}
.invest-val {
  display: inline-flex;
  align-items: center;
  font-weight: bold;
}
.invest.down .invest-val {
  color: var(--bad);
}
.note {
  margin: 10px 0 0;
}
.field-note {
  margin: 12px 0 6px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 12px 0 0;
  font-weight: bold;
}
/* Its usage by month: a bar each, from a common floor, as tall as its usage against its best month's; the month shown
   marked. */
.months {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin: 0;
  padding: 0;
  list-style: none;
}
.months li {
  display: flex;
  flex: 0 1 72px;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.month-value {
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.month-bar {
  width: 60%;
  height: calc(4px + 96px * var(--share, 0));
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.current .month-bar {
  background: var(--accent);
}
.current .month-label {
  font-weight: bold;
}
.month-rank {
  font-size: 0.8em;
}
/* Its official tournaments: a row per event, its name and date, its share of the teams against the events before's,
   a bar on one scale for every event, the change in points, and the top cut's teams with it; each regulation's run
   under a divider. On phones, the name across, and its bar, change and top cut under it, the top cut labeled. */
.events-table {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, 14rem) 3.5em 4.5em;
  gap: 6px 14px;
  align-items: center;
}
.ev-row,
.ev-reg {
  display: contents;
}
/* A regulation's divider: its name on a faint band across, no rule, so it doesn't compete with the rows' leaders. */
.ev-reg > span {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-weight: bold;
}
.ev-head .r {
  text-align: right;
}
.ev-what {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  column-gap: 10px;
  min-width: 0;
}
.ev-what > * {
  grid-column: 1;
}
/* A dotted leader from its name and date to its bar, at the bar's height, so the eye keeps to the row across. */
.ev-what::after {
  content: '';
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: center;
  min-width: 12px;
  border-bottom: 1px dotted color-mix(in srgb, var(--muted) 55%, transparent);
}
.ev-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ev-change.up {
  color: var(--good);
}
.ev-change.down {
  color: var(--bad);
}
.ev-label {
  display: none;
}
@media (max-width: 560px) {
  .events-table {
    display: block;
  }
  .ev-row.ev-head {
    display: none;
  }
  /* A row per event, ruled off from the next: its name (wrapping rather than clipped) and date, its bar across, then
     its change and top cut, labeled, on a line of their own. */
  .ev-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'what what' 'bar bar' 'change cut';
    gap: 6px 20px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .ev-row:last-child,
  .ev-row:has(+ .ev-reg) {
    border-bottom: 0;
  }
  .ev-reg,
  .ev-reg > span {
    display: block;
    margin-top: 12px;
  }
  .ev-what {
    grid-area: what;
    display: flex;
    flex-direction: column;
  }
  .ev-what::after {
    display: none;
  }
  .ev-name {
    white-space: normal;
  }
  .ev-usage {
    grid-area: bar;
  }
  .ev-change {
    grid-area: change;
    text-align: left;
  }
  .ev-cut {
    grid-area: cut;
    text-align: left;
  }
  /* The first event of all, with no change: its top cut where the change would be. */
  .ev-change:empty {
    display: none;
  }
  .ev-change:empty + .ev-cut {
    grid-area: change;
  }
  .ev-label {
    display: inline;
    margin-right: 6px;
  }
}
/* Phones, as its dex entry: the name and types beside the sprite, then its use and the stats below, at the left. */
@media (max-width: 560px) {
  .sprite-col {
    display: contents;
  }
  .sprite-col .sprite {
    margin: 0;
  }
  .weight {
    grid-column: 1 / -1;
    order: 1;
  }
  .head {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    grid-template-areas:
      'sprite title'
      'sprite types';
    gap: 8px 12px;
  }
  .facts {
    display: contents;
  }
  .facts > * {
    grid-column: 1 / -1;
  }
  .facts .entry-title {
    grid-area: title;
    align-self: end;
  }
  .head .types {
    grid-area: types;
    align-self: start;
  }
  .sprite {
    grid-area: sprite;
    width: 96px;
    height: 96px;
  }
  .icon-sprite :deep(.sheet-icon) {
    zoom: 0.5;
  }
  .stats-col {
    grid-column: 1 / -1;
    margin: 8px 0 0;
  }
}
</style>
