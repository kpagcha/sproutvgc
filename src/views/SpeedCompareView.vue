<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, ChevronDown, Plus, RotateCcw } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { currentSnapshots, distinctLabel, has } from '@/data/meta'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { natureEffect, speedStat } from '@/lib/speed'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { buildQuery, buildSpeed, readBuild, toMoveFirst, type SpeedBuild } from '@/lib/speedBuild'
import { LIST_MAX, listQuery, movePlaces, readList, type ListEntry } from '@/lib/speedLineup'
import { TIERS_PICKS, lastTiersQuery } from '@/lib/tiersState'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import AppLink from '@/components/AppLink'
import BuildSummary from '@/components/BuildSummary.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import SetupStar from '@/components/SetupStar.vue'
import SpeedAddSecond from '@/components/SpeedAddSecond.vue'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import SpeedEditor from '@/components/SpeedEditor.vue'
import SpeedLineup, { type LineupEntry } from '@/components/SpeedLineup.vue'
import SpeedMatchups from '@/components/SpeedMatchups.vue'
import HelpToggle from '@/components/HelpToggle.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// Pokémon's Speeds compared, each with a build of its own (its nature's effect, its stat points, its modifiers), in
// one of two views (`mode`). Yours against opponents (the default): up to two a side, yours `a` and `a2`, the
// opponents `b` and `b2` (each build under its letters: `anat`, `apts`, `amods`, `astage`…); a pair side by side,
// which moves first and the points each needs to move before the other; more, one under the other in the order they
// move, with how each of yours does against each opponent, and any two of them alone (`pair`). Or the speed order
// (`mode=order`): any Pokémon, up to `LIST_MAX`, in the order they move (`list`). Everything in the URL, with
// `trickroom`; the speed tiers link here with yours and the Pokémon it's measured against, and back with either as
// yours.
const route = useRoute()
const router = useRouter()
const replace = (q: Record<string, string | undefined>) => void router.replace({ query: { ...route.query, ...q } })

const { snapshot, data } = useMeta()
const metaSpeeds = computed(() => !!snapshot.value && has(snapshot.value, 'speeds'))

const MODES = ['vs', 'order'] as const
type Mode = (typeof MODES)[number]
const mode = computed<Mode>(() => (route.query.mode === 'order' ? 'order' : 'vs'))
const trickRoom = computed(() => route.query.trickroom === '1')

// Yours against the opponents: each team's first, and its second once picked.
const SIDES = ['a', 'b'] as const
type Side = (typeof SIDES)[number]
const SLOTS = ['a', 'a2', 'b', 'b2'] as const
type Slot = (typeof SLOTS)[number]
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a')
const teamOf = (s: string) => (s.startsWith('a') ? ('yours' as const) : ('opponent' as const))
const BUILD_KEYS = ['', 'nat', 'pts', 'mods', 'stage'] as const

const idOf = (s: Slot) => {
  const id = route.query[s]
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
}
/** Each team's first, and its second once picked. */
const vsSlots = computed(() => SLOTS.filter((s) => s === 'a' || s === 'b' || !!idOf(s)))

/** One of the comparison's Pokémon, by its key: a slot's letters, or `p` and its place in the speed order's list. */
const mon = (key: string, id: PokemonId | null, build: SpeedBuild) => ({
  key,
  id,
  build,
  name: id ? refName(pokemon(id)) : null,
  stat: id ? speedStat(POKEMON[id].stats[5], build.points, build.effect) : null,
  speed: id ? buildSpeed(id, build) : null,
})
type Mon = ReturnType<typeof mon>
const list = computed(() => readList(route.query.list))
const entries = computed<Mon[]>(() =>
  mode.value === 'order'
    ? list.value.map((e, i) => mon(`p${i}`, e.id, e.build))
    : vsSlots.value.map((s) => mon(s, idOf(s), readBuild(route.query, s))),
)
const entryOf = (key: string) => entries.value.find((e) => e.key === key)

/** A pair side by side, as the page always had; past a pair, and in speed order, one under the other. */
const stacked = computed(() => mode.value === 'order' || vsSlots.value.length > 2)

const sides = computed(() => SIDES.map((s) => ({ s, ...mon(s, idOf(s), readBuild(route.query, s)) })))
const sideOf = (s: Side) => sides.value[SIDES.indexOf(s)]!

/** Who moves first: the faster, or under Trick Room the slower; a tie when they're as fast. */
const verdict = computed(() => {
  const [a, b] = sides.value
  if (a!.speed === null || b!.speed === null) return null
  if (a!.speed === b!.speed) return { tie: true as const }
  const first = a!.speed > b!.speed !== trickRoom.value ? a! : b!
  return { tie: false as const, first: first.s, name: first.name! }
})

/** What it takes for a side to move before the other, at each nature effect. */
function against(s: Side) {
  const me = sideOf(s)
  const them = sideOf(other(s))
  if (!me.id || them.speed === null) return null
  return toMoveFirst(me.id, me.build, them.speed, trickRoom.value)
}
const againstTitle = (s: Side) => t('compare.against', { name: sideOf(other(s)).name!, speed: sideOf(other(s)).speed! })

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
  picked.value
    .filter((e) => teamOf(e.key) === tm)
    .map((e) => ({ key: e.key, id: e.id, name: e.name!, speed: e.speed, build: e.build }))

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
const openKey = ref<string | null>(mode.value === 'vs' ? (SIDES.find((s) => !idOf(s)) ?? null) : null)
// One with none picked goes straight to picking it, its panel opening once it's picked (`pick`).
const editors: Record<string, InstanceType<typeof SpeedEditor> | undefined> = {}
const editorRef = (key: string) => (el: unknown) => {
  editors[key] = (el as InstanceType<typeof SpeedEditor> | null) ?? undefined
}
function toggleOpen(key: string) {
  if (!entryOf(key)?.id) {
    openKey.value = key
    return void nextTick(() => editors[key]?.openPicker())
  }
  openKey.value = openKey.value === key ? null : key
}

/** A Pokémon's builds in the meta, by nature effect and points (what Speed cares about), the most common first. */
function commonBuilds(id: PokemonId | null) {
  if (!id) return []
  const byBuild = new Map<string, { effect: NatureEffect; points: number; share: number }>()
  for (const sp of data.value?.[id]?.speeds ?? []) {
    const effect = natureEffect(sp.nature)
    const key = `${effect}:${sp.points}`
    const b = byBuild.get(key) ?? { effect, points: sp.points, share: 0 }
    b.share += sp.share
    byBuild.set(key, b)
  }
  return [...byBuild.values()]
    .filter((b) => b.share >= 0.03)
    .sort((x, y) => y.share - x.share)
    .slice(0, 4)
}
/** A Pokémon's build when picked: the meta's most common, else the fastest; the modifiers it had stay. */
function pickedBuild(id: PokemonId, was: SpeedBuild): SpeedBuild {
  const top = commonBuilds(id)[0]
  return { ...was, effect: top?.effect ?? 'up', points: top?.points ?? MAX_POINTS }
}

const listIndex = (key: string) => Number(key.slice(1))
const setList = (next: readonly ListEntry[]) => replace({ list: listQuery(next) })

function setBuild(key: string, b: Partial<SpeedBuild>) {
  const e = entryOf(key)
  if (!e) return
  if (mode.value === 'order')
    setList(list.value.map((x, i) => (i === listIndex(key) ? { ...x, build: { ...x.build, ...b } } : x)))
  else replace(buildQuery({ ...e.build, ...b }, key))
}
function pick(key: string, id: PokemonId) {
  const e = entryOf(key)
  if (!e) return
  if (phone.value || stacked.value) openKey.value = key
  const build = pickedBuild(id, e.build)
  if (mode.value === 'order') return setList(list.value.map((x, i) => (i === listIndex(key) ? { id, build } : x)))
  replace({ [key]: id, ...buildQuery(build, key) })
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
  replace({ [key]: id, ...buildQuery(pickedBuild(id, readBuild(route.query, key)), key) })
}
// Wider, a side's panel folds to its Pokémon in short (Confirm, or its band), and opens again from either; a side
// with none picked is always open. On phones, Confirm folds its tab's panel instead.
const folded = ref(new Set<Side>())
const isFolded = (s: Side) => !phone.value && folded.value.has(s) && !!idOf(s)
function toggleFold(s: Side) {
  if (folded.value.has(s)) folded.value.delete(s)
  else folded.value.add(s)
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
  setList([...list.value, { id, build: pickedBuild(id, { effect: 'up', points: MAX_POINTS, toggles: [], stage: 0 }) }])
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
  const b = readBuild(route.query, mineId)
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
watch(ladderOpen, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onLadderPointer)
    document.addEventListener('keydown', onLadderKey)
  } else {
    document.removeEventListener('pointerdown', onLadderPointer)
    document.removeEventListener('keydown', onLadderKey)
  }
})
onUnmounted(() => (ladderOpen.value = false))

// The top panel folds away as the speed tiers' does (open at first, then as the reader last left it; on phones folded
// on each visit), what's set then said in short beside the heading. How to read the page in a section of its own,
// closed unless opened (remembered).
const isOpen = (e: Event) => (e.target as HTMLDetailsElement).open
const { open: controlsOpen, toggle: toggleControls } = useOpenState('sproutvgc.compare.controlsOpen', true)
if (window.matchMedia('(max-width: 720px)').matches) controlsOpen.value = false
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.compare.helpOpen', false)
// On phones, how to read the page is toggled from beside its heading, the controls folded or not: opening it opens
// them, which hold it.
function helpFromHead() {
  if (controlsOpen.value && helpOpen.value) return toggleHelp()
  controlsOpen.value = true
  if (!helpOpen.value) toggleHelp()
}
// In two kinds, as the speed tiers': the options on first, then what's shown (the view, the data).
const active = computed(() => {
  const list: { label: string; kind: 'view' | 'option' }[] = []
  if (trickRoom.value) list.push({ label: t('speed.mod.trickroom'), kind: 'option' })
  // The view always, as the speed tiers' (yours against opponents, or the speed order).
  list.push({ label: t(`compare.mode.${mode.value}`), kind: 'view' })
  if (snapshot.value && metaSpeeds.value && currentSnapshots().length > 1)
    list.push({ label: distinctLabel(snapshot.value), kind: 'view' })
  return list
})
const anyPicked = computed(() => !!sideOf('a').id || !!sideOf('b').id)
// Everything back as the page comes with nothing set, as the speed tiers' Reset all: its whole URL cleared (the
// Pokémon, their builds, the view, Trick Room), and on phones yours' panel open to pick it.
const allChanged = computed(() => Object.keys(route.query).length > 0)
function resetAll() {
  openKey.value = 'a'
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
    <!-- The heading, the intro and how to read the page, and what applies to every one (the view, the snapshot the
         common builds come from, Trick Room): a panel folding away as the speed tiers' top one does, what's set said
         in short beside the heading while folded. Its heading opens and closes it itself, so the arrow and what's said
         change at once. -->
    <details class="panel instant top" :open="controlsOpen" @toggle="controlsOpen = isOpen($event)">
      <summary class="head" @click.prevent="toggleControls">
        <!-- Its star saves the Pokémon and their builds to the favorites. -->
        <h1>
          <span
            ><span class="marker" aria-hidden="true">{{ controlsOpen ? '▾' : '▸' }}</span
            >{{ t('title.speedCompare') }}</span
          ><SetupStar /><HelpToggle
            class="head-help"
            :open="helpOpen && controlsOpen"
            controls="compare-help"
            fit
            @toggle="helpFromHead"
          />
        </h1>
        <!-- On one line, scrolling sideways when it doesn't fit. -->
        <ScrollRow v-if="!controlsOpen && active.length" class="active" role="list" :aria-label="t('speed.active')">
          <span v-for="a in active" :key="a.label" role="listitem" class="item" :class="a.kind">{{ a.label }}</span>
        </ScrollRow>
      </summary>
      <div class="fold-body">
        <!-- The intro, and how to read the page: a link-like toggle beside it. -->
        <p class="lede">
          <span class="muted wide-only">{{ t(mode === 'order' ? 'compare.introOrder' : 'compare.intro') }}</span>
          <HelpToggle :open="helpOpen" controls="compare-help" @toggle="toggleHelp" />
        </p>
        <!-- How to read it: the formula and what each part says; on phones, the intro too. -->
        <div v-if="helpOpen" id="compare-help" class="help-body panel sunken small">
          <p class="muted phone-only-block">{{ t(mode === 'order' ? 'compare.introOrder' : 'compare.intro') }}</p>
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
        <div class="controls">
          <SegmentedControl
            :model-value="mode"
            :label="t('compare.mode')"
            :options="MODES.map((m) => ({ value: m, label: t(`compare.mode.${m}`) }))"
            @update:model-value="(m: Mode) => setMode(m)"
          />
          <MetaPicker v-if="metaSpeeds" />
          <label class="btn switch" :class="{ on: trickRoom }">
            <input type="checkbox" :checked="trickRoom" @change="replace({ trickroom: trickRoom ? undefined : '1' })" />
            {{ t('speed.mod.trickroom') }}
          </label>
          <span class="muted small wide-only">{{ t('compare.trickroomTip') }}</span>
        </div>
      </div>
    </details>

    <!-- Yours against the opponents: swap the teams (once there's one to swap), or see the two first on the speed
         tiers. There from the start, so nothing under it moves on the first pick. -->
    <div v-if="mode === 'vs'" class="panel actions">
      <button type="button" class="btn" :disabled="!anyPicked" @click="swap">
        <ArrowLeftRight :size="16" aria-hidden="true" />{{ t('compare.swap') }}
      </button>
      <AppLink v-if="!ladderChoices.length" :to="ladderLink" class="btn">{{ t('compare.toLadder') }}</AppLink>
      <!-- With a second on either team: which of yours goes there as yours, which opponent it finds. -->
      <div v-else ref="ladderMenu" class="ladder-menu">
        <button type="button" class="btn" :aria-expanded="ladderOpen" @click="ladderOpen = !ladderOpen">
          {{ t('compare.toLadder')
          }}<ChevronDown :size="16" class="fold-chevron" :class="{ open: ladderOpen }" aria-hidden="true" />
        </button>
        <div v-if="ladderOpen" class="ladder-pop panel">
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

    <!-- Past a pair, and in speed order: one under the other, in the order they move. -->
    <template v-if="stacked">
      <SpeedLineup :entries="lineup" :open-key="openKey" @toggle="toggleOpen">
        <template #editor="{ entry }">
          <SpeedEditor
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
            confirmable
            @confirm="openKey = null"
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
            :model-value="null"
            :placeholder="t('compare.add')"
            :title="t('compare.add')"
            icon
            speed
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
      <!-- Who moves first, between the two, and their Speeds at the end of its line (the sentence wrapping, not them);
           on phones, nothing until there are two, the panels saying what to do. -->
      <p
        class="verdict panel"
        :class="{
          tie: verdict?.tie,
          empty: !verdict,
          'first-a': verdict && !verdict.tie && verdict.first === 'a',
          'first-b': verdict && !verdict.tie && verdict.first === 'b',
        }"
        role="status"
      >
        <PokemonIcon v-if="verdict && !verdict.tie" :id="sideOf(verdict.first).id!" />
        <span class="verdict-text">{{
          !verdict ? t('compare.empty') : verdict.tie ? t('compare.tie') : t('compare.first', { name: verdict.name })
        }}</span>
        <span v-if="verdict" class="verdict-speeds"
          >{{ sideOf('a').speed }} <span class="muted">vs</span> {{ sideOf('b').speed }}</span
        >
      </p>

      <!-- On phones, the two side by side as tabs, each with its Pokémon in short, stuck to the top while the page
           scrolls: tapping one opens its panel under them, tapping it again folds it. Who moves first is
           marked on the verdict and the open panel, not on them. -->
      <div v-if="phone" class="side-tabs">
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
            >{{ side.s === 'a' ? t('speed.yours') : t('compare.opponent')
            }}<ChevronDown :size="16" class="tab-chevron" :class="{ unset: !side.id }" aria-hidden="true"
          /></span>
          <BuildSummary v-if="side.id" :id="side.id" :speed="side.speed!" :build="side.build" class="tab-summary" />
          <span v-else class="tab-empty">{{ t('compare.pick') }}</span>
        </button>
      </div>
      <!-- On phones, under each tab, a second for its team, greyed out until its first is picked. -->
      <div v-if="phone" class="side-adds">
        <SpeedAddSecond
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
        <div v-for="side in sides" v-show="!phone || openKey === side.s" :key="side.s" class="side-col">
          <section
            :id="`compare-${side.s}`"
            class="panel banded side"
            :class="{
              first: verdict && !verdict.tie && verdict.first === side.s,
              // On phones, the open one is outlined whenever there are two (in its color when it moves first, neutral on
              // a tie), so a change to its build shows how it goes at once.
              judged: phone && !!verdict,
              tied: phone && verdict?.tie,
              opponent: side.s === 'b',
            }"
          >
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
            <!-- Folded (desktop): its Pokémon in short, opening it when tapped, and what it takes to move first. -->
            <template v-if="isFolded(side.s)">
              <button type="button" class="folded-summary" @click="toggleFold(side.s)">
                <BuildSummary :id="side.id!" :speed="side.speed!" :build="side.build" />
              </button>
              <section v-if="against(side.s)" class="part folded-part">
                <SpeedAgainst :title="againstTitle(side.s)" :rows="against(side.s)!" :current="side.build.effect" />
              </section>
            </template>
            <!-- Confirm at its end folds it: under its tab on phones, to its short form wider. -->
            <SpeedEditor
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
              confirmable
              @confirm="confirmSide(side.s)"
              @pick="(id: PokemonId) => pick(side.s, id)"
              @build="(b: Partial<SpeedBuild>) => setBuild(side.s, b)"
              @clear="clear(side.s)"
            >
              <!-- What it takes to move before the other, at each nature effect; on phones, under the two instead. -->
              <section v-if="!phone && against(side.s)" class="part">
                <SpeedAgainst :title="againstTitle(side.s)" :rows="against(side.s)!" :current="side.build.effect" />
              </section>
            </SpeedEditor>
          </section>
          <!-- Under its panel, a second for its team, greyed out until its first is picked; on phones, under its tab
             instead. -->
          <SpeedAddSecond
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
      <div v-if="phone && verdict" class="insights">
        <section
          v-for="side in sides"
          :key="side.s"
          class="panel insight"
          :class="{ opponent: side.s === 'b', open: openKey === side.s }"
        >
          <SpeedAgainst :title="againstTitle(side.s)" :rows="against(side.s)!" :current="side.build.effect" banded />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.top {
  margin-bottom: 12px;
}
/* The heading: the arrow and the title, what's set beside it while folded (under it on phones). */
.head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: 'title active';
  align-items: center;
  gap: 4px 12px;
  list-style: none;
  cursor: pointer;
}
.head::-webkit-details-marker {
  display: none;
}
.head h1 {
  grid-area: title;
  display: flex;
  align-items: center;
  margin: 0;
}
.active {
  grid-area: active;
  --gap: 4px;
}
/* Beside the heading, centered on it by its chips, not the room under them for their shadows. */
@media (min-width: 721px) {
  .active {
    margin-bottom: -4px;
  }
}
.active .item {
  flex: none;
  padding: 1px 6px;
  font-size: 0.85em;
  white-space: nowrap;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
}
.active .item.option {
  font-weight: bold;
  background: var(--sel);
  border-color: var(--ink);
}
/* It opens and closes at once, without the slide and fade collapsible sections have (main.css); its heading takes
   taps as taps. */
.instant::details-content,
.instant > summary {
  transition: none;
}
.instant > summary {
  touch-action: manipulation;
  user-select: none;
}
.fold-body {
  padding-top: 8px;
}
.marker {
  display: inline-block;
  width: 0.85em;
  font-size: 1.15em;
  line-height: 1;
}
/* The intro's line: the intro, then the toggle for how to read the page, a link rather than a control. */
/* How to read the page: beside the intro; on phones, beside the heading instead. */
.head .head-help {
  display: none;
}
.lede {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin: 0 0 12px;
}
/* How to read the page, in a well between the intro and the controls. */
.help-body {
  margin: 0 0 12px;
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
.phone-only-block {
  display: none;
}
@media (max-width: 720px) {
  .head {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'title' 'active';
  }
  .phone-only-block {
    display: block;
  }
  .wide-only,
  .lede {
    display: none;
  }
  .head .head-help {
    display: inline-flex;
  }
  .help-options {
    grid-template-columns: 1fr;
  }
  .help-options dd {
    margin-bottom: 4px;
  }
  /* Nothing to say until there are two. */
  .verdict.empty {
    display: none;
  }
}
.controls,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.actions > .btn {
  gap: 6px;
}
.top .controls {
  margin-bottom: 0;
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
.verdict-speeds {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
.insight {
  --side: var(--accent);
  --side-text: var(--accent-text);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
.insight.opponent {
  --side: var(--opponent);
  --side-text: var(--opponent-text);
}
.band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: bold;
}
/* The one that moves first, marked by its outline: blue for yours, the opponents' red for an opponent; on a tie,
   neither. On phones, the open one has its outline whenever there are two, neutral on a tie and see-through while it
   moves after, so it's only its color that changes. */
.side.first,
.side.judged {
  outline: 3px solid transparent;
  outline-offset: 2px;
}
.side.tied {
  outline-color: var(--muted);
}
.side.first {
  outline-color: var(--accent);
}
.side.first.opponent {
  outline-color: var(--opponent);
}

/* The speed tiers' menu: under its button, over what follows. */
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
.folded-part {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
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
