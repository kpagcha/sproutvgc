<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronsDown, ChevronsUp, Funnel, RotateCcw, Rocket, Trash2, X } from '@lucide/vue'
import {
  ability as abilityRef,
  availableIds,
  item as itemRef,
  pokemon,
  type AbilityId,
  type ItemId,
  type PokemonId,
} from '@/data/dex'
import { has, pastRoster, percent, usageRanks, type PokemonMeta, type Share } from '@/data/meta'
import { POKEMON, splitForme, type StatId } from '@/data/pokemon'
import { t, tSplit } from '@/i18n'
import { refName } from '@/i18n/refName'
import { passesGroups } from '@/lib/filterGroups'
import { formatTermFilters, parseTermFilters, type Term, type TermFilters, type TermKind } from '@/lib/searchTerms'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { NATURE_EFFECTS } from '@/lib/speed'
import {
  abilityOf,
  boostItems,
  boostsOf,
  buildKey,
  byUsage,
  myBoostsOf,
  sideFactor,
  statIndex,
  tierBench,
  tierBuilds,
  tierLabel,
  tierOdds,
  tierReach,
  tierValue,
  type Measure,
  type PowerBy,
  type TierBoost,
  type TierBuild,
} from '@/lib/balanceTiers'
import { shapeOf, type Plotted, type Side } from '@/lib/teamBalance'
import { center } from '@/lib/scroll'
import { lastBalanceQuery, withoutMeta } from '@/lib/tiersState'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import CategoryIcon from '@/components/CategoryIcon'
import ChoiceDialog from '@/components/ChoiceDialog.vue'
import EffectTag from '@/components/EffectTag'
import FilterSearch from '@/components/FilterSearch.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import PointsBar from '@/components/PointsBar.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SetupStar from '@/components/SetupStar.vue'
import TierLadder, { type TierRow } from '@/components/TierLadder.vue'

// The bulk tiers and the power tiers (`measure`), the speed tiers' sibling pages, mirroring them (`SpeedTiersView`):
// the meta's Pokémon on a ladder of one side's bulk (HP times Defense, or Sp. Def) or power (Attack or Sp. Atk, alone or
// times its best common move's power: `?by=moves`), the side picked (`?side=special`), at the builds their sets run
// (`balanceTiers.ts`). Who's shown (`?show=`: the top 50 or 100 by usage, or every Pokémon) and what the rows are
// (`?view=`: a row per Pokémon at its most common build, its builds marked on it, the default; a row per build; a row per
// Pokémon at the highest it could reach; or the chart, the meta's spread with its Pokémon on it, `BalanceLanes`). The
// items and abilities that multiply the stat outright are boosts, rows of their own when shown (`?boosts=1`). Found
// Pokémon (`?find=`), shown alone or marked; filters by type, ability and item (`?f=`); and yours (`?mine=`, its nature's
// effect, points and multipliers), placed among them, with how often it comes out ahead, and against those tapped
// (`?vs=`). No modifiers for everyone: a few points either way don't change a matchup as a Speed tie does. Every choice
// in the URL; the page opened bare comes as last left (`lastBalanceQuery`).
const props = defineProps<{ measure: Measure }>()
const router = useRouter()
const route = useRoute()
const routeName = String(route.name)
const query = useActiveQuery()
const flag = (k: string) => query.value[k] === '1'
function set(patch: Record<string, string | undefined>) {
  void router.replace({ query: { ...query.value, ...patch } })
}
const { snapshot, data, loading } = useMeta()
const { entered } = usePageEntered()
const isBulk = computed(() => props.measure === 'bulk')

// The page opened bare comes as it was left, put in the URL; and every change remembered.
{
  const last = lastBalanceQuery[props.measure]
  if (!Object.keys(withoutMeta(query.value)).length && Object.keys(last.value).length)
    void router.replace({ query: { ...last.value, ...(query.value.meta !== undefined && { meta: query.value.meta }) } })
}
watch(query, (q) => route.name === routeName && (lastBalanceQuery[props.measure].value = withoutMeta(q)), {
  immediate: true,
})

const regulationIds = computed<readonly PokemonId[]>(
  () => (snapshot.value && pastRoster(snapshot.value.regulation)) ?? availableIds('pokemon'),
)
const metaAvailable = computed(() => !!snapshot.value && has(snapshot.value, 'spreads'))

// Who's shown and what the rows are, each in the URL away from its default.
const SHOWS = ['common', 'all'] as const
type Show = (typeof SHOWS)[number]
const VIEWS = ['charts', 'ladder', 'max', 'chart'] as const
type View = (typeof VIEWS)[number]
const DEFAULTS = { show: 'common', view: 'charts' } as const
/** The least usage of those shown by usage: 1% and up, or any. */
const COMMON = 0.01
const pick = <T extends string>(k: 'show' | 'view', list: readonly T[]): T =>
  (list as readonly unknown[]).includes(query.value[k]) ? (query.value[k] as T) : (DEFAULTS[k] as T)
const show = computed<Show>(() => (metaAvailable.value ? pick('show', SHOWS) : 'all'))
const view = computed<View>(() => pick('view', VIEWS))
const choose = (k: 'show' | 'view', v: string) => set({ [k]: v === DEFAULTS[k] ? undefined : v })
const needsData = computed(() => metaAvailable.value || show.value !== 'all')
const showLabel = (s: Show) => (s === 'all' ? t('speed.all') : t('tiers.show.common', { pct: percent(COMMON) }))
const viewOptions = computed(() =>
  VIEWS.map((v) => ({
    value: v,
    label: t(`tiers.view.${v === 'max' ? props.measure : v}`),
    desc: t(`tiers.viewTip.${v === 'max' ? props.measure : v}`, { pct: percent(MIN_SHARE) }),
  })),
)

// The side, how power's measured, Megas and boosts.
const side = computed<Side>(() => (query.value.side === 'special' ? 'special' : 'physical'))
const by = computed<PowerBy>(() => (!isBulk.value && query.value.by === 'moves' ? 'moves' : 'stats'))
const showMegas = computed(() => query.value.megas !== '0')
const megaShown = (id: PokemonId) => showMegas.value || !POKEMON[id].mega
/** Whether there are boosts to show: the regulation has an item that multiplies the stat outright. */
const boostsAvailable = computed(() => metaAvailable.value && boostItems(props.measure, side.value).length > 0)
const showBoosts = computed(() => flag('boosts') && boostsAvailable.value)
/** The toolbar's options but its reset (the two sides, power's moves, boosts, Megas): an odd count has Megas across
 * both columns on phones, as the speed tiers' do. */
const optionCount = computed(() => 2 + (isBulk.value ? 0 : 1) + (boostsAvailable.value ? 1 : 0) + 1)
const controlsChanged = computed(() => ['side', 'by', 'megas', 'boosts'].some((k) => query.value[k] !== undefined))
const resetControls = () => set({ side: undefined, by: undefined, megas: undefined, boosts: undefined })
const allChanged = computed(() => Object.keys(withoutMeta(query.value)).length > 0)
const resetAll = () => void router.replace({ query: query.value.meta !== undefined ? { meta: query.value.meta } : {} })
const sides = computed(() => [
  { value: 'physical' as const, label: t('builder.balance.physical') },
  { value: 'special' as const, label: t('builder.balance.special') },
])
const bys = computed(() => [
  { value: 'stats' as const, label: t('builder.balance.modeStats') },
  { value: 'moves' as const, label: t('builder.balance.modeMoves') },
])

/** The stat the measure is of on the side, for its tags and yours' editor. */
const stat = computed<StatId>(
  () => (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const)[statIndex(props.measure, side.value)]!,
)
const label = (v: number) => tierLabel(v, props.measure, by.value)

// The least share of its sets a build needs for a row of its own, and a value for a mark.
const MIN_SHARE = 0.03
const MARK_SHARE = 0.01

// Filtering, as the speed tiers: by type, ability (one its sets run on `MIN_SHARE`, else one it can have) and item.
const filterKinds = computed((): TermKind[] =>
  metaAvailable.value && snapshot.value && has(snapshot.value, 'items')
    ? ['type', 'ability', 'item']
    : ['type', 'ability'],
)
const filters = computed<TermFilters>({
  get: () => parseTermFilters(query.value.f, query.value.fm, filterKinds.value),
  set: (f) => void router.replace({ query: { ...query.value, ...formatTermFilters(f) } }),
})
const filtering = computed(() => filters.value.groups.length > 0)
const run = <T extends string>(list: Share<T>[] | undefined) =>
  (list ?? []).filter((x) => (x.share ?? 1) >= MIN_SHARE).map((x) => x.id)
function matches(id: PokemonId, term: Term): boolean {
  const m = data.value?.[id]
  if (term.kind === 'type') return POKEMON[id].types.includes(term.id)
  if (term.kind === 'ability') return (m?.abilities ? run(m.abilities) : POKEMON[id].abilities).includes(term.id)
  if (term.kind === 'item') return run(m?.items).includes(term.id as ItemId)
  return false
}
const passes = (id: PokemonId, f: TermFilters = filters.value) => passesGroups(f, (x) => matches(id, x))
const filtersOpen = shallowRef(false)
const clearFilters = () => set({ f: undefined, fm: undefined })

// Finding Pokémon (`?find=`), as many as a team has: shown alone (the default) or marked among the rest (`?findmode=mark`).
const MAX_FOUND = 6
/** The found chips' sprites' scale: small enough to sit inside the chip, the sprite filling its cell. */
const CHIP_ICON = 0.7
const foundIds = computed<PokemonId[]>(() =>
  (typeof query.value.find === 'string' ? query.value.find.split(',') : [])
    .filter((id): id is PokemonId => id in POKEMON)
    .slice(0, MAX_FOUND),
)
const foundSet = computed(() => new Set(foundIds.value))
const finding = computed(() => foundIds.value.length > 0)
const findQuery = (ids: readonly PokemonId[]) => (ids.length ? ids.join(',') : undefined)
function addFound(id: PokemonId | null) {
  if (id === null || foundSet.value.has(id)) return
  set({ find: findQuery([...foundIds.value, id].slice(-MAX_FOUND)) })
}
const removeFound = (id: PokemonId) =>
  set({ find: findQuery(foundIds.value.filter((x) => x !== id)), vs: vsQuery(vsIds.value.filter((x) => x !== id)) })
const clearFound = () => set({ find: undefined, vs: undefined })
const onlyFound = computed(() => finding.value && query.value.findmode !== 'mark')
const toggleOnly = () => set({ findmode: onlyFound.value ? 'mark' : undefined })
const onlyLabel = computed(() => tSplit('speed.findOnly', 'name'))
const ranks = computed(() => (data.value ? usageRanks(data.value) : undefined))
const findIds = computed(() =>
  regulationIds.value.filter((id) => !POKEMON[id].cosmetic && megaShown(id) && !foundSet.value.has(id)),
)

// Yours: a Pokémon at its nature's effect on the stat, its points (and HP points, for bulk) and the multipliers it
// holds or has, placed on the ladder among the rest. All in the URL: `mine`, `mynat`, `myhp`, `mypts`, `mymods`.
const mine = computed(() => {
  const id = query.value.mine
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
const pts = (k: string, fallback: number) => {
  const n = Number(query.value[k])
  return Number.isInteger(n) && n >= 0 && n <= MAX_POINTS ? n : fallback
}
/** Its most common build, what it's at where the URL doesn't say (else every point and a nature for it). */
const myDefault = computed(() =>
  mine.value ? tierBuilds(data.value?.[mine.value], props.measure, side.value)[0] : undefined,
)
const myNature = computed<NatureEffect>(() =>
  (NATURE_EFFECTS as readonly unknown[]).includes(query.value.mynat)
    ? (query.value.mynat as NatureEffect)
    : (myDefault.value?.effect ?? 'up'),
)
const myPoints = computed(() => pts('mypts', myDefault.value?.points ?? MAX_POINTS))
const myHp = computed(() => (isBulk.value ? pts('myhp', myDefault.value?.hp ?? MAX_POINTS) : 0))
const myBoosts = computed(() => (mine.value ? myBoostsOf(mine.value, props.measure, side.value) : []))
const boostKey = (b: Pick<TierBoost, 'kind' | 'id'>) => `${b.kind}:${b.id}`
/** Its multipliers on: those in the URL (`none` for none); where it doesn't say, the always-on ability its sets run. */
const myMods = computed(() => {
  const saved = query.value.mymods
  if (typeof saved !== 'string') {
    const a = mine.value && abilityOf(mine.value, data.value?.[mine.value], props.measure, side.value)
    return a ? myBoosts.value.filter((b) => b.kind === 'ability' && b.id === a.id) : []
  }
  const on = new Set(saved.split(','))
  return myBoosts.value.filter((b) => on.has(boostKey(b)))
})
function toggleMyMod(b: TierBoost) {
  const on = new Set(myMods.value.map(boostKey))
  if (!on.delete(boostKey(b))) {
    // One item at a time.
    if (b.kind === 'item') for (const k of [...on]) if (k.startsWith('item:')) on.delete(k)
    on.add(boostKey(b))
  }
  set({ mymods: on.size ? [...on].join(',') : 'none' })
}
/** Its power factor: its best move's, with moves; with none on the side, a 100-power move's (said in its card). */
const NOMINAL_POWER = 100
const myOwnFactor = computed(() =>
  mine.value ? sideFactor(mine.value, data.value?.[mine.value], props.measure, side.value, by.value) : 1,
)
const myFactor = computed(() => myOwnFactor.value ?? (by.value === 'moves' ? NOMINAL_POWER : 1))
const myBuild = computed(() => ({ effect: myNature.value, points: myPoints.value, hp: myHp.value }))
const myValue = computed(() =>
  mine.value
    ? tierValue(mine.value, myBuild.value, props.measure, side.value, myFactor.value) *
      myMods.value.reduce((a, b) => a * b.factor, 1)
    : null,
)
/** Its builds in the meta, the 4 most common on `MIN_SHARE` of its sets, to pick in a tap. */
const myCommon = computed(() =>
  mine.value
    ? tierBuilds(data.value?.[mine.value], props.measure, side.value)
        .filter((b) => b.share >= MIN_SHARE)
        .slice(0, 4)
    : [],
)
/** Picking yours: at its most common build, or every point and a nature for it. */
function pickMine(id: PokemonId | null) {
  if (!id)
    return set({
      mine: undefined,
      mynat: undefined,
      myhp: undefined,
      mypts: undefined,
      mymods: undefined,
      vs: undefined,
    })
  const b = tierBuilds(data.value?.[id], props.measure, side.value)[0]
  set({
    mine: id,
    mynat: b ? b.effect : undefined,
    mypts: b ? String(b.points) : undefined,
    myhp: b && isBulk.value ? String(b.hp) : undefined,
    mymods: undefined,
  })
}
const setMyBuild = (b: Pick<TierBuild, 'effect' | 'points' | 'hp'>) =>
  set({ mynat: b.effect, mypts: String(b.points), myhp: isBulk.value ? String(b.hp) : undefined })
const myChanged = computed(() => {
  const b = myCommon.value[0]
  return (
    !!b &&
    (b.effect !== myNature.value || b.points !== myPoints.value || b.hp !== myHp.value || myMods.value.length > 0)
  )
})
const resetMine = () => mine.value && pickMine(mine.value)

// Those yours is measured against (`?vs=`), tapped on the ladder.
const vsIds = computed<PokemonId[]>(() =>
  (typeof query.value.vs === 'string' ? query.value.vs.split(',') : []).filter((id): id is PokemonId => id in POKEMON),
)
const vsQuery = (ids: readonly PokemonId[]) => (ids.length ? [...new Set(ids)].join(',') : undefined)
function onRow(e: MouseEvent, key: string) {
  const row = rows.value.find((r) => r.key === key)
  if (!row || row.mine || !mine.value || e.ctrlKey || e.metaKey || e.shiftKey) return
  e.preventDefault()
  const ids = vsIds.value.includes(row.id) ? vsIds.value.filter((x) => x !== row.id) : [...vsIds.value, row.id]
  set({ vs: vsQuery(ids) })
}

// The ladder's rows.
interface Mon {
  id: PokemonId
  d: PokemonMeta | undefined
  /** Its power factor (its best move's, with moves) times its always-on ability's. */
  factor: number
  /** That ability, said on its rows. */
  ability: AbilityId | null
  builds: TierBuild[]
  extra: boolean
}
/** The Pokémon shown, before the filters: the top by usage, or every Pokémon; and those found beyond them. */
const mons = computed<Mon[]>(() => {
  const d = data.value
  const slice: PokemonId[] =
    show.value === 'all'
      ? regulationIds.value.filter((id) => !POKEMON[id].cosmetic && megaShown(id))
      : d
        ? byUsage(d)
            .filter(([id, m]) => m.usage! >= COMMON && megaShown(id))
            .map(([id]) => id)
        : []
  const inSlice = new Set(slice)
  const ids = [...slice, ...foundIds.value.filter((id) => !inSlice.has(id))]
  return ids.flatMap((id) => {
    const m = d?.[id]
    const sets = metaAvailable.value ? m : undefined
    const factor = sideFactor(id, sets, props.measure, side.value, by.value)
    if (factor === null) return []
    // Its always-on ability in its stat: its sets' (at the highest possible, the best it can have).
    const ability = abilityOf(id, sets, props.measure, side.value, view.value === 'max')
    return [
      {
        id,
        d: m,
        factor: factor * (ability?.factor ?? 1),
        ability: ability?.id ?? null,
        builds: metaAvailable.value ? tierBuilds(m, props.measure, side.value) : [],
        extra: !inSlice.has(id),
      },
    ]
  })
})
const shown = computed(() =>
  mons.value.filter(
    (m) => (!filtering.value || passes(m.id)) && (!onlyFound.value || foundSet.value.has(m.id) || m.id === mine.value),
  ),
)
const filterCount = (f: TermFilters) => mons.value.filter((m) => passes(m.id, f)).length

/** A Pokémon's marks: its builds' values (those on `MARK_SHARE` of its sets), by value, times `factor`, each with the
 * builds reaching it (each a share of the mark's). */
function marksOf(m: Mon, factor = 1): TierRow['marks'] {
  const byValue = new Map<number, TierRow['marks'][number]>()
  for (const b of m.builds) {
    if (b.share < MARK_SHARE) continue
    const value = tierValue(m.id, b, props.measure, side.value, m.factor) * factor
    const mark = byValue.get(value) ?? { value, share: 0, sets: [] }
    mark.share += b.share
    mark.sets.push({ effect: b.effect, points: b.points, hp: b.hp, share: b.share })
    byValue.set(value, mark)
  }
  return [...byValue.values()]
    .map((mark) => ({ ...mark, sets: mark.sets.map((x) => ({ ...x, share: x.share / mark.share })) }))
    .sort((a, b) => b.share - a.share)
}
/** The build at every point and a nature for it, as the highest possible's mark has it. */
const maxSet = computed(() => ({
  effect: 'up' as const,
  points: MAX_POINTS,
  hp: isBulk.value ? MAX_POINTS : 0,
  share: 1,
}))
function rowOf(m: Mon, key: string, value: number, marks: TierRow['marks'], factor = 1, extra = m.extra): TierRow {
  const name = refName(pokemon(m.id))
  const reach = tierReach(m.id, props.measure, side.value, m.factor * factor)
  const noSets = !marks.length
  return {
    key,
    id: m.id,
    ...splitForme(m.id, name),
    value,
    label: label(value),
    marks,
    reach,
    bench: noSets ? tierBench(m.id, props.measure, side.value, m.factor * factor) : undefined,
    own: value,
    noSets,
    extra,
    hit: foundSet.value.has(m.id) && !onlyFound.value,
    mine: false,
    versus: vsIds.value.includes(m.id),
  }
}
/** What a row is of, for its tags: its build, or its boost. */
const rowBuild = new Map<string, TierBuild>()
const rowBoost = new Map<string, TierBoost>()
const rows = computed<TierRow[]>(() => {
  rowBuild.clear()
  rowBoost.clear()
  const list: TierRow[] = []
  for (const m of shown.value) {
    const marks = marksOf(m)
    const reach = tierReach(m.id, props.measure, side.value, m.factor)
    if (view.value === 'max')
      list.push({ ...rowOf(m, m.id, reach.max, [{ value: reach.max, share: 1, sets: [maxSet.value] }]) })
    else if (view.value === 'ladder' && m.builds.length) {
      for (const b of m.builds.filter((x) => x.share >= MIN_SHARE)) {
        const key = `${m.id}:${buildKey(b)}`
        rowBuild.set(key, b)
        list.push(rowOf(m, key, tierValue(m.id, b, props.measure, side.value, m.factor), marks))
      }
    } else {
      const top = m.builds[0]
      const value = top ? tierValue(m.id, top, props.measure, side.value, m.factor) : reach.max
      list.push(rowOf(m, m.id, value, marks))
    }
    // Its boosts: the items its sets run, at its builds (at the highest it could reach, none: what it holds varies).
    if (showBoosts.value) {
      const max = view.value === 'max'
      for (const b of max ? [] : boostsOf(m.d, props.measure, side.value, MIN_SHARE)) {
        const key = `${m.id}:${boostKey(b)}`
        rowBoost.set(key, b)
        const scaled = max ? [{ value: reach.max * b.factor, share: 1, sets: [maxSet.value] }] : marksOf(m, b.factor)
        const value = max ? reach.max * b.factor : (scaled[0]?.value ?? reach.max * b.factor)
        list.push({ ...rowOf(m, key, value, scaled, b.factor, true), boost: true })
      }
    }
  }
  // Yours, a row of its own at its value.
  if (mine.value !== null && myValue.value !== null) {
    const name = refName(pokemon(mine.value))
    list.push({
      key: 'mine',
      id: mine.value,
      ...splitForme(mine.value, name),
      value: myValue.value,
      label: label(myValue.value),
      marks: [{ value: myValue.value, share: 1, sets: [{ ...myBuild.value, share: 1 }] }],
      reach: tierReach(mine.value, props.measure, side.value, myFactor.value),
      own: myValue.value,
      noSets: false,
      extra: false,
      hit: false,
      mine: true,
      versus: false,
    })
  }
  list.sort((a, b) => b.value - a.value || (a.mine ? -1 : b.mine ? 1 : 0))
  // How yours does against each.
  if (myValue.value !== null)
    for (const r of list) {
      if (r.mine) continue
      const against = r.noSets ? r.bench!.map((value) => ({ value, share: 1 })) : r.marks
      r.above = tierOdds(myValue.value, against).above
    }
  return list
})

/** The median of those shown: each Pokémon's builds by its usage times their shares (with no usage, as one). */
const median = computed(() => {
  const points = shown.value.flatMap((m) =>
    marksOf(m).map((mark) => [mark.value, (m.d?.usage ?? 0.001) * mark.share] as const),
  )
  const total = points.reduce((a, [, w]) => a + w, 0)
  if (!total) return null
  let acc = 0
  for (const [v, w] of [...points].sort((a, b) => a[0] - b[0])) if ((acc += w) >= total / 2) return v
  return null
})
/** How yours does against those shown (each Pokémon's builds, by its usage times their shares). */
const summary = computed(() => {
  if (myValue.value === null || !metaAvailable.value) return null
  let above = 0
  let level = 0
  let total = 0
  for (const m of shown.value) {
    if (m.id === mine.value || !m.d?.usage) continue
    for (const mark of marksOf(m)) {
      const w = m.d.usage * mark.share
      total += w
      if (myValue.value > mark.value) above += w
      else if (myValue.value === mark.value) level += w
    }
  }
  return total ? { above: above / total, level: level / total, under: 1 - (above + level) / total } : null
})
/** Yours against each Pokémon tapped: its most common value, the ratio, and the share of its sets yours is above. */
const versus = computed(() => {
  if (myValue.value === null) return []
  return vsIds.value.flatMap((id) => {
    const m = mons.value.find((x) => x.id === id)
    if (!m) return []
    const marks = marksOf(m)
    const theirs = marks[0]?.value ?? tierReach(id, props.measure, side.value, m.factor).max
    return [
      {
        id,
        theirs,
        ratio: myValue.value! / theirs - 1,
        above: tierOdds(myValue.value!, marks.length ? marks : [{ value: theirs, share: 1 }]).above,
      },
    ]
  })
})
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`

// The chart: the meta's spread on the side, its Pokémon shown on it at their most common build, yours its diamond.
// Its icons: the most used of those shown (whatever order the list is in: every Pokémon's is the dex's), as many as
// the drop-down by it says (`?chart=`, as the tournaments' chart: 30, 15 on phones, unless another's picked), and those
// found besides.
const chartable = computed(() =>
  [...shown.value]
    .filter((m) => m.builds.length && m.id !== mine.value)
    .sort((a, b) => (b.d?.usage ?? 0) - (a.d?.usage ?? 0)),
)
const CHART_MIN = 5
const phoneQuery = window.matchMedia('(max-width: 720px)')
const chartDefault = phoneQuery.matches ? 15 : 30
const chartN = computed<number>({
  get: () => {
    const n = Number(query.value.chart)
    return Math.min(Number.isInteger(n) && n >= CHART_MIN ? n : chartDefault, chartable.value.length)
  },
  set: (n) => set({ chart: n === chartDefault ? undefined : String(n) }),
})
/** The slider's value while it's dragged, the chart following only once it's let go. */
const draggedN = shallowRef<number | null>(null)
function releaseN(e: Event) {
  chartN.value = Number((e.target as HTMLInputElement).value)
  draggedN.value = null
}
/** A number typed in its box, within the slider's range; one that isn't a number puts the box back. */
function typeN(e: Event) {
  const box = e.target as HTMLInputElement
  const n = Math.round(Number(box.value))
  if (box.value !== '' && Number.isFinite(n)) chartN.value = Math.min(Math.max(n, CHART_MIN), chartable.value.length)
  box.value = String(chartN.value)
}
const chartLane = computed((): LaneView[] => {
  const points: [number, number][] = []
  for (const m of shown.value)
    for (const mark of marksOf(m)) points.push([mark.value, (m.d?.usage ?? 0.001) * mark.share])
  const placed = chartable.value
    .filter((m, i) => i < chartN.value || foundSet.value.has(m.id))
    .map((m): Plotted => ({
      pokemon: m.id,
      value: tierValue(m.id, m.builds[0]!, props.measure, side.value, m.factor),
      rank: null,
    }))
  return [
    {
      side: side.value,
      label: t(side.value === 'physical' ? 'builder.balance.physical' : 'builder.balance.special'),
      shape: shapeOf(points),
      points: placed,
      mean: myValue.value,
    },
  ]
})
const chartTip = (p: Plotted) => `${refName(pokemon(p.pokemon))} · ${label(p.value)}`
const chartMeanTip = () => (mine.value && myValue.value !== null ? `${t('speed.yours')}: ${label(myValue.value)}` : '')
const ends = computed((): [string, string] =>
  isBulk.value
    ? [t('builder.balance.frailer'), t('builder.balance.bulkier')]
    : [t('builder.balance.softer'), t('builder.balance.harder')],
)

const headTip = computed(() =>
  t(isBulk.value ? `tiers.headTip.bulk.${side.value}` : `tiers.headTip.power.${by.value}`, {
    stat: t(`stat.${stat.value}`),
  }),
)
const title = computed(() => t(isBulk.value ? 'title.bulkTiers' : 'title.powerTiers'))
/** The always-on ability a row's stat counts, by name, for its tags (not a boost's row, nor yours'). */
const monAbility = computed(() => new Map(mons.value.map((m) => [m.id, m.ability])))
function abilityTag(id: PokemonId): string {
  const a = monAbility.value.get(id)
  return a ? refName(abilityRef(a)) : ''
}
const boostName = (b: TierBoost) => refName(b.kind === 'item' ? itemRef(b.id as ItemId) : abilityRef(b.id as never))
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const yoursOpen = shallowRef(false)
/** To yours' row on the ladder, centered on the screen (the card, folded over the ladder, folded away). */
function toMine() {
  if (!wide.value) yoursOpen.value = false
  void nextTick(() => center(document.querySelector('.tier.has-mine')))
}
// Wide, yours' card is beside the ladder, always open; narrower, over it, folded until opened.
const wideQuery = window.matchMedia('(min-width: 1100px)')
const wide = shallowRef(wideQuery.matches)
const onWide = (e: MediaQueryListEvent) => (wide.value = e.matches)
wideQuery.addEventListener('change', onWide)
onBeforeUnmount(() => wideQuery.removeEventListener('change', onWide))
</script>

<template>
  <div>
    <!-- Reset all, on the row of the way back to Meta. -->
    <Teleport :to="`#back-actions-${routeName}`" defer>
      <button v-if="allChanged" type="button" class="btn inverted reset-all" @click="resetAll">
        <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetAll') }}
      </button>
    </Teleport>
    <div class="speed-layout">
      <div class="main-col">
        <!-- The heading: the title and its star, and the data shown. -->
        <section class="panel page-head">
          <div class="head">
            <h1>{{ title }}<SetupStar /></h1>
            <MetaDialog v-if="snapshot" class="head-meta" />
          </div>
        </section>
        <div class="panel banded soft list">
          <!-- Who's shown and what the rows are, each in a dialog. -->
          <div v-if="metaAvailable" class="band choices-band">
            <div class="choice">
              <span class="muted choice-label" aria-hidden="true">{{ t('speed.show') }}</span>
              <ChoiceDialog
                :model-value="show"
                :label="t('speed.show')"
                :options="SHOWS.map((s) => ({ value: s, label: showLabel(s) }))"
                @update:model-value="(v: string) => choose('show', v)"
              />
            </div>
            <div class="choice">
              <span class="muted choice-label" aria-hidden="true">{{ t('speed.viewLabel') }}</span>
              <ChoiceDialog
                :model-value="view"
                :label="t('speed.viewLabel')"
                :options="viewOptions"
                @update:model-value="(v: string) => choose('view', v)"
              />
            </div>
          </div>
          <!-- The toolbar: the side, how power's measured, boosts and Megas, then the find. -->
          <div class="band find find-row">
            <div class="options-line">
              <div class="options" :class="{ 'three-rows': optionCount > 4 }">
                <button
                  v-for="s in sides"
                  :key="s.value"
                  type="button"
                  class="btn switch"
                  :class="{ on: side === s.value }"
                  :aria-pressed="side === s.value"
                  @click="set({ side: s.value === 'physical' ? undefined : s.value })"
                >
                  <CategoryIcon :category="s.value" :tip="false" />{{ s.label }}
                </button>
                <button
                  v-if="!isBulk"
                  v-tip="t('builder.balance.modeTip')"
                  type="button"
                  class="btn switch"
                  :class="{ on: by === 'moves' }"
                  :aria-pressed="by === 'moves'"
                  @click="set({ by: by === 'moves' ? undefined : 'moves' })"
                >
                  {{ bys[1]!.label }}
                </button>
                <button
                  v-if="boostsAvailable"
                  v-tip="t(`tiers.boostsDesc.${measure}`)"
                  type="button"
                  class="btn switch"
                  :class="{ on: showBoosts }"
                  :aria-pressed="showBoosts"
                  @click="set({ boosts: showBoosts ? undefined : '1' })"
                >
                  <Rocket :size="16" aria-hidden="true" />{{ t('speed.boosts') }}
                </button>
                <button
                  type="button"
                  class="btn switch"
                  :class="{ on: showMegas, wide: optionCount % 2 === 1 }"
                  :aria-pressed="showMegas"
                  @click="set({ megas: showMegas ? '0' : undefined })"
                >
                  {{ t('speed.megas') }}
                </button>
                <button
                  v-tip="t('speed.resetControls')"
                  type="button"
                  class="btn reset-options"
                  :disabled="!controlsChanged"
                  :aria-label="t('speed.resetControls')"
                  @click="resetControls"
                >
                  <RotateCcw :size="16" aria-hidden="true" />
                </button>
              </div>
            </div>
            <PokemonPicker
              recent
              adds
              :model-value="null"
              :ids="findIds"
              :placeholder="foundIds.length ? t('speed.findMore') : t('speed.find')"
              hotkey="/"
              :title="title"
              list-width-of=".find-row"
              :ranks
              @update:model-value="addFound"
            />
            <button
              type="button"
              class="btn filters-toggle"
              :class="{ on: filtering }"
              :aria-expanded="filtersOpen"
              :aria-label="t('speed.filter')"
              @click="filtersOpen = !filtersOpen"
            >
              <Funnel :size="16" aria-hidden="true" />
            </button>
            <div class="find-modes">
              <button
                type="button"
                class="btn switch find-mode"
                :class="{ on: onlyFound, unshown: !finding }"
                :disabled="!finding"
                :aria-hidden="!finding || undefined"
                :aria-pressed="onlyFound"
                @click="toggleOnly"
              >
                {{ onlyLabel[0]
                }}<span class="only-icons"
                  ><PokemonIcon v-for="id in foundIds.slice(0, 2)" :id :key="id" /><PokemonIcon
                    v-if="!finding"
                    id="pikachu"
                  /><span v-if="foundIds.length > 2" class="only-more">+{{ foundIds.length - 2 }}</span></span
                >{{ onlyLabel[1] }}
              </button>
            </div>
            <ul v-if="finding" class="found-list" :aria-label="t('speed.foundLabel')">
              <li v-for="id in foundIds" :key="id" class="found-chip">
                <span class="found-name"><PokemonIcon :id :scale="CHIP_ICON" />{{ refName(pokemon(id)) }}</span>
                <button
                  type="button"
                  class="found-remove"
                  :aria-label="t('speed.unfind', { name: refName(pokemon(id)) })"
                  @click="removeFound(id)"
                >
                  <X :size="14" aria-hidden="true" />
                </button>
              </li>
              <li v-if="foundIds.length > 1">
                <button type="button" class="btn small found-clear" @click="clearFound">
                  {{ t('speed.unfindAll') }}
                </button>
              </li>
            </ul>
            <div class="filters" :class="{ folded: !filtersOpen }" role="group" :aria-label="t('speed.filter')">
              <span class="small filters-label">{{ t('speed.filter') }}</span>
              <FilterSearch v-model:filters="filters" class="filter-search" :kinds="filterKinds" :count="filterCount" />
              <button v-if="filtering" type="button" class="btn small" @click="clearFilters">
                {{ t('speed.clearAll') }}
              </button>
            </div>
          </div>
          <!-- With yours picked, the ladder is its opponents. -->
          <div v-if="mine && view !== 'chart'" class="band opponents-head">
            <strong>{{ t('speed.opponentsHead') }}</strong>
            <span class="opponents-hint"
              ><span>{{ t('speed.opponentsHint') }}</span></span
            >
          </div>

          <div v-if="!entered || (needsData && !data)" class="ladder" aria-hidden="true">
            <div v-for="i in 12" :key="i" class="tier skeleton"><span class="bone"></span></div>
          </div>
          <div v-else class="ranges-wrap" :class="{ 'meta-stale': loading }" :aria-busy="loading">
            <!-- How many the chart shows, in a drop-down over it, as the tournaments' chart. -->
            <div v-if="view === 'chart' && chartable.length > CHART_MIN" class="chart-head">
              <OptionsMenu
                class="chart-options"
                :title="t('tournaments.chartOptions')"
                :label="t('tiers.chartShowing', { n: draggedN ?? chartN })"
                align="left"
              >
                <label class="chart-n">
                  <span class="muted">{{ t('tournaments.chartShown') }}</span>
                  <input
                    type="range"
                    :min="CHART_MIN"
                    :max="chartable.length"
                    :value="draggedN ?? chartN"
                    @input="draggedN = Number(($event.target as HTMLInputElement).value)"
                    @change="releaseN"
                  />
                  <span class="chart-n-value">
                    <input
                      type="number"
                      class="chart-n-box"
                      :min="CHART_MIN"
                      :max="chartable.length"
                      :value="draggedN ?? chartN"
                      :aria-label="t('tournaments.chartShown')"
                      @change="typeN"
                    />
                    {{ t('tournaments.chartOf', { of: chartable.length }) }}
                  </span>
                </label>
              </OptionsMenu>
            </div>
            <BalanceLanes
              v-if="view === 'chart'"
              class="chart"
              :lanes="chartLane"
              :ends
              :tip="chartTip"
              :mean-tip="chartMeanTip"
              :rows="4"
              :found="foundIds"
              no-label
            />
            <TierLadder
              v-else
              :rows
              :mine="myValue"
              :finding="finding && !onlyFound"
              :head="t(`tiers.head.${measure}`)"
              :head-tip="headTip"
              :ends
              :format="label"
              :stat
              :hp="isBulk"
              :median
              @chip="onRow"
            >
              <template #tags="{ row }">
                <span v-if="row.mine" class="tags">
                  <span class="tag">{{ t('speed.yoursTag') }}</span>
                  <span class="tag"><EffectTag :effect="myNature" :stat /></span>
                  <span v-if="isBulk" class="tag">{{ t('tiers.hpPoints', { n: myHp }) }}</span>
                  <span class="tag">{{ t('tiers.statPoints', { n: myPoints, stat: t(`stat.${stat}`) }) }}</span>
                </span>
                <span v-else-if="!rowBoost.get(row.key) && abilityTag(row.id)" class="tags">
                  <span class="tag">{{ abilityTag(row.id) }}</span>
                  <template v-if="rowBuild.get(row.key)">
                    <span class="tag"><EffectTag :effect="rowBuild.get(row.key)!.effect" :stat /></span>
                    <span v-if="isBulk" class="tag">{{ t('tiers.hpPoints', { n: rowBuild.get(row.key)!.hp }) }}</span>
                    <span class="tag">{{
                      t('tiers.statPoints', { n: rowBuild.get(row.key)!.points, stat: t(`stat.${stat}`) })
                    }}</span>
                  </template>
                </span>
                <span v-else-if="rowBoost.get(row.key)" class="tags">
                  <span class="tag boost-label"
                    ><ItemIcon
                      v-if="rowBoost.get(row.key)!.kind === 'item'"
                      :id="rowBoost.get(row.key)!.id as ItemId"
                      :scale="0.67"
                    />{{ boostName(rowBoost.get(row.key)!) }}</span
                  >
                  <span v-if="rowBoost.get(row.key)!.share !== undefined" class="tag">{{
                    percent(rowBoost.get(row.key)!.share!)
                  }}</span>
                </span>
                <span v-else-if="rowBuild.get(row.key)" class="tags">
                  <span class="tag"><EffectTag :effect="rowBuild.get(row.key)!.effect" :stat /></span>
                  <span v-if="isBulk" class="tag">{{ t('tiers.hpPoints', { n: rowBuild.get(row.key)!.hp }) }}</span>
                  <span class="tag">{{
                    t('tiers.statPoints', { n: rowBuild.get(row.key)!.points, stat: t(`stat.${stat}`) })
                  }}</span>
                  <span class="tag">{{ percent(rowBuild.get(row.key)!.share) }}</span>
                </span>
              </template>
            </TierLadder>
          </div>

          <p v-if="metaAvailable && view !== 'chart'" class="fine-print">
            {{ t('speed.leftOutNote', { pct: percent(MIN_SHARE) }) }}
          </p>
          <p v-if="by === 'moves'" class="fine-print">{{ t('tiers.powerNote') }}</p>
        </div>
      </div>
      <!-- Your Pokémon: beside the ladder on wide screens, stuck as it scrolls; over it, folded, narrower. -->
      <div class="side-col">
        <details class="panel banded yours instant" :open="wide || yoursOpen">
          <summary class="yours-title" @click.prevent="!wide && (yoursOpen = !yoursOpen)">
            <span class="marker yours-marker" aria-hidden="true">{{ yoursOpen ? '▾' : '▸' }}</span>
            <span>{{ t('speed.yours') }}</span>
            <button
              v-if="mine"
              v-tip="t('speed.clear')"
              type="button"
              class="btn on-band band-clear"
              :aria-label="t('speed.clear')"
              @click.stop.prevent="pickMine(null)"
            >
              <Trash2 :size="16" aria-hidden="true" />
            </button>
          </summary>
          <div class="yours-pick">
            <PokemonPicker
              recent
              :model-value="mine"
              :placeholder="t('speed.yoursPick')"
              :title="t('speed.yours')"
              tone="yours"
              list-width-of=".yours-pick"
              icon
              :ranks
              class="yours-picker"
              @update:model-value="pickMine"
            />
          </div>
          <template v-if="mine">
            <section v-if="myCommon.length" class="yours-section">
              <span class="muted small">{{ t('compare.common') }}</span>
              <ScrollRow :key="mine" wrap-on-phones class="builds">
                <button
                  v-for="b in myCommon"
                  :key="buildKey(b)"
                  type="button"
                  class="btn mod"
                  :class="{ on: myNature === b.effect && myPoints === b.points && myHp === b.hp }"
                  @click="setMyBuild(b)"
                >
                  <component
                    :is="EFFECT_ICONS[b.effect]"
                    v-if="EFFECT_ICONS[b.effect]"
                    :size="14"
                    aria-hidden="true"
                  /><template v-if="isBulk">{{ t('tiers.hpPoints', { n: b.hp }) }} · </template
                  >{{ t('tiers.statPoints', { n: b.points, stat: t(`stat.${stat}`) }) }}
                  <span class="muted">{{ percent(b.share) }}</span>
                </button>
              </ScrollRow>
            </section>
            <section class="yours-section">
              <SegmentedControl
                class="stacked"
                :model-value="myNature"
                :label="t('speed.natureLabel')"
                no-tips
                :options="
                  NATURE_EFFECTS.map((e) => ({
                    value: e,
                    label: t(`tiers.effect.${e}`, { stat: t(`stat.${stat}`) }),
                    icon: EFFECT_ICONS[e],
                    short: t(`stat.${stat}`),
                  }))
                "
                @update:model-value="(v: string) => set({ mynat: v })"
              />
            </section>
            <section class="yours-section">
              <div v-if="isBulk" class="yours-field">
                <span class="muted small">{{ t('tiers.hpLabel') }}</span>
                <PointsBar
                  :model-value="myHp"
                  :base="POKEMON[mine].stats[0]!"
                  effect="neutral"
                  hp
                  :limit="MAX_POINTS"
                  :label="t('tiers.hpLabel')"
                  raised
                  @change="(p: number) => set({ myhp: String(p) })"
                />
              </div>
              <div class="yours-field">
                <span class="muted small">{{ t('tiers.pointsLabel', { stat: t(`stat.${stat}`) }) }}</span>
                <PointsBar
                  :model-value="myPoints"
                  :base="POKEMON[mine].stats[statIndex(measure, side)]!"
                  :effect="myNature"
                  :limit="MAX_POINTS"
                  :label="t('tiers.pointsLabel', { stat: t(`stat.${stat}`) })"
                  raised
                  @change="(p: number) => set({ mypts: String(p) })"
                />
              </div>
            </section>
            <section v-if="myBoosts.length" class="yours-section">
              <span class="muted small">{{
                t(myBoosts.some((b) => b.kind === 'item') ? 'tiers.myBoosts' : 'tiers.myAbility')
              }}</span>
              <div class="mods">
                <button
                  v-for="b in myBoosts"
                  :key="boostKey(b)"
                  type="button"
                  class="btn mod"
                  :class="{ on: myMods.some((x) => boostKey(x) === boostKey(b)) }"
                  :aria-pressed="myMods.some((x) => boostKey(x) === boostKey(b))"
                  @click="toggleMyMod(b)"
                >
                  <ItemIcon v-if="b.kind === 'item'" :id="b.id as ItemId" :scale="0.75" class="mod-item" />{{
                    boostName(b)
                  }}
                  <span class="muted">×{{ b.factor }}</span>
                </button>
              </div>
            </section>
            <section v-if="myOwnFactor === null" class="yours-section">
              <p class="muted small">
                {{ t(by === 'moves' ? 'tiers.noMoveNote' : 'tiers.noSideNote', { power: NOMINAL_POWER }) }}
              </p>
            </section>
            <section v-if="summary" class="yours-section">
              <p class="small">
                {{
                  t(`tiers.summary.${measure}`, {
                    above: percent(summary.above),
                    level: percent(summary.level),
                    under: percent(summary.under),
                  })
                }}
              </p>
            </section>
            <section v-if="versus.length" class="yours-section">
              <span class="muted small">{{ t('tiers.against') }}</span>
              <ul class="versus-list">
                <li v-for="v in versus" :key="v.id">
                  <PokemonIcon :id="v.id" />
                  <span class="versus-name">{{ refName(pokemon(v.id)) }}</span>
                  <span class="num" :class="v.ratio >= 0 ? 'good' : 'bad'">{{ signed(v.ratio) }}</span>
                  <span class="muted small">{{ t('tiers.aboveSets', { pct: percent(v.above) }) }}</span>
                  <button
                    type="button"
                    class="btn small quiet versus-close"
                    :aria-label="t('speed.unfind', { name: refName(pokemon(v.id)) })"
                    @click="set({ vs: vsQuery(vsIds.filter((x) => x !== v.id)) })"
                  >
                    <X :size="14" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </section>
            <section v-if="myChanged" class="yours-section">
              <button type="button" class="btn inverted" @click="resetMine">
                <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetYours') }}
              </button>
            </section>
            <section class="yours-section yours-go">
              <button type="button" class="btn primary big-go" @click="toMine">
                <span class="big-go-speed">{{ myValue !== null ? label(myValue) : '' }}</span>
                <span>{{ t('speed.showYours') }}</span>
              </button>
            </section>
          </template>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Yours' bar: stuck to the top of the page over what scrolls under it, on the page's own color; back to Meta,
   then yours in short taking the rest, its name giving way first. */
.yours-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  /* Room above it, none under: stuck, nothing but the button (and its shadow) covers what scrolls under. */
  padding-top: 6px;
  background: var(--bg);
}
.bar-yours {
  flex: 1 1 0;
  min-width: 0;
  justify-content: flex-start;
  gap: 6px;
}
/* Its text with none picked, as the summary's name with one. */
.bar-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.bar-yours .marker {
  margin-left: auto;
}
/* A modifier's item icon, before its name, taking no more height than the text. */
.mod-item {
  margin-block: -2px;
}
/* Its actions, at the foot of the card, Confirm at the end. */
.drop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 12px calc(-1 * var(--panel-pad)) calc(-1 * var(--panel-pad));
  padding: 10px var(--panel-pad);
  background: var(--panel);
  border-top: 1px solid var(--border);
}
/* In a dialog over the page (phones), one card filling it: yours' card scrolling within it, its band on top saying
   what it is and closing it (Clear left to the actions), and the actions at its foot, always there. */
.yours-sheet {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
}
.yours-sheet-card {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
:root:root .yours-sheet-card > .yours {
  margin: 0;
  border: none;
  box-shadow: none;
}
.yours-sheet .band-clear {
  display: none;
}
/* Its arrow at the band's end, where the bar's is: a tap on the band folds the card back into the bar. */
.yours-sheet .yours-marker {
  order: 1;
  margin-left: auto;
}
.sheet-actions {
  flex: none;
  margin: 0;
}
/* Dropped from the bar, which says what it is and closes it, the card's own band is left out. */
.yours-drop .yours-title {
  display: none;
}
/* Its card, dropped under it over the page, as tall as the screen leaves, scrolling within that (room kept for its
   shadow); the page dimmed behind it, a tap there closing it, and not scrolling. */
.yours-drop {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  padding: 0 4px 4px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.yours-drop > .yours {
  margin: 0;
}
/* Spreading sideways to the screen's edges by its shadow, which, unlike its box, can't widen the page; clipped at its
   top, so the bar isn't dimmed. */
.yours-backdrop {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 100dvh;
  background: var(--dim);
  box-shadow: 0 0 0 100vmax var(--dim);
  clip-path: inset(0 -100vmax -100vmax);
  touch-action: none;
  --dim: color-mix(in srgb, var(--ink) 40%, transparent);
}
/* The heading's row: the title and its star, the data shown (its dataset cut short first when the row's tight; on
   phones, its icon alone), then the way to take the tour again, at its end. */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.head-tour {
  margin-left: auto;
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
/* These sections open and close at once, without the slide and fade collapsible sections have (main.css). Their
   headings take taps as taps: quick ones neither select the text nor zoom. */
.instant::details-content,
.instant > summary {
  transition: none;
}
.instant > summary {
  touch-action: manipulation;
  user-select: none;
}
.find {
  flex: 1 1 14em;
  max-width: 30em;
}
.find :deep(.search-box) {
  max-width: none;
}
/* The toolbar's first line: the options, one outlined block of cells (ink between them, the block's gaps over its
   ink), on one line; the modifiers, opened, under it. Over the find. */
.find-row > :is(.options-line, .all-mods) {
  flex-basis: 100%;
  order: -1;
}
.options {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 100%;
  background: var(--ink);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-sm);
}
:root:root .options > .btn {
  min-height: 0;
  padding: 4px 12px;
  font-size: 0.9em;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  transform: none;
}
:root:root .options > .btn:is(:hover, :active):not(:disabled) {
  box-shadow: none;
  transform: none;
}
.options > .btn:focus-visible {
  outline-offset: -4px;
}
/* On phones, two to a row, as wide as each other: what's on the ladder, then the battle; one alone (Megas without
   the boosts, the field in play) the row's whole width; the reset down the block's right edge. */
@media (max-width: 720px) {
  .options {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    width: 100%;
  }
  .options > .reset-options {
    grid-row: 1 / span 2;
    grid-column: 3;
  }
  :root:root .options > .btn {
    justify-content: center;
    justify-self: stretch;
    min-width: 0;
    padding-block: 7px;
    white-space: normal;
  }
  .options > :is(.wide, .field-status) {
    grid-column: 1 / 3;
  }
  .options:has(> .field-status) > .reset-options {
    grid-row: 1 / span 3;
  }
}
/* Who's shown and the view: each its label, then its choice. */
.choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* Resetting them, its icon alone; greyed out in its icon alone, so the block stays whole. */
:root:root .options > .reset-options {
  padding-inline: 10px;
}
.reset-options:disabled {
  color: var(--muted);
  opacity: 1;
}
/* The modifiers' disclosure while some are on, folded or not: marked as the switches on are. */
.disclosure.on {
  background: var(--sel);
}
/* The modifiers, opened: a tray under their disclosure, set into the page (a shade darker, a shadow along its top
   edge), the disclosure the tray's tab, in its color, nothing between them. Their chips flat and smaller, a level under
   what's around. */
.tray,
.disclosure.open {
  --tray: color-mix(in srgb, var(--ink) 12%, var(--panel-alt));
}
:root:root .tray {
  padding: 8px;
  font-size: 0.85em;
  background: var(--tray);
  border: 2px solid var(--ink);
  box-shadow:
    inset 0 2px 0 color-mix(in srgb, var(--ink) 15%, transparent),
    var(--hard-sm);
}
:root:root .tray > .mod,
:root:root .tray > :deep(.stepper) {
  min-height: 0;
  padding-block: 3px;
  font-weight: normal;
  box-shadow: none;
}
:root:root .tray > :deep(.stepper) {
  padding-block: 0;
}
:root:root .tray > .mod:is(:hover, :active):not(:disabled) {
  box-shadow: none;
  transform: none;
}
:root:root .disclosure.open {
  position: relative;
  background: var(--tray);
  box-shadow: none;
  transform: none;
}
:root:root .disclosure.open:is(:hover, :active):not(:disabled) {
  box-shadow: none;
  transform: none;
}
/* Over the line under it and the tray's shadow, in the tray's color. */
.disclosure.open::after {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  z-index: 1;
  height: 4px;
  background: var(--tray);
  content: '';
}
/* Everyone's tray on the options' block's edge (over the row's gap), the block's shadow gone; yours' on its
   disclosure's (over the section's gap), the disclosure at the foot of its row. */
.find-row > .all-mods {
  margin-top: -10px;
}
.find-row > .options-line:has(+ .all-mods) .options {
  box-shadow: none;
}
.yours-section > .tray {
  align-self: stretch;
  margin-top: -8px;
}
/* The modifiers' disclosure: a button, a plus, what it opens (folded, the ones on in short) and the arrow saying
   whether it is. */
.disclosure {
  justify-self: start;
  justify-content: flex-start;
  gap: 6px;
  font-weight: bold;
}
.mods-on {
  font-weight: normal;
}
/* The disclosures' arrows: as large as the text, close to it, in a column as wide as either so the text doesn't shift
   when one turns. */
.marker {
  display: inline-block;
  width: 0.85em;
  font-size: 1.15em;
  line-height: 1;
}
.mods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mod {
  min-height: 0;
  padding: 6px 10px;
  line-height: inherit;
}
.mod.on {
  background: var(--sel);
}
.small {
  font-size: calc(13px * var(--text-scale));
}
/* On phones, runs to the panel's edges (`--panel-bleed`), so the row lines and a picked row's highlight meet its
   border. */
.ladder {
  margin: 0 calc(-1 * var(--panel-bleed));
  padding: 0;
  list-style: none;
}
/* A Speed, and the Pokémon at it: the number in a column of its own, the chips wrapping beside it. The band over the
   ladder's header heads that column too. */
.list {
  --speed-col: 2.2em;
}
/* The toolbar's color (the find's band): the panel's own, darker, rather than the accent's tint. */
.main-col {
  --toolbar: color-mix(in srgb, var(--ink) 25%, var(--panel));
  --choices: var(--panel-alt);
}
/* What the list is: a band of its own over the toolbar, lighter than it, a rule between them; its choices on a line,
   wrapping where they don't fit. */
:root:root .list.banded > .band.choices-band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin-bottom: 0;
  padding-block: 8px;
  background: var(--choices);
}
@media (max-width: 720px) {
  /* On phones, one compact line, the two joined halves of it (one outline, a line between them): the labels read
     out but not shown. */
  :root:root .list.banded > .band.choices-band {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    padding-block: 6px;
  }
  .choice {
    min-width: 0;
  }
  .choice > :deep(.choice-dialog),
  .choice > :deep(.choice-dialog > .toggle) {
    flex: 1;
    width: 100%;
    max-width: none;
  }
  .choice > :deep(.choice-dialog > .toggle) {
    justify-content: space-between;
  }
  .choice + .choice {
    margin-left: -1px;
  }
  .choice:first-child > :deep(.choice-dialog > .toggle) {
    border-radius: 3px 0 0 3px;
  }
  .choice + .choice > :deep(.choice-dialog > .toggle) {
    border-radius: 0 3px 3px 0;
  }
  .choice-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
/* The opponents band: red, on top of the panel. Beats retro.css's bands. */
:root:root .list.banded > .band.opponents-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  color: var(--opponent-text);
  background: var(--opponent);
}
/* Its hint quieter than its name: smaller, not bold, and softer (white at 85% keeps over 4.5:1 on the red). */
.opponents-head > span {
  font-size: 0.85em;
  font-weight: normal;
  opacity: 0.85;
}
/* The hint takes what's left of the line, and is left out when it doesn't fit there: one line high, clipped, with an
   empty first item as tall as a line, so a hint too wide wraps to the line under it, out of view. */
.opponents-head > .opponents-hint {
  display: flex;
  flex: 1 1 0;
  flex-wrap: wrap;
  min-width: 0;
  height: 1lh;
  overflow: hidden;
}
.opponents-hint::before {
  height: 1lh;
  content: '';
}
.opponents-hint > span {
  white-space: nowrap;
}
.opponents-head > strong,
.opponents-head > .field-tag,
.opponents-head > .find-swap {
  flex: none;
  white-space: nowrap;
}
/* The field they're in: a tag outlined in the band's text, at its end, kept to one line. */
.opponents-head > .field-tag {
  align-self: center;
  margin-left: auto;
  padding: 0 6px;
  font-weight: bold;
  white-space: nowrap;
  border: 1px solid currentColor;
  opacity: 1;
}
/* The field in play among the options: its cross at its end. */
.field-status {
  gap: 6px;
}
.field-status > .lucide {
  margin-left: auto;
}
.field-source {
  font-weight: normal;
}
/* The panel's bands, stacked: the tabs, the toolbar, then the opponents' (with yours picked), on the rows. */
:root:root .list.banded > .band.find-row {
  margin-bottom: 6px;
  padding-block: 10px;
}
:root:root .list.banded > .band.find-row:has(+ .opponents-head) {
  margin-bottom: 0;
}
:root:root .list.banded > .band + .band {
  margin-top: 0;
}
:root:root .list.banded > .band.find-row {
  background: var(--toolbar);
}
/* The find's band, with why the Pokémon found shows as it does, when it isn't in the top, on a line of its own. */
.find-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: none;
}
.find-note {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  gap: 4px;
  margin: 0;
}
.find-note :deep(.sheet-icon) {
  flex: none;
  margin-block: -6px;
}
/* The filters, on a line of their own under the find: what's searched, and the groups in the advanced mode. */
.filters {
  display: flex;
  flex-basis: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.filters-label {
  font-weight: bold;
}
.filter-search {
  flex: 1 1 320px;
  min-width: 0;
}
/* The resets: under what they reset, to the left. */
.reset {
  align-self: flex-start;
  justify-self: start;
}
/* The toggles as tall as the search beside them. */
.find-row .find-mode {
  align-self: stretch;
}
/* The find with the filters' fold beside it, the filters folded under it, then what to do with the one found, why it
   shows as it does, and what finding does, each on a row of its own. */
/* The filters' fold joined to the find's field, at its end: one outline, a line between them (over the row's gap and
   the field's border), still where it is when hovered. */
.filters-toggle {
  display: inline-flex;
  flex: none;
  align-self: stretch;
  order: 1;
  margin-left: -10px;
  padding-inline: 10px;
}
:root:root .filters-toggle:hover:not(:disabled) {
  transform: none;
}
.filters-toggle.on {
  background: var(--sel);
}
.filters {
  order: 2;
}
.filters.folded {
  display: none;
}
/* Only them beside the find, as tall as the row; under them the filters, opened, then the ones found, and why any of
   them shows as it does. */
.find-modes {
  display: flex;
  align-self: stretch;
  order: 1;
}
.found-list {
  display: flex;
  flex-basis: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  order: 3;
  margin: 0;
  padding: 0;
  list-style: none;
}
.find-note {
  order: 4;
}
/* Only them, while there's none found: its room kept, nothing shown. */
.find-mode.unshown {
  visibility: hidden;
}
/* One found: its name (finding its row) and its cross, one pill, a line between them. */
.found-chip {
  display: flex;
}
.found-clear {
  align-self: stretch;
}
.found-name,
.found-remove {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  /* Room around the sprite, so it sits inside the chip rather than touching its edges. */
  padding: 3px 8px 3px 2px;
  font: inherit;
  font-size: 0.875em;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--border-strong);
  cursor: pointer;
}
.found-remove {
  margin-left: -2px;
  padding: 0 6px;
  color: var(--muted);
}
.found-name:hover,
.found-remove:hover {
  background: var(--sel);
  color: var(--text);
}

/* Wider, the find no wider than a name needs. */
@media (min-width: 721px) {
  .find.find-row > .picker {
    flex: 0 1 18em;
  }
}
.find-compare {
  gap: 6px;
}
/* The swap on the opponents band, at its end (beside the field's tag, when there's one). */
.opponents-head > .find-swap {
  align-self: center;
  gap: 6px;
  margin-block: -2px;
  margin-left: auto;
}
.opponents-head > .field-tag + .find-swap {
  margin-left: 0;
}
.find-compare:hover {
  text-decoration: none;
}
/* The found Pokémon's icons over the toggle's padding, so the toggle takes the height around it: the search's in its
   row, the switches' pinned. Overlapping a little, then how many more past the first few. */
.find-mode :deep(.sheet-icon) {
  margin-block: -6px;
}
.only-icons {
  display: inline-flex;
  align-items: center;
}
.only-icons > :deep(.sheet-icon + .sheet-icon) {
  margin-left: -12px;
}
.only-more {
  margin-left: 2px;
  font-size: 0.8em;
  font-variant-numeric: tabular-nums;
}
/* The search takes what the toggles leave, but never less than room for a name: what doesn't fit beside it then goes
   to the next line. */
.find.find-row > .picker {
  flex: 1 1 9em;
  min-width: 9em;
}
/* On phones, the search and the filters' fold take the whole first row; Only them starts the next, the ones found
   after it, all wrapping as one row. */
@media (max-width: 720px) {
  .find.find-row > .picker {
    flex-basis: calc(100% - 46px);
  }
  .find-row .find-modes {
    order: 3;
  }
  .find-row .find-modes:has(.unshown) {
    display: none;
  }
  .find-row .find-mode {
    align-self: center;
  }
  .find-row .found-list {
    display: contents;
  }
  /* Each as tall as Only, the row's tallest. */
  .find-row .found-list > li {
    display: flex;
    order: 3;
    align-self: stretch;
  }
}
/* The skeleton's rows, while the ladder comes in. */
.tier {
  display: grid;
  grid-template-columns: var(--speed-col) 1fr;
  align-items: start;
  gap: 8px;
  padding: 4px var(--panel-bleed);
  border-top: 1px solid var(--border);
}
/* The bar pinned over the ladder: sticks to the top with no height, the bar itself drawn over the rows. */
.pin {
  position: sticky;
  top: var(--bar-h);
  z-index: 2;
  height: 0;
  /* As wide as the ladder. */
  margin-inline: calc(-1 * var(--panel-bleed));
}
.pinned {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px var(--panel-bleed);
  background: var(--panel);
  border-bottom: 1px solid var(--border-strong);
}
.pinned .short {
  display: none;
}
/* With yours picked, the ladder is its opponents: the bar's edge in their red, thick. */
.pinned.opponents {
  border-bottom: 3px solid var(--opponent);
}
/* The find, the "only" switch beside it, the search taking what the switch leaves. */
.pinned .find {
  display: flex;
  align-items: stretch;
  gap: 8px;
  max-width: none;
}
.pinned .find > .picker {
  flex: 1 1 0;
  min-width: 0;
}
/* The filters' fold right after the search, before the "only" switch. */
.pinned .filters-toggle {
  order: 0;
}
/* The strip: its chips as tall as each other, a smaller weight than the toolbar's. */
.pinned-chips {
  --gap: 6px;
}
.pinned-chips :deep(.track) {
  align-items: stretch;
  padding-block: 0 4px;
}
.pinned-chips .btn {
  gap: 6px;
  white-space: nowrap;
}
.pinned-chips :deep(.track) > .btn,
.pinned-chips :deep(.choice-dialog .toggle) {
  min-height: 0;
  padding-block: 4px;
}
/* What's on, a tap turning it off: marked as the switches on are, its cross at the end. */
.off-chip {
  font-weight: normal;
}
.pinned-chips .count {
  padding: 0 5px;
  font-size: 0.85em;
  font-weight: bold;
  color: var(--panel);
  background: var(--ink);
}
.pinned-chips .btn.on {
  background: var(--sel);
}
/* Wide: one line, the find a set share of it, the strip the rest. */
@media (min-width: 721px) {
  .pinned {
    flex-wrap: nowrap;
  }
  .pinned .find {
    flex: 0 1 22em;
    min-width: 12em;
  }
  .pinned-chips {
    flex: 1 1 0;
  }
}
/* Phones: the find on a line of its own, the strip under it. */
@media (max-width: 720px) {
  .pinned {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  /* As tall as the search: the find's width share would be its height in a column. */
  .pinned .find {
    flex: none;
  }
  .pinned .long {
    display: none;
  }
  .pinned .short {
    display: inline;
  }
}
/* The pinned bar's dialog: the filters, then the modifiers, then its actions. */
.filters-sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}
:root:root .filters-sheet.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
.sheet-close {
  min-height: 0;
  padding: 2px 4px;
}
.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filters-sheet > .drop-actions {
  justify-content: space-between;
  margin-top: 0;
}
/* Your Pokémon's Speed: one big primary button, its number large. */
.big-go {
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  padding: 4px 12px;
  font-weight: bold;
}
/* The opponents band, in short: beside the page's heading, and on the button to them. */
.opponents-tag {
  flex: none;
  padding: 1px 6px;
  font-size: 0.8125em;
  font-weight: bold;
  color: var(--opponent-text);
  background: var(--opponent);
  border: 1px solid var(--ink);
}
/* The way to the opponents: a plain button beside yours' primary one, in red. */
.opponents-go {
  justify-content: space-between;
  width: 100%;
  margin-top: 8px;
  padding: 4px 6px 4px 4px;
  font-weight: bold;
  color: var(--bad);
}
/* The find, flashed once in the opponents' red after the page scrolls to it. */
.find-row.flash :deep(.search) {
  animation: find-flash 1.2s ease-out 0.35s;
}
@keyframes find-flash {
  30% {
    box-shadow: 0 0 0 3px var(--opponent);
  }
}
.big-go-speed {
  font-size: 1.75em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
/* The button to the nearest match, floating at the bottom of the screen as the matchups page's to its results. */
/* What's docked at the foot of the screen: the way to the Pokémon found. */
.float-dock {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 32em;
  margin: 0 auto;
  pointer-events: none;
}
.float-dock > * {
  pointer-events: auto;
}
/* Under the row measured against, told apart from it by the room around it: yours' Speed against its, bold, and the way
   to the comparison of the two. */
.versus-who {
  font-weight: bold;
  white-space: nowrap;
}
.versus-compare {
  gap: 4px;
  font-weight: bold;
}
.versus-compare:hover {
  text-decoration: none;
}
.to-match {
  min-height: 40px;
  padding: 6px 16px;
  font-weight: bold;
}
/* The ladder and yours: side by side from 1100px, yours sticking in view; narrower, yours above the ladder. */
.speed-layout {
  display: flex;
  flex-direction: column;
}
@media (min-width: 1100px) {
  .speed-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 21em;
    align-items: start;
    gap: 0 12px;
  }
  /* Beside the ladder, yours and the comparison under it, stuck as it scrolls; scrolling when taller than the screen,
     the page then scrolling on from its end (and from anywhere on it when it fits), as a wheel over it would expect. */
  .side-col {
    position: sticky;
    top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: calc(100dvh - 24px);
    padding: 0 4px 4px 0;
    overflow-y: auto;
  }
  .side-col > .yours {
    margin: 0;
  }
}
/* A nature effect, in the comparison: its arrows and "Spe" together, the effect's name read out in their place. */
.effect {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.yours-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
/* The search takes what Clear leaves, as the find's does. */
.yours-pick .picker {
  flex: 1 1 12em;
}
.yours-pick :deep(.search-box) {
  max-width: none;
}
/* Its name, telling what the card is for on hover. */
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
/* Its heading, with an arrow drawn as the modifiers' is, rather than the browser's marker. */
.yours-title {
  display: flex;
  align-items: center;
  gap: 4px;
  list-style: none;
  font-weight: bold;
  cursor: pointer;
}
/* Clear, at the band's end. */
/* Its clearing, the icon alone, flat on the band: a wash of it on hover. */
:root:root .band-clear {
  margin-block: -2px;
  margin-left: auto;
  padding: 2px 4px;
  border-color: transparent;
}
/* Yours' search as a button holding it: its icon, its name and the cross, raised and bold as the buttons are. */
.yours-picker :deep(.search) {
  font-weight: bold;
  box-shadow: var(--hard-sm);
  cursor: pointer;
}
.yours-picker :deep(.search:focus) {
  cursor: text;
}
.yours-title::-webkit-details-marker {
  display: none;
}
@media (min-width: 1100px) {
  .yours-title {
    cursor: default;
  }
  .yours-marker {
    display: none;
  }
}
/* Its sections, each under a line, its parts spaced evenly, a label above what it labels. */
.yours-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
/* The ways to the ladder, at the card's foot, spaced by the section. */
.yours-go {
  gap: 8px;
}
.yours-go > :is(.big-go, .opponents-go) {
  margin-top: 0;
}
/* The common builds' row, the card's width, scrolling sideways (wrapping on phones). */
.yours-section > .builds {
  align-self: stretch;
}
/* The comparison, across the card's foot; greyed out, its tooltip on what's around it (a disabled button gets no
   pointer events). */
.yours-compare > :is(.compare-go, .compare-off) {
  align-self: stretch;
}
.compare-go {
  gap: 6px;
}
.compare-off {
  display: flex;
}
.compare-off > .compare-go {
  flex: 1;
}
.mods-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
  align-self: stretch;
}
.mods-head > .disclosure {
  margin-top: 0;
}
.yours-section > p,
.yours p.small {
  margin: 0;
}
.yours-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
}
/* The nature's choice under its label, its options each on one line. */
.yours .stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
/* On phones, the choices' labels above them, so they start at the panel's edge as the buttons around them do. */
@media (max-width: 720px) {
  .segmented.phone-stacked {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
.stacked :deep(.segments label) {
  white-space: nowrap;
}
/* Its modifiers tighter than the ones for everyone, as the panel is narrow (the tray already makes them smaller). */
.yours .mod {
  padding: 3px 8px;
}
.link-button {
  padding: 0;
  font: inherit;
  color: var(--link);
  background: none;
  border: none;
  cursor: pointer;
}
/* A chip, in the legend: its tags, as a row's are. */
.chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  max-width: 100%;
  padding: 0 6px 0 2px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
/* A row's tags, under its name. */
.tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
/* Each centered on the line, rather than on the words' baseline: the nature's effect, an arrow and "Spe", would sit
   its arrow on the baseline and lift its words above the other tags'. */
.tag {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .wide-only {
    display: none;
  }
}
/* Quieter than the name: in a row, its line under the name is so already. On phones, a long one (an item's name)
   wraps rather than running under how yours does beside it. */
.tag {
  color: var(--muted);
}
@media (max-width: 720px) {
  .tags .tag {
    white-space: normal;
  }
}
.chip .tag {
  font-size: 0.85em;
}
.tag + .tag::before {
  content: '·';
  margin-right: 4px;
}
/* An item's icon before its name. */
.boost-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
/* The build a boost is placed at: assumed, so quieter than the rest. Its words and the nature's effect centered on one
   line (the effect's arrow would otherwise lift it off the words' baseline), spaced as the words were. */
.boost-at {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-style: italic;
}
/* In a row, on a line of its own under the boost, with no dot before it. */
.tags .boost-at {
  flex-basis: 100%;
}
.tags .boost-at::before {
  content: none;
}
/* An item or ability its sets run that changes Speed, told apart from its builds. */
.chip.boost {
  border-style: dashed;
  border-color: var(--muted);
}
.skeleton {
  height: 2.2em;
}
.bone {
  display: inline-block;
  width: 40%;
  height: 0.8em;
  margin-left: calc(var(--speed-col) + 8px);
  background: var(--border);
  border-radius: 2px;
  opacity: 0.6;
}

/* The bulk and power tiers' own, past the speed tiers' (above, the same rules for the same parts). */
/* Phones: the reset down every row of the options, three with power's. */
@media (max-width: 720px) {
  .options.three-rows > .reset-options {
    grid-row: 1 / span 3;
  }
}
/* Narrower, yours' card over the ladder, folded until opened. */
@media (max-width: 1099px) {
  .side-col {
    order: -1;
    margin-bottom: 12px;
  }
}
/* Yours against those tapped: a line each, its icon and name, how much stronger or weaker, the share of its sets yours
   is above, and a cross letting it go. */
.versus-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
}
.versus-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
}
.versus-name {
  font-weight: bold;
}
.versus-close {
  margin-left: auto;
}
.good {
  color: var(--good);
}
.bad {
  color: var(--bad);
}
.chart {
  padding: 8px 0;
}
/* How many the chart shows: its button over it, its drop-down a slider and a box, as the tournaments' chart. */
.chart-head {
  display: flex;
  padding-top: 8px;
}
.chart-n {
  display: grid;
  grid-template-columns: minmax(0, auto) auto;
  gap: 2px 8px;
}
.chart-n > .muted {
  grid-column: 1 / -1;
}
.chart-n .chart-n-box {
  width: 4em;
  font: inherit;
}
@media (max-width: 720px) {
  .chart-n input[type='range'] {
    width: 100%;
    min-width: 6rem;
  }
}
</style>
