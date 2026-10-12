<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch, type Component } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronsDown,
  ChevronsUp,
  Columns2,
  Funnel,
  Box,
  Plus,
  Rocket,
  RotateCcw,
  Trash2,
  Wind,
  X,
  Zap,
} from '@lucide/vue'
import {
  ability,
  availableIds,
  condition,
  item,
  pokemon,
  type AbilityId,
  type ItemId,
  type PokemonId,
  type Ref,
} from '@/data/dex'
import { TYPES, isType, type TypeId } from '@/data/types'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { has, metaLabel, pastRoster, percent, type PokemonMeta, type Share, usageRanks } from '@/data/meta'
import { locale, t, tSplit, typeName } from '@/i18n'
import { refName } from '@/i18n/refName'
import { center, reveal } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'
import { natureName } from '@/data/natures'
import {
  NATURE_EFFECTS,
  NATURES_BY_EFFECT,
  pointsToMoveFirst,
  SPEED_ABILITIES,
  SPEED_ITEMS,
  inBattle,
  commonBuilds,
  MARK_SHARE,
  natureEffect,
  speedBuilds,
  speedStat,
  type SpeedEffect,
  type SpeedMods,
  type SpeedWhen,
  withEffect,
} from '@/lib/speed'
import { BENCHMARKS, MAX_POINTS, benchmark, type Benchmark, type NatureEffect } from '@/lib/stats'
import {
  FASTEST,
  benchBuild,
  buildQuery,
  doublerToggle,
  doublers,
  doubling,
  modButtons,
  toggled,
  type BuildToggle,
  type SpeedBuild,
} from '@/lib/speedBuild'
import { confirmDialog } from '@/composables/useConfirm'
import { lastTiersQuery, withoutMeta } from '@/lib/tiersState'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import { usePageEntered } from '@/composables/usePageEntered'
import AppLink from '@/components/AppLink'
import BuildSummary from '@/components/BuildSummary.vue'
import ChoiceDialog from '@/components/ChoiceDialog.vue'
import EffectTag from '@/components/EffectTag'
import ModalDialog from '@/components/ModalDialog.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import StageStepper from '@/components/StageStepper.vue'
import SpeedRanges, { type RangeRow } from '@/components/SpeedRanges.vue'
import SpeedOdds, { type OddsRow } from '@/components/SpeedOdds.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SpeedKeptMenu from '@/components/SpeedKeptMenu.vue'
import TypeIcon from '@/components/TypeIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import VersusCard from '@/components/VersusCard.vue'
import SetupStar from '@/components/SetupStar.vue'
import HelpToggle from '@/components/HelpToggle.vue'

// The regulation's Pokémon ordered by Speed, as a ladder of Speed values with the Pokémon at each. By default the
// meta: the most used Pokémon at the Speeds their sets actually run (from the meta snapshot shown, when it has them);
// with the items and abilities they run that change Speed as chips of their own (boosts); or every Pokémon at
// the Speeds that mark its range (`BENCHMARKS`). Trick Room turns the ladder over; the modifiers, when the reader
// opens them, apply to every Pokémon shown, to read Speeds as they'd be under Tailwind, at +1... Every choice is kept
// in the URL, so a view can be shared.
const router = useRouter()
const query = useActiveQuery()
const flag = (k: string) => query.value[k] === '1'
function set(k: string, v: string | undefined) {
  void router.replace({ query: { ...query.value, [k]: v } })
}

/** The least share of a Pokémon's sets a Speed needs. */
const MIN_SHARE = 0.03

// The snapshot shown is the one picked on any page (`useMeta`).
const { snapshot, data, loading } = useMeta()
/** Every Pokémon of the regulation shown: a past one's, when the data is of one; else the dex's. */
const regulationIds = computed<readonly PokemonId[]>(
  () => (snapshot.value && pastRoster(snapshot.value.regulation)) ?? availableIds('pokemon'),
)
const metaAvailable = computed(() => !!snapshot.value && has(snapshot.value, 'speeds'))

// Two choices, each in the URL: which Pokémon are shown (`?show=`): the most used (the top 50 or 100), or every
// Pokémon of the regulation; and what the ladder's rows are (`?view=`): a row per build its sets run, at its Speed
// (`ladder`); a row per Pokémon at its most common Speed, its builds marked on it (`charts`; `ranges`, their name
// before, still taken); or a row per Pokémon at the fastest it could be (`max`: Max+, Min− under Trick Room), with every
// Speed ability it can have among the boosts. Their Speeds are the sets players run; without a snapshot with Speeds,
// every Pokémon is at the benchmarks, a row per base Speed. A link from before these (`?all=1`) is every Pokémon's
// charts; one from when the charts could be at the benchmarks (`?speeds=bench`) is at the sets.
const SHOWS = ['top50', 'top100', 'all'] as const
type Show = (typeof SHOWS)[number]
const VIEWS = ['ladder', 'charts', 'max'] as const
type View = (typeof VIEWS)[number]
const DEFAULTS = { show: 'top50', view: 'ladder' } as const
const LEGACY = { show: 'all', view: 'charts' } as const
/** The charts' name in the URL before they were the charts. */
const renamed = <T,>(k: string, v: T) => (k === 'view' && v === 'ranges' ? 'charts' : v)
const legacy = computed(() => flag('all'))
const pick = <T extends string>(k: 'show' | 'view', list: readonly T[]): T => {
  const v = renamed(k, query.value[k])
  return (list as readonly unknown[]).includes(v) ? (v as T) : ((legacy.value ? LEGACY : DEFAULTS)[k] as T)
}
const show = computed<Show>(() => (metaAvailable.value ? pick('show', SHOWS) : 'all'))
const view = computed<View>(() => pick('view', VIEWS))
/** Whether the ladder is a row per Pokémon (and per boost), rather than per build. */
const perMon = computed(() => view.value !== 'ladder')
/** Whether the Speeds are the sets players run: with a snapshot that has them (else the benchmarks: a row per base
 * Speed). */
const bySets = computed(() => metaAvailable.value)
/** How many of the most used the view shows (every Pokémon: no top). */
const topN = computed(() => (show.value === 'top50' ? 50 : show.value === 'top100' ? 100 : Infinity))
/** Whether the view needs the snapshot's data: for the sets, or to know who's most used. */
const needsData = computed(() => bySets.value || show.value !== 'all')
/** One of the two set (the URL saying so only away from its default), a link from before them made explicit. */
function choose(k: 'show' | 'view', v: string) {
  const q: Record<string, unknown> = { ...query.value }
  delete q.speeds
  if (legacy.value) {
    delete q.all
    // Both of them away from their defaults.
    for (const key of ['show', 'view'] as const) q[key] ??= LEGACY[key]
  }
  q[k] = v === DEFAULTS[k] ? undefined : v
  void router.replace({ query: q as typeof query.value })
}
// The page opened bare (from the menu, nothing in its URL) comes as it was left (`lastTiersQuery`), put in the URL, so
// the URL always says what's shown; the charts' name from before put right.
{
  // Bare but for the data shown, which a link may carry: kept.
  const q: typeof query.value =
    Object.keys(withoutMeta(query.value)).length || !Object.keys(lastTiersQuery.value).length
      ? query.value
      : { ...lastTiersQuery.value, ...(query.value.meta !== undefined && { meta: query.value.meta }) }
  const fixed = q.view === 'ranges' ? { ...q, view: 'charts' } : q
  if (fixed !== query.value) void router.replace({ query: fixed })
}
const trickRoom = computed(() => flag('trickroom'))

// The benchmark a Pokémon is at on the ladder, with no sets to have it at: the fastest build, or the slowest under
// Trick Room, which is what matters then.
const bench = computed<Benchmark>(() => (trickRoom.value ? 'min' : 'max'))

// The modifiers, applied to everyone: shown when the reader opens them, or when the URL sets one; closed, they stay
// on, their disclosure marked and saying which, so the ladder is never modified out of sight.
const STAGES = ['-6', '-5', '-4', '-3', '-2', '-1', '0', '1', '2', '3', '4', '5', '6'] as const
const stage = computed({
  get: () => ((STAGES as readonly string[]).includes(String(query.value.stage)) ? String(query.value.stage) : '0'),
  set: (v: string) => set('stage', v === '0' ? undefined : v),
})
const TOGGLES = ['tailwind', 'scarf', 'paralysis'] as const
type Toggle = (typeof TOGGLES)[number]
const toggleMod = (k: Toggle) => set(k, flag(k) ? undefined : '1')
/** The modifiers that are items, shown with their icon. */
const MOD_ITEMS: Partial<Record<string, ItemId>> = { scarf: 'choicescarf', ironball: 'ironball' }
/** The modifiers with no item to show, by an icon: Tailwind's wind, paralysis' bolt. */
const MOD_ICONS: Partial<Record<string, Component>> = { tailwind: Wind, paralysis: Zap }
const mods = computed<SpeedMods>(() => ({
  tailwind: flag('tailwind'),
  scarf: flag('scarf'),
  paralysis: flag('paralysis'),
  stage: Number(stage.value),
}))
const modded = computed(() => TOGGLES.some(flag) || stage.value !== '0')
const modsOpen = shallowRef(modded.value)
const toggleMods = () => (modsOpen.value = !modsOpen.value)
/**
 * Whether boosts show, when the snapshot has the items and abilities they come from: as the URL says (`?boosts=0` or
 * `1`, a shared link), else as the reader last left them, remembered in this browser; off at first.
 */
const boostsAvailable = computed(
  () => !!snapshot.value && has(snapshot.value, 'items') && has(snapshot.value, 'abilities'),
)
const BOOSTS_KEY = 'sproutvgc.speedTiers.boosts'
function savedBoosts(): boolean {
  try {
    return localStorage.getItem(BOOSTS_KEY) === '1'
  } catch {
    return false
  }
}
const boostsPref = shallowRef(savedBoosts())
const boostsOn = computed(() =>
  query.value.boosts === '0' ? false : query.value.boosts === '1' ? true : boostsPref.value,
)
// Boosts are rows of the ladder at the sets' Speeds.
const showBoosts = computed(() => bySets.value && boostsAvailable.value && boostsOn.value)
function toggleBoosts() {
  const on = !boostsOn.value
  boostsPref.value = on
  try {
    localStorage.setItem(BOOSTS_KEY, on ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
  // The URL says so only when it differs from the default, so links stay short.
  set('boosts', on ? '1' : undefined)
}
const toggleTrickRoom = () => set('trickroom', trickRoom.value ? undefined : '1')
// The weather or terrain in play: the one yours' doubling ability needs, its ×2 on (Swift Swim, rain), as it's then
// the battle's for everyone on the ladder. Boosts needing another weather (or terrain) leave the ladder; those needing
// it are how their sets play, counted as such in how often yours moves first. With none, every boost shows, whatever
// it needs, as what could be.
const FIELDS = ['sun', 'rain', 'sandstorm', 'snow', 'electricterrain'] as const
type Field = (typeof FIELDS)[number]
/** Whether a boost's condition is a weather or terrain. */
const needsField = (w: SpeedWhen): w is Field => (FIELDS as readonly string[]).includes(w)
const isTerrain = (w: Field) => w === 'electricterrain'
/** The weather or terrain a doubling ability needs, if that's what it needs. */
const fieldOf = (a: string | undefined): Field | null => {
  const w = a ? SPEED_ABILITIES[a]?.when : undefined
  return w && needsField(w) ? w : null
}
const inPlay = computed<Field | null>(() => (mine.value ? fieldOf(doubling(mine.value, myBuild.value)) : null))
const fieldLabel = (f: Field) => refName(condition(f))
/** Whether a boost can be in the field in play: a weather can't with another weather, a terrain with another terrain. */
const inField = (w: SpeedWhen) =>
  !inPlay.value || !needsField(w) || w === inPlay.value || isTerrain(w) !== isTerrain(inPlay.value)
/** Whether a boost is in play: the field's own, which its sets have, rather than what could be. */
const live = (b: Boost) => b.ref.kind === 'ability' && !!inPlay.value && b.when === inPlay.value
// The controls back as a page comes without them: the options and the modifiers, boosts on again here too. Which
// Pokémon are shown (the tabs), what's found and kept, and yours, are left as they are.
// Everything back as the page comes with nothing set: its whole URL cleared (what's shown, the options, yours, what's
// found and kept), boosts on again, and the modifiers' sections folded.
// The data shown (`?meta=`) isn't the page's to reset: it's the reader's choice on every page.
const allChanged = computed(() => Object.keys(withoutMeta(query.value)).length > 0 || !boostsPref.value)
function resetAll() {
  boostsPref.value = true
  try {
    localStorage.removeItem(BOOSTS_KEY)
  } catch {
    // Storage unavailable: nothing saved to clear.
  }
  modsOpen.value = false
  myModsOpen.value = false
  yoursOpen.value = false
  void router.replace({ query: {} })
}
// `field` and `doubled` were controls of their own, once, as was where the Speeds come from (`speeds`): cleared with the
// rest, from an old link. Who's shown and how they're sorted are the toolbar's too (as how they were drawn was).
const CONTROL_KEYS = [
  'show',
  'view',
  'speeds',
  'all',
  'bench',
  'trickroom',
  'megas',
  'boosts',
  'field',
  'doubled',
  'stage',
  ...TOGGLES,
] as const
const controlsChanged = computed(() => CONTROL_KEYS.some((k) => query.value[k] !== undefined) || boostsOn.value)
function resetControls() {
  boostsPref.value = false
  try {
    localStorage.setItem(BOOSTS_KEY, '0')
  } catch {
    // Storage unavailable: boosts are off until the page reloads.
  }
  const q: Record<string, unknown> = { ...query.value }
  for (const k of CONTROL_KEYS) delete q[k]
  void router.replace({ query: q as typeof query.value })
  modsOpen.value = false
}
// Megas show unless the URL turns them off (`?megas=0`).
const showMegas = computed(() => query.value.megas !== '0')
const toggleMegas = () => set('megas', showMegas.value ? '0' : undefined)

// Your Pokémon: one, at the Speed its nature's effect and stat points give it, with modifiers of its own (the others'
// apply to everyone else), placed on the ladder among them. All in the URL: `mine`, `mynat`, `mypts`, `mymods` and
// `mystage`; and `vs`, the chip it's measured against.
const mine = computed(() => {
  const id = query.value.mine
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
const isEffect = (e: unknown): e is NatureEffect => (NATURE_EFFECTS as readonly unknown[]).includes(e)
const myNature = computed<NatureEffect>(() => (isEffect(query.value.mynat) ? query.value.mynat : 'up'))
const myPoints = computed(() => {
  const n = Number(query.value.mypts)
  return Number.isInteger(n) && n >= 0 && n <= MAX_POINTS ? n : MAX_POINTS
})
const MY_TOGGLES = ['tailwind', 'scarf', 'ironball', 'doubled', 'doubled2', 'paralysis'] as const
type MyToggle = (typeof MY_TOGGLES)[number]
const myToggles = computed(
  () =>
    new Set(
      String(query.value.mymods ?? '')
        .split(',')
        .filter((m): m is MyToggle => (MY_TOGGLES as readonly string[]).includes(m)),
    ),
)
const myStage = computed(() =>
  (STAGES as readonly string[]).includes(String(query.value.mystage)) ? String(query.value.mystage) : '0',
)
const myMods = computed<SpeedMods>(() => ({
  tailwind: myToggles.value.has('tailwind'),
  scarf: myToggles.value.has('scarf'),
  ironBall: myToggles.value.has('ironball'),
  doubled: !!mine.value && !!doubling(mine.value, myBuild.value),
  paralysis: myToggles.value.has('paralysis'),
  stage: Number(myStage.value),
}))
// Its modifiers fold away as the others' do: shown when the page comes with some on; folded, they stay on, their
// disclosure marked.
const myModded = computed(() => myToggles.value.size > 0 || myStage.value !== '0')
const myModsOpen = shallowRef(myModded.value)
const toggleMyMods = () => (myModsOpen.value = !myModsOpen.value)
const mySpeed = computed(() =>
  mine.value === null
    ? null
    : inBattle(speedStat(POKEMON[mine.value].stats[5], myPoints.value, myNature.value), myMods.value),
)

/**
 * Picks your Pokémon, at the meta's most common build of it when there is one, else the fastest. The page stays where
 * it is, so the ladder's opponents band is the first of it you see; the Speed's button shows where it landed.
 */
function pickMine(id: PokemonId | null) {
  if (!id) return
  void router.replace({ query: { ...query.value, mine: id, ...buildOf(id), mymods: keptMods(), vs: undefined } })
  // On phones, picked from the bar: its card opens, for its build and modifiers.
  if (phone.value) yoursOpen.value = true
}
/** Your modifiers for another Pokémon: its abilities aren't yours' (nor the weather they'd bring). */
function keptMods() {
  const kept = [...myToggles.value].filter((k) => k !== 'doubled' && k !== 'doubled2')
  return kept.length ? kept.join(',') : undefined
}
/** A Pokémon's Speed builds in the meta, by nature effect and points (what Speed cares about), the most common first. */
const buildsOf = (id: PokemonId) => speedBuilds(data.value?.[id]?.speeds ?? [])
/** Its build as picked: the meta's most common one, else the fastest. */
function buildOf(id: PokemonId) {
  const build = buildsOf(id)[0]
  return { mynat: build ? build.effect : 'up', mypts: String(build ? build.points : MAX_POINTS) }
}
// Its build and modifiers back as when it was picked.
const myChanged = computed(() => {
  if (mine.value === null) return false
  const b = buildOf(mine.value)
  return myNature.value !== b.mynat || String(myPoints.value) !== b.mypts || myModded.value
})
function resetMine() {
  if (mine.value === null) return
  void router.replace({ query: { ...query.value, ...buildOf(mine.value), mymods: undefined, mystage: undefined } })
  myModsOpen.value = false
}
function clearMine() {
  const q = { ...query.value }
  for (const k of ['mine', 'mynat', 'mypts', 'mymods', 'mystage', 'vs']) delete q[k]
  void router.replace({ query: q })
}
/** Yours and the one found swapped: the one found yours, at its build as picked (keeping your modifiers, as picking
 * one does), and yours found. */
function swapMine() {
  if (mine.value === null || found.value === null) return
  void router.replace({
    query: {
      ...query.value,
      mine: found.value,
      ...buildOf(found.value),
      mymods: keptMods(),
      find: mine.value,
      vs: undefined,
    },
  })
}
const setMyNature = (e: NatureEffect) => set('mynat', e)
/** Yours' common builds in the meta, to pick in a tap (as the comparison's are). */
const myCommon = computed(() => (mine.value ? commonBuilds(buildsOf(mine.value)) : []))
const setMyBuild = (e: NatureEffect, points: number) =>
  void router.replace({ query: { ...query.value, mynat: e, mypts: String(points) } })
const setMyPoints = (v: string) => {
  const n = Math.round(Number(v))
  if (Number.isFinite(n)) set('mypts', String(Math.min(MAX_POINTS, Math.max(0, n))))
}
/**
 * Turns one of your modifiers on or off: a Choice Scarf and an Iron Ball can't be held together, nor two abilities
 * had. A doubling ability that needs a weather or terrain brings it to the whole ladder: with boosts showing, asked
 * first, as those needing another one leave it; the chip yours is measured against, if one of them, then the same
 * Pokémon's at its build, without the boost.
 */
async function toggleMine(k: MyToggle) {
  const next = toggled([...myToggles.value], k)
  const id = mine.value
  const field = id ? fieldOf(doubling(id, { ...myBuild.value, toggles: next })) : null
  if (field && field !== inPlay.value && showBoosts.value) {
    const a = refName(ability(doublers(id!)[k === 'doubled2' ? 1 : 0] as AbilityId))
    const ok = await confirmDialog({
      message: t('speed.fieldConfirm', { ability: a, field: fieldLabel(field) }),
      confirm: t('speed.fieldConfirmButton', { field: fieldLabel(field) }),
    })
    if (!ok) return
  }
  const vs = field !== inPlay.value ? remapVs(field) : query.value.vs
  void router.replace({ query: { ...query.value, mymods: next.length ? next.join(',') : undefined, vs } })
}
/**
 * The chip yours is measured against, once `field` is in play (or none is): the same set as it then plays. A build
 * the field's ability now boosts, if its plain chip leaves the ladder, is its boosted one; a boosted build the field no
 * longer boosts, its plain one; a boost the field rules out, the Pokémon at the build it was placed at.
 */
function remapVs(field: Field | null) {
  const vs = vsKey.value ?? undefined
  if (vs === undefined) return vs
  const parts = vs.split(':')
  const id = parts[0] as PokemonId
  const m = data.value?.[id]
  const builds = buildsOf(id)
  const top = builds[0]
  const shareOf = (a: string) => m?.abilities?.find((x) => x.id === a)?.share ?? 0
  if (parts[1] !== 'ability') {
    // A plain build: boosted, when the field's ability leaves too little of it plain.
    const [, pts, nat] = parts
    const sp = builds.find((x) => String(x.points) === pts && x.effect === nat)
    const woken = field
      ? POKEMON[id]?.abilities.find((a) => SPEED_ABILITIES[a]?.when === field && shareOf(a) > 0)
      : undefined
    if (!sp || !woken) return vs
    const rest =
      1 -
      (m?.abilities ?? []).filter((a) => SPEED_ABILITIES[a.id]?.when === field).reduce((n, a) => n + (a.share ?? 0), 0)
    return sp.share * rest >= MIN_SHARE ? vs : `${id}:ability:${woken}:${pts}:${nat}`
  }
  const [, , effect, pts, nat] = parts
  const when = effect ? SPEED_ABILITIES[effect]?.when : undefined
  if (!when || !needsField(when)) return vs
  if (when === field && shareOf(effect!) > 0) return vs
  // Still on the ladder as what could be, while boosts show and the field doesn't rule it out; else its build plain.
  if (showBoosts.value && (!field || isTerrain(when) !== isTerrain(field) || when === field)) return vs
  if (pts) return `${id}:${pts}:${nat}`
  return top ? `${id}:${top.points}:${top.effect}` : m ? undefined : `${id}:${boostBench.value}`
}
/**
 * The chip yours is measured against, by its key (`?vs=`). Builds go by nature effect: a key from before, with an
 * exact nature in its place (a plain build's last, a live boost's), has it turned into its effect. A boost's from
 * before, with no build, when boosts were each at the most common one, is at that build.
 */
const vsKey = computed(() => {
  const vs = query.value.vs
  if (typeof vs !== 'string') return null
  const parts = vs.split(':')
  const top = buildsOf(parts[0] as PokemonId)[0]
  if ((parts[1] === 'ability' || parts[1] === 'item') && parts.length === 3 && top)
    return `${vs}:${top.points}:${top.effect}`
  const i = parts[1] === 'ability' ? 4 : /^\d+$/.test(parts[1] ?? '') ? 2 : -1
  const nat = parts[i]
  if (i < 0 || nat === undefined || isEffect(nat)) return vs
  parts[i] = natureEffect(nat)
  return parts.join(':')
})
/** What brings the field in play, for where it's said: yours' ability, by name. */
const fieldSource = computed(() => {
  const a = mine.value && inPlay.value ? doubling(mine.value, myBuild.value) : undefined
  return a ? refName(ability(a as AbilityId)) : null
})
/** The field out of play: yours' ability that brings it turned off. */
const clearField = () => void toggleMine(myToggles.value.has('doubled2') ? 'doubled2' : 'doubled')
/** Yours' modifiers' buttons: its doubling abilities by name, only those it can have. */
const myModButtons = computed(() => modButtons(mine.value))
const setMyStage = (v: string) => set('mystage', v === '0' ? undefined : v)
/** The nature effects' choice shows them as arrows beside "Spe", up and down, neutral as a word. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
/** The natures of an effect, by name: listed, as the effect is all Speed cares about. */
const naturesOf = (e: NatureEffect) =>
  e === 'neutral' ? t('speed.naturesNeutral') : NATURES_BY_EFFECT[e].map(natureName).join(', ')

interface Entry {
  id: PokemonId
  species: string
  forme?: string
  speed: number
  /** How its sets get there, stat points and their nature's effect on Speed, and their share of its sets (the meta),
   * or the benchmark it is (every Pokémon). */
  points?: number
  effect?: NatureEffect
  share?: number
  bench?: Benchmark
  /** An item or ability its sets run that changes Speed (`SPEED_ITEMS`, `SPEED_ABILITIES`), at one of its Speed
   * builds (a benchmark, with no sets in the snapshot): `speed` is the build's, the effect applied with the modifiers
   * (`chipSpeed`). */
  boost?: { ref: Ref<'item' | 'ability'> } & SpeedEffect
  /** Its boost is the field's own, which its sets have: how they play, rather than what could be. */
  live?: true
  /** Your Pokémon, with its own modifiers rather than the others'. */
  mine?: true
  /** The Pokémon found, shown though the top leaves it out: not counted in how yours does against the others. */
  extra?: true
  /** Its usage rank, to order the Pokémon at the same Speed: the same for all of them when every one shows, which
   * shows no usage, so they go by name. */
  rank: number
}

const named = (id: PokemonId) => splitForme(id, refName(pokemon(id)))
/**
 * A Pokémon's chips in the meta: one per Speed build (stat points and the nature's effect, `speedBuilds`), and its
 * boosts. With a weather or terrain in play, its sets whose ability it wakes are boosted as they play: their share
 * leaves its builds (a build left under the least share leaving the ladder) for its boost's chip.
 */
function metaChips(id: PokemonId, m: PokemonMeta, extra?: true): Entry[] {
  const base = POKEMON[id].stats[5]
  const rest = 1 - fieldShare(id)
  const builds = speedBuilds(m.speeds ?? [])
  // What its sets run under the least share is left out, but for the Pokémon looked for (found, or kept on the
  // ladder): every build its sets run on a chart's least share (`MARK_SHARE`; the data has every one, down to single
  // sets), and every boost, the Speed abilities it can have too, however few run them.
  const all = id === found.value || kept.value.includes(id)
  const shown = (share: number) => share >= (all ? MARK_SHARE : MIN_SHARE)
  // Those under it, shown only as it's looked for, are as a Pokémon beyond the top is: marked, and not counted in how
  // yours does against the others, so looking for one doesn't change it.
  const rare = (share: number) => extra ?? (share < MIN_SHARE ? (true as const) : undefined)
  const list: Entry[] = builds
    .filter((b) => shown(b.share * rest))
    .map((b) => ({
      id,
      ...named(id),
      speed: speedStat(base, b.points, b.effect),
      points: b.points,
      effect: b.effect,
      share: b.share * rest,
      rank: m.rank,
      extra: rare(b.share * rest),
    }))
  // Its boosts, at each of its builds the ladder has (whatever the field): the data counts items, abilities and spreads
  // apart, so it doesn't say which builds go with them. Items and abilities its sets run (the least share of them, but
  // for the Pokémon looked for, and sorting by what they could reach, which have every ability they can have, as what
  // could be), with the share of its sets running each. Those the modifiers rule out (Unburden with a Choice Scarf on everyone), or the field (another
  // weather), are left out. The field's own, always shown, are how its sets play: each build boosted, at its share of
  // them times the ability's (the two taken apart as the data counts them), those under the least share left out.
  if (boostsAvailable.value && builds.length) {
    const at = { id, ...named(id), rank: m.rank, extra }
    const abilityShare = (a: string) => m.abilities?.find((x) => x.id === a)?.share ?? 0
    const effects = [
      ...(m.items ?? [])
        .filter((i) => shown(i.share ?? 0))
        .map((i) => ({ ref: item(i.id), share: i.share ?? 0, effect: SPEED_ITEMS[i.id] })),
      ...POKEMON[id].abilities
        .filter((a) => all || view.value === 'max' || abilityShare(a) >= MIN_SHARE)
        .map((a) => ({ ref: ability(a), share: abilityShare(a), effect: SPEED_ABILITIES[a] })),
    ]
    for (const { ref, share, effect } of effects) {
      if (!effect || !inField(effect.when) || !withEffect(mods.value, effect)) continue
      const boost = { ref, ...effect }
      if (live(boost) && share > 0) {
        for (const b of builds) {
          if (!shown(b.share * share)) continue
          list.push({
            ...at,
            speed: speedStat(base, b.points, b.effect),
            points: b.points,
            effect: b.effect,
            share: b.share * share,
            boost,
            live: true,
            extra: rare(b.share * share),
          })
        }
      } else if (showBoosts.value) {
        for (const b of builds) {
          if (!shown(b.share)) continue
          list.push({
            ...at,
            speed: speedStat(base, b.points, b.effect),
            points: b.points,
            effect: b.effect,
            share,
            boost,
            extra: rare(Math.min(b.share, share)),
          })
        }
      }
    }
  }
  return list
}
/** The benchmark a Pokémon with no sets in the snapshot has its boosts at: the fastest, the slowest under Trick
 * Room. */
const boostBench = computed<Benchmark>(() => (trickRoom.value ? 'min' : 'max'))
/** A Pokémon with no sets in the snapshot's boosts: the Speed abilities it can have, at `boostBench` (what could be, as
 * nothing says how many run them). */
function benchBoosts(id: PokemonId, rank: number): Entry[] {
  if (!showBoosts.value) return []
  const speed = benchmark(POKEMON[id].stats[5], boostBench.value)
  const at = { id, ...named(id), rank, extra: true as const }
  return POKEMON[id].abilities.flatMap((a) => {
    const effect = SPEED_ABILITIES[a]
    if (!effect || !inField(effect.when) || !withEffect(mods.value, effect)) return []
    return [{ ...at, speed, bench: boostBench.value, boost: { ref: ability(a), ...effect } }]
  })
}
/** A Pokémon with no sets in the snapshot, found or kept: at every benchmark, and its boosts. */
function benchChips(id: PokemonId): Entry[] {
  const base = POKEMON[id].stats[5]
  const at = { id, ...named(id), rank: Infinity, extra: true as const }
  return [...BENCHMARKS.map((b) => ({ ...at, speed: benchmark(base, b), bench: b })), ...benchBoosts(id, Infinity)]
}
/** A chip's Speed in battle: with the modifiers, and its boost's effect among them, counted once if they have it. */
const chipSpeed = (e: Entry) => inBattle(e.speed, (e.boost && withEffect(mods.value, e.boost)) || mods.value)
const megaShown = (id: PokemonId) => showMegas.value || !POKEMON[id].mega
/** The Pokémon shown, before the filters: the top by usage, or every Pokémon. */
const sliceIds = computed<PokemonId[]>(() => {
  if (show.value === 'all') return regulationIds.value.filter((id) => !POKEMON[id].cosmetic && megaShown(id))
  if (!data.value) return []
  return (Object.entries(data.value) as [PokemonId, PokemonMeta][])
    .filter(([id, m]) => m.rank <= topN.value && megaShown(id))
    .map(([id]) => id)
})
/** A Pokémon at the benchmark picked: as the view's Speeds, or, at the sets, for one with none (marked as such). */
function benchEntry(id: PokemonId, extra?: true): Entry {
  return {
    id,
    ...named(id),
    speed: benchmark(POKEMON[id].stats[5], bench.value),
    bench: bench.value,
    rank: show.value === 'all' ? 0 : (data.value?.[id]?.rank ?? Infinity),
    extra,
  }
}
/** Every chip the view has, before the filters. */
const pool = computed<Entry[]>(() => {
  if (needsData.value && !data.value) return []
  const list: Entry[] = []
  for (const id of sliceIds.value) {
    const m = bySets.value ? data.value?.[id] : undefined
    if (m?.speeds?.length) list.push(...metaChips(id, m))
    else {
      const e = benchEntry(id, bySets.value || undefined)
      list.push(e)
      // At the fastest they could be, its boosts too, as for one with sets.
      if (bySets.value && view.value === 'max') list.push(...benchBoosts(id, e.rank))
    }
  }
  // The Pokémon kept and the one found, when the view leaves them out: at their sets (with none in the snapshot, at
  // every benchmark), or at the benchmark picked.
  const extras = new Set([...kept.value, ...(found.value ? [found.value] : [])])
  for (const id of extras) {
    if (!beyondTop(id) || !findable.value.has(id)) continue
    const m = data.value?.[id]
    if (!bySets.value) list.push(benchEntry(id, true))
    else list.push(...(m?.speeds?.length ? metaChips(id, m, true) : benchChips(id)))
  }
  return list
})

// Filtering the ladder (`?type=`, `?ability=`, `?item=`, together): only the Pokémon of a type, with an ability, or
// holding an item. In the meta, an ability or item its sets run, on at least `MIN_SHARE` of them, as the chips show
// them; otherwise (every Pokémon shown, or one with no sets) an ability it can have, and items only from sets. Yours
// stays, and how often it moves first is then against those filtered alone.
const queryId = <T extends string>(k: string, ids: readonly T[]): T | null => {
  const v = query.value[k]
  return typeof v === 'string' && (ids as readonly string[]).includes(v) ? (v as T) : null
}
const filterType = computed<TypeId | null>(() => {
  const v = query.value.type
  return typeof v === 'string' && isType(v) ? v : null
})
const filterAbility = computed(() => queryId<AbilityId>('ability', availableIds('ability')))
/** Items filter only the meta, whose sets have them. */
const itemsFilterable = computed(() => bySets.value && !!snapshot.value && has(snapshot.value, 'items'))
const filterItem = computed(() => (itemsFilterable.value ? queryId<ItemId>('item', availableIds('item')) : null))
const filtering = computed(() => !!(filterType.value || filterAbility.value || filterItem.value))
/** A Pokémon's abilities and items, as the filters go by them. */
function traits(id: PokemonId): { abilities: AbilityId[]; items: ItemId[] } {
  const m = bySets.value ? data.value?.[id] : undefined
  const run = <T extends string>(list: Share<T>[] | undefined) =>
    (list ?? []).filter((x) => (x.share ?? 1) >= MIN_SHARE).map((x) => x.id)
  return {
    abilities: m?.abilities ? run(m.abilities) : POKEMON[id].abilities,
    items: m?.items ? run(m.items) : [],
  }
}
type FilterKind = 'type' | 'ability' | 'item'
/** Whether a Pokémon passes the filters, but for the one of `except`'s kind. */
function passes(id: PokemonId, except?: FilterKind): boolean {
  const type = except === 'type' ? null : filterType.value
  const ab = except === 'ability' ? null : filterAbility.value
  const it = except === 'item' ? null : filterItem.value
  if (type && !POKEMON[id].types.includes(type)) return false
  if (!ab && !it) return true
  const { abilities, items } = traits(id)
  return (!ab || abilities.includes(ab)) && (!it || items.includes(it))
}
/** The chips shown: the view's, filtered. */
const entries = computed<Entry[]>(() => (filtering.value ? pool.value.filter((e) => passes(e.id)) : pool.value))
// What each filter can pick: what the Pokémon of the view passing the other filters have, with how many of them have
// it, by name (types in their usual order), so no pick leaves the ladder empty; the one picked always, though none
// have it.
const poolIds = computed(() => [...new Set(pool.value.map((e) => e.id))])
function options<T extends string>(
  kind: FilterKind,
  of: (id: PokemonId) => readonly T[],
  name: (id: T) => string,
  picked: T | null,
) {
  const counts = new Map<T, number>()
  for (const id of poolIds.value) {
    if (passes(id, kind)) for (const x of new Set(of(id))) counts.set(x, (counts.get(x) ?? 0) + 1)
  }
  if (picked && !counts.has(picked)) counts.set(picked, 0)
  return [...counts].map(([id, n]) => ({ id, n, name: name(id) }))
}
const byName = <T extends { name: string }>(list: T[]) =>
  list.sort((a, b) => a.name.localeCompare(b.name, locale.value))
const typeOptions = computed(() => {
  const list = options('type', (id) => POKEMON[id].types, typeName, filterType.value)
  return TYPES.flatMap((ty) => list.find((o) => o.id === ty) ?? [])
})
const abilityOptions = computed(() =>
  byName(
    options(
      'ability',
      (id) => traits(id).abilities,
      (a) => refName(ability(a)),
      filterAbility.value,
    ),
  ),
)
const itemOptions = computed(() =>
  itemsFilterable.value
    ? byName(
        options(
          'item',
          (id) => traits(id).items,
          (i) => refName(item(i)),
          filterItem.value,
        ),
      )
    : [],
)
// The filters fold away behind a button beside the find, marked while any is on.
const filtersOpen = shallowRef(false)
const clearFilters = () =>
  void router.replace({ query: { ...query.value, type: undefined, ability: undefined, item: undefined } })
/** Usage ranks, for the pickers to list by, most used first: the meta's, when there is one. */
const ranks = computed(() => (data.value ? usageRanks(data.value) : undefined))

// Finding a Pokémon: one picked from those on the ladder (`?find=`), its chips marked and the rest dimmed.
const found = computed(() => {
  const id = query.value.find
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
/** A row per Pokémon, the one found is the one yours is measured against too (its most common set), as tapping its
 * row does; a row per build, that's one of its rows, tapped. */
function setFound(id: PokemonId | null) {
  if (!perMon.value || mine.value === null) return set('find', id ?? undefined)
  const e = id !== null && id !== mine.value ? topEntry(id) : undefined
  void router.replace({ query: { ...query.value, find: id ?? undefined, vs: e ? chipKey(e) : undefined } })
}
/** Formes found though they battle as their base species does: Squawkabilly's plumages, which go together (two of
 * them have an ability of their own). */
const FINDABLE_ALIKE: ReadonlySet<PokemonId> = new Set<PokemonId>(['squawkabillyblue'])
/** A forme that battles as its base species does: the same types, base stats and abilities (Vivillon's patterns). */
function playsAsBase(id: PokemonId): boolean {
  if (FINDABLE_ALIKE.has(id)) return false
  const p = POKEMON[id]
  const b = p.base && POKEMON[p.base]
  const same = (x: readonly unknown[], y: readonly unknown[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return !!b && same(p.types, b.types) && same(p.stats, b.stats) && same(p.abilities, b.abilities)
}
// What can be found: every Pokémon shown, and in the meta every other one too, beyond the top (at its sets) or with
// none in the snapshot (at the benchmarks); but for the formes a battle changes it into, Megas aside (picked before
// it), and those battling as their base species, which say nothing it doesn't.
const findableIds = computed<PokemonId[]>(() =>
  regulationIds.value.filter(
    (id) =>
      !POKEMON[id].cosmetic &&
      megaShown(id) &&
      (!filtering.value || passes(id)) &&
      (show.value === 'all' ||
        !!data.value?.[id] ||
        ((!POKEMON[id].battleOnly || !!POKEMON[id].mega) && !playsAsBase(id))),
  ),
)
const findable = computed(() => new Set(findableIds.value))
/** A Pokémon the view leaves out, showing the most used: below its top, or with no sets in the snapshot. */
const beyondTop = (id: PokemonId) =>
  show.value !== 'all' && !!data.value && (data.value[id]?.rank ?? Infinity) > topN.value
// Pokémon beyond the top kept on the ladder once found (`?keep=`, comma-separated), to compare several of them; in the
// order kept.
const kept = computed<PokemonId[]>(() => {
  const v = query.value.keep
  return typeof v === 'string' ? (v.split(',').filter((id) => id in POKEMON) as PokemonId[]) : []
})
const keptShown = computed(() => kept.value.filter((id) => beyondTop(id) && findable.value.has(id)))
function toggleKept(id: PokemonId) {
  const list = kept.value.includes(id) ? kept.value.filter((k) => k !== id) : [...kept.value, id]
  set('keep', list.length ? list.join(',') : undefined)
}
/** The Pokémon found has no sets in the snapshot, or isn't in its top: why, said under the find. */
const foundNote = computed(() => {
  const id = found.value
  if (!id || !needsData.value || !data.value) return null
  const m = data.value[id]
  if (!m) return bySets.value ? t('speed.findNoData') : null
  return m.rank > topN.value ? t('speed.findBeyond', { n: topN.value }) : null
})
const isHit = (e: Entry) => !e.mine && e.id === found.value
// What finding does: mark its chips among the rest, or show only them (and yours, to compare): only them by default;
// the URL says so (`?findmode=`) only when it differs.
const FIND_MODES = ['mark', 'only'] as const
type FindMode = (typeof FIND_MODES)[number]
const defaultFindMode: FindMode = 'only'
const findMode = computed<FindMode>({
  get: () =>
    (FIND_MODES as readonly unknown[]).includes(query.value.findmode)
      ? (query.value.findmode as FindMode)
      : defaultFindMode,
  set: (m) => set('findmode', m === defaultFindMode ? undefined : m),
})
// The find's dialog on phones says what it finds in: the ladder, or yours' opponents on it.
const findTitle = computed(() => (mine.value ? t('compare.opponent') : t('title.speedTiers')))
/// Only it on the ladder, among its builds and boosts; with every Pokémon at the benchmarks, a row per base Speed, it'd be
// alone in its row, so there it's only marked.
/** Whether the view can show only the Pokémon found: not the ranges at the benchmarks, a row per base Speed. */
const onlyAllowed = computed(() => bySets.value)
const onlyFound = computed(() => found.value !== null && onlyAllowed.value && findMode.value === 'only')
// The toggle's label around the found Pokémon's icon, the same width whatever its name (which the search shows).
const onlyLabel = computed(() => tSplit('speed.findOnly', 'name'))
// A boost's build, around its nature's effect (an arrow, as the chips have it).
const boostAt = computed(() => tSplit('speed.boostAt', 'effect'))
const finding = computed(() => found.value !== null)

/** The modifiers for everyone, with a boost's effect among them, counted once if they have it. */
const modsWith = (boost?: Boost) => (boost && withEffect(mods.value, boost)) || mods.value
/** A Pokémon's sets' Speeds in battle, with a boost's effect if any: merged by nature effect and points, and by Speed
 * once the modifiers apply (each keeping the builds reaching it), the most common first. */
function setSpeeds(id: PokemonId, boost?: Boost): OddsRow['builds'] {
  const base = POKEMON[id].stats[5]
  const m = modsWith(boost)
  const bySpeed = new Map<number, OddsRow['builds'][number]>()
  for (const b of buildsOf(id)) {
    const speed = inBattle(speedStat(base, b.points, b.effect), m)
    const at = bySpeed.get(speed) ?? { speed, share: 0, sets: [] }
    at.share += b.share
    at.sets.push(b)
    bySpeed.set(speed, at)
  }
  return [...bySpeed.values()].sort((a, b) => b.share - a.share)
}
/** A Pokémon's Speed at each benchmark in battle, with `m`. */
const benchSpeeds = (id: PokemonId, m: SpeedMods) =>
  Object.fromEntries(BENCHMARKS.map((b) => [b, inBattle(benchmark(POKEMON[id].stats[5], b), m)])) as Record<
    Benchmark,
    number
  >
/** A row of the ladder, but for where it's placed and how it stands to the one yours is measured against. */
type RowBase = Omit<OddsRow, 'speed' | 'own' | 'versus' | 'rival'>
/** What the rows of a Pokémon and one of its boosts (or none) have alike, by the two: its sets' Speeds and reach. */
const groupKey = (e: Entry) => (e.boost ? `${e.id}:${e.boost.ref.kind}:${e.boost.ref.id}` : e.id)
/** Where a row of a Pokémon goes: at its most common Speed, or the fastest it could be (Max+; Min− under Trick Room);
 * with no sets in the snapshot, at that benchmark either way. */
function placeOf(r: RowBase): number {
  if (r.noSets || view.value === 'max') return trickRoom.value ? r.bench.min : r.bench.max
  return r.builds[0]!.speed
}
/**
 * The ladder at the sets players run (`SpeedOdds`), each row with the chip it stands for (what tapping it measures
 * yours against, and its tags): by build, a row per chip (a Speed build its sets run, or a boost at one), at its
 * Speed; else a row per Pokémon (its most common build's chip) and per boost (at its most common build), placed by the
 * view (`placeOf`). Each row has its Pokémon's sets' Speeds (with its boost), or, with none in the snapshot, its
 * benchmarks. Yours is a row of its own, first at its Speed; the rest from those moving first, then by usage.
 */
const ladderRows = computed(() => {
  const chips = new Map<string, Entry>()
  if (!bySets.value) return { rows: [] as OddsRow[], chips }
  const cache = new Map<string, Omit<RowBase, 'key' | 'extra' | 'hit'>>()
  function rowBase(key: string, e: Entry, extra: boolean): RowBase {
    const k = groupKey(e)
    let b = cache.get(k)
    if (!b) {
      const builds = setSpeeds(e.id, e.boost)
      const bench = benchSpeeds(e.id, modsWith(e.boost))
      b = {
        id: e.id,
        species: e.species,
        forme: e.forme,
        builds,
        reach: { min: bench.min, max: bench.max },
        bench,
        noSets: !builds.length,
        boost: !!e.boost && !e.live,
        mine: false,
      }
      cache.set(k, b)
    }
    return { ...b, key, extra, hit: isHit(e) }
  }
  const vs = versus.value?.e
  const vsGroup = vs ? groupKey(vs) : null
  const shown = onlyFound.value ? entries.value.filter((e) => e.id === found.value) : entries.value
  const placed: { row: OddsRow; rank: number; share: number }[] = []
  if (perMon.value) {
    const groups = new Map<string, Entry[]>()
    for (const e of shown) {
      const k = groupKey(e)
      groups.set(k, [...(groups.get(k) ?? []), e])
    }
    for (const [k, list] of groups) {
      // Its most common build (the chips come so), or with no sets, the benchmark it's placed at.
      const e = list.find((x) => x.bench === bench.value) ?? list[0]!
      const b = rowBase(
        k,
        e,
        list.every((x) => x.extra),
      )
      chips.set(k, e)
      const isVs = k === vsGroup
      placed.push({
        row: { ...b, speed: placeOf(b), versus: isVs, rival: !isVs && vs?.id === e.id },
        rank: e.rank,
        share: e.boost ? 0 : 1,
      })
    }
  } else {
    for (const e of shown) {
      const k = chipKey(e)
      const speed = chipSpeed(e)
      chips.set(k, e)
      const isVs = vsKey.value === k
      placed.push({
        row: { ...rowBase(k, e, !!e.extra), speed, own: speed, versus: isVs, rival: !isVs && vs?.id === e.id },
        rank: e.rank,
        share: e.share ?? 0,
      })
    }
  }
  // Yours, at its Speed with its own modifiers.
  if (mine.value !== null && mySpeed.value !== null) {
    const myBench = benchSpeeds(mine.value, myMods.value)
    placed.push({
      row: {
        key: 'mine',
        id: mine.value,
        ...named(mine.value),
        speed: mySpeed.value,
        builds: [
          { speed: mySpeed.value, share: 1, sets: [{ effect: myNature.value, points: myPoints.value, share: 1 }] },
        ],
        reach: { min: myBench.min, max: myBench.max },
        bench: myBench,
        own: mySpeed.value,
        noSets: false,
        extra: false,
        hit: false,
        mine: true,
        versus: false,
        rival: false,
      },
      rank: -Infinity,
      share: 1,
    })
  }
  // Yours first at its Speed, then by usage and by how many of its sets are at it, then by name: species, then forme,
  // the species' own first.
  const dir = trickRoom.value ? 1 : -1
  placed.sort(
    (a, b) =>
      (a.row.speed - b.row.speed) * dir ||
      a.rank - b.rank ||
      b.share - a.share ||
      a.row.species.localeCompare(b.row.species, locale.value) ||
      (a.row.forme ?? '').localeCompare(b.row.forme ?? '', locale.value),
  )
  return { rows: placed.map((p) => p.row), chips }
})
/** The chip a row stands for. */
const rowChip = (r: OddsRow) => ladderRows.value.chips.get(r.key)
/**
 * Every Pokémon shown, by base Speed (`SpeedRanges`), with no snapshot to have their sets from: those sharing one have
 * the same Speeds whatever their build, so a row each, with its Speeds at every benchmark (with the modifiers) and its
 * Pokémon by name; the rows from those moving first.
 */
const rangeRows = computed<RangeRow[]>(() => {
  if (bySets.value) return []
  const byBase = new Map<number, Entry[]>()
  for (const e of entries.value) {
    const base = POKEMON[e.id].stats[5]
    byBase.set(base, [...(byBase.get(base) ?? []), e])
  }
  const dir = trickRoom.value ? 1 : -1
  return [...byBase]
    .sort((a, b) => (a[0] - b[0]) * dir)
    .map(([base, list]) => ({
      base,
      speeds: Object.fromEntries(BENCHMARKS.map((b) => [b, inBattle(benchmark(base, b), mods.value)])) as Record<
        Benchmark,
        number
      >,
      mons: list
        .sort(
          (a, b) =>
            a.species.localeCompare(b.species, locale.value) ||
            (a.forme ?? '').localeCompare(b.forme ?? '', locale.value),
        )
        .map((e) => ({
          id: e.id,
          species: e.species,
          forme: e.forme,
          hit: e.id === found.value,
          mine: e.id === mine.value,
        })),
    }))
})
/** A Pokémon tapped, or found, a row per Pokémon: measured against at its most common chip, as its row is; yours
 * isn't. */
const topEntry = (id: PokemonId) =>
  entries.value.filter((x) => x.id === id && !x.boost).sort((a, b) => (b.share ?? 0) - (a.share ?? 0))[0]
/** Yours, tapped: nothing, as on its row (its page still opens in a new tab). */
function holdMine(ev: MouseEvent) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return
  ev.preventDefault()
  ev.stopPropagation()
}
function onRangeChip(ev: MouseEvent, id: PokemonId) {
  const e = topEntry(id)
  if (id === mine.value) holdMine(ev)
  else if (e) onChip(ev, e)
}
/** A row's Pokémon tapped: measured against the chip it stands for. */
function onRow(ev: MouseEvent, key: string) {
  const e = ladderRows.value.chips.get(key)
  if (key === 'mine') holdMine(ev)
  else if (e) onChip(ev, e)
}
/** A mark tapped, with yours: measured against that Speed of its row, at the most common build reaching it (with its
 * boost); on a row with no sets, at that benchmark. */
function onMark(key: string, speed: number) {
  const e = ladderRows.value.chips.get(key)
  const row = ladderRows.value.rows.find((r) => r.key === key)
  if (mine.value === null || !e || !row) return
  if (row.noSets) {
    const b = BENCHMARKS.find((x) => row.bench[x] === speed)
    // A boost with no sets is only at the benchmark it's placed at.
    if (!b || (e.boost && b !== e.bench)) return
    return pickVersus({ ...e, speed: benchmark(POKEMON[e.id].stats[5], b), bench: b })
  }
  const set = row.builds.find((b) => b.speed === speed)?.sets[0]
  if (!set) return
  pickVersus({
    ...e,
    speed: speedStat(POKEMON[e.id].stats[5], set.points, set.effect),
    points: set.points,
    effect: set.effect,
    ...(!e.boost && { share: set.share }),
  })
}
/** How many Pokémon the ladder holds, each once however many rows it has. */
const monCount = computed(() =>
  bySets.value
    ? new Set(ladderRows.value.rows.filter((r) => !r.mine).map((r) => r.id)).size
    : rangeRows.value.reduce((n, r) => n + r.mons.length, 0),
)
const ladder = useTemplateRef<HTMLElement>('ladder')

// How yours does against the others shown: the share of them it moves before, ties and moves after, weighted by usage
// in the meta (each build by its Pokémon's usage and its share of its sets; boosts left out, as they're those same
// sets boosted, but for those of the field picked, which are those sets as they play: the share of its sets with them
// moved from its builds to them), or each Pokémon alike when showing them all.
/** The share of a Pokémon's sets whose ability works in the field in play, as the chips show them. */
function fieldShare(id: PokemonId): number {
  if (!inPlay.value || !boostsAvailable.value) return 0
  const sum = (data.value?.[id]?.abilities ?? [])
    .filter((a) => SPEED_ABILITIES[a.id]?.when === inPlay.value)
    .reduce((n, a) => n + (a.share ?? 0), 0)
  return Math.min(1, sum)
}
/** What the summary is of: the view's Pokémon, those filtered, and the field picked. */
const summaryNote = computed(() =>
  [
    bySets.value
      ? t('speed.summarySets', { slice: sliceLabel.value })
      : t('speed.summaryBench', { slice: sliceLabel.value, bench: benchLabel(bench.value) }),
    filtering.value && t('speed.summaryFiltered'),
    inPlay.value && t('speed.summaryField', { field: fieldLabel(inPlay.value) }),
  ]
    .filter(Boolean)
    .join(' '),
)
function weight(e: Entry): number {
  if (!bySets.value) return e.boost ? 0 : 1
  const usage = data.value?.[e.id]?.usage ?? 0
  if (e.boost) return e.live ? usage * (e.share ?? 0) : 0
  return usage * (e.share ?? 0)
}
const summary = computed(() => {
  if (mySpeed.value === null) return null
  const tally = { first: 0, ties: 0, after: 0 }
  let total = 0
  for (const e of entries.value) {
    if (e.extra) continue
    const w = weight(e)
    if (!w) continue
    const theirs = chipSpeed(e)
    const k = theirs === mySpeed.value ? 'ties' : mySpeed.value > theirs !== trickRoom.value ? 'first' : 'after'
    tally[k] += w
    total += w
  }
  if (!total) return null
  return { first: tally.first / total, ties: tally.ties / total, after: tally.after / total }
})

// The chip yours is measured against (`?vs=`, picked by tapping it while yours is set), and what it takes to move
// before it, for each nature effect.
const versus = computed(() => {
  if (mine.value === null || vsKey.value === null) return null
  const e = chipOf(vsKey.value)
  if (!e) return null
  const target = chipSpeed(e)
  const base = POKEMON[mine.value].stats[5]
  const at = (effect: NatureEffect) => pointsToMoveFirst(base, effect, myMods.value, target, trickRoom.value)
  // Yours' nature, and when no points do it with that one, the nature that would: raising Speed (lowering it, under
  // Trick Room).
  const result = at(myNature.value)
  const works = (r: typeof result) => !!r && !('ties' in r)
  const better = trickRoom.value ? ('down' as const) : ('up' as const)
  const other =
    !works(result) && myNature.value !== better && works(at(better)) ? { effect: better, result: at(better) } : null
  return {
    e,
    target,
    card: {
      id: e.id,
      name: [e.species, e.forme].filter(Boolean).join(' '),
      speed: target,
      mineSpeed: mySpeed.value!,
      trickRoom: trickRoom.value,
      points: myPoints.value,
      result,
      other,
      compareTo: compareLink({ id: e.id, build: chipBuild(e), sets: perMon.value }),
    },
  }
})
/**
 * The chip a key stands for: one the ladder has, or, a mark tapped, a build its sets run that it leaves out (under the
 * least share), of a Pokémon and boost it has rows of.
 */
function chipOf(key: string): Entry | undefined {
  const on = entries.value.find((x) => chipKey(x) === key)
  if (on) return on
  const parts = key.split(':')
  const id = parts[0] as PokemonId
  const boosted = parts[1] === 'item' || parts[1] === 'ability'
  const of = entries.value.find((x) => x.id === id && (boosted ? x.boost?.ref.id === parts[2] : !x.boost))
  if (!of) return undefined
  const bench = parts[boosted ? 3 : 1]
  if (!boosted && parts.length === 2 && (BENCHMARKS as readonly string[]).includes(bench!)) {
    const b = bench as Benchmark
    return { ...of, speed: benchmark(POKEMON[id].stats[5], b), bench: b, points: undefined, effect: undefined }
  }
  const [pts, nat] = parts.slice(boosted ? 3 : 1)
  if (!isEffect(nat) || !/^\d+$/.test(pts ?? '') || of.bench) return undefined
  return {
    ...of,
    speed: speedStat(POKEMON[id].stats[5], Number(pts), nat),
    points: Number(pts),
    effect: nat,
    ...(!boosted && { share: buildsOf(id).find((b) => b.effect === nat && String(b.points) === pts)?.share }),
  }
}
// The comparison from yours' card: yours alone, to add opponents to there; none until there's yours. Against the chip
// tapped, the comparison's card has the way there instead. The one found, none of its chips tapped, is its opponent:
// at its sets, no Speed of them picked.
const compareTarget = computed(() => {
  if (mine.value === null) return null
  const id = found.value !== mine.value ? found.value : null
  if (id === null) return compareLink(null)
  const e = topEntry(id)
  return compareLink({ id, build: e ? chipBuild(e) : othersBuild(id, buildsOf(id)[0] ?? FASTEST), sets: true })
})
// Its title, the Pokémon's name (with its icon) a link to its page.
// Picking one finds it too, the find showing as its "Only" switch says; a row per Pokémon, letting it go lets the find
// go too, the two being one there.
function pickVersus(e: Entry) {
  const vs = vsKey.value === chipKey(e) ? undefined : chipKey(e)
  if (!vs && perMon.value) return clearVersus()
  void router.replace({ query: { ...query.value, vs, ...(vs && { find: e.id }) } })
}
// A row per Pokémon, one found with none measured against (found before yours was set, or a row per build) is
// measured against, as finding it there does.
watch([perMon, mine, found, vsKey, entries], () => {
  if (!perMon.value || mine.value === null || found.value === null || found.value === mine.value) return
  if (vsKey.value !== null) return
  const e = topEntry(found.value)
  if (e) set('vs', chipKey(e))
})
function clearVersus() {
  void router.replace({ query: { ...query.value, vs: undefined, ...(perMon.value && { find: undefined }) } })
}
// The comparison's Speed finds the row it's against: brought to the middle of the screen, flashing once.
function locateVersus() {
  const el = ladder.value?.querySelector<HTMLElement>('.row.versus')
  if (!el) return
  center(el)
  el.classList.remove('flash')
  void el.offsetWidth
  el.classList.add('flash')
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true })
}
function onChip(ev: MouseEvent, e: Entry) {
  if (mine.value === null || ev.ctrlKey || ev.metaKey || ev.shiftKey) return
  ev.preventDefault()
  ev.stopPropagation()
  if (!e.mine) pickVersus(e)
}

// The comparison page, side by side: yours (when picked) against a Pokémon, each at its build, with the modifiers the
// ladder has for everyone on the other.
const myBuild = computed<SpeedBuild>(() => ({
  effect: myNature.value,
  points: myPoints.value,
  toggles: [...myToggles.value],
  stage: Number(myStage.value),
}))
/** A boost's toggle in a build, for the Pokémon `id`: its doubling ability's by its place among them; Quick Feet has
 * none. */
function boostToggle(id: PokemonId, boost: Boost): BuildToggle | null {
  if (boost.mod === 'scarf') return 'scarf'
  if (boost.mod === 'ironBall') return 'ironball'
  if (boost.mod !== 'doubled') return null
  const i = doublers(id).indexOf(boost.ref.id)
  return i < 0 ? null : doublerToggle(i)
}
/** The ladder's modifiers for everyone, with an item or ability a chip's sets run. */
function othersBuild(id: PokemonId, b: Pick<SpeedBuild, 'effect' | 'points'>, boost?: Entry['boost']): SpeedBuild {
  let toggles: BuildToggle[] = TOGGLES.filter(flag)
  const k = boost ? boostToggle(id, boost) : null
  if (k && !toggles.includes(k)) toggles = toggled(toggles, k)
  return { ...b, toggles, stage: Number(stage.value) }
}
/** A chip's build: its benchmark, or its sets' nature effect and points. */
const chipBuild = (e: Entry) =>
  othersBuild(
    e.id,
    e.bench ? benchBuild(e.bench) : e.effect ? { effect: e.effect, points: e.points! } : FASTEST,
    e.boost,
  )
/** The comparison of yours and `other`, at its build, or at its sets (`sets`, when the meta has them). */
function compareLink(other: { id: PokemonId; build: SpeedBuild; sets: boolean } | null) {
  return {
    name: 'speedCompare',
    query: {
      ...(mine.value && { a: mine.value, ...buildQuery(myBuild.value, 'a') }),
      ...(other && { b: other.id, ...buildQuery(other.build, 'b') }),
      bsets: other?.sets && buildsOf(other.id).length ? '1' : undefined,
      trickroom: trickRoom.value ? '1' : undefined,
    },
  }
}
function toMine() {
  if (!side.value) yoursOpen.value = false
  center(ladder.value?.querySelector('.tier.has-mine'))
}
// To the ladder from yours' card, when it isn't beside it: the ladder's top brought up, its find flashing once (not
// focused, so no keyboard comes up) to say it's where to look for an opponent.
const listPanel = useTemplateRef<HTMLElement>('listPanel')
const flashFind = shallowRef(false)
async function toOpponents() {
  yoursOpen.value = false
  reveal(listPanel.value, listPanel.value)
  flashFind.value = false
  await nextTick()
  flashFind.value = true
}

const benchLabel = (b: Benchmark) => t(`stat.bench.${b}`)
/** The choice of who's shown, by name; and who's shown, as the summary says it. */
const showLabel = (s: Show) => (s === 'all' ? t('speed.all') : t('speed.meta', { n: s === 'top50' ? 50 : 100 }))
/** The views to pick, each with what it is in a line: the fastest possible the slowest under Trick Room, which turns
 * the ladder over. */
const viewOptions = computed(() => {
  const max = trickRoom.value ? 'min' : 'max'
  return VIEWS.map((v) => ({
    value: v,
    label: t(`speed.view.${v === 'max' ? max : v}`),
    desc: t(`speed.viewTip.${v === 'max' ? max : v}`, {
      pct: percent(v === 'ladder' ? MIN_SHARE : MARK_SHARE),
      bench: benchLabel(bench.value),
    }),
  }))
})
const sliceLabel = computed(() =>
  show.value === 'all' ? t('speed.slice.all') : t('speed.slice.top', { n: topN.value }),
)
/** Whether there's anything to choose about the list (its band, with the tab shown in its color). */
const choicesShown = computed(() => metaAvailable.value)
const benchTip = (b: Benchmark) => t(`speed.benchTip.${b}`)
/** A build in words: its nature's effect (with the natures that have it, but for neutral's), and its points. */
const buildText = (effect: NatureEffect, points: number) =>
  t('speed.build', {
    nature: t(`speed.natureOf.${effect}`),
    natures: effect === 'neutral' ? '' : ` (${naturesOf(effect)})`,
    points,
  })
const investTip = (e: Entry) => t('speed.invest', { build: buildText(e.effect!, e.points!), pct: percent(e.share!) })
type Boost = NonNullable<Entry['boost']>
const factor = (b: Boost) => b.factor.toLocaleString(locale.value)
const boostLabel = (b: Boost) => t('speed.boostLabel', { effect: refName(b.ref), factor: factor(b) })
/** The weather or terrain a boost needs, by name. */
const field = (b: Boost) =>
  b.when === 'always' || b.when === 'itemLost' || b.when === 'status' ? undefined : refName(condition(b.when))
/** When a boost applies, in short, for its chip: the weather or terrain, or what has to happen first. */
const whenTag = (b: Boost) => (b.when === 'itemLost' || b.when === 'status' ? t(`speed.whenShort.${b.when}`) : field(b))
function boostTip(e: Entry) {
  const b = e.boost!
  if (e.live)
    return t('speed.liveTip', {
      effect: refName(b.ref),
      factor: factor(b),
      field: field(b) ?? '',
      build: buildText(e.effect!, e.points!),
      pct: percent(e.share!),
    })
  const f = field(b)
  const when =
    b.when === 'always'
      ? ''
      : ` ${f ? t('speed.when.field', { field: f }) : t(`speed.when.${b.when as 'itemLost' | 'status'}`)}`
  if (e.bench)
    return t('speed.boostTipNoSets', { effect: refName(b.ref), factor: factor(b), when, build: benchTip(e.bench) })
  return t('speed.boostTip', {
    effect: refName(b.ref),
    pct: percent(e.share!),
    factor: factor(b),
    when,
    build: buildText(e.effect!, e.points!),
  })
}
const tip = (e: Entry) => (e.boost ? boostTip(e) : e.bench ? (e.extra ? benchTip(e.bench) : undefined) : investTip(e))
const chipKey = (e: Entry) =>
  e.mine
    ? 'mine'
    : `${e.id}:${
        e.boost
          ? `${e.boost.ref.kind}:${e.boost.ref.id}${e.bench ? '' : `:${e.points}:${e.effect}`}`
          : (e.bench ?? `${e.points}:${e.effect}`)
      }`

// A Speed's row links to the page as it is with that row picked (`?at=`): clicking its number picks it (or drops it,
// when picked already) and copies the link. A shared link brings the row into view once the ladder is in.
const at = computed(() => (typeof query.value.at === 'string' ? Number(query.value.at) : null))
const rowHref = (speed: number) => router.resolve({ query: { ...query.value, at: String(speed) } }).href
const copied = shallowRef<number | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function share(speed: number) {
  if (at.value === speed) return set('at', undefined)
  set('at', String(speed))
  if (!(await copy(new URL(rowHref(speed), location.href).href))) return
  copied.value = speed
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = null), 1500)
}

/**
 * Copies `text`, saying whether it could. The clipboard API only exists on secure pages (not the dev server opened
 * over the LAN, as on a phone), so elsewhere it goes through a hidden field and the older copy command. When neither
 * works, the address bar still has the link.
 */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position: fixed; opacity: 0; pointer-events: none'
    document.body.append(field)
    field.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      field.remove()
    }
  }
}
// A shared link to a row brings it into view once the ladder is in. Only the link it came with: a row picked later
// doesn't move the page. A Pokémon found doesn't either (the comparison's way here finds its opponent): the floating
// button, below, goes to it.
let scrolled = false
watch(
  () => [ladder.value, bySets.value ? ladderRows.value.rows.length : rangeRows.value.length] as const,
  async ([el, n]) => {
    if (scrolled || !el || !n) return
    scrolled = true
    if (at.value === null) return
    await nextTick()
    center(el.querySelector(`[data-speed="${at.value}"]`))
  },
)

// Finding a Pokémon, a floating button goes to the Speed it's at nearest the screen while none of them is on it, an
// arrow saying which way.
const match = shallowRef<{ el: Element; up: boolean; name: string } | null>(null)
function checkMatch() {
  const el = ladder.value
  const hits = finding.value && el ? [...el.querySelectorAll('.tier.hit')] : []
  const vh = window.innerHeight
  let nearest: { el: Element; up: boolean; d: number } | null = null
  for (const hit of hits) {
    const r = hit.getBoundingClientRect()
    if (r.bottom > 0 && r.top < vh) return void (match.value = null)
    const up = r.bottom <= 0
    const d = up ? -r.bottom : r.top - vh
    if (!nearest || d < nearest.d) nearest = { el: hit, up, d }
  }
  // Named after the Pokémon found, whatever the view.
  const who = found.value ? named(found.value) : null
  match.value = nearest && {
    el: nearest.el,
    up: nearest.up,
    name: who ? [who.species, who.forme].filter(Boolean).join(' ') : '',
  }
}
watch([ladderRows, rangeRows, found, ladder], () => void nextTick(checkMatch), { flush: 'post' })
window.addEventListener('scroll', checkMatch, { passive: true })
window.addEventListener('resize', checkMatch)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', checkMatch)
  window.removeEventListener('resize', checkMatch)
})
const toMatch = () => center(match.value?.el)

// Once the ladder's top scrolls past the screen's (the controls and the legend gone), a slim bar pinned over it keeps
// the search and the switches in reach. A marker where the ladder starts says when.
const pinMark = useTemplateRef<HTMLElement>('pinMark')
const pinned = shallowRef(false)
let observer: IntersectionObserver | undefined
watch(
  pinMark,
  (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new IntersectionObserver(([e]) => {
      pinned.value = !e!.isIntersecting && e!.boundingClientRect.top < 0
    })
    observer.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())

// "/" focuses the find (the pinned bar's, while it shows), as on sites with a search; not while typing elsewhere, nor
// with a dialog over the page.
const findPicker = useTemplateRef<InstanceType<typeof PokemonPicker>>('findPicker')
const pinnedFindPicker = useTemplateRef<InstanceType<typeof PokemonPicker>>('pinnedFindPicker')
function onSlash(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
  const el = document.activeElement
  if (el instanceof HTMLElement && (el.isContentEditable || el.closest('input, textarea, select'))) return
  if (document.documentElement.classList.contains('dialog-open')) return
  const picker = (pinned.value && pinnedFindPicker.value) || findPicker.value
  if (!picker) return
  e.preventDefault()
  picker.open()
}
window.addEventListener('keydown', onSlash)
onBeforeUnmount(() => window.removeEventListener('keydown', onSlash))

// How to read the page, in a section closed unless the reader opens it (remembered), so the ladder starts close to the
// top: what each option does, the chips' legend, and yours among them. Opened from the heading's row.
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.speedTiers.helpOpen', false)
const isOpen = (e: Event) => (e.target as HTMLDetailsElement).open

const stageLabel = (s: string) => (Number(s) > 0 ? `+${s}` : s.replace('-', '−'))
// The modifiers on, in short, on their disclosure while it's folded.
const modsOn = computed(() => [
  ...TOGGLES.filter((k) => flag(k)).map((k) => t(`speed.modShort.${k}`)),
  ...(stage.value !== '0' ? [stageLabel(stage.value)] : []),
])

/** Whether the screen has hover, for tooltips: touch screens show what matters inline instead. */
const canHover = window.matchMedia('(hover: hover)').matches

/** Whether the sidebar (yours) shows beside the ladder: from 1100px. Narrower, a comparison shows in a card. */
const sideQuery = window.matchMedia('(min-width: 1100px)')
const side = shallowRef(sideQuery.matches)
const onSide = (e: MediaQueryListEvent) => (side.value = e.matches)
sideQuery.addEventListener('change', onSide)
onBeforeUnmount(() => sideQuery.removeEventListener('change', onSide))

// Yours, narrower than the sidebar: a bar stuck to the top of the page, the way back to Competitive and yours in
// short, its card dropping from it when tapped (over the page, which a tap beside it closes). Beside the ladder, the
// card is the sidebar, and the bar shows only while it's out of view, bringing it in.
const yoursOpen = shallowRef(false)
// On phones (as wide as 720px), the card opens on a screen of its own rather than dropping from the bar, whether the
// bar is stuck to the top or not.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = shallowRef(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhone))
const yoursSheet = computed({
  get: () => yoursOpen.value && phone.value,
  set: (v: boolean) => (yoursOpen.value = v),
})
const toggleYours = () => (yoursOpen.value = !yoursOpen.value)
watch(side, (s) => s && (yoursOpen.value = false))
const yoursCard = useTemplateRef<HTMLElement>('yoursCard')
const sidebarSeen = shallowRef(true)
let sidebarObserver: IntersectionObserver | undefined
watch(
  [yoursCard, side],
  ([el, s]) => {
    sidebarObserver?.disconnect()
    sidebarSeen.value = true
    if (!el || !s) return
    sidebarObserver = new IntersectionObserver(([e]) => (sidebarSeen.value = e!.isIntersecting))
    sidebarObserver.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => sidebarObserver?.disconnect())
const barShown = computed(() => !side.value || !sidebarSeen.value)
// On phones with none picked, the bar goes straight to picking one: the card would only ask for it.
const yoursPicker = useTemplateRef<InstanceType<typeof PokemonPicker>>('yoursPicker')
function onBarYours() {
  if (side.value) reveal(yoursCard.value)
  else if (phone.value && !mine.value) yoursPicker.value?.open()
  else toggleYours()
}
// The bar's height, for what sticks to the top under it (the controls' heading, the ladder's bar), and where its card
// drops to: the screen under the bar, the card scrolling within that.
const bar = useTemplateRef<HTMLElement>('bar')
const barHeight = shallowRef(0)
const dropHeight = shallowRef(0)
let barObserver: ResizeObserver | undefined
watch(
  bar,
  (el) => {
    barObserver?.disconnect()
    if (!el) return
    barObserver = new ResizeObserver(() => (barHeight.value = el.offsetHeight))
    barObserver.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => barObserver?.disconnect())
watch(yoursOpen, (open) => {
  if (open && bar.value) dropHeight.value = window.innerHeight - bar.value.getBoundingClientRect().bottom - 8
})

// Remembered as left, for the page opened bare and the comparison's way back: while it's the page shown, not as it
// leaves (still there, fading out, as the next page's query comes in).
const route = useRoute()
watch(query, (q) => route.name === 'speedTiers' && (lastTiersQuery.value = withoutMeta(q)), { immediate: true })

const { entered } = usePageEntered()
</script>

<template>
  <!-- The controls and the ladder in panels of their own, under yours' bar. -->
  <div :style="{ '--bar-h': `${barHeight}px` }">
    <!-- Reset all, on the row of the way back to Competitive (the app's frame has a place for it there). -->
    <Teleport to="#back-actions-speedTiers" defer>
      <button v-if="allChanged" type="button" class="btn inverted reset-all" @click="resetAll">
        <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetAll') }}
      </button>
    </Teleport>
    <!-- Yours' bar: yours in short, opening its card (dropped under it, narrower than the sidebar; the sidebar brought
         in, beside the ladder). -->
    <div v-show="barShown" ref="bar" class="yours-bar" data-top-bar>
      <button
        type="button"
        class="btn primary bar-yours"
        :aria-expanded="side ? undefined : yoursOpen"
        @click="onBarYours"
      >
        <template v-if="mine">
          <!-- Yours in short: its name where the row has room for it, else its icon stands for it. -->
          <BuildSummary :id="mine" :speed="mySpeed!" :build="myBuild" />
        </template>
        <template v-else>
          <Plus :size="16" aria-hidden="true" />
          <span class="bar-name">{{ t('speed.yours') }}</span>
        </template>
        <span class="marker" aria-hidden="true">{{ yoursOpen ? '▾' : '▸' }}</span>
      </button>
      <div v-if="yoursOpen && !side && !phone" class="yours-backdrop" @click="yoursOpen = false"></div>
      <div
        v-show="yoursOpen && !side && !phone"
        id="yours-drop"
        class="yours-drop"
        :style="{ maxHeight: `${dropHeight}px` }"
      ></div>
      <!-- On phones, where yours' card opens instead: a dialog over the page. -->
      <!-- As large as the screen leaves, whatever's open in the card (which scrolls), its actions at the foot. -->
      <ModalDialog v-model:open="yoursSheet" :label="t('speed.yours')" fill>
        <div class="yours-sheet">
          <div id="yours-sheet" class="yours-sheet-card"></div>
          <div class="drop-actions sheet-actions">
            <button v-if="mine" type="button" class="btn inverted" @click="clearMine">
              <Trash2 :size="16" aria-hidden="true" />{{ t('speed.clear') }}
            </button>
            <button type="button" class="btn" :class="{ primary: mine }" @click="yoursOpen = false">
              {{ t(mine ? 'speed.confirm' : 'speed.close') }}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>

    <div class="speed-layout">
      <div class="main-col">
        <!-- The page's heading, over the ladder (yours beside both): on one row, the title and its star, saving the setup
             to the favorites, the data shown (a button opening what it is, to pick another; on phones, its icon alone),
             and how to read the page at the row's end (its icon alone on phones); under it, how to read the page,
             opened. -->
        <section class="panel page-head">
          <div class="head">
            <h1>{{ t('title.speedTiers') }}<SetupStar /></h1>
            <MetaDialog v-if="snapshot" class="head-meta" />
            <HelpToggle class="head-help" :open="helpOpen" controls="speed-help" fit @toggle="toggleHelp" />
          </div>
          <!-- How to read the ladder: what its options do; samples of a chip, each with what its parts mean; then yours
               among them. -->
          <div v-if="helpOpen" id="speed-help" class="help-body panel sunken">
            <div class="help-intro small">
              <dl class="help-options">
                <template v-if="metaAvailable">
                  <dt>{{ t('speed.show') }}</dt>
                  <dd class="muted">{{ t('speed.showDesc') }}</dd>
                  <dt>{{ t('speed.viewLabel') }}</dt>
                  <dd class="muted">{{ t('speed.viewDesc') }}</dd>
                </template>
                <template v-if="bySets && boostsAvailable">
                  <dt>{{ t('speed.boosts') }}</dt>
                  <dd class="muted">{{ t('speed.boostsDesc') }}</dd>
                </template>
                <dt>{{ t('speed.megas') }}</dt>
                <dd class="muted">{{ t('speed.megasDesc') }}</dd>
                <dt>{{ t('speed.mod.trickroom') }}</dt>
                <dd class="muted">{{ t('speed.modTip.trickroom') }}</dd>
                <dt>{{ t('speed.modifiers') }}</dt>
                <dd class="muted">{{ t('speed.modifiersTip') }}</dd>
              </dl>
            </div>
            <p class="formula muted small">{{ t('speed.formula') }}</p>
            <dl v-if="bySets && snapshot" class="legend small">
              <dt>
                <span class="chip sample"
                  ><span class="tag"><EffectTag effect="up" /></span
                  ><span class="tag">{{ t('speed.points', { n: 32 }) }}</span
                  ><span class="tag">{{ percent(0.461) }}</span></span
                >
              </dt>
              <dd class="muted">{{ t('speed.legendChip', { pct: percent(MIN_SHARE) }) }}</dd>
              <template v-if="showBoosts">
                <dt>
                  <span class="chip sample boost"
                    ><span class="tag boost-label"
                      ><ItemIcon id="choicescarf" :scale="0.67" />{{ t('speed.legendBoostLabel') }}</span
                    ></span
                  >
                </dt>
                <dd class="muted">
                  {{ t('speed.legendBoost') }}
                </dd>
              </template>
            </dl>
            <!-- Yours among them: what picking it does, tapping an opponent, and the comparison side by side. -->
            <dl class="help-options help-yours small">
              <dt>{{ t('speed.yours') }}</dt>
              <dd class="muted">{{ t('speed.helpYours') }}</dd>
              <dt>{{ t('compare.common') }}</dt>
              <dd class="muted">{{ t('compare.helpCommon') }}</dd>
              <dt>{{ t('speed.opponentsHead') }}</dt>
              <dd class="muted">{{ t('speed.helpOpponents') }}</dd>
              <dt>{{ t('compare.open') }}</dt>
              <dd class="muted">{{ t('speed.helpCompare') }}</dd>
            </dl>
          </div>
        </section>
        <div ref="listPanel" class="panel banded soft list">
          <!-- What the list is, a band of its own over the toolbar: who's shown and what places them (with a snapshot
               to have them from). On phones, their labels read out but not shown (the choices say what they are). -->
          <div v-if="choicesShown" class="band choices-band">
            <!-- Each in a dialog: who's shown, a plain list; the view, each with what it is in a line. -->
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
          <!-- The list's toolbar, a band under what the list is: its options on a line (what each does in a tooltip,
               the boosts', or in how to read the page; the modifiers for everyone opening under them), then finding a
               Pokémon on it. -->
          <div class="band find find-row" :class="{ flash: flashFind }" @animationend="flashFind = false">
            <div class="options-line">
              <div class="options">
                <template v-if="bySets && boostsAvailable">
                  <button
                    v-tip="canHover && t('speed.boostsDesc')"
                    type="button"
                    class="btn switch"
                    :class="{ on: showBoosts }"
                    :aria-pressed="showBoosts"
                    @click="toggleBoosts"
                  >
                    <Rocket :size="16" aria-hidden="true" />{{ t('speed.boosts') }}
                  </button>
                </template>
                <button
                  type="button"
                  class="btn switch"
                  :class="{ on: trickRoom }"
                  :aria-pressed="trickRoom"
                  @click="toggleTrickRoom"
                >
                  <Box :size="16" aria-hidden="true" />{{ t('speed.mod.trickroom') }}
                </button>
                <!-- The weather or terrain in play, from yours' ability: said as a switch that's on, what brings it on it, its
               cross turning the ability off. -->
                <template v-if="inPlay">
                  <button
                    v-tip="
                      canHover &&
                      t('speed.fieldFrom', {
                        name: refName(pokemon(mine!)),
                        ability: fieldSource!,
                        field: fieldLabel(inPlay),
                      })
                    "
                    type="button"
                    class="btn switch on field-status"
                    :aria-label="t('speed.fieldOff', { ability: fieldSource!, field: fieldLabel(inPlay) })"
                    @click="clearField"
                  >
                    {{ fieldLabel(inPlay) }}<span class="field-source"> · {{ fieldSource }}</span
                    ><X :size="16" aria-hidden="true" />
                  </button>
                </template>
                <button
                  type="button"
                  class="btn disclosure"
                  :class="{ on: modded }"
                  :aria-expanded="modsOpen"
                  @click="toggleMods"
                >
                  <Plus :size="16" aria-hidden="true" />{{ t('speed.modifiers')
                  }}<span v-if="!modsOpen && modsOn.length" class="mods-on">{{ modsOn.join(' · ') }}</span
                  ><span class="marker" aria-hidden="true">{{ modsOpen ? '▾' : '▸' }}</span>
                </button>
                <button
                  type="button"
                  class="btn switch"
                  :class="{ on: showMegas }"
                  :aria-pressed="showMegas"
                  @click="toggleMegas"
                >
                  {{ t('speed.megas') }}
                </button>
              </div>
              <!-- Resetting them: an icon at the end of the options' first line (they wrap beside it, never leaving it a
                   line of its own), there from the start (greyed out with nothing to reset), so the line doesn't change as
                   options are set. The zero-width space gives it a line of text, so it's as tall as the buttons. -->
              <button
                v-tip="canHover && t('speed.resetControls')"
                type="button"
                class="btn reset reset-options"
                :disabled="!controlsChanged"
                :aria-label="t('speed.resetControls')"
                @click="resetControls"
              >
                <RotateCcw :size="16" aria-hidden="true" />&#8203;
              </button>
            </div>
            <div v-if="modsOpen" class="mods all-mods">
              <button
                v-for="k in TOGGLES"
                :key="k"
                v-tip="canHover && t(`speed.modTip.${k}`)"
                type="button"
                class="btn mod"
                :class="{ on: flag(k) }"
                :aria-pressed="flag(k)"
                @click="toggleMod(k)"
              >
                <ItemIcon v-if="MOD_ITEMS[k]" :id="MOD_ITEMS[k]!" :scale="0.75" class="mod-item" /><component
                  :is="MOD_ICONS[k]"
                  v-else-if="MOD_ICONS[k]"
                  :size="16"
                  aria-hidden="true"
                />{{ t(`speed.mod.${k}`) }}
              </button>
              <StageStepper
                :model-value="Number(stage)"
                :min="Number(STAGES[0])"
                :max="Number(STAGES.at(-1))"
                @update:model-value="(n: number) => (stage = String(n))"
              />
            </div>
            <PokemonPicker
              ref="findPicker"
              recent
              :model-value="found"
              :ids="findableIds"
              :placeholder="t('speed.find')"
              hotkey="/"
              :title="findTitle"
              :tone="mine ? 'opponent' : undefined"
              list-width-of=".find-row"
              speed
              :ranks
              clearable
              @update:model-value="setFound"
            />
            <!-- The filters' fold, beside the find. -->
            <button
              type="button"
              class="btn filters-toggle"
              :class="{ on: filtering }"
              :aria-expanded="filtersOpen"
              aria-controls="speed-filters"
              :aria-label="t('speed.filter')"
              @click="filtersOpen = !filtersOpen"
            >
              <Funnel :size="16" aria-hidden="true" />
            </button>
            <!-- Only it on the ladder, beside the find (not with every Pokémon once, where it shows once): its room kept
                 there while it's not shown, so the row doesn't change. -->
            <div class="find-modes">
              <button
                type="button"
                class="btn switch find-mode"
                :class="{ on: onlyFound, unshown: !found || !onlyAllowed }"
                :disabled="!found || !onlyAllowed"
                :aria-hidden="!found || !onlyAllowed || undefined"
                :aria-pressed="onlyFound"
                :aria-label="found ? t('speed.findOnly', { name: refName(pokemon(found)) }) : undefined"
                @click="findMode = onlyFound ? 'mark' : 'only'"
              >
                {{ onlyLabel[0] }}<PokemonIcon :id="found ?? 'pikachu'" />{{ onlyLabel[1] }}
              </button>
            </div>
            <!-- What to do with the one found, on a row under the filters (the field's own cross clears it): keep it on
                 the ladder, joined to the ones kept. -->
            <div v-if="(found && beyondTop(found)) || keptShown.length" class="find-actions">
              <!-- Keeping the one found on the ladder (when it's not on it already: beyond the top), joined to the drop-down
                   of the ones kept, saying how many. -->
              <span v-if="(found && beyondTop(found)) || keptShown.length" class="keep-group">
                <label
                  v-if="found && beyondTop(found)"
                  v-tip="canHover && t('speed.keep')"
                  class="btn switch find-mode"
                  :class="{ on: kept.includes(found) }"
                >
                  <input
                    type="checkbox"
                    :checked="kept.includes(found)"
                    :aria-label="t('speed.keep')"
                    @change="toggleKept(found)"
                  />
                  {{ t('speed.keepShort') }}
                </label>
                <SpeedKeptMenu
                  v-if="keptShown.length"
                  :ids="keptShown"
                  :found
                  @find="setFound"
                  @remove="toggleKept"
                  @clear="set('keep', undefined)"
                />
              </span>
            </div>
            <p v-if="foundNote" class="find-note muted small">{{ foundNote }}</p>
            <!-- Filtering the ladder: by type, ability and item, each a choice of what the Pokémon shown have. -->
            <div
              id="speed-filters"
              class="filters"
              :class="{ folded: !filtersOpen }"
              role="group"
              :aria-label="t('speed.filter')"
            >
              <span class="small filters-label">{{ t('speed.filter') }}</span>
              <span class="filter" :class="{ on: filterType }">
                <TypeIcon v-if="filterType" :type="filterType" class="filter-icon" aria-hidden="true" />
                <select
                  class="search filter-pick"
                  :value="filterType ?? ''"
                  :aria-label="t('speed.filterType')"
                  @change="set('type', ($event.target as HTMLSelectElement).value || undefined)"
                >
                  <option value="">{{ t('speed.anyType') }}</option>
                  <option v-for="o in typeOptions" :key="o.id" :value="o.id">{{ o.name }} ({{ o.n }})</option>
                </select>
              </span>
              <span class="filter" :class="{ on: filterAbility }">
                <select
                  class="search filter-pick"
                  :value="filterAbility ?? ''"
                  :aria-label="t('speed.filterAbility')"
                  @change="set('ability', ($event.target as HTMLSelectElement).value || undefined)"
                >
                  <option value="">{{ t('speed.anyAbility') }}</option>
                  <option v-for="o in abilityOptions" :key="o.id" :value="o.id">{{ o.name }} ({{ o.n }})</option>
                </select>
              </span>
              <span v-if="itemsFilterable" class="filter" :class="{ on: filterItem }">
                <ItemIcon v-if="filterItem" :id="filterItem" :scale="0.67" class="filter-icon" aria-hidden="true" />
                <select
                  class="search filter-pick"
                  :value="filterItem ?? ''"
                  :aria-label="t('speed.filterItem')"
                  @change="set('item', ($event.target as HTMLSelectElement).value || undefined)"
                >
                  <option value="">{{ t('speed.anyItem') }}</option>
                  <option v-for="o in itemOptions" :key="o.id" :value="o.id">{{ o.name }} ({{ o.n }})</option>
                </select>
              </span>
              <button v-if="filtering" type="button" class="btn inverted filters-clear" @click="clearFilters">
                <X :size="14" aria-hidden="true" />{{ t('speed.clearFilters') }}
              </button>
            </div>
          </div>
          <!-- With yours picked, the ladder is its opponents: said over it, with what tapping one does. -->
          <div v-if="mine" class="band opponents-head">
            <strong>{{ t('speed.opponentsHead') }}</strong>
            <!-- What tapping one does, left out when it doesn't fit on the band's line. -->
            <span class="opponents-hint"
              ><span>{{ t('speed.opponentsHint') }}</span></span
            >
            <!-- The weather or terrain they're in, from yours' ability, at the band's end. -->
            <span v-if="inPlay" class="field-tag">{{ fieldLabel(inPlay) }}</span>
            <!-- Yours and the one found swapped, at the band's very end. -->
            <button
              v-if="found"
              type="button"
              class="btn on-band inverted find-swap"
              :aria-label="t('compare.swap')"
              @click="swapMine"
            >
              <ArrowLeftRight :size="14" aria-hidden="true" />{{ t('compare.swap') }}
            </button>
          </div>
          <!-- Pinned over the ladder once the controls are scrolled away; takes no room of its own. -->
          <div ref="pinMark" aria-hidden="true"></div>
          <div class="pin">
            <div v-if="pinned" class="pinned" :class="{ opponents: mine }" data-top-bar>
              <div class="find">
                <PokemonPicker
                  ref="pinnedFindPicker"
                  recent
                  :model-value="found"
                  :ids="findableIds"
                  :placeholder="t('speed.findShort')"
                  hotkey="/"
                  :title="findTitle"
                  :tone="mine ? 'opponent' : undefined"
                  list-width-of=".pinned"
                  speed
                  :ranks
                  clearable
                  @update:model-value="setFound"
                />
                <button
                  v-if="found && onlyAllowed"
                  type="button"
                  class="btn switch find-mode"
                  :class="{ on: onlyFound }"
                  :aria-pressed="onlyFound"
                  :aria-label="t('speed.findOnly', { name: refName(pokemon(found)) })"
                  @click="findMode = onlyFound ? 'mark' : 'only'"
                >
                  {{ onlyLabel[0] }}<PokemonIcon :id="found" />{{ onlyLabel[1] }}
                </button>
              </div>
              <button
                v-if="bySets && boostsAvailable"
                type="button"
                class="btn switch"
                :class="{ on: showBoosts }"
                :aria-pressed="showBoosts"
                @click="toggleBoosts"
              >
                <Rocket :size="16" aria-hidden="true" />{{ t('speed.boosts') }}
              </button>
              <button
                type="button"
                class="btn switch"
                :class="{ on: trickRoom }"
                :aria-pressed="trickRoom"
                :aria-label="t('speed.mod.trickroom')"
                @click="toggleTrickRoom"
              >
                <!-- "TR" on phones, the usual shorthand, so the bar fits on one line. -->
                <Box :size="16" aria-hidden="true" />
                <span class="long" aria-hidden="true">{{ t('speed.mod.trickroom') }}</span>
                <span class="short" aria-hidden="true">{{ t('speed.trShort') }}</span>
              </button>
            </div>
          </div>

          <div v-if="!entered || (needsData && !data)" class="ladder" aria-hidden="true">
            <div v-for="i in 12" :key="i" class="tier skeleton"><span class="bone"></span></div>
          </div>
          <!-- The ladder: at the sets, a row per build or per Pokémon with its sets' Speeds, by the view; with no
               snapshot, at the benchmarks, a row per base Speed. With yours, a tap on a row's Pokémon or on a mark
               measures yours against it (caught before the link follows; the link still opens in a new tab). -->
          <div v-else ref="ladder" class="ranges-wrap" :class="{ 'meta-stale': loading }" :aria-busy="loading">
            <SpeedOdds
              v-if="bySets"
              :rows="ladderRows.rows"
              :mine="mySpeed"
              :trick-room="trickRoom"
              :finding="finding && !onlyFound"
              :versus-speed="versus?.target ?? null"
              :picked-speed="at"
              :copied
              :row-href="rowHref"
              :axis-reach="view === 'max'"
              @chip="onRow"
              @mark="onMark"
              @share="share"
            >
              <template #tags="{ row }">
                <span v-if="row.mine" class="tags">
                  <span class="tag">{{ t('speed.yoursTag') }}</span>
                  <span class="tag"><EffectTag :effect="myNature" /></span>
                  <span class="tag">{{ t('speed.points', { n: myPoints }) }}</span>
                </span>
                <template v-else-if="rowChip(row)">
                  <span v-if="rowChip(row)!.boost" v-tip="canHover && tip(rowChip(row)!)" class="tags">
                    <span class="tag boost-label"
                      ><ItemIcon
                        v-if="rowChip(row)!.boost!.ref.kind === 'item'"
                        :id="rowChip(row)!.boost!.ref.id as ItemId"
                        :scale="0.67"
                      />{{ boostLabel(rowChip(row)!.boost!) }}</span
                    >
                    <span v-if="whenTag(rowChip(row)!.boost!)" class="tag">{{ whenTag(rowChip(row)!.boost!) }}</span>
                    <span v-if="rowChip(row)!.share !== undefined && !(perMon && rowChip(row)!.live)" class="tag">{{
                      percent(rowChip(row)!.share!)
                    }}</span>
                    <!-- A row per build: the build it's placed at, which the data doesn't tie to the boost (but for the
                         field's own, as they play), said as such. -->
                    <template v-if="!perMon">
                      <template v-if="rowChip(row)!.live">
                        <span class="tag"><EffectTag :effect="rowChip(row)!.effect!" /></span>
                        <span class="tag">{{ t('speed.points', { n: rowChip(row)!.points! }) }}</span>
                      </template>
                      <span v-else-if="rowChip(row)!.bench" class="tag boost-at">{{
                        t('speed.boostAtBench', { bench: benchLabel(rowChip(row)!.bench!) })
                      }}</span>
                      <span v-else class="tag boost-at"
                        >{{ boostAt[0] }}<EffectTag :effect="rowChip(row)!.effect!" />{{
                          boostAt[1].replace('{points}', String(rowChip(row)!.points))
                        }}</span
                      >
                    </template>
                  </span>
                  <template v-else-if="!perMon">
                    <span v-if="rowChip(row)!.bench && rowChip(row)!.extra" class="tags">
                      <span class="tag">{{ benchLabel(rowChip(row)!.bench!) }}</span>
                    </span>
                    <span v-else-if="!rowChip(row)!.bench" v-tip="canHover && tip(rowChip(row)!)" class="tags">
                      <span class="tag"><EffectTag :effect="rowChip(row)!.effect!" /></span>
                      <span class="tag">{{ t('speed.points', { n: rowChip(row)!.points! }) }}</span>
                      <span class="tag">{{ percent(rowChip(row)!.share!) }}</span>
                    </span>
                  </template>
                </template>
              </template>
            </SpeedOdds>
            <SpeedRanges
              v-else
              :rows="rangeRows"
              :mine="mySpeed"
              :trick-room="trickRoom"
              :finding
              :versus="versus?.e.id ?? null"
              @chip="onRangeChip"
            />
          </div>

          <!-- Outside the page so the page transition's transform can't move it. -->
          <Teleport to="body">
            <AnimatePresence>
              <motion.div
                v-if="versus && !side"
                key="versus"
                class="versus-float"
                :initial="{ opacity: 0, y: 8 }"
                :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: 8 }"
                :transition="FADE"
              >
                <VersusCard v-bind="versus.card" @close="clearVersus" @locate="locateVersus" />
              </motion.div>
              <motion.button
                v-else-if="match"
                key="match"
                type="button"
                class="btn primary to-match"
                :initial="{ opacity: 0, y: 8 }"
                :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: 8 }"
                :transition="FADE"
                :while-press="PRESS"
                @click="toMatch"
              >
                {{ match.name }} {{ match.up ? '↑' : '↓' }}
              </motion.button>
            </AnimatePresence>
          </Teleport>

          <p v-if="entered && (!needsData || data)" class="muted small note">{{ t('speed.count', { n: monCount }) }}</p>
          <p class="muted small note">{{ t('speed.intro', { reg: snapshot?.regulation ?? REGULATION }) }}</p>
          <p v-if="entered && (!needsData || data) && filtering && !monCount" class="muted small note">
            {{ t('speed.filteredNone') }}
          </p>
          <p v-if="showMegas" class="muted small note">{{ t('speed.megaNote') }}</p>
          <p v-if="bySets && snapshot" class="muted small note">
            {{ t('speed.leftOutNote', { pct: percent(MIN_SHARE) }) }}
          </p>
          <p v-if="needsData && snapshot" class="muted small note">
            {{ metaLabel(snapshot) }} · {{ t('usage.from') }}
            <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
          </p>
        </div>
      </div>
      <!-- Your Pokémon: where it lands among the others, and what it takes to move before one of them. A sidebar that
           stays in view beside the ladder on wide screens, so tapping a chip anywhere shows the answer; above it, narrower. -->
      <!-- Narrower, it's the card dropping from yours' bar; on phones, on a screen of its own. -->
      <!-- Beside the ladder, yours and under it, in a panel of its own, the comparison with the chip tapped; both
           stuck as the ladder scrolls. Narrower, the card goes to the bar's drop (or a dialog) and the comparison
           floats at the foot of the screen. -->
      <div class="side-col">
        <Teleport :to="phone ? '#yours-sheet' : '#yours-drop'" :disabled="side" defer>
          <details
            ref="yoursCard"
            class="panel banded yours instant"
            :open="side || yoursOpen"
            @toggle="!side && (yoursOpen = isOpen($event))"
          >
            <!-- A heading that closes the card dropped from the bar; beside the ladder it's always open. -->
            <summary class="yours-title" @click.prevent="!side && toggleYours()">
              <span class="marker yours-marker" aria-hidden="true">{{ yoursOpen ? '▾' : '▸' }}</span>
              {{ t('speed.yours') }}
              <!-- Unpicking yours, at the band's end: its own click, not the heading's. -->
              <button v-if="mine" type="button" class="btn on-band inverted band-clear" @click.stop.prevent="clearMine">
                <Trash2 :size="14" aria-hidden="true" />{{ t('speed.clear') }}
              </button>
            </summary>
            <div class="yours-pick">
              <PokemonPicker
                recent
                :model-value="mine"
                ref="yoursPicker"
                :placeholder="t('speed.yoursPick')"
                :title="t('speed.yours')"
                tone="yours"
                :caret="!mine"
                list-width-of=".yours-pick"
                speed
                icon
                :ranks
                class="yours-picker"
                @update:model-value="pickMine"
              />
            </div>
            <p v-if="!mine" class="muted small wide-only yours-intro">{{ t('speed.yoursIntro') }}</p>
            <template v-else>
              <!-- Its Speed, right under the pick, following the build below as it changes; a tap shows where it landed on
               the ladder. -->
              <button type="button" class="btn primary big-go" @click="toMine">
                <span class="big-go-speed">{{ mySpeed }}</span>
                <span>{{ t('speed.showYours') }}</span>
              </button>
              <!-- Narrower, the ladder is under this card, its opponents band out of view: a way to it, said as it's
               picked. -->
              <button v-if="!side" type="button" class="btn opponents-go" @click="toOpponents">
                <span class="opponents-tag">{{ t('speed.opponentsHead') }}</span>
                <span>{{ t('speed.opponentsGo') }}</span>
              </button>
              <!-- Its build and modifiers, then what they come to: each a section of its own, labeled above. -->
              <!-- The meta's builds of it, to pick one in a tap, as the comparison has them. -->
              <section v-if="myCommon.length" class="yours-section">
                <span class="muted small">{{ t('compare.common') }}</span>
                <ScrollRow :key="mine" wrap-on-phones class="builds">
                  <button
                    v-for="b in myCommon"
                    :key="`${b.effect}:${b.points}`"
                    type="button"
                    class="btn mod"
                    :class="{ on: myNature === b.effect && myPoints === b.points }"
                    @click="setMyBuild(b.effect, b.points)"
                  >
                    <component
                      :is="EFFECT_ICONS[b.effect]"
                      v-if="EFFECT_ICONS[b.effect]"
                      :size="14"
                      aria-hidden="true"
                    />{{ t('speed.points', { n: b.points }) }}
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
                      label: t(`speed.effect.${e}`),
                      icon: EFFECT_ICONS[e],
                      short: t('stat.spe'),
                    }))
                  "
                  @update:model-value="(v: string) => setMyNature(v as NatureEffect)"
                />
                <p class="muted small">{{ naturesOf(myNature) }}</p>
              </section>
              <section class="yours-section">
                <label class="yours-field">
                  <span class="muted small">{{ t('speed.pointsLabel') }}</span>
                  <span class="yours-points">
                    <input
                      type="range"
                      min="0"
                      :max="MAX_POINTS"
                      :value="myPoints"
                      @input="setMyPoints(($event.target as HTMLInputElement).value)"
                    />
                    <input
                      type="number"
                      class="points-box"
                      min="0"
                      :max="MAX_POINTS"
                      :value="myPoints"
                      @change="setMyPoints(($event.target as HTMLInputElement).value)"
                    />
                  </span>
                </label>
              </section>
              <section class="yours-section">
                <!-- The modifiers' disclosure, and Reset build at the row's end. -->
                <div class="mods-head">
                  <button
                    type="button"
                    class="btn disclosure"
                    :class="{ on: myModded }"
                    :aria-expanded="myModsOpen"
                    @click="toggleMyMods"
                  >
                    <Plus :size="16" aria-hidden="true" />{{ t('speed.modifiers')
                    }}<span class="marker" aria-hidden="true">{{ myModsOpen ? '▾' : '▸' }}</span>
                  </button>
                  <button v-if="myChanged" type="button" class="btn inverted" @click="resetMine">
                    <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetYours') }}
                  </button>
                </div>
                <div v-if="myModsOpen" class="mods">
                  <button
                    v-for="m in myModButtons"
                    :key="m.key"
                    v-tip="canHover && m.tip"
                    type="button"
                    class="btn mod"
                    :class="{ on: myToggles.has(m.key) }"
                    :aria-pressed="myToggles.has(m.key)"
                    @click="toggleMine(m.key)"
                  >
                    <ItemIcon v-if="m.item" :id="m.item" :scale="0.75" class="mod-item" /><component
                      :is="MOD_ICONS[m.key]"
                      v-else-if="MOD_ICONS[m.key]"
                      :size="16"
                      aria-hidden="true"
                    />{{ m.label }}
                  </button>
                  <StageStepper
                    :model-value="Number(myStage)"
                    :min="Number(STAGES[0])"
                    :max="Number(STAGES.at(-1))"
                    @update:model-value="(n: number) => setMyStage(String(n))"
                  />
                </div>
              </section>
              <section v-if="summary" class="yours-section">
                <p class="small">
                  {{
                    t('speed.summary', {
                      first: percent(summary.first),
                      ties: percent(summary.ties),
                      after: percent(summary.after),
                    })
                  }}
                  <span class="muted">{{ summaryNote }}</span>
                </p>
              </section>
            </template>
            <!-- Yours on the comparison's page, to add opponents to there: greyed out until there's yours, saying why in
                 a tooltip, or under it where there's no hovering. Not with a chip tapped: the comparison's card goes
                 there with both. -->
            <section v-if="!versus" class="yours-section yours-compare">
              <AppLink v-if="compareTarget" :to="compareTarget" class="btn primary compare-go"
                ><Columns2 :size="16" aria-hidden="true" />{{ t('compare.open')
                }}<ArrowRight :size="16" aria-hidden="true"
              /></AppLink>
              <template v-else>
                <span v-tip="canHover && t('speed.compareNeeds')" class="compare-off">
                  <button type="button" class="btn compare-go" disabled>
                    <Columns2 :size="16" aria-hidden="true" />{{ t('compare.open') }}
                  </button>
                </span>
                <p v-if="!canHover" class="muted small">{{ t('speed.compareNeeds') }}</p>
              </template>
            </section>
            <!-- Dropped from the bar, the card has no band: its actions at its foot instead,
               Confirm putting it away (Close, a plain button, with none picked). -->
            <div v-if="!side && !phone" class="drop-actions">
              <button v-if="mine" type="button" class="btn inverted" @click="clearMine">
                <Trash2 :size="16" aria-hidden="true" />{{ t('speed.clear') }}
              </button>
              <button type="button" class="btn" :class="{ primary: mine }" @click="yoursOpen = false">
                {{ t(mine ? 'speed.confirm' : 'speed.close') }}
              </button>
            </div>
          </details>
        </Teleport>
        <VersusCard v-if="versus && side" v-bind="versus.card" @close="clearVersus" @locate="locateVersus" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Yours' bar: stuck to the top of the page over what scrolls under it, on the page's own color; back to Competitive,
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
   phones, its icon alone), then how to read the page taking what's left, at its end (its words when they fit, else its
   icon alone; on phones, always its icon alone). */
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
@media (max-width: 720px) {
  .head-help :deep(span) {
    display: none;
  }
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
/* The toolbar's first line: the switches (buttons holding their checkbox) and the modifiers' disclosure, compact,
   wrapping where they don't fit, the reset at the line's end; the modifiers, opened, under it. Over the find. */
.find-row > :is(.options-line, .all-mods) {
  flex-basis: 100%;
  order: -1;
}
.options-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.options {
  display: flex;
  flex: 1 1 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}
/* Who's shown and the view: each its label, then its choice. */
.choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.options-line .btn {
  min-height: 0;
  padding: 3px 10px;
  font-size: 0.9em;
}
/* Its icon centered: no gap before the zero-width space that gives it a line's height. */
.options-line > .reset-options {
  flex: none;
  gap: 0;
  padding-inline: 8px;
}
/* The modifiers' disclosure while some are on, folded or not: marked as the switches on are. */
.disclosure.on {
  background: var(--sel);
}
.switch {
  justify-content: flex-start;
  gap: 6px;
  font-weight: bold;
}
.switch.on {
  background: var(--sel);
}
.switch input {
  margin: 0;
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
/* The modifiers that apply to everyone, under the options. */
.all-mods {
  padding: 8px;
  background: var(--panel-alt);
  border: 1px dashed var(--border-strong);
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
  /* On phones, one compact line: the labels read out but not shown. */
  :root:root .list.banded > .band.choices-band {
    gap: 6px 8px;
    padding-block: 6px;
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
  flex-basis: 100%;
  margin: 0;
}
/* The filters, on a line of their own under the find: each a choice, its pick's icon before it once picked. */
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
.filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* On phones, the choices share the lines, each as wide as its share. */
@media (max-width: 720px) {
  .filter {
    flex: 1 1 9em;
    min-width: 0;
  }
  .filter-pick {
    flex: 1;
    min-width: 0;
    max-width: none;
  }
}
/* As wide as what they hold: the search fields' width limit would cut them off. */
.filter-pick {
  width: auto;
  margin: 0;
}
.filter-pick {
  max-width: 14em;
}
.filter.on .filter-pick {
  border-color: var(--ink);
  background: var(--sel);
}
.filters-clear {
  gap: 4px;
  padding-block: 4px;
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
/* Only it beside the find, as tall as the row; under them the filters, opened, then what to do with the one found and
   the ones kept, and why the one found shows as it does. */
.find-modes {
  display: flex;
  align-self: stretch;
  order: 1;
}
.find-actions {
  position: relative;
  display: flex;
  flex-basis: 100%;
  flex-wrap: wrap;
  gap: 8px;
  order: 3;
}
.find-note {
  order: 4;
}
/* Only it, while there's none found: its room kept, nothing shown. */
.find-mode.unshown {
  visibility: hidden;
}
/* The keep and the ones kept, one pill: a single outline, a line between them. */
.keep-group {
  display: flex;
}
.keep-group > :not(:first-child) :deep(.btn),
.keep-group > .btn:not(:first-child) {
  margin-left: -2px;
}
:root:root .keep-group > .btn:not(:last-child) {
  box-shadow: none;
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
/* The found Pokémon's icon over the toggle's padding, so the toggle takes the height around it: the search's in its
   row, the switches' pinned. */
.find-mode :deep(.sheet-icon) {
  margin-block: -6px;
}
/* The search takes what the toggles leave, but never less than room for a name: what doesn't fit beside it then goes
   to the next line. */
.find.find-row > .picker {
  flex: 1 1 9em;
  min-width: 9em;
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
/* Its switches as tall as the search beside them. */
.pinned > .switch,
.pinned .find > .find-mode {
  align-self: stretch;
}
/* The find, how it shows beside it, the search taking what the switches leave, as in its row. */
.pinned .find {
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 8px;
  max-width: none;
}
.pinned .find > .picker {
  flex: 1 1 0;
  min-width: 0;
}
/* On phones, one line: the search takes what the compact switches leave. */
@media (max-width: 720px) {
  .pinned {
    gap: 6px;
  }
  .pinned .find {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
  }
  /* No room for how a find shows beside it, the switches too: the find's row has it. */
  .pinned .find-mode {
    display: none;
  }
  .pinned .switch {
    flex: none;
    padding-inline: 6px;
  }
  .pinned .long {
    display: none;
  }
  .pinned .short {
    display: inline;
  }
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
.to-match {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 10;
  translate: -50% 0;
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
/* The comparison's card, at the bottom of the screen where yours isn't beside the ladder. */
.versus-float {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 10;
  max-width: 32em;
  margin: 0 auto;
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
.band-clear {
  margin-block: -2px;
  margin-left: auto;
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
  align-items: center;
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
.yours p.yours-intro {
  margin-top: 10px;
}
.yours-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
}
.yours-points {
  display: flex;
  align-items: center;
  gap: 10px;
}
.yours-points input[type='range'] {
  flex: 1;
  min-width: 0;
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
/* Its modifiers smaller than the ones for everyone, as the panel is narrow. */
.yours .mod {
  padding: 3px 8px;
  font-size: 0.875em;
}
.points-box {
  width: 4em;
  font: inherit;
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
/* A row's tags, under its name, and the legend's. */
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
/* How to read the page, in a well under the data shown. */
.help-body {
  margin: 12px 0 0;
  padding: 8px 10px;
}
.help-body > :is(.legend, p) {
  margin-top: 0;
}
.help-body > .formula {
  margin-bottom: 8px;
}
.help-body .legend dd:last-child {
  margin-bottom: 0;
}
/* What the options do, first in the well. */
.help-intro {
  margin-bottom: 10px;
}
.help-options {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 8px 0 0;
}
.help-intro > .help-options {
  margin-top: 0;
}
.help-options dt {
  font-weight: bold;
}
.help-options dd {
  margin: 0;
}
/* Yours among them, under a rule, apart from how to read the chips. */
.help-yours {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
@media (max-width: 720px) {
  .wide-only {
    display: none;
  }
  /* Under the options. */
  .help-body > .legend {
    margin-top: 12px;
  }
  .help-body > p {
    margin-top: 1em;
  }
  .help-options {
    grid-template-columns: 1fr;
  }
  .help-options dd {
    margin-bottom: 4px;
  }
  /* Each legend sample's description under it rather than squeezed beside it. */
  .help-body .legend {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .help-body .legend dd {
    margin-bottom: 8px;
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
.note {
  margin: 12px 0 0;
}
/* Nothing below the top panel's last line but its padding. */
.help-body > :last-child {
  margin-bottom: 0;
}
/* The legend: sample chips, each with what its parts mean. */
.legend {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 4px 10px;
  margin: 12px 0 0;
}
.legend dt,
.legend dd {
  margin: 0;
}
.sample {
  padding: 1px 6px;
}
.note + .note {
  margin-top: 4px;
}
</style>
