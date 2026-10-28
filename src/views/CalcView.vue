<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createReusableTemplate, useMediaQuery, watchDebounced } from '@vueuse/core'
import {
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Box,
  ChevronDown,
  ClipboardPaste,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Users,
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
import SideDrawer from '@/components/SideDrawer.vue'
import TeamPicker from '@/components/TeamPicker.vue'

// The damage calculator: two Pokémon, yours and the opponent's, each a team builder's slot (`CalcSide`, `TeamSlot`:
// every part a button opening its picker, `TeamPicker`, the meta's searches with their shares) with its moves' damage
// against the other under it, both ways at once, and what the battle adds to each (HP, status, stages); the battle's
// conditions (weather, terrain, what's on the field and on each side) in a dialog, those on the field named across the
// top, with Trick Room at hand; under the two, who moves first and how a one-on-one between them goes (`CalcVerdict`),
// with the ways to the speed pages. On phones, one under the other as the speed comparison's list: each a band of its
// side's color with its Pokémon in short (`CalcSummary`), stuck to the top under the one before it, its panel opening
// under it when tapped, folding when tapped again. The numbers are Smogon's calc's (`@smogon/calc`, its Champions mechanics, doubles), `damage.ts`. A Pokémon picked comes with its most common
// set in the meta shown (its Mega's, when most players run that), so there's a calc to read at once; a side can be
// loaded from the reader's teams, from a paste, or back to its common set. Under them, yours against the meta's most
// used (`CalcMeta`), a row tapped making it the opponent. Everything is in the URL, a calc a link to share
// (`calcState.ts`), and the page opened bare comes back as last left; the first time, the meta's two most used.
const route = useRoute()
const router = useRouter()
const { snapshot, data } = useMeta()
const { teams } = useTeams()
const wide = useMediaQuery('(min-width: 900px)')

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
const toggleSide = (k: SideKey) => {
  openSide.value = openSide.value === k ? null : k
  if (openSide.value) void nextTick(() => document.getElementById(`calc-${k}`)?.scrollIntoView({ block: 'nearest' }))
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
}
function resetAll() {
  sides.value = { a: emptyFighter(), b: emptyFighter() }
  field.value = emptyField()
  picking.value = null
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
watch(pasting, () => {
  pasted.value = ''
  pasteFailed.value = false
})
function importPaste() {
  const k = pasting.value
  const first = parsePaste(pasted.value).members[0]
  if (!k || !first) return void (pasteFailed.value = true)
  fromTeam(k, first)
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
    // Trick Room's toggle beside them says it.
    ...field.value.effects.filter((e) => e !== 'trickRoom').map(fieldOf),
  ].filter((c) => !!c),
)
const trickRoom = computed(() => field.value.effects.includes('trickRoom'))
const toggleTrickRoom = () =>
  (field.value = {
    ...field.value,
    effects: trickRoom.value
      ? field.value.effects.filter((e) => e !== 'trickRoom')
      : [...field.value.effects, 'trickRoom'],
  })
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
function face(f: Fighter) {
  setSide('b', { ...f, side: sides.value.b.side })
  openSide.value = 'b'
  void nextTick(() => document.getElementById('calc-b')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
</script>

<template>
  <div class="calc">
    <section class="panel head-panel">
      <div class="head">
        <h1>{{ t('title.calc') }}</h1>
        <MetaDialog v-if="snapshot" class="head-meta" />
        <button v-if="hasAny" type="button" class="btn small" @click="resetAll">
          <RotateCcw :size="14" aria-hidden="true" />{{ t('calc.reset') }}
        </button>
      </div>
      <!-- The field's conditions: folding under the toggle, Trick Room at hand, and those on named while folded. -->
      <div class="toolbar">
        <div class="options">
          <button
            type="button"
            class="btn"
            :class="{ on: fieldOpen }"
            :aria-expanded="fieldOpen"
            aria-controls="calc-field"
            @click="fieldOpen = !fieldOpen"
          >
            <SlidersHorizontal :size="16" aria-hidden="true" /><span class="long">{{ t('calc.conditions') }}</span
            ><span class="short">{{ t('calc.conditionsShort') }}</span
            ><span class="on-count" :class="{ none: !fieldOn.length }">{{ fieldOn.length }}</span
            ><ChevronDown :size="14" class="fold-chev" :class="{ open: fieldOpen }" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="btn switch"
            :class="{ on: trickRoom }"
            :aria-pressed="trickRoom"
            @click="toggleTrickRoom"
          >
            <Box :size="16" aria-hidden="true" />{{ t('speed.mod.trickroom') }}
          </button>
        </div>
        <ul v-if="fieldOn.length && !fieldOpen" class="field-on" :aria-label="t('calc.fieldOn')">
          <li v-for="c in fieldOn" :key="c!.key">
            <component :is="c!.icon" v-if="c!.icon" :size="14" aria-hidden="true" />{{ conditionName(c!) }}
          </li>
        </ul>
      </div>
      <div v-if="fieldOpen" id="calc-field" class="field-conditions">
        <CalcConditions :field :data @field="field = $event" />
      </div>
    </section>

    <div class="duel" :class="{ aligned: hasBoth, stacked: !wide }">
      <template v-for="k in ['a', 'b'] as const" :key="k">
        <!-- On phones, its band: its side's color, its Pokémon in short, stuck to the top under the one before it;
           tapping it opens its panel under it, tapping it again folds it. -->
        <button
          v-if="!wide"
          type="button"
          class="band"
          :class="{ open: openSide === k, theirs: k === 'b' }"
          :style="{ '--i': k === 'a' ? 0 : 1 }"
          :aria-expanded="openSide === k"
          :aria-controls="`calc-${k}`"
          @click="toggleSide(k)"
        >
          <span class="visually-hidden">{{ labels[k] }}</span>
          <CalcSummary v-if="battlerOf(sides[k])" :fighter="sides[k]" />
          <span v-else class="band-empty">{{ t(k === 'a' ? 'compare.pickYours' : 'compare.pickOpponent') }}</span>
          <ChevronDown :size="16" class="band-chevron" aria-hidden="true" />
        </button>
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
            <OptionsMenu :title="t('calc.load')" :label="t('calc.load')" :icon="Users">
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
                  <template v-if="savedTeams.length">
                    <span class="muted load-label">{{ t('calc.fromTeams') }}</span>
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
                            @click="(fromTeam(k, m), close())"
                          >
                            <PokemonIcon :id="m.pokemon" />
                          </button>
                        </template>
                      </span>
                    </div>
                  </template>
                </div>
              </template>
            </OptionsMenu>
            <button
              v-if="sides[k].member.pokemon"
              v-tip="t('calc.copySetTip')"
              type="button"
              class="btn quiet small"
              :aria-label="t('calc.copySetTip')"
              @click="copySet(k)"
            >
              <component :is="copiedSide === k ? Check : ClipboardCopy" :size="14" aria-hidden="true" />{{
                copiedSide === k ? t('tournaments.pasteCopied') : t('calc.copySet')
              }}
            </button>
            <button
              v-if="k === 'a'"
              v-tip="t('calc.swap')"
              type="button"
              class="btn quiet small"
              :aria-label="t('calc.swap')"
              @click="swap"
            >
              <ArrowLeftRight :size="14" aria-hidden="true" />{{ t('calc.swapShort') }}
            </button>
          </template>
        </CalcSide>
      </template>
    </div>

    <CalcVerdict :a="sides.a" :b="sides.b" :field />

    <CalcMeta v-if="battlerOf(sides.a)" id="calc-meta" :yours="sides.a" :field :data @pick="face" />

    <!-- Right after a Pokémon's picked, its most common set, to load rather than put the set together. -->
    <DefineCommon>
      <CommonSetOffer v-if="commonPreview" :id="picking!.common!" :set="commonPreview.member" @load="loadCommon" />
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
.head-panel {
  margin: 0;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.head h1 {
  margin: 0;
}
.head-meta {
  margin-left: auto;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-top: 14px;
}
.options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn.switch.on {
  background: var(--sel);
}
.field-on {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9em;
  font-weight: bold;
}
.field-on li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.fold-chev {
  transition: transform 0.15s;
}
.fold-chev.open {
  transform: rotate(180deg);
}
.field-conditions {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
/* On phones, the conditions' button in a word, so it and Trick Room share a row. */
.short {
  display: none;
}
@media (max-width: 480px) {
  .long {
    display: none;
  }
  .short {
    display: inline;
  }
}
/* The two sides beside each other, once both have a Pokémon each one's five parts (heading, set, moves, battle, its
   side) on rows the two share, so each part starts level with the other's whatever they hold (before, each as short as
   what it has); one under the other on phones. */
.duel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
.duel > :deep(section) {
  scroll-margin-top: 12px;
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
    row-gap: 18px;
    align-content: start;
  }
}
@media (max-width: 899px) {
  .duel {
    grid-template-columns: minmax(0, 1fr);
  }
}
/* On phones, the two one under the other, as the speed comparison's list: each a band of its side's color, stuck to the
   top under the one before it (their shared lines overlapping), its panel under it lined up with it, its side's color a
   stripe inside its left edge. */
.band {
  --band-h: 44px;
  position: sticky;
  top: calc(var(--i) * (var(--band-h) - 2px));
  z-index: calc(40 - var(--i));
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--band-h);
  min-width: 0;
  padding: 0 10px;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: var(--accent-text);
  background: var(--accent);
  border: 2px solid var(--ink);
  cursor: pointer;
  touch-action: manipulation;
}
.band.theirs {
  color: var(--opponent-text);
  background: var(--opponent);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.band-empty {
  flex: 1;
  font-weight: normal;
  opacity: 0.85;
}
.band-chevron {
  flex: none;
  margin-left: auto;
  transition: transform 0.15s;
}
.band.open .band-chevron {
  transform: rotate(180deg);
}
:root:root .duel.stacked > :deep(section) {
  margin-top: -2px;
  padding-left: calc(var(--panel-pad, 12px) + 4px);
  border: 2px solid var(--ink);
  box-shadow: inset 6px 0 var(--side);
  scroll-margin-top: calc(2 * 42px);
}
.duel.stacked > .band + .band,
.duel.stacked > section + .band {
  margin-top: -2px;
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
