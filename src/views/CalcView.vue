<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createReusableTemplate, useElementSize, useEventListener, useMediaQuery, watchDebounced } from '@vueuse/core'
import {
  ArrowLeftRight,
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
import { pokemon, type AbilityId, type ItemId, type MoveId, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
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
import type { HitSeen, Observation } from '@/lib/damageReverse'
import {
  abilityOf,
  atSets,
  battlerOf,
  canPool,
  commonSet,
  emptyField,
  emptyFighter,
  pooledView,
  SETS_FIELD,
  type Battlefield,
  type Fighter,
} from '@/lib/damage'
import { membersPaste, parsePaste } from '@/lib/pokepaste'
import { copy } from '@/lib/clipboard'
import { underBand } from '@/lib/scroll'
import { commonForme, commonMember } from '@/lib/commonSet'
import { emptyMember, nextField, pickedAs, setsAs, stoneMega, type Field, type Member } from '@/lib/team'
import { conditionName, fieldOf, terrainOf, weatherOf } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import CalcMeta from '@/components/CalcMeta.vue'
import CalcReverse from '@/components/CalcReverse.vue'
import CalcHits, { type HitDraft } from '@/components/CalcHits.vue'
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
import PokemonIcon from '@/components/PokemonIcon'
import ScrollRow from '@/components/ScrollRow.vue'
import SectionNav from '@/components/SectionNav.vue'
import SetupStar from '@/components/SetupStar.vue'
import SideDrawer from '@/components/SideDrawer.vue'
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
// the inverse (`inverse`, `/tools/calc/inverse`): what was seen (`CalcHits`: the hits, which moved first) and what of
// the opponent's set fits it (`CalcReverse`), the opponent's panel leaving out what's worked out.
const props = defineProps<{ inverse?: boolean }>()
const route = useRoute()
const router = useRouter()
// Its address while it was a switch on the damage tab.
if (!props.inverse && route.query.mode === 'reverse') {
  const query = { ...route.query }
  delete query.mode
  void router.replace({ name: 'calcInverse', query })
}
type Tab = 'damage' | 'inverse'
const tab = computed<Tab>(() => (props.inverse ? 'inverse' : 'damage'))
const tabs = computed(() => [
  { value: 'damage' as const, label: t('calc.tab.damage') },
  { value: 'inverse' as const, label: t('calc.tab.inverse') },
])
const toTab = (to: Tab) => {
  if (to !== tab.value) void router.push({ name: to === 'inverse' ? 'calcInverse' : 'calc', query: route.query })
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
        { id: 'calc-duel', label: t('calc.section.pokemon') },
        ...(hasBoth.value
          ? [
              { id: 'calc-hits', label: t('calc.hits.title') },
              { id: 'calc-reverse', label: t('calc.reverse.title') },
            ]
          : []),
      ]
    : damageSections.value),
])
const damageSections = computed(() => [
  { id: 'calc-duel', label: t('calc.section.damage') },
  ...(battlerOf(sides.value.a) && battlerOf(sides.value.b)
    ? [{ id: 'calc-threats', label: t('calc.threats.title') }]
    : []),
  ...(battlerOf(sides.value.a) ? [{ id: 'calc-meta', label: t('calc.meta.title') }] : []),
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
const hits = shallowRef<HitDraft[]>(decodeHits(start.h))
/** Which was seen moving first (`?first=a|b`). */
const first = shallowRef<'a' | 'b' | null>(start.first === 'a' || start.first === 'b' ? start.first : null)
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
  if (!battlerOf(sides.value[k])) {
    picking.value = { side: k, field: 'pokemon' }
    return
  }
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
  h: encodeHits(seen.value) || undefined,
  first: first.value ?? undefined,
}))
watchDebounced(
  query,
  (q) => {
    saveLast(q)
    const next = { ...route.query, ...q }
    for (const k of ['a', 'b', 'f', 'sheet', 'h', 'first'] as const) if (!q[k]) delete next[k]
    void router.replace({ query: next })
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
/** A spread of What fits used: the opponent set to it (its nature unless at its team sheet, and the item likeliest to
 * go with it where its item was worked out), the damage tab shown with it. */
function useBuild(b: { nature: string | null; points: Member['points']; item?: ItemId | null }) {
  const f = sides.value.b
  const member = {
    ...f.member,
    points: [...b.points] as Member['points'],
    ...(!sheet.value && { nature: b.nature }),
    ...(b.item !== undefined && { item: b.item }),
  }
  setSide('b', { ...f, member, sets: false, mega: !!stoneMega(member) && f.mega })
  toTab('damage')
}
/** The sides as they battle: at every set, at their sets pooled in the meta shown. */
const fought = computed(() => ({ a: atSets(sides.value.a, data.value), b: atSets(sides.value.b, data.value) }))
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
  // The inverse tab's opponent off its team sheet: its most common ability, which isn't asked for (it counts as set,
  // and can be changed on its card). Its item is left unknown, worked out until set.
  if (props.inverse && k === 'b' && !sheet.value) member.ability ??= commonMember(id, data.value).ability
  setSide(k, { ...emptyFighter(member), side: sides.value[k].side, sets: sides.value[k].sets })
}
/**
 * The part to pick next: on the damage tab, the next the set lacks (`nextField`). On the inverse tab, a move picked
 * closes the picker (a hit's move is picked where the hit is, any the attacker learns, so its set needs none, or one or
 * two), and none follows another; the opponent's stat points aren't asked for, nor off its team sheet its item,
 * ability and nature (its item optional, worked out until set; its nature worked out; its ability its most common).
 */
function nextStep(k: SideKey, member: Member, after: Field): Field | null {
  if (!props.inverse) return nextField(member, after)
  if (typeof after === 'number') return null
  const skip = (f: Field) =>
    typeof f === 'number' ||
    (k === 'b' && (f === 'points' || (!sheet.value && (f === 'item' || f === 'ability' || f === 'nature'))))
  let f = nextField(member, after)
  while (f !== null && skip(f)) f = nextField(member, f)
  return f
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
// The reader's teams, a side loading one of their Pokémon: in the side's Load menu and in its picker's.
const [DefineTeams, ReuseTeams] = createReusableTemplate<{ side: SideKey; done: () => void }>()
const commonPreview = computed(() => (picking.value?.common ? commonSet(picking.value.common, data.value) : null))

function pick(value: string) {
  const p = picking.value
  if (!p) return
  const m = sides.value[p.side].member
  let common: PokemonId | undefined
  if (p.field === 'pokemon') {
    if (pickedAs(value as PokemonId).pokemon !== m.pokemon) {
      choose(p.side, value as PokemonId)
      common = commonForme(value as PokemonId, data.value)
    } else {
      const { item } = pickedAs(value as PokemonId)
      if (item) patchMember(p.side, { item })
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
    const was = moves.indexOf(value as MoveId)
    if (was >= 0) moves[was] = moves[p.field]!
    moves[p.field] = value as MoveId
    patchMember(p.side, { moves })
  }
  const now = sides.value[p.side].member
  const next = p.back ?? nextStep(p.side, now, p.field)
  picking.value = next === null ? null : { side: p.side, field: next, ...(common && { common }) }
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
  const forme = sides.value[k].mega ? setsAs(sides.value[k].member)! : id
  setSide(k, { ...commonSet(forme, data.value), side: sides.value[k].side, sets: sides.value[k].sets })
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
  if (await mayReplace(k)) fromTeam(k, m)
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
  if (await mayReplace(k)) fromTeam(k, first)
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
  if (k) setSide(k, { ...sides.value[k], member: { ...sides.value[k].member, ...patch }, sets: false })
}
function pointsSets(on: boolean) {
  const k = picking.value?.side
  if (k) setSide(k, { ...sides.value[k], sets: on })
}
const natureAgain = () =>
  picking.value && (picking.value = { side: picking.value.side, field: 'nature', back: 'points' })
const labels = computed(() => ({ a: t('calc.yours'), b: t('calc.theirs') }))
const hasAny = computed(() => !!(battlerOf(sides.value.a) || battlerOf(sides.value.b)))
const hasBoth = computed(() => !!(battlerOf(sides.value.a) && battlerOf(sides.value.b)))

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
  reveal('b', 'smooth')
}
</script>

<template>
  <div
    class="calc"
    :style="{
      '--nav-h': `${navH}px`,
      '--bar-h': `${fieldOpen && !fieldCompact ? 0 : barH}px`,
      '--band-h': `${BAND_H}px`,
    }"
  >
    <!-- Reset all, on the row of the way back to Tools, as on the speed pages (the app's frame has a place for it there). -->
    <Teleport :to="`#back-actions-${inverse ? 'calcInverse' : 'calc'}`" defer>
      <button v-if="hasAny" type="button" class="btn inverted" @click="resetAll">
        <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetAll') }}
      </button>
    </Teleport>
    <SectionNav ref="nav" :sections />
    <section id="calc-top" class="head-panel">
      <div class="head">
        <h1>{{ t('title.calc') }}<SetupStar /></h1>
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
        }"
      >
        <!-- One row, sliding sideways where it doesn't fit: the toggle, and those on named while folded. -->
        <ScrollRow class="toolbar">
          <button
            type="button"
            class="btn"
            :class="{ on: fieldOpen }"
            :aria-expanded="fieldOpen"
            aria-controls="calc-field"
            @click="toggleField"
          >
            <SlidersHorizontal :size="16" aria-hidden="true" />{{ t('calc.conditions')
            }}<span class="on-count" :class="{ none: !fieldOn.length }">{{ fieldOn.length }}</span
            ><ChevronDown :size="14" class="fold-chev" :class="{ open: fieldOpen }" aria-hidden="true" />
          </button>
          <template v-if="!fieldOpen">
            <span v-for="c in fieldOn" :key="c!.key" class="field-on">
              <component :is="c!.icon" v-if="c!.icon" :size="14" aria-hidden="true" />{{ conditionName(c!) }}
            </span>
          </template>
        </ScrollRow>
        <!-- Unfolded, its Clear on the toggle's row, beside it (on phones at the row's end). -->
        <button
          v-if="fieldOpen"
          type="button"
          class="btn quiet small field-clear"
          :disabled="!fieldOn.length"
          @click="field = { ...field, weather: '', terrain: '', effects: [] }"
        >
          <Eraser :size="14" aria-hidden="true" />{{ t('calc.clearConditions') }}
        </button>
        <div v-if="fieldOpen" id="calc-field" class="field-conditions">
          <CalcConditions :field :data no-clear :rows="fieldCompact" @field="field = $event" />
        </div>
      </div>

      <div
        id="calc-duel"
        class="duel"
        :class="{
          aligned:
            hasBoth && movesFolded.a.value === movesFolded.b.value && battleFolded.a.value === battleFolded.b.value,
          stacked: !wide,
        }"
      >
        <!-- On phones, as the speed comparison's list past a pair: each side a band of its color, its Pokémon in short,
           stuck to the top under the field's bar, the second piling up under the first, and to the bottom; tapping it
           brings its panel into view under it, opening it (one with none picks it), or, in its place with its panel open
           under it, folds it; its arrow opens and folds it. -->
        <template v-for="k in ['a', 'b'] as const" :key="k">
          <div
            v-if="!wide"
            :id="`band-${k}`"
            class="side-band"
            :class="[`band-${k}`, { open: open[k] && !!battlerOf(sides[k]), theirs: k === 'b' }]"
          >
            <button type="button" class="band-main" :aria-controls="`calc-${k}`" @click="tapBand(k)">
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
            :sheet
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
      </div>
    </div>

    <!-- The inverse tab: what was seen, and what of the opponent's set fits it. -->
    <template v-if="inverse">
      <template v-if="hasBoth">
        <CalcHits id="calc-hits" v-model:hits="hits" v-model:first="first" :yours="fought.a" :theirs="fought.b" />
        <CalcReverse
          id="calc-reverse"
          :yours="fought.a"
          :theirs="fought.b"
          :field
          :data
          :obs="observations"
          v-model:sheet="sheet"
          @use="useBuild"
        />
      </template>
    </template>
    <template v-else>
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

      <CalcMeta v-if="battlerOf(sides.a)" id="calc-meta" :yours="fought.a" :field :data @pick="face" />
    </template>

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

    <!-- Right after a Pokémon's picked, its most common set, to load rather than put the set together; picking the
    Pokémon, the side's Load's other ways side by side over the list: a paste, and one of the reader's teams' Pokémon
    from a drop-down, when they have a team. -->
    <DefineCommon>
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

    <!-- On wide screens, the picker as a drawer over the page, the side's card left clear. -->
    <SideDrawer
      ref="drawer"
      :open="wide && !!picking"
      :anchor="drawerAnchor"
      :label="t('builder.picker')"
      defer
      @close="picking = null"
    >
      <TeamPicker
        v-if="picking && pickerMember"
        :member="pickerMember"
        :others="otherMembers"
        :field="picking.field"
        :data
        :snapshot
        v-bind="pickerPoints"
        @pick="pick"
        @close="picking = null"
        @change="pointsChange"
        @sets="pointsSets"
        @nature="natureAgain"
        ><ReuseCommon
      /></TeamPicker>
    </SideDrawer>

    <!-- On phones, the picker over the page. -->
    <ModalDialog v-if="!wide" v-model:open="pickerOpen" :label="t('builder.picker')" fill>
      <div v-if="picking && pickerMember" ref="pickerBox" class="panel picker-dialog">
        <TeamPicker
          :member="pickerMember"
          :others="otherMembers"
          :field="picking.field"
          :data
          :snapshot
          v-bind="pickerPoints"
          @pick="pick"
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
            class="load-row"
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
.calc > .verdict,
.calc > #calc-hits,
.calc > #calc-meta {
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
  .calc > .verdict,
  .calc > #calc-meta {
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
#calc-duel,
#calc-meta {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + 8px);
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
  max-height: calc(100dvh - var(--nav-h, 0px) - 12px);
  margin: -8px -6px 0;
  /* Less under it than over it: the row in it already keeps 4px under its buttons for their shadows. */
  padding: 8px 6px 4px;
  overflow-y: auto;
  background: var(--bg);
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
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
/* Its Clear beside the toggle; on phones at the row's end. */
.field-clear {
  flex: none;
}
@media (max-width: 899px) {
  .field-clear {
    margin-left: auto;
  }
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
@media (max-width: 899px) {
  .duel {
    grid-template-columns: minmax(0, 1fr);
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
</style>
