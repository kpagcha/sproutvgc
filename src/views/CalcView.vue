<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createReusableTemplate, useElementSize, useEventListener, useMediaQuery, watchDebounced } from '@vueuse/core'
import {
  ArrowLeftRight,
  Calculator,
  Check,
  ClipboardCopy,
  ChevronDown,
  ClipboardPaste,
  Ellipsis,
  Eraser,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Users,
  X,
} from '@lucide/vue'
import { move, pokemon, type AbilityId, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import { itemBound, POKEMON } from '@/data/pokemon'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useMeta } from '@/composables/useMeta'
import { useTeams } from '@/composables/useTeams'
import {
  decodeField,
  decodeFighter,
  decodeHits,
  encodeField,
  encodeFighter,
  encodeHits,
  readLast,
  saveLast,
} from '@/lib/calcState'
import { goalDamage, type GoalBuild } from '@/lib/damageGoal'
import { NEUTRAL, reverseDamage, type HitSeen, type Observation, type OpponentUnknowns } from '@/lib/damageReverse'
import {
  abilityOf,
  atSets,
  battlerOf,
  canPool,
  commonSet,
  damaging,
  DOUBLING,
  emptyField,
  emptyFighter,
  hit,
  hitChoices,
  hpShown,
  leadOf,
  metaFoes,
  pooledView,
  priorityOf,
  speedOf,
  usesAttacked,
  usesFainted,
  SETS_FIELD,
  type Battlefield,
  type Fighter,
  type Hit,
} from '@/lib/damage'
import { membersPaste, parsePaste } from '@/lib/pokepaste'
import { copy } from '@/lib/clipboard'
import { toTopAt, underBand } from '@/lib/scroll'
import { commonForme, commonMember } from '@/lib/commonSet'
import { emptyMember, nextField, pickedAs, setsAs, stoneMega, type Field, type Member } from '@/lib/team'
import { conditionName, fieldOf, terrainOf, weatherOf } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import CalcConditionSearch from '@/components/CalcConditionSearch.vue'
import CalcMeta from '@/components/CalcMeta.vue'
import CalcReverse from '@/components/CalcReverse.vue'
import CalcHits, { type HitDraft } from '@/components/CalcHits.vue'
import CalcHitMove from '@/components/CalcHitMove.vue'
import FolderTabs from '@/components/FolderTabs.vue'
import CalcThreats from '@/components/CalcThreats.vue'
import CalcSide from '@/components/CalcSide.vue'
import CalcSummary from '@/components/CalcSummary.vue'
import CalcVerdict from '@/components/CalcVerdict.vue'
import CommonSetOffer from '@/components/CommonSetOffer.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import ModalDialog from '@/components/ModalDialog.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
import { confirmDialog } from '@/composables/useConfirm'
import { useStepBack } from '@/composables/useStepBack'
import PokemonIcon from '@/components/PokemonIcon'
import ScrollRow from '@/components/ScrollRow.vue'
import SectionNav from '@/components/SectionNav.vue'
import SetupStar from '@/components/SetupStar.vue'
import SideDrawer from '@/components/SideDrawer.vue'
import SolverBands from '@/components/SolverBands.vue'
import SolverChips from '@/components/SolverChips.vue'
import SolverGoal from '@/components/SolverGoal.vue'
import { goalDiff, goalOf, GOALS, type Goal } from '@/lib/solverGoal'
import { MAX_POINTS } from '@/lib/stats'
import { ORDER_MOVES } from '@/lib/threats'
import { MOVES } from '@/data/moves'
import { exampleFor, useTour, warmExample } from '@/composables/useTour'
import TourToggle from '@/components/TourToggle.vue'
import TeamPicker from '@/components/TeamPicker.vue'

// The damage calculator: two Pokémon, yours and the opponent's, each a team builder's slot (`CalcSide`, `TeamSlot`:
// every part a button opening its picker, `TeamPicker`, the meta's searches with their shares) with its moves' damage
// against the other under it, both ways at once, and what the battle adds to each (HP, status, stages); the battle's
// conditions (weather, terrain, what's on the field and on each side) in a dialog, those on the field named across the
// top; under the two, who moves first and how a one-on-one between them goes (`CalcVerdict`),
// with the ways to the speed pages. On phones, as the speed comparison's pair: two tabs side by side, each its side's
// color over its Pokémon in short (`CalcSummary`), stuck to the top, the one tapped opening its panel under them,
// folding when tapped again. The numbers are Smogon's calc's (`@smogon/calc`, its Champions mechanics, doubles), `damage.ts`. A Pokémon picked comes with its most common
// set in the meta shown (its Mega's, when most players run that), so there's a calc to read at once; a side's menu loads
// it from the reader's teams, from a paste, or back to its common set, copies it, or swaps the two. Under them, yours against the meta's most
// used (`CalcMeta`), a row tapped making it the opponent; before it, once both are picked, what the opponent could knock
// yours out with, every move it learns at its sets (`CalcThreats`). Everything is in the URL, a calc a link to share
// (`calcState.ts`), and the page opened bare comes back as last left; the first time, empty.
// Two tabs, one page each over the same Pokémon and field (the URL's, carried from one to the other): the damage, and
// the solver (`inverse`, `/tools/calc/solver`): the two as bands stuck to the top (`SolverBands`), the Pokémon picked
// on the page under them while one's missing, then the hits seen (`CalcHits`), then what fits them (`CalcReverse`,
// what it works out a choice over it, `SolverGoal`), the sides' panels under them for the rest of the battle.
const props = defineProps<{ inverse?: boolean; against?: boolean }>()
const route = useRoute()
const router = useRouter()
// Its address while it was a switch on the damage tab.
if (!props.inverse && !props.against && route.query.mode === 'reverse') {
  const query = { ...route.query }
  delete query.mode
  void router.replace({ name: 'calcInverse', query })
}
type Tab = 'damage' | 'inverse' | 'meta'
const tab = computed<Tab>(() => (props.inverse ? 'inverse' : props.against ? 'meta' : 'damage'))
const tabs = computed(() => [
  { value: 'damage' as const, label: t('calc.tab.damage') },
  { value: 'inverse' as const, label: t('calc.tab.inverse') },
  { value: 'meta' as const, label: t('calc.tab.meta') },
])
/** Each tab's route. */
const TAB_ROUTES = { damage: 'calc', inverse: 'calcInverse', meta: 'calcMeta' } as const
const routeName = computed(() => TAB_ROUTES[tab.value])
/** The other tab, carrying the setup as it is now: the URL is written once the edits pause, so a change made just before
 * (a build of What fits used) would be left behind. */
const toTab = (to: Tab, hash?: string) => {
  if (to !== tab.value) void router.push({ name: TAB_ROUTES[to], query: urlOf(query.value), hash })
}
const { snapshot, data } = useMeta()
const { teams } = useTeams()
const wide = useMediaQuery('(min-width: 900px)')
// Its sections, a row of links stuck to the top, the one being read marked: the field, the two sides' damage, and
// yours against the meta once there's yours; on the inverse tab, the field, the two, what was seen and what fits. On
// phones the sides' tabs stick under it (`--nav-h`, its height).
const sections = computed(() => [
  { id: 'calc-top', label: t('calc.section.field') },
  ...(props.inverse
    ? [
        ...(hasBoth.value
          ? [
              { id: 'calc-duel', label: t('calc.section.pokemon') },
              { id: 'calc-hits', label: t('calc.hits.title') },
              { id: 'calc-reverse', label: t('calc.reverse.title') },
            ]
          : []),
      ]
    : props.against
      ? [
          { id: 'calc-duel', label: t('calc.yours') },
          ...(battlerOf(sides.value.a) ? [{ id: 'calc-meta', label: t('calc.meta.title') }] : []),
        ]
      : damageSections.value),
])
const damageSections = computed(() => [
  { id: 'calc-duel', label: t('calc.section.damage') },
  ...(battlerOf(sides.value.a) && battlerOf(sides.value.b)
    ? [{ id: 'calc-threats', label: t('calc.threats.title') }]
    : []),
])
const nav = useTemplateRef<InstanceType<typeof SectionNav>>('nav')
// The field's bar, stuck under the row of links; on phones the sides' tabs stick under it (`--bar-h`, its height).
const bar = useTemplateRef<HTMLElement>('bar')
const { height: barH } = useElementSize(bar, undefined, { box: 'border-box' })
// Stuck: its top at the row of links' foot, checked as the page scrolls; toned down then (`stuck`).
const barStuck = shallowRef(false)
let barFrame = 0
function checkBar() {
  barFrame = 0
  const el = bar.value
  // At the row of links' foot, not past it: on phones it scrolls away with the sides once they're past.
  barStuck.value = !!el && window.scrollY > 0 && Math.abs(el.getBoundingClientRect().top - navH.value) <= 0.5
}
const onBarScroll = () => {
  if (!barFrame) barFrame = requestAnimationFrame(checkBar)
}
useEventListener(window, 'scroll', onBarScroll, { passive: true })
useEventListener(window, 'resize', onBarScroll)
const { height: navH } = useElementSize(() => nav.value?.$el as HTMLElement | undefined, undefined, {
  box: 'border-box',
})

type SideKey = 'a' | 'b'
const sides = shallowRef<Record<SideKey, Fighter>>({ a: emptyFighter(), b: emptyFighter() })
const field = shallowRef<Battlefield>(emptyField())

// Its setup: the URL's, else as last left; with neither, empty.
const fromUrl = route.query.a || route.query.b || route.query.f ? route.query : null
const start = fromUrl ?? readLast()
/** The threats at the opponent's team sheet (`?sheet=1`), kept with the rest. */
const sheet = shallowRef(start.sheet === '1')
/** The inverse tab's hits seen (`?h=`), those with no result yet kept for the visit alone. */
const hits = shallowRef<HitDraft[]>(
  decodeHits(start.h).map((h) => ('n' in h.saw && h.saw.bound ? { ...h, bound: true } : h)),
)
/** Which was seen moving first (`?first=a|b`). */
const first = shallowRef<'a' | 'b' | null>(start.first === 'a' || start.first === 'b' ? start.first : null)
/** The tour's example on the page (`solverExample`), kept out of the URL. */
const example = shallowRef<SolverExample | null>(null)
/** The damage tab's tour's example on the page (`damageExample`), kept out of the URL too. */
const damageEx = shallowRef<DamageExample | null>(null)
const inExample = computed(() => !!example.value || !!damageEx.value)
/** The hits seen with a move and a result: what's kept and worked out. */
const seen = computed(() => hits.value.filter((h): h is HitSeen => !!h.move && !!h.saw))
const observations = computed<Observation[]>(() => [
  ...(first.value ? [{ by: 'speed' as const, first: first.value }] : []),
  ...seen.value,
])
sides.value = {
  a: decodeFighter(start.a) ?? emptyFighter(),
  b: decodeFighter(start.b) ?? emptyFighter(),
}
field.value = decodeField(start.f)
/**
 * What of the opponent's set the inverse tab works out (`?work=`: `nat`, `item`, `pts`, comma-separated, or `none`).
 * Unsaid, as it was before it could be picked: at its team sheet (`?sheet=1`) its points alone; else its nature, its
 * points, and its item unless set.
 */
const work = shallowRef<OpponentUnknowns>(readWork(start.work))
function readWork(v: unknown): OpponentUnknowns {
  if (typeof v === 'string') {
    const parts = v.split(',')
    return { nature: parts.includes('nat'), item: parts.includes('item'), points: parts.includes('pts') }
  }
  return sheet.value
    ? { nature: false, item: false, points: true }
    : { nature: true, item: !sides.value.b.member.item, points: true }
}
const workQuery = (w: OpponentUnknowns) =>
  [w.nature && 'nat', w.item && 'item', w.points && 'pts'].filter(Boolean).join(',') || 'none'
/** What of yours the inverse tab works out (`?awork=`, as `?work=`): nothing unless said, yours being known; worked
 * out, what of it gets what the hits say. */
const NOTHING: OpponentUnknowns = { nature: false, item: false, points: false }
const workYours = shallowRef<OpponentUnknowns>(typeof start.awork === 'string' ? readWork(start.awork) : NOTHING)
const yoursWorked = computed(
  () => props.inverse && (workYours.value.nature || workYours.value.item || workYours.value.points),
)
/** What of a side's set its card leaves out on the inverse tab: what's worked out (its item not, one it can't be
 * without). */
const hiddenOf = (k: SideKey) => {
  if (!props.inverse) return []
  const m = sides.value[k].member
  const w = k === 'a' ? workYours.value : work.value
  const fixed = !!stoneMega(m) || (!!m.pokemon && itemBound(m.pokemon))
  return (['points', 'nature', 'item'] as const).filter((p) => w[p] && !(p === 'item' && fixed))
}
const hidden = computed(() => ({ a: hiddenOf('a'), b: hiddenOf('b') }))
// On phones, the two one under the other, each a band of its side's color with its panel under it, opened or folded
// apart, so both can be open at once: yours open at first.
const open = shallowRef<Record<SideKey, boolean>>({ a: true, b: false })
/** Whether a side's panel shows: on wide screens always; on phones while open, once it has a Pokémon (with none, its
 * band picks one). */
const shows = (k: SideKey) => wide.value || (open.value[k] && !!battlerOf(sides.value[k]))
/** The room the bands take where they stick: each one row, their shared lines overlapping. */
const BAND_H = 44
/** A side's top brought into view under the bands stuck over it (the second's under the first's too). */
function reveal(k: SideKey, behavior: ScrollBehavior = 'auto') {
  void nextTick(() => document.getElementById(`calc-${k}`)?.scrollIntoView({ behavior, block: 'start' }))
}
/**
 * A band tapped: with no Pokémon yet, its picker; else its panel brought into view, opened first if folded. In its place,
 * its panel open right under it, it folds it instead (as its arrow always does).
 */
function tapBand(k: SideKey) {
  if (!battlerOf(sides.value[k])) return void (picking.value = { side: k, field: 'pokemon' })
  if (open.value[k] && underBand(document.getElementById(`band-${k}`), document.getElementById(`calc-${k}`)))
    return foldBand(k)
  open.value = { ...open.value, [k]: true }
  reveal(k)
}
/** A band's arrow: its panel folded, or opened and brought into view. */
function foldBand(k: SideKey) {
  const on = !open.value[k]
  open.value = { ...open.value, [k]: on }
  if (on) reveal(k)
}
// Into the URL and remembered, once the edits pause (a slider dragged writes it once).
const query = computed(() => ({
  a: encodeFighter(sides.value.a) || undefined,
  b: encodeFighter(sides.value.b) || undefined,
  f: encodeField(field.value) || undefined,
  sheet: sheet.value ? '1' : undefined,
  // The inverse tab's alone; the damage tab keeping what was there.
  work: props.inverse ? workQuery(work.value) : typeof route.query.work === 'string' ? route.query.work : undefined,
  awork: props.inverse
    ? yoursWorked.value
      ? workQuery(workYours.value)
      : undefined
    : typeof route.query.awork === 'string'
      ? route.query.awork
      : undefined,
  h: encodeHits(seen.value) || undefined,
  first: first.value ?? undefined,
}))
/** The URL's query with the setup in it, the rest of it kept. */
function urlOf(q: typeof query.value) {
  const next = { ...route.query, ...q }
  for (const k of ['a', 'b', 'f', 'sheet', 'work', 'awork', 'h', 'first'] as const) if (!q[k]) delete next[k]
  return next
}
watchDebounced(
  query,
  (q) => {
    // The tour's example is the tour's, not the reader's.
    if (inExample.value) return
    saveLast(q)
    void router.replace({ query: urlOf(q) })
  },
  { debounce: 250, immediate: true },
)

// The pooled stats a side at every set battles with are the page's, from the meta shown (`fought`), never kept.
// Another Pokémon, its moves' options (crit, single target…) start over.
const setSide = (k: SideKey, f: Fighter) =>
  (sides.value = {
    ...sides.value,
    [k]: {
      ...f,
      pooled: undefined,
      ...(f.member.pokemon !== sides.value[k].member.pokemon &&
        f.hitOpts === sides.value[k].hitOpts && { hitOpts: undefined }),
    },
  })
// What was seen is of these two: another Pokémon on either side, or the two swapped, it goes.
watch(
  () => [sides.value.a.member.pokemon, sides.value.b.member.pokemon] as const,
  ([a, b], [wasA, wasB]) => {
    if (a === wasA && b === wasB) return
    hits.value = []
    first.value = null
  },
)
/** A build of What fits used: the opponent set to what was worked out of it (its points, its nature, and the item
 * likeliest to go with it), the damage tab shown with it. */
function useBuild(b: { nature: string | null; points: Member['points']; item?: ItemId | null }) {
  const f = sides.value.b
  const member = {
    ...f.member,
    ...(work.value.points && { points: [...b.points] as Member['points'] }),
    ...(work.value.nature && { nature: b.nature }),
    ...(b.item !== undefined && { item: b.item }),
  }
  setSide('b', { ...f, member, sets: false, mega: !!stoneMega(member) && f.mega })
  toTab('damage')
}
/** A build of yours from What fits used: yours set to what was worked out of it, the damage tab shown with it. */
function useYours(b: { nature: string | null; points: Member['points']; item: ItemId | null }) {
  const f = sides.value.a
  const w = workYours.value
  const member = {
    ...f.member,
    ...(w.points && { points: [...b.points] as Member['points'] }),
    ...(w.nature && { nature: b.nature }),
    ...(w.item && { item: b.item }),
  }
  setSide('a', { ...f, member, sets: false, mega: !!stoneMega(member) && f.mega })
  toTab('damage')
}
/** The sides as they battle: at every set, at their sets pooled in the meta shown; yours not, with something of it
 * worked out (what it is being the question). */
const fought = computed(() => ({
  a: atSets(yoursWorked.value ? { ...sides.value.a, sets: false } : sides.value.a, data.value),
  b: atSets(sides.value.b, data.value),
}))
const patchMember = (k: SideKey, patch: Partial<Member>) =>
  setSide(k, { ...sides.value[k], member: { ...sides.value[k].member, ...patch } })
function swap() {
  sides.value = { a: sides.value.b, b: sides.value.a }
  picking.value = null
  previous.value = []
}
function resetAll() {
  sides.value = { a: emptyFighter(), b: emptyFighter() }
  field.value = emptyField()
  picking.value = null
  previous.value = []
}

// The part being picked: its side and field, as in the team builder (a drawer on wide screens, a dialog on phones);
// right after a Pokémon's picked, the meta's entry whose most common set can be loaded instead of going on (`common`);
// its nature picked again from its stat points' step, the step to come back to once picked (`back`).
const picking = shallowRef<{ side: SideKey; field: Field; common?: PokemonId; back?: Field } | null>(null)
// Its steps, the way back through them; the opponent's moves step going back into the picker it went on from.
const { canBack: pickerCanBack, back: pickerBack } = useStepBack(picking, (p) => p.side)
const pickerOpen = computed({
  get: () => !!picking.value,
  set: (on) => {
    if (!on) picking.value = null
  },
})
const sideEls = shallowRef<Partial<Record<SideKey, InstanceType<typeof CalcSide> | null>>>({})
const setSideEl = (k: SideKey, el: unknown) => {
  sideEls.value[k] = el as InstanceType<typeof CalcSide> | null
}
const drawerAnchor = computed(() => (picking.value ? (sideEls.value[picking.value.side]?.card ?? null) : null))
const drawer = shallowRef<InstanceType<typeof SideDrawer> | null>(null)
const pickerBox = shallowRef<HTMLElement | null>(null)
watch(picking, async () => {
  await nextTick()
  ;(drawer.value?.el ?? pickerBox.value)?.scrollTo({ top: 0 })
})

/** A Pokémon picked: the rest of its set to be put together (its only ability given), the side's field effects kept. */
function choose(k: SideKey, id: PokemonId) {
  const { pokemon, item } = pickedAs(id)
  const abilities = POKEMON[pokemon].abilities
  const member = {
    ...emptyMember(),
    pokemon,
    item: item ?? null,
    ability: abilities.length === 1 ? abilities[0]! : null,
  }
  setSide(k, { ...emptyFighter(member), side: sides.value[k].side, sets: sides.value[k].sets })
}
/** The set being put together skipped: the most common set loaded, the picker closed. */
function loadCommon() {
  const p = picking.value
  if (!p?.common) return
  setSide(p.side, {
    ...commonSet(p.common, data.value),
    side: sides.value[p.side].side,
    sets: sides.value[p.side].sets,
  })
  picking.value = null
}
const [DefineCommon, ReuseCommon] = createReusableTemplate()
const [DefineBody, ReuseBody] = createReusableTemplate()
const [DefineDock, ReuseDock] = createReusableTemplate()
// The reader's teams, a side loading one of their Pokémon: in the side's Load menu and in its picker's.
const [DefineTeams, ReuseTeams] = createReusableTemplate<{ side: SideKey; done: () => void }>()
const commonPreview = computed(() => (picking.value?.common ? commonSet(picking.value.common, data.value) : null))

function pick(value: string) {
  const p = picking.value
  if (!p) return
  const m = sides.value[p.side].member
  let common: PokemonId | undefined
  if (p.field === 'pokemon' && props.inverse) {
    // The solver's: another Pokémon at its most common set, nothing more asked.
    if (value !== setsAs(m)) loadSolverSide(p.side, value as PokemonId)
    picking.value = null
    return
  }
  if (p.field === 'pokemon') {
    const id = value as PokemonId
    if (pickedAs(id).pokemon !== m.pokemon) {
      choose(p.side, id)
      common = commonForme(id, data.value)
    } else if (id !== setsAs(m)) {
      // Another forme of the one it has, the list having a Mega apart: its Mega, holding its stone and Mega Evolving,
      // or back from it, without it; the rest of its set kept, that forme's most common one offered.
      const member = { ...m, item: pickedAs(id).item ?? null }
      setSide(p.side, { ...sides.value[p.side], member, mega: !!stoneMega(member) })
      common = commonForme(id, data.value)
    }
  } else if (p.field === 'item') {
    // Its Mega Stone given, it Mega Evolves.
    const member = { ...m, item: (value || null) as ItemId | null }
    setSide(p.side, { ...sides.value[p.side], member, mega: !!stoneMega(member) })
  } else if (p.field === 'ability') patchMember(p.side, { ability: value as AbilityId })
  // A nature picked, it's at its own rather than at every set.
  else if (p.field === 'nature')
    setSide(p.side, { ...sides.value[p.side], member: { ...m, nature: value }, sets: false })
  else if (typeof p.field === 'number') {
    const moves = [...m.moves]
    // No move, the slot left empty; a move the set has elsewhere can't be picked again (the picker greys it out).
    const mv = (value || null) as MoveId | null
    if (mv && moves.includes(mv) && moves[p.field] !== mv) return
    moves[p.field] = mv
    patchMember(p.side, { moves })
  }
  // On the solver, what's set no longer worked out, and nothing after it asked for: one part, from its band.
  if (props.inverse) unwork(p.side, p.field)
  // From a band, that part alone (but a Pokémon, its set still to put together).
  const alone = props.inverse || (!!fromBands.value && p.field !== 'pokemon')
  const next = p.back ?? (alone ? null : nextField(sides.value[p.side].member, p.field))
  picking.value = next === null ? null : { side: p.side, field: next, ...(common && { common }) }
}

/** The parts of a set the inverse tab can work out, by the picker's step. */
const WORKABLE = { item: 'item', nature: 'nature', points: 'points' } as const
const workableOf = (f: Field | undefined) =>
  props.inverse && typeof f === 'string' && f in WORKABLE ? WORKABLE[f as keyof typeof WORKABLE] : null
/** On the inverse tab, a part's step left for it to be worked out: on in the side's Work out, and on to the next. */
function workOutStep() {
  const p = picking.value
  const part = workableOf(p?.field)
  if (!p || !part) return
  setWork(p.side, part, true)
  picking.value = p.back ? { side: p.side, field: p.back } : null
}
function setWork(k: SideKey, part: keyof OpponentUnknowns, on: boolean) {
  if (k === 'a') workYours.value = { ...workYours.value, [part]: on }
  else work.value = { ...work.value, [part]: on }
}
/** A part set on the solver: no longer worked out. */
function unwork(k: SideKey, f: Field | undefined) {
  const part = workableOf(f)
  if (part && (k === 'a' ? workYours : work).value[part]) setWork(k, part, false)
}

// Loading a side: its common set, one of the reader's teams' Pokémon, or a paste.
// A tooltip naming the set's actions' button only where there's hover (a tap opens the dialog).
const canHover = window.matchMedia('(hover: hover)').matches
// The side whose set's actions are open, in a dialog over the page.
const menuSide = shallowRef<SideKey | null>(null)
const menuOpen = computed({
  get: () => !!menuSide.value,
  set: (on) => {
    if (!on) menuSide.value = null
  },
})
/** Whether a side's set may be replaced: at once with no Pokémon there, else once confirmed (the actions' dialog closed
 * first, the confirmation over the page). */
async function mayReplace(k: SideKey, setOnly = false): Promise<boolean> {
  menuSide.value = null
  const id = sides.value[k].member.pokemon
  if (!id) return true
  return confirmDialog({
    message: t(setOnly ? 'calc.replaceSetConfirm' : 'calc.replaceConfirm', { name: refName(pokemon(id)) }),
    confirm: t('calc.replace'),
  })
}
async function common(k: SideKey) {
  const id = sides.value[k].member.pokemon
  if (!id || !(await mayReplace(k, true))) return
  // Holding its Mega Stone it's its Mega, whether it has Mega Evolved yet or not (left as it was): the Mega's set.
  const { mega, side, sets } = sides.value[k]
  const forme = setsAs(sides.value[k].member)!
  setSide(k, { ...commonSet(forme, data.value), side, sets, ...(forme !== id && { mega }) })
}
function clearSide(k: SideKey) {
  menuSide.value = null
  setSide(k, { ...emptyFighter(), side: sides.value[k].side, sets: sides.value[k].sets })
}
const savedTeams = computed(() => teams.value.filter((tm) => tm.members.some((m) => m.pokemon)))
function fromTeam(k: SideKey, m: Member) {
  setSide(k, { ...emptyFighter(JSON.parse(JSON.stringify(m)) as Member), side: sides.value[k].side })
}
/** One of the reader's teams' Pokémon loaded into a side, once confirmed where it replaces one. */
async function loadFromTeam(k: SideKey, m: Member, done: () => void) {
  done()
  if (!(await mayReplace(k))) return
  fromTeam(k, m)
}
// A side's set copied as a paste (Showdown's format, which pokepast.es takes), stat points and all, saying so a moment.
const copiedSide = shallowRef<SideKey | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copySet(k: SideKey) {
  if (!(await copy(membersPaste([sides.value[k].member])))) return
  copiedSide.value = k
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedSide.value = null), 1500)
}
const pasting = shallowRef<SideKey | null>(null)
const pasted = shallowRef('')
const pasteFailed = shallowRef(false)
const pasteOpen = computed({
  get: () => !!pasting.value,
  set: (on) => {
    if (!on) pasting.value = null
  },
})
// From the picker, the paste in its place, and the picker back as it was if the paste's let go without one.
let pasteFrom: typeof picking.value = null
function pasteInstead() {
  const p = picking.value
  if (!p) return
  pasteFrom = p
  picking.value = null
  pasting.value = p.side
}
watch(pasting, (k) => {
  pasted.value = ''
  pasteFailed.value = false
  if (!k && pasteFrom) picking.value = pasteFrom
  if (!k) pasteFrom = null
})
async function importPaste() {
  const k = pasting.value
  const first = parsePaste(pasted.value).members[0]
  if (!k || !first) return void (pasteFailed.value = true)
  pasteFrom = null
  pasting.value = null
  if (!(await mayReplace(k))) return
  fromTeam(k, first)
}

// The battle's conditions where they apply, folded at first and then as last left: the whole field's in the heading's
// panel (those on named beside them while folded), each side's in its "This side" box, the two sides' folding
// together so they stay level.
const readOpen = (key: string) => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const remembered = (key: string) => {
  const open = shallowRef(readOpen(key))
  watch(open, (on) => {
    try {
      localStorage.setItem(key, on ? '1' : '0')
    } catch {
      // Storage unavailable: folded again next time.
    }
  })
  return open
}
const fieldOpen = remembered('sproutvgc.calc.fieldOpen')
const sideOpen = remembered('sproutvgc.calc.sideOpen')
// Each side's moves folded or not, apart (the opponent's folded when only yours hitting it matters), as last left;
// one folded and the other not, the two sides' parts no longer on shared rows, so the folded one closes up.
const movesFolded = {
  a: remembered('sproutvgc.calc.movesFolded.a'),
  b: remembered('sproutvgc.calc.movesFolded.b'),
}
// What the battle adds to each, folded or not, apart, as last left; the two sides' parts on shared rows only while
// both are folded alike, as their moves.
const battleFolded = {
  a: remembered('sproutvgc.calc.battleFolded.a'),
  b: remembered('sproutvgc.calc.battleFolded.b'),
}
// Unfolded while stuck to the top, it stays stuck, its conditions in rows (`compact`), until folded; unfolded where
// it is on the page, it scrolls away with it, its conditions in groups.
const fieldCompact = shallowRef(false)
/** The conditions' search open: its box drops out of the bar, which then doesn't clip it. */
const searchOpen = shallowRef(false)
function toggleField() {
  fieldCompact.value = !fieldOpen.value && barStuck.value
  fieldOpen.value = !fieldOpen.value
}
const fieldOn = computed(() =>
  [
    field.value.weather ? weatherOf(field.value.weather) : undefined,
    field.value.terrain ? terrainOf(field.value.terrain) : undefined,
    ...field.value.effects.map(fieldOf),
  ].filter((c) => !!c),
)
// A Pokémon coming in with an ability that sets the weather or terrain sets it, as it would in battle (not a setup
// opened from a link, whose field is as it was left, nor the two swapping places).
watch(
  () => [abilityOf(sides.value.a), abilityOf(sides.value.b)] as const,
  (now, before) => {
    now.forEach((a) => {
      const sets = a && !before.includes(a) ? SETS_FIELD[a] : undefined
      if (sets) field.value = { ...field.value, ...sets }
    })
  },
)

const spreadsOf = (f: Fighter) => {
  const id = setsAs(f.member)
  return (id && data.value?.[id]?.spreads) || []
}
/** The calc's sides aren't a team: nothing clashes. */
const otherMembers: Member[] = []
const pickerMember = computed(() => (picking.value ? sides.value[picking.value.side].member : null))
/** The side being picked for's stat points' step: the Pokémon its stats are of, its spreads, every set. */
const pickerPoints = computed(() => {
  const k = picking.value?.side
  if (!k) return null
  const f = sides.value[k]
  return {
    battler: battlerOf(f),
    spreads: spreadsOf(f),
    canPool: canPool(f, data.value),
    atSets: !!f.sets && !!fought.value[k].pooled,
    pooled: pooledView(f, data.value),
  }
})
/** Its stat points or nature set from their step: at its own rather than at every set. */
function pointsChange(patch: Partial<Member>) {
  const k = picking.value?.side
  if (!k) return
  setSide(k, { ...sides.value[k], member: { ...sides.value[k].member, ...patch }, sets: false })
  if (props.inverse) unwork(k, 'points')
}
function pointsSets(on: boolean) {
  const k = picking.value?.side
  if (!k) return
  setSide(k, { ...sides.value[k], sets: on })
  if (props.inverse) unwork(k, 'points')
}
const natureAgain = () =>
  picking.value && (picking.value = { side: picking.value.side, field: 'nature', back: 'points' })
const labels = computed(() => ({ a: t('calc.yours'), b: t('calc.theirs') }))
const hasAny = computed(() => !!(battlerOf(sides.value.a) || battlerOf(sides.value.b)))
const hasBoth = computed(() => !!(battlerOf(sides.value.a) && battlerOf(sides.value.b)))

// The solver: the sides' panels as on the damage tab, one with no Pokémon picking it in the picker's Pokémon step alone
// (the drawer, on phones a dialog), the other's next while it has none; each one picked at its most common set
// (`commonSet`), what's worked out of it left for the hits. Both in, the sides' panels, then the hits and what fits them under them, the page taken down to the
// hits; the two as bands again, stuck to the top on every screen once the panels are past, each part of a set on its
// band opening its picker step (`bandPart`), the drawer from the side the band leaves clear.
/** A Pokémon picked on the solver: its most common set but its moves, which the hits fill in as they're picked. */
function loadSolverSide(k: SideKey, id: PokemonId) {
  const f = commonSet(id, data.value)
  const member = { ...f.member, moves: f.member.moves.map(() => null) as Member['moves'] }
  setSide(k, { ...f, member, side: sides.value[k].side, sets: sides.value[k].sets })
}
/** Both in: the page taken down to the hits, the next thing to say. */
watch(hasBoth, (now, before) => {
  // Not for the tour's example: the tour places each step itself.
  if (props.inverse && now && !before && !inExample.value) void nextTick(() => scrollToSolver('calc-hits'))
})
/** One of the solver's parts brought under what's stuck to the top (the row of links, the field's bar on wide screens,
 * the bands). */
function scrollToSolver(id: string) {
  const bar = wide.value && !(fieldOpen.value && !fieldCompact.value) ? barH.value : 0
  // Measured now, not by their sizes as last reported: both in, the row of links gains the solver's links and, on
  // phones, the bands come in, neither's new size reported yet.
  const navNow = (nav.value?.$el as HTMLElement | undefined)?.offsetHeight ?? navH.value
  const bands = bandsEl.value?.offsetHeight ?? bandsH.value
  toTopAt(document.getElementById(id), navNow + bar + bands + 12)
}
/** Whether a side's item can't be another: a Mega's stone, Ogerpon's mask. */
const itemFixed = (k: SideKey) => {
  const m = sides.value[k].member
  return !!stoneMega(m) || (!!m.pokemon && itemBound(m.pokemon))
}
/** What's worked out of each side as the goal reads it. */
const goalWork = () => ({ a: workYours.value, b: work.value, fixed: { a: itemFixed('a'), b: itemFixed('b') } })
/** The goal picked, what it is at first: it stays as parts are set or worked out from the bands and panels, which
 * moving on to what fits then asks to tidy up (`tidyGoal`). */
const goal = shallowRef<Goal>(goalOf(goalWork()))
/** Moving on to what fits with what's worked out not the goal's: what differs said, then either the goal's put back
 * (Tidy up) or the goal taken to be what's worked out (Continue as is). */
async function tidyGoal() {
  const g = goal.value
  if (g === 'custom') return
  const diff = goalDiff(g, goalWork())
  if (!diff.length) return
  const tidy = await confirmDialog({
    message: t('calc.goal.tidy', { goal: t(`calc.goal.${g}`) }),
    details: diff.map((d) =>
      t(d.worked ? 'calc.goal.diffWorked' : 'calc.goal.diffSet', {
        part: t(`calc.goal.part.${d.side}.${d.part}`),
      }),
    ),
    confirm: t('calc.goal.tidyUp'),
    cancel: t('calc.goal.asIs'),
  })
  if (tidy) {
    workYours.value = { ...GOALS[g].a }
    work.value = { ...GOALS[g].b }
    fillKnown()
  } else goal.value = goalOf(goalWork())
}
/** The hits said: on to what to work out, brought into view and lit a moment. */
const goalLit = shallowRef(false)
let goalTimer: ReturnType<typeof setTimeout> | undefined
async function toGoal() {
  await tidyGoal()
  scrollToSolver('calc-goal')
  goalLit.value = false
  void nextTick(() => {
    goalLit.value = true
    clearTimeout(goalTimer)
    goalTimer = setTimeout(() => (goalLit.value = false), 1600)
  })
}
/** A hit added: the Hits panel brought to the top, its new row under it. */
const toHits = () => nextTick(() => scrollToSolver('calc-hits'))
/** Custom picked: the parts that can be set or worked out, on the bands and the panels, lit a moment. */
const partsLit = shallowRef(false)
let partsTimer: ReturnType<typeof setTimeout> | undefined
function litParts() {
  partsLit.value = false
  void nextTick(() => {
    partsLit.value = true
    clearTimeout(partsTimer)
    partsTimer = setTimeout(() => (partsLit.value = false), 1400)
  })
}
/** What's left to set of each side, once the goal changes: what's missing of it filled in from its most common set,
 * never a Mega Stone (a Pokémon picked as itself stays itself), nothing worked out. */
function fillKnown() {
  for (const k of ['a', 'b'] as const) {
    const f = sides.value[k]
    const m = f.member
    const id = setsAs(m)
    if (!id || !data.value?.[id]) continue
    const c = commonMember(id, data.value)
    const w = k === 'a' ? workYours.value : work.value
    const member = { ...m }
    let built = false
    if (!member.ability && c.ability) member.ability = c.ability
    if (!member.item && !w.item && c.item && !stoneMega({ ...member, item: c.item })) member.item = c.item
    if (!member.nature && !w.nature && c.nature) {
      member.nature = c.nature
      built = true
    }
    if (!w.points && !f.sets && member.points.every((n) => !n) && c.points.some(Boolean)) {
      member.points = [...c.points] as typeof member.points
      built = true
    }
    if (member.ability !== m.ability || member.item !== m.item || built)
      setSide(k, { ...f, member, ...(built && { sets: false }) })
  }
}

const bandsEl = useTemplateRef<HTMLElement>('bandsEl')
const { height: bandsH } = useElementSize(bandsEl, undefined, { box: 'border-box' })
// The two as bands stuck to the top, sliding in once the sides' panels' own bands are scrolled past, on either tab
// (`SolverBands`, the damage tab's with nothing worked out); on phones, where the panels' bands stick of their own, the
// solver's alone, once the panels are past.
const bandsDock = useTemplateRef<HTMLElement>('bandsDock')
const duelPast = shallowRef(false)
const NOTHING_WORKED = { a: NOTHING, b: NOTHING }
function checkDock() {
  const dock = bandsDock.value
  if (!dock) return void (duelPast.value = false)
  const line = parseFloat(getComputedStyle(dock).top) + 0.5
  if (!wide.value) return void (duelPast.value = dock.getBoundingClientRect().top <= line)
  const head = document.querySelector('#calc-duel .side-head')
  duelPast.value = !!head && head.getBoundingClientRect().bottom <= line
}
useEventListener(window, 'scroll', checkDock, { passive: true })
useEventListener(window, 'resize', checkDock)
watch([hasAny, hasBoth, wide], () => nextTick(checkDock))
/** The band a part was picked from, which the drawer leaves clear. */
const fromBands = shallowRef<SideKey | null>(null)
watch(picking, (p) => !p && (fromBands.value = null))

// The solver's tour, walked through on an example (`useTour`'s `example`), the page set up step by step as the reader
// would: the two picked, a hit added and said, which moved first, what to work out, and what fits; then what yours needs
// for an outcome wanted, and Custom. From the meta shown: two of the most used at their most common sets, one of yours'
// moves seen hitting the opponent (its middle roll at the opponent's most common set, so that set fits), and one of its
// moves that could knock yours out or not, to survive. Nothing of it goes into the URL nor what's remembered of the page
// (`inExample`); the reader's setup put back once the tour ends.
interface SolverExample {
  a: Fighter
  b: Fighter
  /** Yours' hit seen on the opponent. */
  seen: HitSeen
  first: 'a' | 'b' | null
  /** Its hit seen on yours, a second hit: the HP it took off. */
  seen2: HitSeen | null
  /** The second example, Your spread: two of its own, and the opponent's hit yours wants to survive. */
  need: { a: Fighter; b: Fighter; wanted: HitSeen } | null
}
/** A move whose damage is plain to read off one hit: fixed power and hits, nothing hanging on what came before, and
 * no priority (a hit entered after another then reads as it would happen: Fake Out can't come second). */
const plainMove = (mv: MoveId | null): mv is MoveId =>
  damaging(mv) &&
  MOVES[mv].power > 0 &&
  MOVES[mv].priority === 0 &&
  !hitChoices(mv) &&
  !(mv in DOUBLING) &&
  !ORDER_MOVES.has(mv) &&
  !usesFainted(mv) &&
  !usesAttacked(mv)
/** A plain, single-target hit of one on the other, with no priority in the battle either (Prankster, Gale Wings). */
const plainHit = (att: Fighter, def: Fighter, mv: MoveId | null) => {
  if (!plainMove(mv) || priorityOf(att, mv, emptyField()) !== 0) return null
  const h = hit(att, def, mv, emptyField())
  return h && !h.none && !h.spread && h.rolls.length ? h : null
}
const middle = (rolls: readonly number[]) => rolls[Math.floor(rolls.length / 2)]!
/** Its moves without the moves: the solver's sides, a hit's move picked where the hit is. */
const noMoves = (f: Fighter): Fighter => ({
  ...f,
  member: { ...f.member, moves: f.member.moves.map(() => null) as Member['moves'] },
})
/** Yours' bulk on the side a move hits: its HP points and its defense's (with a nature raising it) all in, or none
 * (a neutral nature). */
function bulkOf(f: Fighter, mv: MoveId, hp: boolean, def: boolean): Fighter {
  const special = MOVES[mv].category === 'special'
  const points = [...f.member.points] as Member['points']
  points[0] = hp ? MAX_POINTS : 0
  points[special ? 4 : 2] = def ? MAX_POINTS : 0
  return { ...f, member: { ...f.member, points, nature: def ? (special ? 'calm' : 'bold') : NEUTRAL } }
}
/** A solver's run of the page's own, drained at once (the tour's example checked against what the page will show). */
function drain<T>(job: { steps: Generator<unknown, T> }): T {
  for (;;) {
    const r = job.steps.next()
    if (r.done) return r.value
  }
}
const idle = () => new Promise((r) => setTimeout(r, 0))
/** How long the example is looked for, before the best one found so far is taken. */
const EXAMPLE_BUDGET = 1500
/** The solver's own answer, worked out at once, for the tour's example to be checked against what the page will show. */
const entryOf = (f: Fighter) => data.value?.[setsAs(f.member) ?? battlerOf(f)!] ?? undefined
/** The opponent's build from what was seen, as the page works it out at its default goal. */
const buildAnswer = (a: Fighter, b: Fighter, obs: Observation[]) =>
  drain(reverseDamage({ yours: a, theirs: b, field: emptyField(), entry: entryOf(b), work: { ...GOALS.build.b }, obs }))
/** What yours needs for a hit of the opponent's to be survived, as the page works it out with Your spread. */
const needAnswer = (a: Fighter, b: Fighter, wanted: HitSeen) =>
  drain(
    goalDamage({
      yours: a,
      theirs: b,
      field: emptyField(),
      entryYours: entryOf(a),
      entryTheirs: entryOf(b),
      workYours: { ...GOALS.need.a },
      workTheirs: { ...GOALS.need.b },
      obs: [wanted],
    }),
  )
/** Its ability sets the weather or terrain as it comes in (`SETS_FIELD`), which the page then has: left out of the
 * examples, kept to a plain field. */
const setsField = (f: Fighter) => {
  const ab = abilityOf(f)
  return !!ab && !!SETS_FIELD[ab]
}
/** The two as the solver has them: their most common sets but their moves, the opponent's item left to work out. */
function solverPair(you: Fighter, them: Fighter) {
  const bm = them.member
  const fixed = !!stoneMega(bm) || (!!bm.pokemon && itemBound(bm.pokemon))
  return { a: noMoves(you), b: noMoves({ ...them, member: { ...bm, item: fixed ? bm.item : null } }) }
}
/**
 * The tour's first example, Opponent build, from the meta shown: two of the most used, at their most common sets. Yours'
 * hit on the opponent (its middle roll at the opponent's most common set, so that set fits) leaving a good part of its
 * HP, its hit on yours leaving yours standing, neither a priority move; yours moving first, so the two hits read in
 * order. Checked against the page's own answer, so its table is worth reading: the opponent's items changing what fits
 * (columns of their own), its rows not all alike, and what was seen not a fluke. The first such, else the best found
 * within a while.
 */
async function buildExample(until: number) {
  const foes = metaFoes(data.value, 15)
  const none = emptyField()
  let best: { ex: Omit<SolverExample, 'need'>; score: number } | null = null
  for (const them of foes) {
    for (const you of foes) {
      if (you.id === them.id || setsField(you.set) || setsField(them.set)) continue
      if (performance.now() > until) return best?.ex ?? null
      const sa = speedOf(you.set, none)
      const sb = speedOf(them.set, none)
      const lead = sa !== null && sb !== null ? leadOf(sa, sb, none) : 'tie'
      let seen: HitSeen | null = null
      for (const mv of you.set.member.moves) {
        const h = plainHit(you.set, them.set, mv)
        const lost = h ? 100 - hpShown(((h.maxHp - middle(h.rolls)) / h.maxHp) * 100) : 0
        if (h && lost >= 30 && lost <= 75) {
          seen = { by: 'a', move: h.move, saw: { kind: 'pct', n: lost } }
          break
        }
      }
      let seen2: HitSeen | null = null
      for (const mv of them.set.member.moves) {
        const h = plainHit(them.set, you.set, mv)
        if (h && middle(h.rolls) < h.hp * 0.8) {
          seen2 = { by: 'b', move: h.move, saw: { kind: 'hp', n: middle(h.rolls) } }
          break
        }
      }
      if (!seen || !seen2) continue
      const { a, b } = solverPair(you.set, them.set)
      const first = lead === 'tie' ? null : lead
      await idle()
      const r = buildAnswer(a, b, [...(first ? [{ by: 'speed' as const, first }] : []), seen, seen2])
      if (!r?.possible) continue
      const pattern = (row: (typeof r.rows)[number]) => row.fits.map((f) => (f > 0 ? 1 : 0)).join('')
      const itemsApart = r.itemsVary && r.columns.length >= 2
      const rowsUnalike = new Set(r.rows.map(pattern)).size >= 2
      let score = 0
      if (itemsApart) score += 3
      if (rowsUnalike) score += 2
      if ((r.chance ?? 0) >= 0.05) score += 2
      if (lead === 'a') score += 1
      const ex = { a, b, seen, seen2, first }
      if (!best || score > best.score) best = { ex, score }
      // Good enough to stop at: the opponent's items apart and its rows unalike, what the table is there to show.
      if (itemsApart && rowsUnalike) return ex
    }
  }
  return best?.ex ?? null
}
/**
 * The tour's second example, Your spread: two of the most used, yours wanting to survive a hit of the opponent's that
 * it always survives with all its bulk on that side and never with none (no Focus Sash nor Sturdy, which would make it
 * sure whatever its points). Checked against the page's own answer, so its strips go from unlikely to sure.
 */
async function needExample(until: number) {
  const foes = metaFoes(data.value, 25)
  let fallback: SolverExample['need'] = null
  for (const them of foes) {
    for (const you of foes) {
      if (you.id === them.id || setsField(you.set) || setsField(them.set)) continue
      if (performance.now() > until) return fallback
      if (you.set.member.item === 'focussash' || abilityOf(you.set) === 'sturdy') continue
      for (const mv of them.set.member.moves) {
        if (!plainMove(mv) || priorityOf(them.set, mv, emptyField()) !== 0) continue
        // At its most common set's numbers: surely knocked out with no bulk, likely with all its HP or all its defense
        // alone, and never with both; so both strips climb.
        const at = (hp: boolean, def: boolean) => plainHit(them.set, bulkOf(you.set, mv, hp, def), mv)
        const [frail, hpOnly, defOnly, bulky] = [at(false, false), at(true, false), at(false, true), at(true, true)]
        if (!frail || !hpOnly || !defOnly || !bulky) continue
        const ko = (h: Hit) => h.rolls.filter((r) => r >= h.hp).length / h.rolls.length
        if (ko(frail) < 1 || ko(hpOnly) < 0.5 || ko(defOnly) < 0.5 || ko(bulky) > 0) continue
        const { a, b } = solverPair(you.set, them.set)
        const wanted: HitSeen = { by: 'b', move: mv, saw: { kind: 'lived' } }
        await idle()
        const g = needAnswer(a, b, wanted)
        // Strips going from unlikely to sure: all of them, else, kept in case none does, one.
        const rises = (c: GoalBuild[]) =>
          Math.min(...c.map((x) => x.coverage)) < 0.35 && Math.max(...c.map((x) => x.coverage)) >= 0.9
        const curves = g?.rows.flatMap((row) => row.curves ?? []) ?? []
        if (g?.theirs?.possible === false || !curves.some(rises)) break
        if (curves.every(rises)) return { a, b, wanted }
        fallback ??= { a, b, wanted }
        break
      }
    }
  }
  return fallback
}
async function solverExample(): Promise<SolverExample | null> {
  const ex = await buildExample(performance.now() + EXAMPLE_BUDGET)
  if (!ex) return null
  return { ...ex, need: await needExample(performance.now() + EXAMPLE_BUDGET) }
}
let kept: {
  sides: Record<SideKey, Fighter>
  field: Battlefield
  hits: HitDraft[]
  first: 'a' | 'b' | null
  work: OpponentUnknowns
  workYours: OpponentUnknowns
  goal: Goal
  open: Record<SideKey, boolean>
  folded: { moves: Record<SideKey, boolean>; battle: Record<SideKey, boolean> }
} | null = null
/** What a tour's example takes the place of, kept to put back once it ends. */
function keepPage() {
  kept ??= {
    sides: sides.value,
    field: field.value,
    hits: hits.value,
    first: first.value,
    work: work.value,
    workYours: workYours.value,
    goal: goal.value,
    open: open.value,
    folded: {
      moves: { a: movesFolded.a.value, b: movesFolded.b.value },
      battle: { a: battleFolded.a.value, b: battleFolded.b.value },
    },
  }
}
async function enterExample() {
  const ex = data.value ? await exampleFor(data.value, solverExample) : null
  if (!ex) return false
  keepPage()
  example.value = ex
  return true
}
/** One of the tour's steps on the page: the two (or none yet), the hits and the order, and what's worked out. */
async function stageExample(o: {
  sides: boolean
  hits?: HitDraft[]
  first?: 'a' | 'b' | null
  goal?: 'build' | 'need'
}) {
  const ex = example.value
  if (!ex) return
  const g = o.goal ?? 'build'
  // The second example, Your spread, on two of its own.
  const pair = g === 'need' && ex.need ? ex.need : ex
  sides.value = o.sides ? { a: pair.a, b: pair.b } : { a: emptyFighter(), b: emptyFighter() }
  field.value = emptyField()
  work.value = { ...GOALS[g].b }
  workYours.value = { ...GOALS[g].a }
  goal.value = g
  // On phones the two folded to their bands, which the steps point at; on wide screens their cards are always shown.
  open.value = { a: wide.value, b: wide.value }
  // Other Pokémon clear what was seen of the two before (its watch, before the next render): the example's after.
  await nextTick()
  hits.value = o.hits ?? []
  first.value = o.first ?? null
}
async function leaveExample() {
  const k = kept
  if (!k) return
  kept = null
  sides.value = k.sides
  field.value = k.field
  work.value = k.work
  workYours.value = k.workYours
  goal.value = k.goal
  open.value = k.open
  for (const s of ['a', 'b'] as const) {
    movesFolded[s].value = k.folded.moves[s]
    battleFolded[s].value = k.folded.battle[s]
  }
  await nextTick()
  hits.value = k.hits
  first.value = k.first
  example.value = null
  damageEx.value = null
  window.scrollTo({ top: 0 })
}
const nameOf = (f: Fighter | undefined) => {
  const id = f && battlerOf(f)
  return id ? refName(pokemon(id)) : ''
}
const exName = (k: SideKey) => nameOf(example.value?.[k])
// Its first visit's, unless it came with hits of its own to read.
const cameWithHits = hits.value.length > 0
const cameWithCalc = !!fromUrl?.a && !!fromUrl.b
// Picked ahead, once the page is in and the browser idle, so the tour starts at once.
if (props.inverse) watch(data, (d) => d && warmExample(d, solverExample), { immediate: true })
const { start: startTour } = props.inverse
  ? useTour(
      'calcSolver',
      () => {
        const ex = example.value
        const seen = ex?.seen
        const wanted = ex?.need?.wanted
        const params = {
          a: exName('a'),
          b: exName('b'),
          move: seen ? refName(move(seen.move)) : '',
          pct: seen?.saw.kind === 'pct' ? seen.saw.n : 0,
          first: ex?.first ? exName(ex.first) : '',
          theirMove: wanted ? refName(move(wanted.move)) : '',
          a2: nameOf(ex?.need?.a),
          b2: nameOf(ex?.need?.b),
          move2: ex?.seen2 ? refName(move(ex.seen2.move)) : '',
          hp2: ex?.seen2?.saw.kind === 'hp' ? ex.seen2.saw.n : 0,
        }
        const seen2 = ex?.seen2
        const blank = { ...seen!, saw: null } as HitDraft
        const both = seen2 ? [seen!, seen2] : [seen!]
        return [
          { title: 'tour.solver.introTitle', text: 'tour.solver.intro', stage: () => stageExample({ sides: false }) },
          { el: '#calc-duel', title: 'tour.solver.pickTitle', text: 'tour.solver.pick', side: 'top' },
          {
            el: '#calc-duel',
            title: 'tour.solver.sidesTitle',
            text: wide.value ? 'tour.solver.sides' : 'tour.solver.sidesPhone',
            params,
            side: 'top',
            stage: () => stageExample({ sides: true }),
          },
          { el: '#calc-hits .adds', title: 'tour.solver.addTitle', text: 'tour.solver.add', side: 'bottom' },
          {
            el: '#calc-hits .hit',
            title: 'tour.solver.hitTitle',
            text: 'tour.solver.hit',
            params,
            side: 'bottom',
            stage: () => stageExample({ sides: true, hits: [blank] }),
          },
          {
            el: '#calc-hits .saw',
            title: 'tour.solver.sawTitle',
            text: 'tour.solver.saw',
            params,
            side: 'bottom',
            stage: () => stageExample({ sides: true, hits: [seen!] }),
          },
          ...(seen2
            ? [
                {
                  el: '#calc-hits .hit-list',
                  title: 'tour.solver.moreTitle' as const,
                  text: 'tour.solver.more' as const,
                  params,
                  side: 'bottom' as const,
                  stage: () => stageExample({ sides: true, hits: both }),
                },
              ]
            : []),
          ...(ex?.first
            ? [
                {
                  el: '#calc-hits .first',
                  title: 'tour.solver.firstTitle' as const,
                  text: 'tour.solver.first' as const,
                  params,
                  side: 'bottom' as const,
                  stage: () => stageExample({ sides: true, hits: both, first: ex.first }),
                },
              ]
            : []),
          { el: '#calc-goal', title: 'tour.solver.goalTitle', text: 'tour.solver.goal', side: 'top' },
          {
            el: ['#calc-reverse .answer.theirs', '#calc-reverse'],
            title: 'tour.solver.theirsTitle',
            text: 'tour.solver.theirs',
            side: 'top',
          },
          ...(wanted
            ? [
                {
                  el: '#calc-goal',
                  title: 'tour.solver.needGoalTitle' as const,
                  text: 'tour.solver.needGoal' as const,
                  side: 'top' as const,
                  stage: () => stageExample({ sides: true, hits: [wanted], goal: 'need' }),
                },
                {
                  el: '#calc-hits .hit',
                  title: 'tour.solver.wantTitle' as const,
                  text: 'tour.solver.want' as const,
                  params,
                  side: 'bottom' as const,
                },
                {
                  el: ['#calc-reverse .answer.yours', '#calc-reverse'],
                  title: 'tour.solver.yoursTitle' as const,
                  text: 'tour.solver.yours' as const,
                  side: 'top' as const,
                },
              ]
            : []),
          {
            el: '#calc-goal .card:last-child',
            title: 'tour.solver.customTitle',
            text: 'tour.solver.custom',
            side: 'top',
          },
          { el: '.head-tour', title: 'tour.againTitle', text: 'tour.again', side: 'bottom' },
        ]
      },
      () => !!data.value && !cameWithHits,
      { enter: enterExample, leave: () => void leaveExample() },
    )
  : props.against
    ? { start: () => {} }
    : useTour(
        'calc',
        () => {
          const ex = damageEx.value
          const params = {
            a: nameOf(ex?.a),
            b: nameOf(ex?.b),
            move: ex ? refName(move(ex.move)) : '',
            range: ex ? `${Math.round(ex.hit.minPct)}–${Math.round(ex.hit.maxPct)}%` : '',
          }
          return [
            { title: 'tour.calc.introTitle', text: 'tour.calc.intro', stage: () => stageDamage(false) },
            { el: '#calc-duel', title: 'tour.calc.pickTitle', text: 'tour.calc.pick', side: 'top' },
            {
              el: '#calc-a .body',
              title: 'tour.calc.sidesTitle',
              text: wide.value ? 'tour.calc.sides' : 'tour.calc.sidesPhone',
              params,
              side: wide.value ? 'right' : 'bottom',
              stage: () => stageDamage(true),
            },
            { el: '#calc-a .damages', title: 'tour.calc.movesTitle', text: 'tour.calc.moves', params, side: 'top' },
            { el: '#calc-a .battle', title: 'tour.calc.battleTitle', text: 'tour.calc.battle', side: 'top' },
            { el: '.field-bar', title: 'tour.calc.fieldTitle', text: 'tour.calc.field', side: 'bottom' },
            { el: '.verdict.panel', title: 'tour.calc.verdictTitle', text: 'tour.calc.verdict', params, side: 'top' },
            { el: '#calc-threats', title: 'tour.calc.threatsTitle', text: 'tour.calc.threats', params, side: 'top' },
            { el: '.calc-tabs', title: 'tour.calc.tabsTitle', text: 'tour.calc.tabs', side: 'bottom' },
            { el: '.head-tour', title: 'tour.againTitle', text: 'tour.again', side: 'bottom' },
          ]
        },
        // Its first visit's, unless it came with a calc of its own to read.
        () => !!data.value && !cameWithCalc,
        { enter: enterDamageExample, leave: () => void leaveExample() },
      )
// The damage tab's tour, walked through on an example as the solver's is: two of the most used at their most common
// sets, yours with a plain move that takes a good part of the opponent's HP (two hits, ideally), so its row reads at a
// glance. Nothing of it in the URL nor what's remembered (`inExample`); the reader's setup put back once the tour ends.
interface DamageExample {
  a: Fighter
  b: Fighter
  move: MoveId
  hit: Hit
}
async function damageExample(): Promise<DamageExample | null> {
  const foes = metaFoes(data.value, 12)
  let best: DamageExample | null = null
  for (const them of foes) {
    for (const you of foes) {
      if (you.id === them.id || setsField(you.set) || setsField(them.set)) continue
      // The opponent hitting back, so its moves' rows and the threats have something to show.
      if (!them.set.member.moves.some((mv) => plainHit(them.set, you.set, mv))) continue
      for (const mv of you.set.member.moves) {
        const h = plainHit(you.set, them.set, mv)
        if (!h || h.maxPct < 25 || h.minPct >= 100) continue
        const ex = { a: you.set, b: them.set, move: h.move, hit: h }
        if (h.koHits === 2) return ex
        best ??= ex
      }
    }
  }
  return best
}
async function enterDamageExample() {
  const ex = data.value ? await exampleFor(data.value, damageExample) : null
  if (!ex) return false
  keepPage()
  damageEx.value = ex
  return true
}
/** One of the damage tab's tour's steps on the page: the two (or none yet), their moves and In battle unfolded. */
async function stageDamage(withSides: boolean) {
  const ex = damageEx.value
  if (!ex) return
  sides.value = withSides ? { a: ex.a, b: ex.b } : { a: emptyFighter(), b: emptyFighter() }
  field.value = emptyField()
  // On phones yours open under its band, the opponent's folded to its own.
  open.value = { a: true, b: wide.value }
  for (const s of ['a', 'b'] as const) {
    movesFolded[s].value = false
    battleFolded[s].value = false
  }
  await nextTick()
}
// Picked ahead, once the page is in and the browser idle, so the tour starts at once.
if (!props.inverse && !props.against) watch(data, (d) => d && warmExample(d, damageExample), { immediate: true })
const bandAnchor = computed(() =>
  fromBands.value ? (bandsEl.value?.querySelector<HTMLElement>(`.band-${fromBands.value}`) ?? null) : null,
)
function bandPart(k: SideKey, f: Field) {
  hitMove.value = null
  // On phones, its Pokémon tapped brings its panel into view instead (opening it first if folded).
  if (!wide.value && f === 'pokemon' && battlerOf(sides.value[k])) return tapBand(k)
  fromBands.value = k
  picking.value = { side: k, field: f }
}

/** A hit's move being picked, from its row on the page: the drawer anchored on its move field (on phones a dialog). */
const hitMove = shallowRef<number | null>(null)
const hitRow = shallowRef<HTMLElement | null>(null)
function pickHitMove(i: number) {
  hitRow.value = document.querySelectorAll<HTMLElement>('#calc-hits .hit-list > li > .move')[i] ?? null
  picking.value = null
  hitMove.value = i
}
function hitMovePicked(mv: MoveId) {
  const i = hitMove.value
  if (i === null) return
  const by = hits.value[i]!.by
  hits.value = hits.value.map((h, j) => (j === i ? { ...h, move: mv } : h))
  hitMove.value = null
  // Into the attacker's set, in its first empty slot, while it has one.
  const moves = [...sides.value[by].member.moves]
  const free = moves.indexOf(null)
  if (!moves.includes(mv) && free >= 0) {
    moves[free] = mv
    patchMember(by, { moves })
  }
}
const hitMoveOpen = computed({
  get: () => !wide.value && hitMove.value !== null && !!hits.value[hitMove.value],
  set: (on) => {
    if (!on) hitMove.value = null
  },
})
const drawerOpen = computed(() => wide.value && (!!picking.value || (hitMove.value !== null && hasBoth.value)))
const closeDrawer = () => ((picking.value = null), (hitMove.value = null))

/** A meta row tapped: the opponent, the page scrolled back to it. */
// The opponents a row of the meta's list took the place of, the latest last (up to `PREVIOUS_MAX`): the way back to
// each in turn, a button before the opponent's Load. Swapping or resetting the sides forgets them.
const previous = shallowRef<Fighter[]>([])
const PREVIOUS_MAX = 20
const previousId = computed(() => {
  const f = previous.value.at(-1)
  return f ? battlerOf(f) : null
})
function back() {
  const f = previous.value.at(-1)
  if (!f) return
  previous.value = previous.value.slice(0, -1)
  setSide('b', { ...f, side: sides.value.b.side })
}
function face(f: Fighter) {
  if (battlerOf(sides.value.b)) previous.value = [...previous.value, sides.value.b].slice(-PREVIOUS_MAX)
  setSide('b', { ...f, side: sides.value.b.side, sets: sides.value.b.sets })
  open.value = { ...open.value, b: true }
  // From the Meta tab, on to the damage tab, at the two.
  if (props.against) toTab('damage', '#calc-duel')
  else reveal('b', 'smooth')
}
</script>

<template>
  <div
    class="calc"
    :class="{ 'parts-lit': partsLit }"
    :style="{
      '--nav-h': `${navH}px`,
      '--bar-h': `${fieldOpen && !fieldCompact ? 0 : barH}px`,
      '--band-h': `${BAND_H}px`,
      '--bands-h': `${inverse || wide ? bandsH : 0}px`,
    }"
  >
    <!-- Reset all, on the row of the way back to Tools, as on the speed pages (the app's frame has a place for it there). -->
    <Teleport :to="`#back-actions-${routeName}`" defer>
      <button v-if="hasAny" type="button" class="btn inverted" @click="resetAll">
        <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetAll') }}
      </button>
    </Teleport>
    <!-- Its reusable parts, defined before anything reuses them. -->
    <!-- The two in short, stuck to the top, sliding in once past: on wide screens the sides' panels' bands, on phones
         the panels. -->
    <DefineDock>
      <div ref="bandsDock" class="bands-dock" :class="{ shown: duelPast }">
        <div ref="bandsEl" class="dock-bands">
          <SolverBands
            :a="fought.a"
            :b="fought.b"
            :work="inverse ? { a: workYours, b: work } : NOTHING_WORKED"
            :fixed="{ a: itemFixed('a'), b: itemFixed('b') }"
            :inert="!duelPast"
            :compact="!wide"
            @part="bandPart"
          />
        </div>
      </div>
    </DefineDock>

    <DefineTeams v-slot="{ side, done }">
      <div v-for="tm in savedTeams" :key="tm.id" class="load-team">
        <span class="load-team-name">{{ tm.name || t('builder.untitled') }}</span>
        <span class="load-team-mons">
          <template v-for="(m, i) in tm.members" :key="i">
            <button
              v-if="m.pokemon"
              v-tip="refName(pokemon(m.pokemon))"
              type="button"
              class="load-mon"
              :aria-label="refName(pokemon(m.pokemon))"
              @click="loadFromTeam(side, m, done)"
            >
              <PokemonIcon :id="m.pokemon" />
            </button>
          </template>
        </span>
      </div>
    </DefineTeams>

    <SectionNav ref="nav" :sections />
    <section id="calc-top" class="head-panel">
      <div class="head">
        <h1>{{ t('title.calc') }}<SetupStar /></h1>
        <TourToggle v-if="!against" class="head-tour" @start="startTour" />
        <MetaDialog v-if="snapshot" class="head-meta" />
      </div>
    </section>
    <!-- Its two tabs, folder tabs on a rule across the page, the one shown joined to it. -->
    <div class="calc-tabs">
      <FolderTabs :model-value="tab" :label="t('calc.tabs')" :options="tabs" @update:model-value="toTab" />
    </div>
    <!-- The field's bar and the sides, together: on phones what sticks of them (the bar, the sides' bands) scrolls away
         with them once they're past; on wide screens the bar sticks the whole page down. -->
    <div class="stick-scope">
      <!-- The field's conditions, a bar on the page (no panel) stuck under the row of links as the page scrolls, so
         they're at hand beside the sides; unfolded, scrolling away with the page, what's unfolded in a soft box. -->
      <div
        ref="bar"
        class="field-bar"
        :class="{
          stuck: barStuck && (!fieldOpen || fieldCompact),
          open: fieldOpen && !fieldCompact,
          compact: fieldOpen && fieldCompact,
          searching: searchOpen,
        }"
      >
        <!-- One row: the toggle, and those on named while folded, sliding sideways where they don't fit. -->
        <button
          type="button"
          class="btn field-toggle"
          :class="{ on: fieldOpen }"
          :aria-expanded="fieldOpen"
          aria-controls="calc-field"
          @click="toggleField"
        >
          <SlidersHorizontal :size="16" aria-hidden="true" />{{ t('calc.conditions')
          }}<span class="on-count" :class="{ none: !fieldOn.length }">{{ fieldOn.length }}</span
          ><ChevronDown :size="14" class="fold-chev" :class="{ open: fieldOpen }" aria-hidden="true" />
        </button>
        <ScrollRow v-if="!fieldOpen && fieldOn.length" class="toolbar">
          <span v-for="c in fieldOn" :key="c!.key" class="field-on">
            <component :is="c!.icon" v-if="c!.icon" :size="14" aria-hidden="true" />{{ conditionName(c!) }}
          </span>
        </ScrollRow>
        <div v-if="fieldOpen" id="calc-field" class="field-conditions">
          <!-- Unfolded, a row of its own over the conditions: any found by name, the field's or a side's (a drop-down,
               on phones a dialog), and its Clear at the row's end. -->
          <div class="field-tools">
            <CalcConditionSearch v-model:open="searchOpen" :field :sides @field="field = $event" @side="setSide" />
            <button
              type="button"
              class="btn quiet small field-clear"
              :disabled="!fieldOn.length"
              @click="field = { ...field, weather: '', terrain: '', effects: [] }"
            >
              <Eraser :size="14" aria-hidden="true" />{{ t('calc.clearConditions') }}
            </button>
          </div>
          <CalcConditions :field :data no-clear :rows="fieldCompact" @field="field = $event" />
        </div>
      </div>

      <!-- On wide screens, the two in short stuck over the sides' panels once their bands are past, and on down. -->
      <ReuseDock v-if="wide && hasAny && !against" />
      <div
        id="calc-duel"
        class="duel"
        :class="{
          aligned:
            !against &&
            hasBoth &&
            movesFolded.a.value === movesFolded.b.value &&
            battleFolded.a.value === battleFolded.b.value,
          stacked: !wide,
          against,
        }"
      >
        <!-- On phones, as the speed comparison's list past a pair: each side a band of its color, its Pokémon in short,
           stuck to the top under the field's bar, the second piling up under the first, and to the bottom; tapping it
           brings its panel into view under it, opening it (one with none picks it), or, in its place with its panel open
           under it, folds it; its arrow opens and folds it. -->
        <template v-for="k in against ? (['a'] as const) : (['a', 'b'] as const)" :key="k">
          <div
            v-if="!wide"
            :id="`band-${k}`"
            class="side-band"
            :class="[`band-${k}`, { open: open[k] && !!battlerOf(sides[k]), theirs: k === 'b' }]"
          >
            <!-- The solver's: its icon and its set as chips, each opening its picker step. -->
            <SolverChips
              v-if="inverse && battlerOf(sides[k])"
              :fighter="fought[k]"
              :work="k === 'a' ? workYours : work"
              :fixed="itemFixed(k)"
              compact
              class="band-chips"
              @part="bandPart(k, $event)"
            />
            <button v-else type="button" class="band-main" :aria-controls="`calc-${k}`" @click="tapBand(k)">
              <span class="sr-only">{{ labels[k] }}</span>
              <CalcSummary
                v-if="battlerOf(sides[k])"
                :fighter="fought[k]"
                :other="fought[k === 'a' ? 'b' : 'a']"
                :field
                :theirs="k === 'b'"
                named
                :no-verdict="inverse"
                class="band-summary"
              />
              <span v-else class="band-empty"
                ><Plus :size="16" aria-hidden="true" />{{
                  t(k === 'a' ? 'compare.pickYours' : 'compare.pickOpponent')
                }}</span
              ></button
            ><button
              v-if="battlerOf(sides[k])"
              type="button"
              class="band-fold"
              :aria-expanded="open[k]"
              :aria-controls="`calc-${k}`"
              :aria-label="t(open[k] ? 'band.fold' : 'band.unfold')"
              @click="foldBand(k)"
            >
              <ChevronDown :size="16" class="band-chevron" aria-hidden="true" />
            </button>
          </div>
          <CalcSide
            :id="`calc-${k}`"
            :ref="(el) => setSideEl(k, el)"
            :fighter="fought[k]"
            :other="fought[k === 'a' ? 'b' : 'a']"
            :field
            :theirs="k === 'b'"
            :label="labels[k]"
            :active="picking?.side === k ? picking.field : null"
            v-show="shows(k)"
            :class="`side-${k}`"
            @update:fighter="setSide(k, $event)"
            @field="picking = { side: k, field: $event }"
            @clear="setSide(k, { ...emptyFighter(), side: sides[k].side, sets: sides[k].sets })"
            :data
            :side-open="sideOpen"
            :moves-folded="movesFolded[k].value"
            :battle-folded="battleFolded[k].value"
            :inverse
            :alone="against"
            :hide="hidden[k]"
            :work="inverse ? (k === 'b' ? work : workYours) : undefined"
            @work="k === 'b' ? (work = $event) : (workYours = $event)"
            @battle-folded="battleFolded[k].value = $event"
            @side-open="sideOpen = $event"
            @battlefield="field = $event"
            @moves-folded="movesFolded[k].value = $event"
          >
            <template #actions>
              <button
                v-if="k === 'b' && previousId"
                v-tip="t('calc.back', { name: refName(pokemon(previousId)) })"
                type="button"
                class="btn small back-to"
                :class="wide ? 'on-band' : 'quiet'"
                :aria-label="t('calc.back', { name: refName(pokemon(previousId)) })"
                @click="back"
              >
                <Undo2 :size="14" aria-hidden="true" /><PokemonIcon :id="previousId" :scale="0.75" />
              </button>
              <!-- What a side can do with its set, in a dialog over the page: load one (its common set, a paste, a
                 Pokémon of the reader's teams), copy it, swap the two sides, clear it. -->
              <button
                v-tip="canHover ? t('calc.setMenu') : undefined"
                type="button"
                :class="wide ? ['btn', 'on-band', { on: menuSide === k }] : ['set-menu', { open: menuSide === k }]"
                aria-haspopup="dialog"
                :aria-expanded="menuSide === k"
                :aria-label="t('calc.setMenu')"
                @click="menuSide = k"
              >
                <Ellipsis :size="16" aria-hidden="true" />
              </button>
            </template>
          </CalcSide>
        </template>
        <!-- The Meta tab: yours against the most used, beside yours (under it on phones). -->
        <CalcMeta v-if="against" id="calc-meta" :yours="fought.a" :field :data @pick="face" />
      </div>
    </div>

    <template v-if="inverse && hasBoth">
      <!-- On phones, the two in short, stuck to the top once the sides' panels are past. -->
      <ReuseDock v-if="!wide" />
      <!-- Both in: the hits seen, then what fits them. -->
      <div class="solver">
        <CalcHits
          id="calc-hits"
          v-model:hits="hits"
          v-model:first="first"
          :yours="fought.a"
          :theirs="fought.b"
          :goal="yoursWorked"
          @pick-move="pickHitMove"
          @next="toGoal"
          @added="toHits"
        />
        <section id="calc-reverse" class="panel results" :class="{ idle: !observations.length }">
          <CalcReverse
            :yours="fought.a"
            :theirs="fought.b"
            :field
            :data
            :obs="observations"
            :work
            :work-yours="yoursWorked ? workYours : null"
            @use="useBuild"
            @use-yours="useYours"
          >
            <div id="calc-goal" class="goal-step" :class="{ lit: goalLit }">
              <SolverGoal
                v-model:goal="goal"
                v-model:work="work"
                v-model:work-yours="workYours"
                @changed="fillKnown"
                @custom="litParts"
              />
            </div>
          </CalcReverse>
        </section>
      </div>
    </template>
    <template v-if="!inverse && !against">
      <CalcVerdict :a="fought.a" :b="fought.b" :field />

      <!-- What the opponent could knock yours out with: every move it learns, at its sets. -->
      <CalcThreats
        v-if="battlerOf(sides.a) && battlerOf(sides.b)"
        id="calc-threats"
        :yours="fought.a"
        :theirs="fought.b"
        :field
        :data
        v-model:sheet="sheet"
      />
    </template>

    <!-- Right after a Pokémon's picked, its most common set, to load rather than put the set together; picking the
    Pokémon, the side's Load's other ways side by side over the list: a paste, and one of the reader's teams' Pokémon
    from a drop-down, when they have a team. -->
    <DefineCommon>
      <!-- On the inverse tab, its item, nature or stat points left to be worked out rather than picked: first, over the
           most common set's offer when there's one too. -->
      <div v-if="workableOf(picking?.field)" class="quick work-step">
        <button type="button" class="work-offer" @click="workOutStep">
          <Calculator :size="18" aria-hidden="true" />
          <span class="work-text">
            <span class="work-title">{{ t('calc.workOutStep') }}</span>
            <span class="muted">{{ t('calc.workOutStepAbout') }}</span>
          </span>
        </button>
        <p v-if="!commonPreview" class="or muted">{{ t('calc.orPick') }}</p>
      </div>
      <CommonSetOffer v-if="commonPreview" :id="picking!.common!" :set="commonPreview.member" @load="loadCommon" />
      <div v-else-if="picking?.field === 'pokemon'" class="quick">
        <div class="quick-load">
          <button type="button" class="btn quiet small" @click="pasteInstead">
            <ClipboardPaste :size="14" aria-hidden="true" />{{ t('calc.paste') }}
          </button>
          <OptionsMenu
            v-if="savedTeams.length"
            :title="t('calc.fromTeams')"
            :label="t('calc.fromTeams')"
            :icon="Users"
            align="left"
          >
            <template #default="{ close }">
              <div class="load">
                <ReuseTeams :side="picking.side" :done="() => (close(), (picking = null))" />
              </div>
            </template>
          </OptionsMenu>
        </div>
        <p class="or muted">{{ t('calc.orPick') }}</p>
      </div>
    </DefineCommon>

    <!-- What the drawer holds: the picker, or a hit's move. -->
    <DefineBody>
      <TeamPicker
        v-if="picking && pickerMember"
        :member="pickerMember"
        :others="otherMembers"
        :side="picking.side === 'a' ? 'yours' : 'opponent'"
        :field="picking.field"
        :data
        :snapshot
        v-bind="pickerPoints"
        :can-back="pickerCanBack"
        @pick="pick"
        @back="pickerBack"
        @close="picking = null"
        @change="pointsChange"
        @sets="pointsSets"
        @nature="natureAgain"
        ><ReuseCommon
      /></TeamPicker>
      <CalcHitMove
        v-else-if="hitMove !== null && hits[hitMove]"
        :attacker="sides[hits[hitMove]!.by].member"
        :defender="battlerOf(sides[hits[hitMove]!.by === 'a' ? 'b' : 'a'])!"
        :data
        :current="hits[hitMove]!.move"
        @pick="hitMovePicked"
        @back="hitMove = null"
        @close="hitMove = null"
      />
    </DefineBody>
    <!-- On wide screens, a drawer over the page, from the side what it's for leaves clear. -->
    <SideDrawer
      ref="drawer"
      :open="drawerOpen"
      :anchor="picking ? (bandAnchor ?? drawerAnchor) : hitRow"
      :label="picking ? t('builder.picker') : t('calc.hits.move')"
      defer
      @close="closeDrawer"
    >
      <ReuseBody />
    </SideDrawer>

    <!-- On phones, a hit's move over the page. -->
    <ModalDialog v-if="!wide && inverse" v-model:open="hitMoveOpen" :label="t('calc.hits.move')" fill>
      <div v-if="hitMoveOpen" class="panel picker-dialog"><ReuseBody /></div>
    </ModalDialog>

    <!-- On phones, the picker over the page. -->
    <ModalDialog v-if="!wide" v-model:open="pickerOpen" :label="t('builder.picker')" fill>
      <div v-if="picking && pickerMember" ref="pickerBox" class="panel picker-dialog">
        <TeamPicker
          :member="pickerMember"
          :others="otherMembers"
          :side="picking.side === 'a' ? 'yours' : 'opponent'"
          :field="picking.field"
          :data
          :snapshot
          v-bind="pickerPoints"
          :can-back="pickerCanBack"
          @pick="pick"
          @back="pickerBack"
          @close="picking = null"
          @change="pointsChange"
          @sets="pointsSets"
          @nature="natureAgain"
          ><ReuseCommon
        /></TeamPicker>
      </div>
    </ModalDialog>

    <!-- A side's set's actions, a dialog over the page; loading over a Pokémon there confirmed first. -->
    <ModalDialog v-model:open="menuOpen" :label="t('calc.setMenu')">
      <div v-if="menuSide" class="panel set-dialog">
        <!-- Whose it is, and its close at the end, as the picker's heading. -->
        <div class="set-dialog-head">
          <h2>{{ labels[menuSide] }}</h2>
          <button type="button" class="set-dialog-close" :aria-label="t('picker.close')" @click="menuSide = null">
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <div class="load">
          <button
            type="button"
            class="load-row"
            :disabled="!sides[menuSide].member.pokemon || !data"
            @click="common(menuSide)"
          >
            <Sparkles :size="14" aria-hidden="true" />{{ t('calc.commonSet') }}
          </button>
          <button type="button" class="load-row" @click="((pasting = menuSide), (menuSide = null))">
            <ClipboardPaste :size="14" aria-hidden="true" />{{ t('calc.paste') }}
          </button>
          <button
            type="button"
            class="load-row"
            :class="{ copied: copiedSide === menuSide }"
            :disabled="!sides[menuSide].member.pokemon"
            @click="copySet(menuSide)"
          >
            <component :is="copiedSide === menuSide ? Check : ClipboardCopy" :size="14" aria-hidden="true" />{{
              copiedSide === menuSide ? t('tournaments.pasteCopied') : t('calc.copySet')
            }}
          </button>
          <button type="button" class="load-row" :disabled="!hasAny" @click="(swap(), (menuSide = null))">
            <ArrowLeftRight :size="14" aria-hidden="true" />{{ t('calc.swap') }}
          </button>
          <button
            type="button"
            class="load-row danger"
            :disabled="!sides[menuSide].member.pokemon"
            @click="clearSide(menuSide)"
          >
            <X :size="14" aria-hidden="true" />{{ t('calc.clearSide') }}
          </button>
        </div>
        <!-- The reader's teams under them, scrolling in the card when they don't fit, the rest staying put. -->
        <template v-if="savedTeams.length">
          <span class="muted load-label">{{ t('calc.fromTeams') }}</span>
          <div class="load load-teams">
            <ReuseTeams :side="menuSide" :done="() => {}" />
          </div>
        </template>
      </div>
    </ModalDialog>

    <ModalDialog v-model:open="pasteOpen" :label="t('calc.paste')">
      <div class="panel import">
        <h2>{{ t('calc.paste') }}</h2>
        <p class="muted">{{ t('calc.pasteHint') }}</p>
        <textarea v-model="pasted" rows="10" spellcheck="false" :aria-label="t('calc.paste')"></textarea>
        <p v-if="pasteFailed" class="problem">{{ t('calc.pasteFailed') }}</p>
        <div class="actions">
          <button type="button" class="btn" @click="pasting = null">{{ t('builder.cancel') }}</button>
          <button type="button" class="btn primary" :disabled="!pasted.trim()" @click="importPaste">
            {{ t('builder.importGo') }}
          </button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.calc {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* The sides, who moves first and yours against the meta set apart, a touch less on phones, where the page is short
   of room. */
.calc > .verdict {
  margin-top: 16px;
}
/* The field's bar and the sides: their own column on phones, so what sticks of them sticks within it; on wide screens
   no box of its own, the bar sticking within the whole page. */
.stick-scope {
  display: contents;
}
@media (max-width: 899px) {
  .stick-scope {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}
@media (max-width: 899px) {
  .calc > .verdict {
    margin-top: 8px;
  }
}
/* The row of links' own gap under it is the page's. */
/* Over what sticks under it (the field's bar, the sides' bands on phones), which, scrolling away past the sides,
   passes under it rather than over it. */
.calc > .section-nav {
  z-index: 50;
  margin-bottom: -4px;
}
/* Room above a section scrolled to for the row of links stuck to the top. */
#calc-top {
  scroll-margin-top: calc(var(--nav-h, 0px) + 8px);
}
#calc-duel {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + 8px);
}
/* Past the sides, clear of the bands stuck over them too. */
#calc-threats,
#calc-meta {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + var(--bands-h, 0px) + 8px);
}
/* The solver's parts, clear of its bands stuck over them too. */
#calc-hits,
#calc-reverse,
#calc-goal {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + var(--bands-h, 0px) + 8px);
}
/* The heading on the page, no panel: a title's line needs no box. */
.head-panel {
  margin: 0;
  padding-top: 4px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
/* The tabs on a rule across the page, the one shown the page's color, joined to it. */
.calc-tabs {
  --tab-bg: var(--bg);
  margin-bottom: -4px;
  border-bottom: 2px solid var(--ink);
}
/* A row, so its star sits centered on the title's line. */
.head h1 {
  display: flex;
  align-items: center;
  margin: 0;
}
.head-meta {
  margin-left: auto;
}
/* The field's bar: folded, stuck under the row of links, over the sides as they scroll under it. */
.field-bar {
  position: sticky;
  top: var(--nav-h, 0px);
  z-index: 41;
  display: flex;
  align-items: center;
  gap: 8px 12px;
  max-height: calc(100dvh - var(--nav-h, 0px) - 12px);
  margin: -8px -6px 0;
  /* Less under it than over it: the row in it already keeps 4px under its buttons for their shadows. */
  padding: 8px 6px 4px;
  overflow-y: auto;
  background: var(--bg);
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
}
.field-bar > .toolbar {
  flex: 0 1 auto;
  min-width: 0;
}
/* The toggle, with the room under it for its shadow that the sliding row kept while it was in it. */
.field-toggle {
  flex: none;
  margin-bottom: 4px;
}
/* The conditions' search: its box drops out of the bar, which doesn't clip it while it's open. */
.field-bar.searching {
  overflow: visible;
}
/* Unfolded, on the page as the rest is, scrolling away with it: stuck, taller than the room it'd leave, it took the
   scrolling and the page under it couldn't be scrolled. */
.field-bar.open {
  position: relative;
  top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  max-height: none;
  overflow: visible;
}
.field-bar.compact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.field-bar.open > .toolbar,
.field-bar.compact > .toolbar {
  flex: 0 1 auto;
  min-width: 0;
}
/* Over the unfolded conditions, the search and, at the row's end, the Clear. */
.field-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.field-bar.compact .field-tools {
  margin-bottom: 8px;
}
.field-clear {
  flex: none;
  margin-left: auto;
}
/* What's unfolded, in a soft box of its own under the toggle (no panel's ink nor shadow): the toggle stays on the
   page. */
.field-bar.compact > .field-conditions {
  flex-basis: 100%;
  min-width: 0;
  margin-top: 0;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.field-bar.open > .field-conditions {
  flex-basis: 100%;
  margin-top: 4px;
  padding: 12px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
/* Stuck, a rule under it setting it apart from the sides scrolling under it. */
.field-bar.stuck {
  border-bottom-color: var(--border-strong);
}
@media (prefers-reduced-motion: reduce) {
  .field-bar {
    transition: none;
  }
}
.toolbar {
  --gap: 10px;
}
/* Names alone in it, no buttons: no room kept for shadows. */
.toolbar :deep(.track) {
  padding: 0;
}
.toolbar .btn {
  flex: none;
}
.btn.switch.on {
  background: var(--sel);
}
/* The conditions on, named while folded. */
.field-on {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  font-size: 0.9em;
  font-weight: bold;
  white-space: nowrap;
}
.fold-chev {
  transition: transform 0.15s;
}
.fold-chev.open {
  transform: rotate(180deg);
}
.field-conditions {
  margin-top: 16px;
}
/* The two sides beside each other, once both have a Pokémon each one's five parts (heading, set, moves, battle, its
   side) on rows the two share, so each part starts level with the other's whatever they hold (before, each as short as
   what it has); one under the other on phones. */
.duel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
/* Scrolled to (a row of the meta's list making it the opponent), clear of the row of links stuck to the top. */
.duel > :deep(section) {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + 12px);
}
@media (min-width: 900px) {
  .duel {
    align-items: start;
  }
  .duel.aligned {
    align-items: stretch;
  }
  .duel.aligned > :deep(section) {
    display: grid;
    grid-row: span 4;
    grid-template-rows: subgrid;
    row-gap: 28px;
    align-content: start;
  }
}
/* The Meta tab: yours, and beside it its matchups, the wider. */
@media (min-width: 900px) {
  .duel.against {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr);
  }
}
@media (max-width: 899px) {
  .duel {
    grid-template-columns: minmax(0, 1fr);
  }
  .duel.against > #calc-meta {
    margin-top: 16px;
  }
}
/* On phones, each side's band, as the speed comparison's list's: one row of its side's color, its Pokémon in short and
   its arrow, stuck under the field's bar, the second piling up under the first (their shared lines overlapping), over
   the panels scrolling under them; and stuck to the bottom of the screen too, the first over the second, while their
   place is still under it. Its panel right under it, their lines shared too. */
.side-band {
  position: sticky;
  top: calc(var(--nav-h, 0px) + var(--bar-h, 0px));
  bottom: calc(var(--band-h) - 2px);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--band-h);
  min-width: 0;
  font-weight: bold;
  color: var(--accent-text);
  background: var(--accent);
  border: 2px solid var(--ink);
}
/* Its two buttons, the band's whole height: its Pokémon in short, bringing its panel into view, and its arrow, folding
   it. */
.band-main,
.band-fold {
  display: flex;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  touch-action: manipulation;
}
.band-main {
  flex: 1;
  gap: 8px;
  padding: 0 10px 0 8px;
}
.band-fold {
  flex: none;
  padding: 0 10px 0 6px;
}
.band-main:focus-visible,
.band-fold:focus-visible {
  outline-offset: -4px;
}
.side-band.theirs {
  top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + var(--band-h) - 2px);
  bottom: 0;
  z-index: 39;
  color: var(--opponent-text);
  background: var(--opponent);
}
/* Each one's top line shared with what's over it (yours' band, or its open panel), as the comparison's bands are: the
   opponent's band whether yours' panel is open or folded (still there between them, hidden). */
.duel.stacked > :deep(section),
.duel.stacked > .side-band.theirs {
  margin-top: -2px;
}
.duel.stacked > :deep(section.side-a) {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + var(--band-h) - 2px);
}
.duel.stacked > :deep(section.side-b) {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + 2 * var(--band-h) - 4px);
}
/* Its Pokémon in short on the band's color: the verdict in it too, bold, rather than the panel's colors. */
/* The solver's chips, the band's whole row but its arrow. */
.band-chips {
  padding: 0 4px 0 6px;
}
.band-summary {
  flex: 1;
  min-width: 0;
}
.side-band :deep(.ko) {
  color: inherit !important;
  font-weight: bold !important;
}
.side-band :deep(.tag) {
  border-color: currentColor;
}
.band-empty {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  font-weight: normal;
}
.band-chevron {
  flex: none;
  transition: transform 0.15s;
}
.side-band.open .band-chevron {
  transform: rotate(180deg);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
/* The buttons on the sides' bands with no outline: the band's color sets them apart enough, a wash on hover. */
:root:root .duel :deep(.btn.on-band) {
  border-color: transparent;
}
/* The way back to the opponent before, its icon after the arrow. */
.back-to {
  gap: 2px;
}
/* A side's set's actions' trigger off the band (on phones): its icon alone, quiet. */
.set-menu {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
.set-menu:hover,
.set-menu.open {
  color: var(--text);
  border-color: var(--border);
}
.set-dialog {
  display: flex;
  flex-direction: column;
}
.set-dialog .load-teams {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.set-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.set-dialog h2 {
  margin: 0;
  font-size: 1.05em;
}
.set-dialog-close {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.set-dialog-close:hover {
  color: var(--text);
}
.set-dialog .load {
  max-width: none;
}
.set-dialog .load-row {
  padding: 8px 6px;
}
.load {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  max-width: min(320px, 80vw);
}
.load-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}
.load-row:hover:not(:disabled) {
  background: var(--hover);
}
.load-row:disabled {
  opacity: 0.5;
  cursor: default;
}
.load-row.copied {
  color: var(--good);
}
/* Clearing the side: destructive, in the bad color. */
.load-row.danger {
  color: var(--bad);
}
.load-row.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bad) 12%, var(--panel));
}
.load-label {
  margin-top: 6px;
  padding: 0 6px;
  font-size: 0.85em;
}
.load-team {
  display: flex;
  flex-direction: column;
  padding: 2px 6px;
}
.load-team-name {
  overflow: hidden;
  font-size: 0.875em;
  font-weight: bold;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.load-team-mons {
  display: flex;
  flex-wrap: wrap;
}
.load-mon {
  display: flex;
  padding: 0;
  line-height: 0;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
}
.load-mon:hover {
  background: var(--hover);
  border-color: var(--border);
}
/* In the picker over its list, the Load menu's ways but the common set, side by side, then a rule either side of a
word, as the common set's offer has. */
.quick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* Leaving a part to be worked out, as the most common set's offer: a soft box in the accent's outline. */
.work-offer {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--panel-alt);
  border: 1px solid var(--accent);
  cursor: pointer;
}
.work-offer:hover {
  background: var(--sel);
}
.work-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 0.875em;
}
.work-title {
  font-size: 1.1em;
  font-weight: bold;
}
/* Custom picked: the parts that can be set or worked out lit a moment, on the bands and the panels' Work out. */
.parts-lit :deep(.solver-chips .chip),
.parts-lit :deep(.work-out .toggle) {
  animation: part-lit 0.7s ease-in-out 2;
}
@keyframes part-lit {
  50% {
    background: var(--sel);
  }
}
@media (prefers-reduced-motion: reduce) {
  .parts-lit :deep(.solver-chips .chip),
  .parts-lit :deep(.work-out .toggle) {
    animation: none;
  }
}
/* Over the most common set's offer, apart from it. */
.work-step:has(+ *) {
  margin-bottom: 10px;
}
.or {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 0.875em;
}
.or::before,
.or::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border);
}
.quick-load {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
/* The teams' drop-down from the row's left edge, not its button's, and no wider than the row (the picker), so it never
   runs past the screen: its menu laid out against the row, the drop-down capped at its width. */
.quick-load :deep(.options-menu) {
  position: static;
}
.quick-load :deep(.pop) {
  max-width: 100%;
}
.quick-load :deep(.pop) .load {
  max-width: none;
}
.picker-dialog {
  width: min(560px, 100vw - 24px);
  max-height: 100%;
  overflow: auto;
}
.import {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(480px, 100vw - 24px);
}
.import h2,
.import p {
  margin: 0;
}
.import textarea {
  width: 100%;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.problem {
  color: var(--bad);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* The hits, then what fits them, one under the other. */
.solver {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.solver > * {
  margin: 0;
}
/* Both in, the bands stuck under the bars at the top, no room of their own in the page, sliding in once the sides'
   panels are past. */
.bands-dock {
  position: sticky;
  top: calc(var(--nav-h, 0px) + var(--bar-h, 0px));
  z-index: 45;
  height: 0;
  margin-bottom: -16px;
}
/* On phones the field's bar has scrolled away with the sides by then. */
@media (max-width: 899px) {
  .bands-dock {
    top: var(--nav-h, 0px);
  }
}
.dock-bands {
  padding: 6px 0 10px;
  background: var(--bg);
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.15s,
    transform 0.15s;
}
/* Until it slides in, nothing of it there for the pointer: it lies over the sides' panels' bands. */
.bands-dock:not(.shown) > .dock-bands {
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.15s,
    transform 0.15s,
    visibility 0s 0.15s;
}
.bands-dock.shown > .dock-bands {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .dock-bands {
    transition: none;
  }
}
/* What to work out, lit a moment as the hits lead on to it. */
.goal-step {
  margin: 14px 0 2px;
  outline: 2px solid transparent;
  outline-offset: 4px;
  transition: outline-color 0.4s;
}
.goal-step.lit {
  outline-color: var(--accent);
  transition: none;
}
/* What fits, dimmed until there's a hit or an order to work from. */
.results > * {
  transition: opacity 0.2s;
}
.results.idle > * {
  opacity: 0.45;
}
@media (prefers-reduced-motion: reduce) {
  .results > * {
    transition: none;
  }
}
/* What fits, its panel its own: no band of the hits' panel to set it apart from. */
.results > :deep(.reverse) {
  margin: 0;
  padding: 0;
  background: none;
  border-top: 0;
  box-shadow: none;
}
/* The hits and what fits set apart from the sides' panels over them. */
.calc > .solver {
  margin-top: 16px;
}
</style>
