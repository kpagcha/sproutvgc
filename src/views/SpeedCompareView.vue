<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, Box, ChevronDown, Plus, RotateCcw, Trash2 } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { has, percent, usageRanks } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { commonBuilds as common, speedBuilds, speedStat } from '@/lib/speed'
import { MAX_POINTS } from '@/lib/stats'
import { buildQuery, buildSpeed, readBuild, type SpeedBuild } from '@/lib/speedBuild'
import { reveal, toTopOf } from '@/lib/scroll'
import {
  LIST_MAX,
  commonSpeed,
  exactSpread,
  listQuery,
  movePlaces,
  odds,
  readList,
  setSpread,
  type ListEntry,
} from '@/lib/speedLineup'
import { TIERS_PICKS, lastCompareQuery, lastTiersQuery, withoutMeta } from '@/lib/tiersState'
import { confirmDialog } from '@/composables/useConfirm'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import { useTour } from '@/composables/useTour'
import AppLink from '@/components/AppLink'
import BuildSummary from '@/components/BuildSummary.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import FolderTabs from '@/components/FolderTabs.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import SetupStar from '@/components/SetupStar.vue'
import SpeedAddSecond from '@/components/SpeedAddSecond.vue'
import SpeedEditor from '@/components/SpeedEditor.vue'
import SpeedLineup, { type LineupEntry } from '@/components/SpeedLineup.vue'
import SpeedMatchups from '@/components/SpeedMatchups.vue'
import SpeedShare from '@/components/SpeedShare.vue'
import SpeedVersus from '@/components/SpeedVersus.vue'
import HelpToggle from '@/components/HelpToggle.vue'
import TourToggle from '@/components/TourToggle.vue'

// Pokémon's Speeds compared, each with a build of its own (its nature's effect, its stat points, its modifiers), in
// one of two views (`mode`). Yours against opponents (the default): up to two a side, yours `a` and `a2`, the
// opponents `b` and `b2` (each build under its letters: `anat`, `apts`, `amods`, `astage`…); a pair side by side,
// which moves first and the points each needs to move before the other; more, one under the other in the order they
// move, with how each of yours does against each opponent, and any two of them alone (`pair`). Or the speed order
// (`mode=order`): any Pokémon, up to `LIST_MAX`, in the order they move (`list`). Everything in the URL, with
// `trickroom`; the speed tiers link here with yours and the Pokémon it's measured against, and back with either as
// yours. Yours against opponents, one can be at its sets rather than at one build (`bsets=1`, an opponent's Speed not
// being known): at every Speed its sets in the meta reach, each counting as often as it's run, with its own modifiers;
// an opponent picked here starts so, when the meta has its sets.
const route = useRoute()
const router = useRouter()
const replace = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })

const { snapshot, data } = useMeta()
const metaSpeeds = computed(() => !!snapshot.value && has(snapshot.value, 'speeds'))
/** Usage ranks, for the pickers to list by, most used first. */
const ranks = computed(() => (data.value ? usageRanks(data.value) : undefined))

const MODES = ['vs', 'order'] as const
type Mode = (typeof MODES)[number]
const mode = computed<Mode>(() => (route.query.mode === 'order' ? 'order' : 'vs'))
// The page opened bare (from the menu, nothing in its URL) comes as it was left (`lastCompareQuery`), put in the URL,
// so the URL always says what's shown and links (the speed tiers', with yours and an opponent) open as they were made.
// Bare but for the data shown, which a link may carry: kept.
if (!Object.keys(withoutMeta(route.query)).length && Object.keys(lastCompareQuery.value).length)
  void router.replace({ query: { ...lastCompareQuery.value, meta: route.query.meta } })
// Remembered as left: while it's the page shown, not as it leaves (still there, fading out, as the next page's query
// comes in).
watch(
  () => route.query,
  (q) => route.name === 'speedCompare' && (lastCompareQuery.value = withoutMeta(q)),
  { immediate: true },
)
const trickRoom = computed(() => route.query.trickroom === '1')
const canHover = window.matchMedia('(hover: hover)').matches
const toggleTrickRoom = () => replace({ trickroom: trickRoom.value ? undefined : '1' })

// Yours against the opponents: each team's first, and its second once picked.
const SIDES = ['a', 'b'] as const
type Side = (typeof SIDES)[number]
const SLOTS = ['a', 'a2', 'b', 'b2'] as const
type Slot = (typeof SLOTS)[number]
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a')
const teamOf = (s: string) => (s.startsWith('a') ? ('yours' as const) : ('opponent' as const))
const BUILD_KEYS = ['', 'nat', 'pts', 'mods', 'stage', 'sets'] as const

const idOf = (s: Slot) => {
  const id = route.query[s]
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
}
/** Each team's first, and its second once picked. */
const vsSlots = computed(() => SLOTS.filter((s) => s === 'a' || s === 'b' || !!idOf(s)))

/**
 * One of the comparison's Pokémon, by its key: a slot's letters, or `p` and its place in the speed order's list. At its
 * sets (`atSets`, when the meta has them), its Speed is their most common, `range` from their slowest to their fastest;
 * its spread is every Speed it can be at, with its share (at one build, that one alone).
 */
function mon(key: string, id: PokemonId | null, build: SpeedBuild, atSets = false) {
  const builds = id && atSets ? speedBuilds(data.value?.[id]?.speeds ?? []) : []
  const spread = !id ? [] : builds.length ? setSpread(id, builds, build) : exactSpread(id, build)
  const sets = builds.length > 0
  return {
    key,
    id,
    build,
    name: id ? refName(pokemon(id)) : null,
    stat: id ? speedStat(POKEMON[id].stats[5], build.points, build.effect) : null,
    speed: id ? (sets ? commonSpeed(spread) : buildSpeed(id, build)) : null,
    spread,
    sets,
    range: sets ? ([spread[spread.length - 1]!.speed, spread[0]!.speed] as const) : null,
  }
}
/** Whether a slot is at its sets, as its URL says. */
const atSets = (s: Slot) => route.query[`${s}sets`] === '1'
type Mon = ReturnType<typeof mon>
const list = computed(() => readList(route.query.list))
const entries = computed<Mon[]>(() =>
  mode.value === 'order'
    ? list.value.map((e, i) => mon(`p${i}`, e.id, e.build))
    : vsSlots.value.map((s) => mon(s, idOf(s), readBuild(route.query, s, idOf(s)), atSets(s))),
)
const entryOf = (key: string) => entries.value.find((e) => e.key === key)

/** A pair side by side, as the page always had; past a pair, and in speed order, one under the other. */
const stacked = computed(() => mode.value === 'order' || vsSlots.value.length > 2)

const sides = computed(() =>
  SIDES.map((s) => ({ s, ...mon(s, idOf(s), readBuild(route.query, s, idOf(s)), atSets(s)) })),
)
const sideOf = (s: Side) => sides.value[SIDES.indexOf(s)]!

/**
 * Who moves first: the faster, or under Trick Room the slower; a tie when they're as fast. With either at its sets, the
 * shares of their matchups each moves first in, and who does in most of them (neither, at most half each).
 */
const verdict = computed(() => {
  const [a, b] = sides.value
  if (a!.speed === null || b!.speed === null) return null
  const shares = a!.sets || b!.sets ? odds(a!.spread, b!.spread, trickRoom.value) : null
  let lead: typeof a | null
  if (shares) lead = shares.first > 0.5 ? a! : shares.after > 0.5 ? b! : null
  else lead = a!.speed === b!.speed ? null : a!.speed > b!.speed !== trickRoom.value ? a! : b!
  let text: string
  if (!shares) text = lead ? t('compare.first', { name: lead.name! }) : t('compare.tie')
  else if (a!.sets && b!.sets)
    text = t('compare.setsVsSets', { name: a!.name!, pct: percent(shares.first), other: b!.name! })
  else if (a!.sets) text = t('compare.vsSets', { name: b!.name!, pct: percent(shares.after), other: a!.name! })
  else text = t('compare.vsSets', { name: a!.name!, pct: percent(shares.first), other: b!.name! })
  return lead ? { tie: false as const, first: lead.s, text, shares } : { tie: true as const, text, shares }
})
/** A side's Speed in short: at its sets, their range. */
const speedLabel = (m: Mon) =>
  !m.range ? m.speed : m.range[0] === m.range[1] ? m.range[0] : `${m.range[0]}–${m.range[1]}`

/** Both sides, once picked: one against the other, as what it takes to move first reads them. */
function vsPair(s: Side) {
  const me = sideOf(s)
  const them = sideOf(other(s))
  if (!me.id || !them.id) return null
  return {
    me: { ...me, id: me.id, name: me.name!, speed: me.speed! },
    them: { ...them, id: them.id, name: them.name!, speed: them.speed! },
  }
}

// Past a pair, each one's place in the move order, and the list in that order (those not picked yet last).
const picked = computed(() => entries.value.filter((e): e is Mon & { id: PokemonId; speed: number } => !!e.id))
const places = computed(() => movePlaces(picked.value, trickRoom.value))
const lineup = computed<LineupEntry[]>(() =>
  entries.value
    .map((e, i) => ({
      i,
      entry: {
        key: e.key,
        team: mode.value === 'vs' ? teamOf(e.key) : null,
        id: e.id,
        build: e.build,
        speed: e.speed,
        range: e.range,
        place: places.value.get(e.key) ?? null,
      },
    }))
    .sort((x, y) => (x.entry.place?.rank ?? 99) - (y.entry.place?.rank ?? 99) || x.i - y.i)
    .map((x) => x.entry),
)
/** In speed order, those as fast as another: by Speed, in the order they move. */
const ties = computed(() => {
  const bySpeed = new Map<number, (typeof picked.value)[number][]>()
  for (const e of picked.value) bySpeed.set(e.speed, [...(bySpeed.get(e.speed) ?? []), e])
  return [...bySpeed.entries()]
    .filter(([, list]) => list.length > 1)
    .sort(([x], [y]) => (trickRoom.value ? x - y : y - x))
    .map(([speed, list]) => ({ speed, list }))
})
const team = (tm: 'yours' | 'opponent') =>
  picked.value.filter((e) => teamOf(e.key) === tm).map((e) => ({ ...e, name: e.name! }))

// The two of yours and the opponents tapped among the matchups, kept in the URL (`pair`, their keys).
const pair = computed(() => {
  const [y, o] = String(route.query.pair ?? '').split('.')
  return y && o && teamOf(y) === 'yours' && teamOf(o) === 'opponent' ? ([y, o] as const) : null
})
const setPair = (p: [string, string] | null) => replace({ pair: p ? p.join('.') : undefined })

// On phones, a pair is two tabs side by side, each with its Pokémon in short: tapping one opens its panel under them,
// tapping it again folds it, both folded leaving what each takes to move first in view, under them. Past a pair, the
// same with the bands one under the other, the one tapped opening under its band. At first, the first one without a
// Pokémon is open, to pick it; with both picked, none.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhone))
// Past a pair, the first slot with none picked starts open, to pick it there; a pair's tabs start folded, an empty one
// picking straight away when tapped.
const openKey = ref<string | null>(
  mode.value === 'vs' && stacked.value ? (SLOTS.find((s) => vsSlots.value.includes(s) && !idOf(s)) ?? null) : null,
)
// One with none picked goes straight to picking it, its panel opening once it's picked (`pick`): in a pair's tabs on
// phones, from its tab alone (the picking screen needs no panel under it); in the list, from its editor.
const editors: Record<string, InstanceType<typeof SpeedEditor> | undefined> = {}
const editorRef = (key: string) => (el: unknown) => {
  editors[key] = (el as InstanceType<typeof SpeedEditor> | null) ?? undefined
}
function toggleOpen(key: string) {
  if (!entryOf(key)?.id) {
    if (stacked.value) openKey.value = key
    return void nextTick(() => editors[key]?.openPicker())
  }
  openKey.value = openKey.value === key ? null : key
  if (openKey.value) void nextTick(revealOpen)
}

/** A Pokémon's builds in the meta, by nature effect and points (what Speed cares about), the most common first. */
function commonBuilds(id: PokemonId | null) {
  return id ? common(speedBuilds(data.value?.[id]?.speeds ?? [])) : []
}
/** A Pokémon's build when picked: the meta's most common, else the fastest; the modifiers it had stay. */
function pickedBuild(id: PokemonId, was: SpeedBuild): SpeedBuild {
  const top = commonBuilds(id)[0]
  return { ...was, effect: top?.effect ?? 'up', points: top?.points ?? MAX_POINTS }
}

const listIndex = (key: string) => Number(key.slice(1))
const setList = (next: readonly ListEntry[]) => replace({ list: listQuery(next) })

// Its nature or points set, one at its sets is at that build instead; its modifiers set, it stays at them.
function setBuild(key: string, b: Partial<SpeedBuild>) {
  const e = entryOf(key)
  if (!e) return
  if (mode.value === 'order')
    setList(list.value.map((x, i) => (i === listIndex(key) ? { ...x, build: { ...x.build, ...b } } : x)))
  else
    replace({
      ...buildQuery({ ...e.build, ...b }, key),
      ...(('effect' in b || 'points' in b) && { [`${key}sets`]: undefined }),
    })
}
/** One at its sets, or at one build (the one it had: its sets' most common, from when it was picked). */
const setSets = (key: string, on: boolean) => replace({ [`${key}sets`]: on ? '1' : undefined })
/** Whether a slot starts at its sets when picked: an opponent, when the meta has its sets. */
const startsAtSets = (key: string, id: PokemonId) =>
  teamOf(key) === 'opponent' && commonBuilds(id).length ? '1' : undefined
function pick(key: string, id: PokemonId) {
  const e = entryOf(key)
  if (!e) return
  if (phone.value || stacked.value) openKey.value = key
  const build = pickedBuild(id, e.build)
  const done =
    mode.value === 'order'
      ? setList(list.value.map((x, i) => (i === listIndex(key) ? { id, build } : x)))
      : replace({ [key]: id, ...buildQuery(build, key), [`${key}sets`]: startsAtSets(key, id) })
  if (stacked.value) void toListTop(done)
  else void afterPick(done, revealOpen)
}
/** A slot's keys in the URL, each as `from`'s (none when it's empty). */
const moveSlot = (to: Slot, from: Slot | null) =>
  Object.fromEntries(
    BUILD_KEYS.map((k) => {
      const v = from && route.query[`${from}${k}`]
      return [`${to}${k}`, typeof v === 'string' ? v : undefined]
    }),
  )
// A team's first cleared with its second picked, the second takes its place.
function clear(key: string) {
  if (openKey.value === key) openKey.value = null
  if (mode.value === 'order') return setList(list.value.filter((_, i) => i !== listIndex(key)))
  const s = key as Slot
  const second = s === 'a' || s === 'b' ? (`${s}2` as Slot) : null
  const q = second && idOf(second) ? { ...moveSlot(s, second), ...moveSlot(second, null) } : moveSlot(s, null)
  replace({ ...q, pair: undefined })
}
/** Every one of the teams cleared, with their builds (and the two tapped among the matchups); the rest stays. */
function clearTeams() {
  openKey.value = null
  folded.value = new Set()
  replace({
    ...moveSlot('a', null),
    ...moveSlot('a2', null),
    ...moveSlot('b', null),
    ...moveSlot('b2', null),
    pair: undefined,
  })
}
/** The speed order's list emptied: asked first past a few, as it can take a while to make. */
async function clearList() {
  if (
    list.value.length > 4 &&
    !(await confirmDialog({
      message: t('compare.clearListConfirm', { n: list.value.length }),
      confirm: t('compare.clearList'),
      danger: true,
    }))
  )
    return
  openKey.value = null
  setList([])
}
function swap() {
  replace({
    ...moveSlot('a', 'b'),
    ...moveSlot('b', 'a'),
    ...moveSlot('a2', 'b2'),
    ...moveSlot('b2', 'a2'),
    pair: undefined,
  })
  openKey.value = null
}
/** A team's second, picked (only then does the page show the list): its panel opens, to set its build. */
function addSecond(s: Side, id: PokemonId) {
  const key = `${s}2` as Slot
  openKey.value = key
  void toListTop(
    replace({
      [key]: id,
      ...buildQuery(pickedBuild(id, readBuild(route.query, key, id)), key),
      [`${key}sets`]: startsAtSets(key, id),
    }),
  )
}
// Wider, a side's panel folds to its Pokémon in short (Confirm, or its band), and opens again from either; a side
// with none picked is always open. On phones, Confirm folds its tab's panel instead.
const folded = ref(new Set<Side>())
const isFolded = (s: Side) => !phone.value && folded.value.has(s) && !!idOf(s)
function toggleFold(s: Side) {
  if (folded.value.has(s)) folded.value.delete(s)
  else folded.value.add(s)
}
// In the list, Confirm folds the open one, and the bands move to the order they move in: on phones, the page then goes
// to the list's top, its first in view at the top of the screen.
const lineupEl = useTemplateRef<InstanceType<typeof SpeedLineup>>('lineupEl')
/**
 * On phones, once one's picked in the list, the page at the list's top, its first at the top of the screen: after the
 * URL has it and the list is drawn, and the picking dialog has closed (the page under it kept from scrolling until then).
 */
const toListTop = (picked: Promise<unknown>) => afterPick(picked, () => phone.value && toTopOf(lineupEl.value?.root))
/** `then`, once what was picked is on the page: the URL has it, it's drawn, and the picking dialog has closed. */
async function afterPick(picked: Promise<unknown>, then: () => void) {
  await picked
  await nextTick()
  setTimeout(then)
}
/**
 * The open one's panel brought into view under what's stuck over it: in the list, right under its band (and the ones
 * piled over it); on phones' pair of tabs, under them, from the row adding a second over it.
 */
const sideAdds = useTemplateRef<HTMLElement>('sideAdds')
function revealOpen() {
  if (stacked.value) return lineupEl.value?.revealOpen()
  const panel = phone.value && openKey.value ? document.getElementById(`compare-${openKey.value}`) : null
  if (panel) reveal(sideAdds.value ?? panel, panel)
}
function confirmRow() {
  openKey.value = null
  if (phone.value) void nextTick(() => toTopOf(lineupEl.value?.root))
}
function confirmSide(s: Side) {
  if (phone.value) openKey.value = null
  else folded.value.add(s)
}
/** What an empty one picks: in the list, whose it is, as there's no team band over it. */
const pickLabel = (team: 'yours' | 'opponent' | null) =>
  t(team === 'yours' ? 'compare.pickYours' : team === 'opponent' ? 'compare.pickOpponent' : 'compare.pick')
// Each team offers its second from the start, once its first is picked.
const canAdd = (s: Side) => !!idOf(s)
const hasSecond = (s: Side) => vsSlots.value.includes(`${s}2` as Slot)
/** The Pokémon on a slot's team but it, which it can't be (a team has one of each species); none in speed order. */
const takenFor = (key: string) =>
  mode.value === 'vs' ? SLOTS.filter((s) => s !== key && teamOf(s) === teamOf(key)).flatMap((s) => idOf(s) ?? []) : []

// In speed order, one added at the end of the list (at its common build), the field emptied for the next; past the
// most it takes, a message saying so in its place, until one goes.
const adderKey = ref(0)
const full = computed(() => list.value.length >= LIST_MAX)
const limitShown = ref(false)
watch(full, (f) => !f && (limitShown.value = false))
function add(id: PokemonId | null) {
  adderKey.value++
  if (!id) return
  if (full.value) return void (limitShown.value = true)
  void toListTop(
    setList([
      ...list.value,
      { id, build: pickedBuild(id, { effect: 'up', points: MAX_POINTS, toggles: [], stage: 0 }) },
    ]),
  )
}

// Switching to the speed order with its list empty brings the Pokémon compared over, to go on from them.
function setMode(m: Mode) {
  openKey.value = null
  const carried =
    m === 'order' && !list.value.length
      ? listQuery(picked.value.map((e) => ({ id: e.id, build: e.build })))
      : route.query.list
  replace({ mode: m === 'order' ? 'order' : undefined, list: typeof carried === 'string' ? carried : undefined })
}

/**
 * The speed tiers as they were left, with one of yours as yours (`ladderMine`) and an opponent found on the ladder
 * (`ladderFind`; what was picked there before giving way to them), and Trick Room as here.
 */
const ladderMine = ref<Slot>('a')
const ladderFind = ref<Slot>('b')
const ladderLink = computed(() => {
  const q = { ...lastTiersQuery.value }
  for (const k of TIERS_PICKS) delete q[k]
  const mineId = idOf(ladderMine.value) ? ladderMine.value : 'a'
  const findId = idOf(ladderFind.value) ? ladderFind.value : 'b'
  const me = idOf(mineId)
  const b = readBuild(route.query, mineId, me)
  return {
    name: 'speedTiers',
    query: {
      ...(q as Record<string, string>),
      ...(me && {
        mine: me,
        mynat: b.effect,
        mypts: String(b.points),
        mymods: b.toggles.length ? b.toggles.join(',') : undefined,
        // The speed tiers have fewer stages: one beyond them is left out.
        mystage: [-1, 1, 2].includes(b.stage) ? String(b.stage) : undefined,
      }),
      find: idOf(findId) ?? undefined,
      trickroom: trickRoom.value ? '1' : undefined,
    },
  }
})
// With a second on either team, the link is a menu choosing which of each goes there first: a row per team with two
// to choose from. Closed by a press outside it, or Escape.
const ladderChoices = computed(() =>
  SIDES.map((s) => ({
    side: s,
    slots: [s, `${s}2` as Slot].filter((x) => !!idOf(x)),
  })).filter((c) => c.slots.length > 1),
)
const ladderOpen = ref(false)
const ladderMenu = useTemplateRef<HTMLElement>('ladderMenu')
function onLadderPointer(e: PointerEvent) {
  if (!ladderMenu.value?.contains(e.target as Node)) ladderOpen.value = false
}
const onLadderKey = (e: KeyboardEvent) => e.key === 'Escape' && (ladderOpen.value = false)
/** The menu over its button rather than under it: too little room under it, and more over it. */
const ladderUp = ref(false)
function placeLadder() {
  const pop = ladderMenu.value?.querySelector<HTMLElement>('.ladder-pop')
  const anchor = pop?.offsetParent?.getBoundingClientRect()
  if (!pop || !anchor) return
  const below = window.innerHeight - anchor.bottom
  ladderUp.value = below < pop.offsetHeight + 6 && anchor.top > below
}
watch(ladderOpen, (on) => {
  if (on) {
    ladderUp.value = false
    void nextTick(placeLadder)
    document.addEventListener('pointerdown', onLadderPointer)
    document.addEventListener('keydown', onLadderKey)
  } else {
    document.removeEventListener('pointerdown', onLadderPointer)
    document.removeEventListener('keydown', onLadderKey)
  }
})
onUnmounted(() => (ladderOpen.value = false))

// How to read the page, in a section closed unless opened (remembered), toggled from the heading's row.
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.compare.helpOpen', false)
const anyPicked = computed(() => !!sideOf('a').id || !!sideOf('b').id)

// The first visit's tour of the page: its two views, what applies to every one, yours and the opponent (or the list in
// speed order), a second a side, and where to read more (and take it again).
const { start: startTour } = useTour('compare', () => [
  { title: 'tour.compare.introTitle', text: 'tour.compare.intro' },
  { el: '.folder-tabs', title: 'tour.compare.viewsTitle', text: 'tour.compare.views', side: 'bottom' },
  { el: '.toolbar', title: 'tour.compare.toolbarTitle', text: 'tour.compare.toolbar', side: 'bottom' },
  { el: ['#compare-a', '.side-tabs'], title: 'tour.compare.yoursTitle', text: 'tour.compare.yours', side: 'bottom' },
  { el: '#compare-b', title: 'tour.compare.opponentTitle', text: 'tour.compare.opponent', side: 'bottom' },
  { el: ['.col-add', '.side-adds'], title: 'tour.compare.secondTitle', text: 'tour.compare.second', side: 'top' },
  { el: '.adder', title: 'tour.compare.orderTitle', text: 'tour.compare.order', side: 'bottom' },
  { el: '.head-tour', title: 'tour.againTitle', text: 'tour.again', side: 'bottom' },
])
// Everything back as the page comes with nothing set, as the speed tiers' Reset all: its whole URL cleared (the
// Pokémon, their builds, the view, Trick Room).
// The data shown (`?meta=`) isn't the page's to reset: it's the reader's choice on every page.
const allChanged = computed(() => Object.keys(withoutMeta(route.query)).length > 0)
function resetAll() {
  openKey.value = null
  void router.replace({ query: {} })
}
</script>

<template>
  <div class="compare-page">
    <!-- Reset all, on the row of the way back to the speed tiers (the app's frame has a place for it there). -->
    <Teleport to="#back-actions-speedCompare" defer>
      <button v-if="allChanged" type="button" class="btn inverted" @click="resetAll">
        <RotateCcw :size="16" aria-hidden="true" />{{ t('speed.resetAll') }}
      </button>
    </Teleport>
    <!-- The heading: the title and its star (saving the Pokémon and their builds to the favorites), the data the
         common builds come from (a button opening what it is, to pick another; on phones, its icon alone), and how to
         read the page at the row's end (its icon alone on phones); under it, how to read the page, opened: the formula
         and what each part says. -->
    <section class="panel page-head">
      <div class="head">
        <h1>{{ t('title.speedCompare') }}<SetupStar /></h1>
        <MetaDialog v-if="metaSpeeds" class="head-meta" />
        <HelpToggle class="head-help" :open="helpOpen" controls="compare-help" fit icon-only @toggle="toggleHelp" />
        <TourToggle class="head-tour" @start="startTour" />
      </div>
      <div v-if="helpOpen" id="compare-help" class="help-body panel sunken small">
        <p class="formula muted">{{ t('speed.formula') }}</p>
        <!-- What the view shown has: yours against opponents, or the speed order. -->
        <dl class="help-options">
          <dt>{{ t('compare.mode') }}</dt>
          <dd class="muted">{{ t('compare.helpMode') }}</dd>
          <template v-if="mode === 'vs'">
            <dt>{{ t('compare.helpTeamsLabel') }}</dt>
            <dd class="muted">{{ t('compare.helpTeams') }}</dd>
          </template>
          <template v-else>
            <dt>{{ t('compare.helpListLabel') }}</dt>
            <dd class="muted">{{ t('compare.helpList') }}</dd>
          </template>
          <dt>{{ t('compare.helpPlacesLabel') }}</dt>
          <dd class="muted">{{ t('compare.helpPlaces') }}</dd>
          <dt>{{ t('compare.common') }}</dt>
          <dd class="muted">{{ t('compare.helpCommon') }}</dd>
          <template v-if="mode === 'vs'">
            <template v-if="metaSpeeds">
              <dt>{{ t('compare.helpSetsLabel') }}</dt>
              <dd class="muted">{{ t('compare.helpSets') }}</dd>
            </template>
            <dt>{{ t('compare.helpAgainstLabel') }}</dt>
            <dd class="muted">{{ t('compare.helpAgainst') }}</dd>
            <dt>{{ t('compare.matchups') }}</dt>
            <dd class="muted">{{ t('compare.helpMatchups') }}</dd>
            <dt>{{ t('compare.both') }}</dt>
            <dd class="muted">{{ t('compare.helpBoth') }}</dd>
            <dt>{{ t('compare.toLadder') }}</dt>
            <dd class="muted">{{ t('compare.helpLadder') }}</dd>
          </template>
          <template v-else>
            <dt>{{ t('compare.ties') }}</dt>
            <dd class="muted">{{ t('compare.tiesNote') }}</dd>
          </template>
          <dt>{{ t('speed.mod.trickroom') }}</dt>
          <dd class="muted">{{ t('compare.trickroomTip') }}</dd>
        </dl>
      </div>
    </section>

    <!-- The view: folder tabs on the toolbar under them, the one shown joined to it. -->
    <FolderTabs
      :model-value="mode"
      :label="t('compare.mode')"
      :options="
        MODES.map((m) => ({ value: m, label: t(phone && m === 'vs' ? 'compare.mode.vsShort' : `compare.mode.${m}`) }))
      "
      @update:model-value="(m: Mode) => setMode(m)"
    />
    <!-- What applies to every one shown: Trick Room, turning over everything under it; yours against the opponents,
         once there's one picked, swapping the teams; and at the row's end, clearing them (the teams, or the list in
         speed order; on phones, its icon alone). There from the start, so nothing under it moves on the first pick. -->
    <div class="panel toolbar">
      <button
        v-tip="canHover && t('compare.trickroomTip')"
        type="button"
        class="btn switch tr-switch"
        :class="{ on: trickRoom }"
        :aria-pressed="trickRoom"
        @click="toggleTrickRoom"
      >
        <Box :size="16" aria-hidden="true" />{{ t('speed.mod.trickroom') }}
      </button>
      <template v-if="mode === 'vs' && anyPicked">
        <button type="button" class="btn" @click="swap">
          <ArrowLeftRight :size="16" aria-hidden="true" />{{ t('compare.swap') }}
        </button>
      </template>
      <button
        v-if="mode === 'order'"
        type="button"
        class="btn inverted clear-all"
        :aria-label="t('compare.clearList')"
        :disabled="!list.length"
        @click="clearList"
      >
        <Trash2 :size="16" aria-hidden="true" /><span class="clear-label">{{ t('compare.clearList') }}</span>
      </button>
      <button
        v-else
        type="button"
        class="btn inverted clear-all"
        :aria-label="t('compare.clearTeams')"
        :disabled="!anyPicked"
        @click="clearTeams"
      >
        <Trash2 :size="16" aria-hidden="true" /><span class="clear-label">{{ t('compare.clearTeams') }}</span>
      </button>
    </div>

    <!-- Past a pair, and in speed order: one under the other, in the order they move. -->
    <template v-if="stacked">
      <SpeedLineup ref="lineupEl" :entries="lineup" :open-key="openKey" @toggle="toggleOpen">
        <template #editor="{ entry }">
          <SpeedEditor
            :ranks
            :ref="editorRef(entry.key)"
            :id="entry.id"
            :build="entry.build"
            :speed="entry.speed"
            :stat="entryOf(entry.key)?.stat ?? null"
            :common="commonBuilds(entry.id)"
            :title="entry.team === 'opponent' ? t('compare.opponent') : t('speed.yours')"
            :tone="entry.team ?? undefined"
            :taken="takenFor(entry.key)"
            :placeholder="pickLabel(entry.team)"
            :at-sets="mode === 'vs' ? !!entryOf(entry.key)?.sets : undefined"
            :range="entry.range"
            confirmable
            @sets="(on: boolean) => setSets(entry.key, on)"
            @confirm="confirmRow"
            @pick="(id: PokemonId) => pick(entry.key, id)"
            @build="(b: Partial<SpeedBuild>) => setBuild(entry.key, b)"
            @clear="clear(entry.key)"
          />
        </template>
        <!-- Yours against the opponents: a slot adding a second to each team that has room for one, greyed out until
             its first is picked. -->
        <template v-if="mode === 'vs'" #after>
          <template v-for="s in SIDES" :key="s">
            <SpeedAddSecond
              :ranks
              v-if="!hasSecond(s)"
              class="row-add"
              :team="teamOf(s)"
              :label="t(s === 'a' ? 'compare.addYours' : 'compare.addOpponent')"
              :disabled="!canAdd(s)"
              :taken="takenFor(`${s}2`)"
              @pick="(id: PokemonId) => addSecond(s, id)"
            />
          </template>
        </template>
      </SpeedLineup>

      <!-- In speed order, one more added at the end; past the most it takes, a message saying so. -->
      <div v-if="mode === 'order'" class="panel adder">
        <p v-if="!list.length" class="muted small adder-empty">{{ t('compare.emptyOrder') }}</p>
        <div class="adder-row">
          <PokemonPicker
            v-if="!full"
            :key="adderKey"
            recent
            :model-value="null"
            :placeholder="t('compare.add')"
            :title="t('compare.add')"
            icon
            speed
            :ranks
            class="picker"
            @update:model-value="add"
          />
          <button
            v-else
            type="button"
            class="btn adder-full"
            :aria-describedby="limitShown ? 'compare-limit' : undefined"
            @click="limitShown = true"
          >
            <Plus :size="16" aria-hidden="true" />{{ t('compare.add') }}
          </button>
          <span class="muted small count">{{ list.length }}/{{ LIST_MAX }}</span>
        </div>
        <p v-if="limitShown" id="compare-limit" class="limit" role="alert">{{ t('compare.limit', { n: LIST_MAX }) }}</p>
      </div>

      <!-- Yours against the opponents: how each does against each, and any two alone. -->
      <SpeedMatchups
        v-if="mode === 'vs' && team('yours').length && team('opponent').length"
        :yours="team('yours')"
        :opponents="team('opponent')"
        :trick-room="trickRoom"
        :pair="pair"
        @pair="setPair"
      />

      <!-- In speed order, those as fast as another. -->
      <section v-if="mode === 'order' && ties.length" class="panel ties">
        <h2 class="ties-heading">{{ t('compare.ties') }}</h2>
        <ul class="tie-list">
          <li v-for="g in ties" :key="g.speed">
            <span class="tie-speed">{{ g.speed }}</span>
            <span class="tie-mons"
              ><span v-for="e in g.list" :key="e.key" class="tie-mon"
                ><PokemonIcon :id="e.id" />{{ e.name }}</span
              ></span
            >
          </li>
        </ul>
        <p class="muted small">{{ t('compare.tiesNote') }}</p>
      </section>
    </template>

    <template v-else>
      <!-- Who moves first, between the two, and their Speeds at the end of its line (the sentence wrapping, not them):
           nothing until there are two, the panels saying what to do. -->
      <!-- With either at its sets, how often each moves first, the one that does in most of them outlined, and under
           it the shares split by who moves first. -->
      <div
        v-if="verdict"
        class="verdict panel"
        :class="{
          tie: verdict.tie,
          'first-a': !verdict.tie && verdict.first === 'a',
          'first-b': !verdict.tie && verdict.first === 'b',
        }"
        role="status"
      >
        <PokemonIcon v-if="!verdict.tie" :id="sideOf(verdict.first).id!" />
        <span class="verdict-text">{{ verdict.text }}</span>
        <span class="verdict-speeds"
          ><span v-if="trickRoom" class="tr-tag" :aria-label="t('speed.mod.trickroom')">{{ t('speed.trShort') }}</span
          >{{ speedLabel(sideOf('a')) }} <span class="muted">vs</span> {{ speedLabel(sideOf('b')) }}</span
        >
        <SpeedShare
          v-if="verdict.shares"
          class="verdict-share"
          :odds="verdict.shares"
          :name="sideOf('a').name!"
          :other="sideOf('b').name!"
          tone="yours"
        />
      </div>

      <!-- On phones, the two side by side as tabs, each with its Pokémon in short, stuck to the top while the page
           scrolls: tapping one opens its panel under them, tapping it again folds it. Who moves first is marked on the verdict alone.
           One at its sets says so in its label, rather than beside its Speeds, where it would wrap. -->
      <div v-if="phone" class="side-tabs" data-top-bar>
        <button
          v-for="side in sides"
          :key="side.s"
          type="button"
          class="tab"
          :class="{
            open: openKey === side.s,
            opponent: side.s === 'b',
          }"
          :aria-expanded="side.id ? openKey === side.s : undefined"
          :aria-controls="`compare-${side.s}`"
          @click="toggleOpen(side.s)"
        >
          <span class="tab-label"
            ><span
              >{{ side.s === 'a' ? t('speed.yours') : t('compare.opponent')
              }}<span v-if="side.id && side.range" class="tab-sets">{{ t('compare.setsTag') }}</span></span
            ><ChevronDown :size="16" class="tab-chevron" :class="{ unset: !side.id }" aria-hidden="true"
          /></span>
          <BuildSummary
            v-if="side.id"
            :id="side.id"
            :speed="side.speed!"
            :build="side.build"
            :range="side.range"
            sets-said
            class="tab-summary"
          />
          <span v-else class="tab-empty"><Plus :size="16" aria-hidden="true" />{{ t('compare.pick') }}</span>
        </button>
      </div>
      <!-- On phones, under each tab, a second for its team, greyed out until its first is picked. -->
      <div v-if="phone" ref="sideAdds" class="side-adds">
        <SpeedAddSecond
          :ranks
          v-for="side in sides"
          :key="side.s"
          :team="teamOf(side.s)"
          :label="t('compare.addSecondShort')"
          :disabled="!canAdd(side.s)"
          :taken="takenFor(`${side.s}2`)"
          @pick="(id: PokemonId) => addSecond(side.s, id)"
        />
      </div>

      <div class="sides">
        <div
          v-for="side in sides"
          v-show="!phone || openKey === side.s"
          :key="side.s"
          class="side-col"
          :class="{ folded: isFolded(side.s) }"
        >
          <section :id="`compare-${side.s}`" class="panel banded side" :class="{ opponent: side.s === 'b' }">
            <!-- Yours, and its opponent, red as on the speed tiers; on phones, its tab stands for it. Once picked, it
                 opens and folds the panel, an arrow at its end saying so. -->
            <component
              :is="side.id ? 'button' : 'div'"
              v-if="!phone"
              :type="side.id ? 'button' : undefined"
              class="band"
              :class="{ toggle: side.id }"
              :aria-expanded="side.id ? !isFolded(side.s) : undefined"
              @click="side.id && toggleFold(side.s)"
            >
              <span>{{ side.s === 'a' ? t('speed.yours') : t('compare.opponent') }}</span>
              <ChevronDown
                v-if="side.id"
                :size="16"
                class="fold-chevron"
                :class="{ open: !isFolded(side.s) }"
                aria-hidden="true"
              />
            </component>
            <!-- Folded (desktop): its Pokémon in short, opening it when tapped. -->
            <button v-if="isFolded(side.s)" type="button" class="folded-summary" @click="toggleFold(side.s)">
              <BuildSummary :id="side.id!" :speed="side.speed!" :build="side.build" :range="side.range" />
            </button>
            <!-- Confirm at its end folds it: under its tab on phones, to its short form wider. -->
            <SpeedEditor
              :ranks
              v-else
              :ref="editorRef(side.s)"
              :id="side.id"
              :build="side.build"
              :speed="side.speed"
              :stat="side.stat"
              :common="commonBuilds(side.id)"
              :title="side.s === 'a' ? t('speed.yours') : t('compare.opponent')"
              :tone="side.s === 'a' ? 'yours' : 'opponent'"
              :taken="takenFor(side.s)"
              :at-sets="side.sets"
              :range="side.range"
              confirmable
              @sets="(on: boolean) => setSets(side.s, on)"
              @confirm="confirmSide(side.s)"
              @pick="(id: PokemonId) => pick(side.s, id)"
              @build="(b: Partial<SpeedBuild>) => setBuild(side.s, b)"
              @clear="clear(side.s)"
            />
          </section>
          <!-- What it takes to move before the other, in panels of their own under its side's, open or folded; on
               phones, under the two instead. -->
          <SpeedVersus
            v-if="!phone && vsPair(side.s)"
            v-bind="vsPair(side.s)!"
            class="col-insight"
            :tone="teamOf(side.s)"
            :trick-room="trickRoom"
          />
          <!-- Under its panel, a second for its team, greyed out until its first is picked; on phones, under its tab
             instead. -->
          <SpeedAddSecond
            :ranks
            v-if="!phone"
            class="col-add"
            :team="teamOf(side.s)"
            :label="t(side.s === 'a' ? 'compare.addYours' : 'compare.addOpponent')"
            :disabled="!canAdd(side.s)"
            :taken="takenFor(`${side.s}2`)"
            @pick="(id: PokemonId) => addSecond(side.s, id)"
          />
        </div>
      </div>

      <!-- On phones, what each takes to move first, side by side under the two (and the panel open, if one is). -->
      <!-- With either at its sets, one under the other, full width: its Speeds need the room. -->
      <div v-if="phone && verdict" class="insights" :class="{ wide: verdict.shares }">
        <SpeedVersus
          v-for="side in sides"
          :key="side.s"
          v-bind="vsPair(side.s)!"
          :tone="teamOf(side.s)"
          :trick-room="trickRoom"
        />
      </div>
    </template>
    <!-- Yours against the opponents, once there's one picked: seeing the two on the speed tiers, at the page's end, as
         the speed tiers' card ends with the way here. -->
    <div v-if="mode === 'vs' && anyPicked" class="to-ladder">
      <AppLink v-if="!ladderChoices.length" :to="ladderLink" class="btn">{{ t('compare.toLadder') }}</AppLink>
      <!-- With a second on either team: which of yours goes there as yours, which opponent it finds. -->
      <div v-else ref="ladderMenu" class="ladder-menu">
        <button type="button" class="btn" :aria-expanded="ladderOpen" @click="ladderOpen = !ladderOpen">
          {{ t('compare.toLadder')
          }}<ChevronDown :size="16" class="fold-chevron" :class="{ open: ladderOpen }" aria-hidden="true" />
        </button>
        <div v-if="ladderOpen" class="ladder-pop panel" :class="{ up: ladderUp }">
          <div
            v-for="c in ladderChoices"
            :key="c.side"
            class="ladder-row"
            role="radiogroup"
            :aria-label="t(c.side === 'a' ? 'compare.ladderYours' : 'compare.ladderFind')"
          >
            <span class="muted small">{{ t(c.side === 'a' ? 'compare.ladderYours' : 'compare.ladderFind') }}</span>
            <span class="ladder-picks">
              <button
                v-for="sl in c.slots"
                :key="sl"
                type="button"
                role="radio"
                class="btn ladder-pick"
                :class="[teamOf(sl), { on: (c.side === 'a' ? ladderMine : ladderFind) === sl }]"
                :aria-checked="(c.side === 'a' ? ladderMine : ladderFind) === sl"
                @click="c.side === 'a' ? (ladderMine = sl) : (ladderFind = sl)"
              >
                <PokemonIcon :id="idOf(sl)!" />{{ refName(pokemon(idOf(sl)!)) }}
              </button>
            </span>
          </div>
          <AppLink :to="ladderLink" class="btn primary ladder-go">{{ t('compare.toLadder') }}</AppLink>
        </div>
      </div>
    </div>
    <p class="muted small page-note">{{ t(mode === 'order' ? 'compare.introOrder' : 'compare.intro') }}</p>
  </div>
</template>

<style scoped>
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
.head-meta {
  flex: 0 1 auto;
}
@media (max-width: 720px) {
  .head-help :deep(span) {
    display: none;
  }
}
/* How to read the page, in a well under the heading. */
.help-body {
  margin: 12px 0 0;
  padding: 8px 10px;
}
.help-body > p {
  margin: 0 0 8px;
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
/* The toolbar under the view's tabs: Trick Room, the teams' actions, and the clear at the row's end. */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar > .btn {
  gap: 6px;
}
/* The intro, at the page's end. */
.page-note {
  margin: 12px 0 0;
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
.small {
  font-size: 0.875em;
}
/* Outlined in the color of the one that moves first, neutral on a tie. */
.verdict.first-a,
.verdict.first-b,
.verdict.tie {
  outline: 3px solid var(--muted);
  outline-offset: 2px;
}
.verdict.first-a {
  outline-color: var(--accent);
}
.verdict.first-b {
  outline-color: var(--opponent);
}
.verdict {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-weight: bold;
}
/* Its line as tall as the icon of the one first, whether it shows or not (a tie, none picked): nothing under it moves
   as the verdict changes. Its own width taken back from the gap after it. */
.verdict::before {
  content: '';
  height: 30px;
  margin-right: -10px;
}
.verdict-text {
  flex: 1;
  min-width: 0;
}
/* The shares, on a line of their own under the rest. */
.verdict {
  flex-wrap: wrap;
}
.verdict-share {
  flex: 1 0 100%;
  font-weight: normal;
}
.verdict-speeds {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
/* On phones, not the Speeds: the tabs right under it have them. */
@media (max-width: 720px) {
  .verdict-speeds {
    display: none;
  }
}
/* Side by side from tablets up; one under the other on phones. */
.sides {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
@media (max-width: 720px) {
  .sides {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* Side by side, each column's parts on rows they share (its panel, what it takes to move first, the second to add),
   so the two panels are as tall as the taller one. */
@media (min-width: 721px) {
  .sides {
    row-gap: 0;
  }
  .side-col {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
    /* Its share of the width, whatever its widest row (the builds, scrolling sideways) would take. */
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }
  .side-col > .col-add {
    align-self: start;
  }
  /* Folded, its column off the shared rows: its panel as short as its Pokémon in short, what's under it right after. */
  .side-col.folded {
    display: block;
    align-self: start;
  }
  /* The shorter one's Confirm at its foot, level with the other's: its editor taking the panel's room. */
  .side {
    display: flex;
    flex-direction: column;
  }
  .side > .speed-editor {
    display: flex;
    flex: 1;
    flex-direction: column;
  }
  .side :deep(.confirm-row) {
    margin-top: auto;
  }
  .side :deep(.speed-editor > :nth-last-child(2)) {
    margin-bottom: 12px;
  }
}
/* Its side's color, for what's marked in it. */
.side {
  --side: var(--accent);
}
.side.opponent {
  --side: var(--opponent);
}
:root:root .side.opponent > .band {
  color: var(--opponent-text);
  background: var(--opponent);
}
.band > .btn {
  flex: none;
  gap: 4px;
  margin-left: auto;
}
/* On phones, the two tabs: each a band of its side's color over its Pokémon in short, side by side, stuck to the top
   on a strip of the page's background. The open one flat, lined up with its panel under it, its arrow turned. */
.side-tabs {
  position: sticky;
  top: 0;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  /* Clear of the open panel's outline (its width and offset), which the strip would otherwise cover. */
  margin-bottom: 6px;
  padding: 6px 0 8px;
  background: var(--bg);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
  cursor: pointer;
  touch-action: manipulation;
}
.tab.open {
  box-shadow: none;
}
.tab-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  color: var(--accent-text);
  background: var(--accent);
  border-bottom: 2px solid var(--ink);
}
/* At its sets: "Sets" in a badge outlined in the label's color, as beside the Speeds elsewhere, within the label's
   height. */
.tab-sets {
  display: inline-flex;
  align-items: center;
  height: 16px;
  margin: -2px 0 -2px 6px;
  padding: 0 4px;
  font-size: 0.875em;
  font-weight: normal;
  vertical-align: middle;
  border: 1px solid currentColor;
}
.tab.opponent .tab-label {
  color: var(--opponent-text);
  background: var(--opponent);
}
.tab-chevron {
  flex: none;
  transition: transform 0.15s;
}
.tab.open .tab-chevron {
  transform: rotate(180deg);
}
/* With none picked there's nothing to fold: the tab picks one. Hidden, its room kept, so both tabs stay as tall. */
.tab-chevron.unset {
  visibility: hidden;
}
/* Its icon standing for its name (still read out), its modifiers under the rest when they don't fit beside it. */
.tab-summary {
  flex: none;
  flex-wrap: wrap;
  row-gap: 6px;
}
.tab-summary :deep(.name) {
  display: none;
}
.tab-summary,
.tab-empty {
  min-height: 40px;
  padding: 4px 8px;
}
.tab-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: normal;
  color: var(--muted);
}
/* On phones, what each takes to move first, side by side, each topped by its side's color. */
.insights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.insights.wide {
  grid-template-columns: minmax(0, 1fr);
}
.band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: bold;
}
/* On the verdict, beside the Speeds it turns over. */
.tr-tag {
  margin-right: 8px;
  padding: 1px 6px;
  font-size: 0.8em;
  color: var(--panel);
  background: var(--text);
}
/* Clearing them: last in the row, pushed to its end. */
.toolbar > .clear-all {
  order: 1;
  margin-left: auto;
}
/* On phones, clearing them is its icon alone (its words read out still). */
@media (max-width: 720px) {
  .clear-label {
    display: none;
  }
}
/* The way to the speed tiers, at the page's end. */
.to-ladder {
  position: relative;
  display: flex;
  margin-top: 12px;
}
.to-ladder > .btn {
  gap: 6px;
}
/* The speed tiers' menu: under its button, over what follows; over it instead when there's no room under it. */
.ladder-menu {
  position: relative;
}
.ladder-menu > .btn {
  gap: 6px;
}
.ladder-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: max-content;
  max-width: min(420px, calc(100vw - 32px));
}
.ladder-pop.up {
  top: auto;
  bottom: calc(100% + 6px);
}
/* On phones, the menu as wide as the page's column. */
@media (max-width: 720px) {
  .ladder-menu {
    position: static;
  }
  .ladder-pop {
    right: 0;
    width: auto;
    max-width: none;
  }
}
.ladder-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ladder-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ladder-pick {
  gap: 4px;
  min-height: 0;
  padding: 2px 10px 2px 4px;
}
.ladder-pick :deep(.sheet-icon) {
  margin-block: -4px;
}
.ladder-pick.on.yours {
  color: var(--accent-text);
  background: var(--accent);
}
.ladder-pick.on.opponent {
  color: var(--opponent-text);
  background: var(--opponent);
}
.ladder-go {
  align-self: flex-start;
}
/* The band, once picked, a toggle: the whole strip, its arrow at its end turning as it opens. */
.band.toggle {
  width: calc(100% + 2 * var(--panel-pad));
  border-top: none;
  border-inline: none;
  font: inherit;
  font-weight: bold;
  text-align: left;
  cursor: pointer;
}
.fold-chevron {
  flex: none;
  transition: transform 0.15s;
}
.fold-chevron.open {
  transform: rotate(180deg);
}
/* Folded: its Pokémon in short, a row that opens it. */
.folded-summary {
  display: flex;
  width: 100%;
  min-height: 40px;
  padding: 0;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
}
.col-insight {
  margin-top: 12px;
}
/* A team's second, added: under its panel; on phones, under its tab; past a pair, under the list. */
.col-add {
  margin-top: 8px;
}
.side-adds {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: -2px 0 10px;
  font-size: 0.875em;
}
.row-add {
  margin-top: 6px;
}
/* In speed order, the field adding one more, how many there are beside it. */
.adder {
  margin-bottom: 12px;
}
.adder-empty {
  margin: 0 0 8px;
}
.adder-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.adder-row > .picker,
.adder-full {
  flex: 1;
  min-width: 0;
}
.adder-full {
  justify-content: flex-start;
  gap: 6px;
  color: var(--muted);
}
.count {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.limit {
  margin: 8px 0 0;
  padding: 4px 8px;
  font-weight: bold;
  color: var(--m0-fg);
  background: var(--m0-bg);
  border: 2px solid var(--ink);
}
/* In speed order, those as fast as another: each Speed, and the Pokémon at it. */
.ties {
  margin-bottom: 12px;
}
.ties-heading {
  margin: 0 0 8px;
  font-size: 1.1em;
}
.tie-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}
.tie-list li {
  display: grid;
  grid-template-columns: 2.5em minmax(0, 1fr);
  align-items: baseline;
  gap: 10px;
}
.tie-list li + li {
  padding-top: 6px;
  border-top: 1px solid var(--border);
}
.tie-mons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.tie-speed {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}
.tie-mon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tie-mon :deep(.sheet-icon) {
  margin-block: -6px;
}
.ties > p {
  margin: 0;
}
</style>
