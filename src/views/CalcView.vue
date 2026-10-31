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
import { decodeField, decodeFighter, encodeField, encodeFighter, readLast, saveLast } from '@/lib/calcState'
import {
  abilityOf,
  battlerOf,
  commonSet,
  emptyField,
  emptyFighter,
  SETS_FIELD,
  type Battlefield,
  type Fighter,
} from '@/lib/damage'
import { membersPaste, parsePaste } from '@/lib/pokepaste'
import { copy } from '@/lib/clipboard'
import { commonForme } from '@/lib/commonSet'
import { emptyMember, pickedAs, setsAs, stoneMega, type Field, type Member } from '@/lib/team'
import { conditionName, fieldOf, terrainOf, weatherOf } from '@/components/calcConditions'
import CalcConditions from '@/components/CalcConditions.vue'
import CalcMeta from '@/components/CalcMeta.vue'
import CalcSide from '@/components/CalcSide.vue'
import CalcSummary from '@/components/CalcSummary.vue'
import CalcVerdict from '@/components/CalcVerdict.vue'
import CommonSetOffer from '@/components/CommonSetOffer.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import ModalDialog from '@/components/ModalDialog.vue'
import OptionsMenu from '@/components/OptionsMenu.vue'
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
// used (`CalcMeta`), a row tapped making it the opponent. Everything is in the URL, a calc a link to share
// (`calcState.ts`), and the page opened bare comes back as last left; the first time, the meta's two most used.
const route = useRoute()
const router = useRouter()
const { snapshot, data } = useMeta()
const { teams } = useTeams()
const wide = useMediaQuery('(min-width: 900px)')
// Its sections, a row of links stuck to the top, the one being read marked: the field, the two sides' damage, and
// yours against the meta once there's yours. On phones the sides' tabs stick under it (`--nav-h`, its height).
const sections = computed(() => [
  { id: 'calc-top', label: t('calc.section.field') },
  { id: 'calc-duel', label: t('calc.section.damage') },
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
  barStuck.value = !!el && window.scrollY > 0 && el.getBoundingClientRect().top <= navH.value + 0.5
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

// Its setup: the URL's, else as last left; with neither, the meta's two most used once the meta is in.
const fromUrl = route.query.a || route.query.b || route.query.f ? route.query : null
const start = fromUrl ?? readLast()
sides.value = {
  a: decodeFighter(start.a) ?? emptyFighter(),
  b: decodeFighter(start.b) ?? emptyFighter(),
}
field.value = decodeField(start.f)
let seeded = !!(start.a || start.b)
// On phones, the side shown under the tabs: yours at first, none once the open one is folded.
const openSide = shallowRef<SideKey | null>('a')
const tabs = useTemplateRef<HTMLElement>('tabs')
const { height: tabsH } = useElementSize(tabs, undefined, { box: 'border-box' })
/** A tab's band tapped: its side opened under the tabs, its top brought into view, or folded if it was. */
function foldTab(k: SideKey) {
  openSide.value = openSide.value === k ? null : k
  if (openSide.value) void nextTick(() => document.getElementById(`calc-${k}`)?.scrollIntoView({ block: 'start' }))
}
/** A tab's Pokémon tapped: its side opened and its top brought into view; with none yet, its picker straight away. */
function goTab(k: SideKey) {
  openSide.value = k
  if (!battlerOf(sides.value[k])) {
    picking.value = { side: k, field: 'pokemon' }
    return
  }
  void nextTick(() => document.getElementById(`calc-${k}`)?.scrollIntoView({ block: 'start' }))
}
watch(
  data,
  (d) => {
    if (seeded || !d) return
    seeded = true
    const top = (Object.keys(d) as PokemonId[])
      .filter((id) => POKEMON[id] && d[id]?.usage)
      .sort((x, y) => d[y]!.usage! - d[x]!.usage!)
    if (top.length >= 2) {
      sides.value = { a: commonSet(top[0]!, d), b: commonSet(top[1]!, d) }
    }
  },
  { immediate: true },
)
// Into the URL and remembered, once the edits pause (a slider dragged writes it once).
const query = computed(() => ({
  a: encodeFighter(sides.value.a) || undefined,
  b: encodeFighter(sides.value.b) || undefined,
  f: encodeField(field.value) || undefined,
}))
watchDebounced(
  query,
  (q) => {
    saveLast(q)
    const next = { ...route.query, ...q }
    for (const k of ['a', 'b', 'f'] as const) if (!q[k]) delete next[k]
    void router.replace({ query: next })
  },
  { debounce: 250, immediate: true },
)

const setSide = (k: SideKey, f: Fighter) => (sides.value = { ...sides.value, [k]: f })
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
// right after a Pokémon's picked, the meta's entry whose most common set can be loaded instead of going on (`common`).
const picking = shallowRef<{ side: SideKey; field: Field; common?: PokemonId } | null>(null)
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

/** The next part a side hasn't got, in the order a set is put together; null once it has them all. */
function nextField(m: Member, after: Field): Field | null {
  const order: Field[] = ['pokemon', 'item', 'ability', 'nature', 0, 1, 2, 3]
  for (const f of order.slice(order.indexOf(after) + 1)) {
    if (typeof f === 'number' ? !m.moves[f] : !m[f]) return f
  }
  return null
}

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
  setSide(k, { ...emptyFighter(member), side: sides.value[k].side })
}
/** The set being put together skipped: the most common set loaded, the picker closed. */
function loadCommon() {
  const p = picking.value
  if (!p?.common) return
  setSide(p.side, { ...commonSet(p.common, data.value), side: sides.value[p.side].side })
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
  else if (p.field === 'nature') patchMember(p.side, { nature: value })
  else {
    const moves = [...m.moves]
    const was = moves.indexOf(value as MoveId)
    if (was >= 0) moves[was] = moves[p.field]!
    moves[p.field] = value as MoveId
    patchMember(p.side, { moves })
  }
  const now = sides.value[p.side].member
  const next = nextField(now, p.field)
  picking.value = next === null ? null : { side: p.side, field: next, ...(common && { common }) }
}

// Loading a side: its common set, one of the reader's teams' Pokémon, or a paste.
function common(k: SideKey) {
  const id = sides.value[k].member.pokemon
  if (!id) return
  const forme = sides.value[k].mega ? setsAs(sides.value[k].member)! : id
  setSide(k, { ...commonSet(forme, data.value), side: sides.value[k].side })
}
const savedTeams = computed(() => teams.value.filter((tm) => tm.members.some((m) => m.pokemon)))
function fromTeam(k: SideKey, m: Member) {
  setSide(k, { ...emptyFighter(JSON.parse(JSON.stringify(m)) as Member), side: sides.value[k].side })
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
function importPaste() {
  const k = pasting.value
  const first = parsePaste(pasted.value).members[0]
  if (!k || !first) return void (pasteFailed.value = true)
  fromTeam(k, first)
  pasteFrom = null
  pasting.value = null
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
  setSide('b', { ...f, side: sides.value.b.side })
  openSide.value = 'b'
  void nextTick(() => document.getElementById('calc-b')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
</script>

<template>
  <div class="calc" :style="{ '--nav-h': `${navH}px`, '--bar-h': `${barH}px`, '--tabs-h': `${tabsH}px` }">
    <!-- Reset all, on the row of the way back to Tools, as on the speed pages (the app's frame has a place for it there). -->
    <Teleport to="#back-actions-calc" defer>
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
    <!-- The field's conditions, a bar on the page (no panel) stuck under the row of links as the page scrolls, so
         they're at hand beside the sides. -->
    <div ref="bar" class="field-bar" :class="{ stuck: barStuck }">
      <!-- One row, sliding sideways where it doesn't fit: the toggle, and those on named while folded. -->
      <ScrollRow class="toolbar">
        <button
          type="button"
          class="btn"
          :class="{ on: fieldOpen }"
          :aria-expanded="fieldOpen"
          aria-controls="calc-field"
          @click="fieldOpen = !fieldOpen"
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
      <div v-if="fieldOpen" id="calc-field" class="field-conditions">
        <CalcConditions :field :data @field="field = $event" />
      </div>
    </div>

    <!-- On phones, the two side by side as tabs, as the speed comparison's: each its side's color over its Pokémon in
         short, stuck to the top under the field's bar the whole page down. Its band, with its arrow, opens its panel
         under them or folds it; its Pokémon opens it and goes to its top (one with none picks it). -->
    <div v-if="!wide" ref="tabs" class="side-tabs">
      <div v-for="k in ['a', 'b'] as const" :key="k" class="tab" :class="{ open: openSide === k, theirs: k === 'b' }">
        <button
          type="button"
          class="tab-label"
          :disabled="!battlerOf(sides[k])"
          :aria-expanded="battlerOf(sides[k]) ? openSide === k : undefined"
          :aria-controls="`calc-${k}`"
          @click="foldTab(k)"
        >
          {{ labels[k]
          }}<ChevronDown :size="16" class="tab-chevron" :class="{ unset: !battlerOf(sides[k]) }" aria-hidden="true" />
        </button>
        <button type="button" class="tab-body" :aria-controls="`calc-${k}`" @click="goTab(k)">
          <CalcSummary v-if="battlerOf(sides[k])" :fighter="sides[k]" class="tab-summary" />
          <span v-else class="tab-empty"><Plus :size="16" aria-hidden="true" />{{ t('compare.pick') }}</span>
        </button>
      </div>
    </div>
    <div id="calc-duel" class="duel" :class="{ aligned: hasBoth, stacked: !wide }">
      <!-- On phones, the one opened slides in a touch from its tab's side; the one leaving goes at once. -->
      <template v-for="k in ['a', 'b'] as const" :key="k">
        <Transition :name="k === 'a' ? 'from-left' : 'from-right'">
          <CalcSide
            :id="`calc-${k}`"
            :ref="(el) => setSideEl(k, el)"
            :fighter="sides[k]"
            :other="sides[k === 'a' ? 'b' : 'a']"
            :field
            :theirs="k === 'b'"
            :label="labels[k]"
            :active="picking?.side === k ? picking.field : null"
            :spreads="spreadsOf(sides[k])"
            v-show="wide || openSide === k"
            :class="`side-${k}`"
            @update:fighter="setSide(k, $event)"
            @field="picking = { side: k, field: $event }"
            @clear="setSide(k, { ...emptyFighter(), side: sides[k].side })"
            :data
            :side-open="sideOpen"
            @side-open="sideOpen = $event"
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
              <!-- What a side can do with its set, in one menu: load one (its common set, a paste, a Pokémon of the
                 reader's teams), copy it, swap the two sides, clear it. -->
              <OptionsMenu :title="t('calc.setMenu')" :icon="Ellipsis" :on-band="wide">
                <template #default="{ close }">
                  <div class="load">
                    <button
                      type="button"
                      class="load-row"
                      :disabled="!sides[k].member.pokemon || !data"
                      @click="(common(k), close())"
                    >
                      <Sparkles :size="14" aria-hidden="true" />{{ t('calc.commonSet') }}
                    </button>
                    <button type="button" class="load-row" @click="((pasting = k), close())">
                      <ClipboardPaste :size="14" aria-hidden="true" />{{ t('calc.paste') }}
                    </button>
                    <button
                      type="button"
                      class="load-row"
                      :class="{ copied: copiedSide === k }"
                      :disabled="!sides[k].member.pokemon"
                      @click="copySet(k)"
                    >
                      <component :is="copiedSide === k ? Check : ClipboardCopy" :size="14" aria-hidden="true" />{{
                        copiedSide === k ? t('tournaments.pasteCopied') : t('calc.copySet')
                      }}
                    </button>
                    <button type="button" class="load-row" :disabled="!hasAny" @click="(swap(), close())">
                      <ArrowLeftRight :size="14" aria-hidden="true" />{{ t('calc.swap') }}
                    </button>
                    <button
                      type="button"
                      class="load-row"
                      :disabled="!sides[k].member.pokemon"
                      @click="(setSide(k, { ...emptyFighter(), side: sides[k].side }), close())"
                    >
                      <X :size="14" aria-hidden="true" />{{ t('calc.clearSide') }}
                    </button>
                    <template v-if="savedTeams.length">
                      <span class="muted load-label">{{ t('calc.fromTeams') }}</span>
                      <ReuseTeams :side="k" :done="close" />
                    </template>
                  </div>
                </template>
              </OptionsMenu>
            </template>
          </CalcSide>
        </Transition>
      </template>
    </div>

    <CalcVerdict :a="sides.a" :b="sides.b" :field />

    <CalcMeta v-if="battlerOf(sides.a)" id="calc-meta" :yours="sides.a" :field :data @pick="face" />

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
              @click="(fromTeam(side, m), done())"
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
        @pick="pick"
        @close="picking = null"
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
          @pick="pick"
          @close="picking = null"
          ><ReuseCommon
        /></TeamPicker>
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
/* The sides, who moves first and yours against the meta set well apart, more on phones, where they'd run together. */
.calc > .verdict,
.calc > #calc-meta {
  margin-top: 16px;
}
@media (max-width: 899px) {
  .calc > .verdict,
  .calc > #calc-meta {
    margin-top: 28px;
  }
}
/* The row of links' own gap under it is the page's. */
.calc > .section-nav {
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
/* A row, so its star sits centered on the title's line. */
.head h1 {
  display: flex;
  align-items: center;
  margin: 0;
}
.head-meta {
  margin-left: auto;
}
/* The field's bar: stuck under the row of links, over the sides as they scroll under it; unfolded, scrolling when
   taller than the screen leaves it. */
.field-bar {
  position: sticky;
  top: var(--nav-h, 0px);
  z-index: 41;
  max-height: calc(100dvh - var(--nav-h, 0px) - 12px);
  margin: -8px -6px 0;
  padding: 8px 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--bg);
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
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
    grid-row: span 5;
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
/* On phones, the side opened sliding in a touch from its tab's side, faded in; the one leaving gone at once. Only
   transform and opacity, off the main thread. */
.from-left-enter-active,
.from-right-enter-active {
  transition:
    opacity 0.22s ease-out,
    transform 0.22s ease-out;
}
/* The one leaving hidden from the start of its leaving, not a frame later, so the one coming in is where it stays
   when the page goes to its top. */
.from-left-leave-active,
.from-right-leave-active {
  display: none;
}
.from-left-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.from-right-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
@media (prefers-reduced-motion: reduce) {
  .from-left-enter-active,
  .from-right-enter-active {
    transition: none;
  }
}
/* On phones, the two tabs, as the speed comparison's: each a band of its side's color over its Pokémon in short, side
   by side, stuck under the field's bar on a strip of the page's background. The open one flat, its arrow turned. */
.side-tabs {
  position: sticky;
  top: calc(var(--nav-h, 0px) + var(--bar-h, 0px));
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  /* A few pixels past the column either way, over the outlines and shadows of the panels scrolling under it. */
  margin: -8px -6px -10px;
  padding: 6px 6px 8px;
  background: var(--bg);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  font-weight: bold;
  color: var(--text);
  background: var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard);
  transition: opacity 0.15s ease;
}
/* Its two parts, buttons: the band folding it, its Pokémon going to it. */
.tab-label,
.tab-body {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
  touch-action: manipulation;
}
/* Closed, faded, its band's color paler; open, in full. Both raised, with the hard shadow. */
.tab:not(.open) {
  opacity: 0.6;
}
.tab:not(.open) .tab-label {
  background: color-mix(in srgb, var(--accent) 55%, var(--panel));
}
.tab.theirs:not(.open) .tab-label {
  background: color-mix(in srgb, var(--opponent) 55%, var(--panel));
}
@media (hover: hover) {
  .tab:not(.open):hover {
    opacity: 0.85;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tab {
    transition: none;
  }
}
.tab-label {
  justify-content: space-between;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  color: var(--accent-text);
  background: var(--accent);
  border-bottom: 2px solid var(--ink);
}
.tab-label:disabled {
  cursor: default;
}
.tab.theirs .tab-label {
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
.tab-body > * {
  flex: 1;
  min-width: 0;
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
:root:root .duel.stacked > :deep(section) {
  scroll-margin-top: calc(var(--nav-h, 0px) + var(--bar-h, 0px) + var(--tabs-h, 0px) + 8px);
}
/* The buttons on the sides' bands with no outline: the band's color sets them apart enough, a wash on hover. */
:root:root .duel :deep(.btn.on-band) {
  border-color: transparent;
}
/* The way back to the opponent before, its icon after the arrow. */
.back-to {
  gap: 2px;
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
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
