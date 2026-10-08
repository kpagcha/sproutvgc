<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, ChevronDown, ChevronsDown, ChevronsUp, RotateCcw, Trash2 } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { currentSnapshots, distinctLabel, has, percent, usageRanks } from '@/data/meta'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { NATURE_EFFECTS, NATURES_BY_EFFECT, natureEffect, speedStat } from '@/lib/speed'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import {
  BUILD_TOGGLES,
  buildQuery,
  buildSpeed,
  readBuild,
  toggled,
  toMoveFirst,
  type BuildToggle,
  type SpeedBuild,
} from '@/lib/speedBuild'
import { TIERS_PICKS, lastTiersQuery } from '@/lib/tiersState'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import AppLink from '@/components/AppLink'
import BuildSummary from '@/components/BuildSummary.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
import SetupStar from '@/components/SetupStar.vue'
import SpeedAgainst from '@/components/SpeedAgainst.vue'
import HelpToggle from '@/components/HelpToggle.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// Yours and an opponent's Speeds side by side, each with a build of its own (its nature's effect, its stat points, its
// modifiers): which moves first, and the points each needs to move before the other. Everything in the URL, each side
// under its letter (`a`, `b`, and `anat`, `apts`, `amods`, `astage`…), with `trickroom`; the speed tiers link here with
// yours and the Pokémon it's measured against, and back with either as yours.
const route = useRoute()
const router = useRouter()
const replace = (q: Record<string, string | undefined>) => void router.replace({ query: { ...route.query, ...q } })

const { snapshot, data } = useMeta()
const metaSpeeds = computed(() => !!snapshot.value && has(snapshot.value, 'speeds'))
/** Usage ranks, for the pickers to list by, most used first. */
const ranks = computed(() => (data.value ? usageRanks(data.value) : undefined))

const SIDES = ['a', 'b'] as const
type Side = (typeof SIDES)[number]
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a')

const idOf = (s: Side) => {
  const id = route.query[s]
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
}
const trickRoom = computed(() => route.query.trickroom === '1')

const sides = computed(() =>
  SIDES.map((s) => {
    const id = idOf(s)
    const build = readBuild(route.query, s)
    return {
      s,
      id,
      build,
      name: id ? refName(pokemon(id)) : null,
      stat: id ? speedStat(POKEMON[id].stats[5], build.points, build.effect) : null,
      speed: id ? buildSpeed(id, build) : null,
    }
  }),
)
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

// On phones, the two side by side as tabs, each with its Pokémon in short: tapping one opens its panel under them,
// tapping it again folds it, both folded leaving what each takes to move first in view, under them. At first, the
// first one without a Pokémon is open, to pick it; with both picked, neither.
const phoneQuery = window.matchMedia('(max-width: 720px)')
const phone = ref(phoneQuery.matches)
const onPhone = (e: MediaQueryListEvent) => (phone.value = e.matches)
phoneQuery.addEventListener('change', onPhone)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhone))
const openSide = ref<Side | null>(SIDES.find((s) => !idOf(s)) ?? null)
// A side with none picked goes straight to picking it, its panel opening once it's picked (`pick`).
const pickers: Partial<Record<Side, InstanceType<typeof PokemonPicker>>> = {}
function toggleSide(s: Side) {
  if (!sideOf(s).id) return pickers[s]?.open()
  openSide.value = openSide.value === s ? null : s
}

/** A Pokémon's builds in the meta, by nature effect and points (what Speed cares about), the most common first. */
function commonBuilds(id: PokemonId) {
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

function setBuild(s: Side, b: Partial<SpeedBuild>) {
  replace(buildQuery({ ...sideOf(s).build, ...b }, s))
}
/** Picks a side's Pokémon at the meta's most common build of it, else the fastest; its modifiers stay. */
function pick(s: Side, id: PokemonId | null) {
  if (!id) return
  if (phone.value) openSide.value = s
  const top = commonBuilds(id)[0]
  replace({
    [s]: id,
    ...buildQuery({ ...sideOf(s).build, effect: top?.effect ?? 'up', points: top?.points ?? MAX_POINTS }, s),
  })
}
function clear(s: Side) {
  replace({
    [s]: undefined,
    [`${s}nat`]: undefined,
    [`${s}pts`]: undefined,
    [`${s}mods`]: undefined,
    [`${s}stage`]: undefined,
  })
}
function swap() {
  const q: Record<string, string | undefined> = {}
  for (const s of SIDES) {
    const from = other(s)
    for (const k of ['', 'nat', 'pts', 'mods', 'stage']) {
      const v = route.query[`${from}${k}`]
      q[`${s}${k}`] = typeof v === 'string' ? v : undefined
    }
  }
  replace(q)
}
const setPoints = (s: Side, v: string) => {
  const n = Math.round(Number(v))
  if (Number.isFinite(n)) setBuild(s, { points: Math.min(MAX_POINTS, Math.max(0, n)) })
}
const toggle = (s: Side, k: BuildToggle) => setBuild(s, { toggles: toggled(sideOf(s).build.toggles, k) })

/**
 * The speed tiers as they were left, with yours as yours and the opponent found on the ladder (what was picked there
 * before giving way to them), and Trick Room as here.
 */
const ladderLink = computed(() => {
  const q = { ...lastTiersQuery.value }
  for (const k of TIERS_PICKS) delete q[k]
  const me = sideOf('a')
  const them = sideOf('b')
  const b = me.build
  return {
    name: 'speedTiers',
    query: {
      ...(q as Record<string, string>),
      ...(me.id && {
        mine: me.id,
        mynat: b.effect,
        mypts: String(b.points),
        mymods: b.toggles.length ? b.toggles.join(',') : undefined,
        // The speed tiers have fewer stages: one beyond them is left out.
        mystage: [-1, 1, 2].includes(b.stage) ? String(b.stage) : undefined,
      }),
      find: them.id ?? undefined,
      trickroom: trickRoom.value ? '1' : undefined,
    },
  }
})

const STAGES = ['-2', '-1', '0', '1', '2'] as const
const stageLabel = (s: string) => (Number(s) > 0 ? `+${s}` : s.replace('-', '−'))
const MOD_ITEMS: Partial<Record<BuildToggle, 'choicescarf' | 'ironball'>> = {
  scarf: 'choicescarf',
  ironball: 'ironball',
}
/** The nature effects' choice shows them as arrows beside "Spe", up and down, neutral as a word. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
const naturesOf = (e: NatureEffect) =>
  e === 'neutral' ? t('speed.naturesNeutral') : NATURES_BY_EFFECT[e].map(natureName).join(', ')
const canHover = window.matchMedia('(hover: hover)').matches

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
// In two kinds, as the speed tiers': the options on first, then what's shown (the data).
const active = computed(() => {
  const list: { label: string; kind: 'view' | 'option' }[] = []
  if (trickRoom.value) list.push({ label: t('speed.mod.trickroom'), kind: 'option' })
  if (snapshot.value && metaSpeeds.value && currentSnapshots().length > 1)
    list.push({ label: distinctLabel(snapshot.value), kind: 'view' })
  return list
})
const anyPicked = computed(() => !!sideOf('a').id || !!sideOf('b').id)
// Everything back as the page comes with nothing set, as the speed tiers' Reset all: its whole URL cleared (the two,
// their builds, Trick Room), and on phones yours' panel open to pick it.
const allChanged = computed(() => Object.keys(route.query).length > 0)
function resetAll() {
  openSide.value = 'a'
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
    <!-- The heading, the intro and how to read the page, and what applies to both sides (the snapshot the common
         builds come from, Trick Room): a panel folding away as the speed tiers' top one does, what's set said in short
         beside the heading while folded. Its heading opens and closes it itself, so the arrow and what's said change at
         once. -->
    <details class="panel instant top" :open="controlsOpen" @toggle="controlsOpen = isOpen($event)">
      <summary class="head" @click.prevent="toggleControls">
        <!-- Its star saves the two and their builds to the favorites. -->
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
          <span class="muted wide-only">{{ t('compare.intro') }}</span>
          <HelpToggle :open="helpOpen" controls="compare-help" @toggle="toggleHelp" />
        </p>
        <!-- How to read it: the formula and what each part says; on phones, the intro too. -->
        <div v-if="helpOpen" id="compare-help" class="help-body panel sunken small">
          <p class="muted phone-only-block">{{ t('compare.intro') }}</p>
          <p class="formula muted">{{ t('speed.formula') }}</p>
          <dl class="help-options">
            <dt>{{ t('compare.common') }}</dt>
            <dd class="muted">{{ t('compare.helpCommon') }}</dd>
            <dt>{{ t('compare.helpAgainstLabel') }}</dt>
            <dd class="muted">{{ t('compare.helpAgainst') }}</dd>
            <dt>{{ t('speed.mod.trickroom') }}</dt>
            <dd class="muted">{{ t('compare.trickroomTip') }}</dd>
          </dl>
        </div>
        <div class="controls">
          <MetaPicker v-if="metaSpeeds" />
          <label class="btn switch" :class="{ on: trickRoom }">
            <input type="checkbox" :checked="trickRoom" @change="replace({ trickroom: trickRoom ? undefined : '1' })" />
            {{ t('speed.mod.trickroom') }}
          </label>
          <span class="muted small wide-only">{{ t('compare.trickroomTip') }}</span>
        </div>
      </div>
    </details>

    <!-- What to do with the two, once there's one: swap them, or see them on the speed tiers. -->
    <div v-if="anyPicked" class="panel actions">
      <button type="button" class="btn" @click="swap">
        <ArrowLeftRight :size="16" aria-hidden="true" />{{ t('compare.swap') }}
      </button>
      <AppLink :to="ladderLink" class="btn">{{ t('compare.toLadder') }}</AppLink>
    </div>

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
          open: openSide === side.s,
          opponent: side.s === 'b',
        }"
        :aria-expanded="side.id ? openSide === side.s : undefined"
        :aria-controls="`compare-${side.s}`"
        @click="toggleSide(side.s)"
      >
        <span class="tab-label"
          >{{ side.s === 'a' ? t('speed.yours') : t('compare.opponent')
          }}<ChevronDown :size="16" class="tab-chevron" :class="{ unset: !side.id }" aria-hidden="true"
        /></span>
        <BuildSummary v-if="side.id" :id="side.id" :speed="side.speed!" :build="side.build" class="tab-summary" />
        <span v-else class="tab-empty">{{ t('compare.pick') }}</span>
      </button>
    </div>

    <div class="sides">
      <section
        v-for="side in sides"
        v-show="!phone || openSide === side.s"
        :id="`compare-${side.s}`"
        :key="side.s"
        class="panel banded side"
        :class="{
          first: verdict && !verdict.tie && verdict.first === side.s,
          // On phones, the open one is outlined whenever there are two (in its color when it moves first, neutral on a
          // tie), so a change to its build shows how it goes at once.
          judged: phone && !!verdict,
          tied: phone && verdict?.tie,
          opponent: side.s === 'b',
        }"
      >
        <!-- Yours, and its opponent, red as on the speed tiers; on phones, its tab stands for it. -->
        <div v-if="!phone" class="band">
          <span>{{ side.s === 'a' ? t('speed.yours') : t('compare.opponent') }}</span>
          <button v-if="side.id" type="button" class="btn on-band inverted" @click="clear(side.s)">
            <Trash2 :size="14" aria-hidden="true" />{{ t('speed.clear') }}
          </button>
        </div>
        <!-- On phones, its Clear beside it, with no band to hold it. -->
        <div class="pick-row">
          <PokemonPicker
            :ref="(el) => (pickers[side.s] = (el as InstanceType<typeof PokemonPicker> | null) ?? undefined)"
            :model-value="side.id"
            :placeholder="t('compare.pick')"
            :title="side.s === 'a' ? t('speed.yours') : t('compare.opponent')"
            :tone="side.s === 'a' ? 'yours' : 'opponent'"
            icon
            speed
            :ranks
            class="picker"
            @update:model-value="(id: PokemonId | null) => pick(side.s, id)"
          />
          <button v-if="phone && side.id" type="button" class="btn pick-clear" @click="clear(side.s)">
            <Trash2 :size="14" aria-hidden="true" />{{ t('speed.clear') }}
          </button>
        </div>
        <template v-if="side.id">
          <!-- Its Speed, large, with its stat as built when modifiers change it (its base is the dex's). -->
          <p class="speed">
            <span class="speed-number">{{ side.speed }}</span>
            <span v-if="side.stat !== side.speed" class="muted small">{{
              t('compare.stat', { stat: side.stat! })
            }}</span>
          </p>

          <!-- The meta's builds of it, to pick one in a tap. -->
          <section v-if="commonBuilds(side.id).length" class="part">
            <span class="muted small">{{ t('compare.common') }}</span>
            <!-- On one line, scrolling sideways when they don't fit; on phones, wrapping. -->
            <ScrollRow wrap-on-phones class="builds">
              <button
                v-for="b in commonBuilds(side.id)"
                :key="`${b.effect}:${b.points}`"
                type="button"
                class="btn mod"
                :class="{ on: side.build.effect === b.effect && side.build.points === b.points }"
                @click="setBuild(side.s, { effect: b.effect, points: b.points })"
              >
                <component :is="EFFECT_ICONS[b.effect]" v-if="EFFECT_ICONS[b.effect]" :size="14" aria-hidden="true" />{{
                  t('speed.points', { n: b.points })
                }}
                <span class="muted">{{ percent(b.share) }}</span>
              </button>
            </ScrollRow>
          </section>

          <section class="part">
            <SegmentedControl
              class="stacked"
              :model-value="side.build.effect"
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
              @update:model-value="(v: string) => setBuild(side.s, { effect: v as NatureEffect })"
            />
            <p class="muted small">{{ naturesOf(side.build.effect) }}</p>
          </section>

          <section class="part">
            <label class="field">
              <span class="muted small">{{ t('speed.pointsLabel') }}</span>
              <span class="points">
                <input
                  type="range"
                  min="0"
                  :max="MAX_POINTS"
                  :value="side.build.points"
                  @input="setPoints(side.s, ($event.target as HTMLInputElement).value)"
                />
                <input
                  type="number"
                  class="points-box"
                  min="0"
                  :max="MAX_POINTS"
                  :value="side.build.points"
                  @change="setPoints(side.s, ($event.target as HTMLInputElement).value)"
                />
              </span>
            </label>
          </section>

          <section class="part">
            <span class="muted small">{{ t('speed.modifiers') }}</span>
            <div class="mods">
              <button
                v-for="k in BUILD_TOGGLES"
                :key="k"
                v-tip="canHover && t(`speed.modTip.${k}`)"
                type="button"
                class="btn mod"
                :class="{ on: side.build.toggles.includes(k) }"
                :aria-pressed="side.build.toggles.includes(k)"
                @click="toggle(side.s, k)"
              >
                <ItemIcon v-if="MOD_ITEMS[k]" :id="MOD_ITEMS[k]!" :scale="0.75" class="mod-item" />{{
                  t(`speed.mod.${k}`)
                }}
              </button>
            </div>
            <SegmentedControl
              class="stacked"
              :model-value="String(side.build.stage)"
              :label="t('speed.stage')"
              :options="STAGES.map((s) => ({ value: s, label: stageLabel(s) }))"
              @update:model-value="(v: string) => setBuild(side.s, { stage: Number(v) })"
            />
          </section>

          <!-- What it takes to move before the other, at each nature effect; on phones, under the two instead. -->
          <section v-if="!phone && against(side.s)" class="part">
            <SpeedAgainst :title="againstTitle(side.s)" :rows="against(side.s)!" :current="side.build.effect" />
          </section>
        </template>
      </section>
    </div>

    <!-- On phones, what each takes to move first, side by side under the two (and the panel open, if one is). -->
    <div v-if="phone && verdict" class="insights">
      <section
        v-for="side in sides"
        :key="side.s"
        class="panel insight"
        :class="{ opponent: side.s === 'b', open: openSide === side.s }"
      >
        <SpeedAgainst :title="againstTitle(side.s)" :rows="against(side.s)!" :current="side.build.effect" banded />
      </section>
    </div>
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
.pick-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.pick-row > .picker {
  flex: 1;
  min-width: 0;
}
.pick-clear {
  flex: none;
  gap: 4px;
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
.part > .builds {
  align-self: stretch;
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

.speed {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 10px 0 0;
}
.speed-number {
  font-size: 2em;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
/* Each part under a line, a label above what it labels. */
.part {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.part > p {
  margin: 0;
}
.stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.stacked :deep(.segments label) {
  white-space: nowrap;
}
.mods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mod {
  min-height: 0;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.875em;
  line-height: inherit;
}
.mod.on {
  background: var(--sel);
}
.mod-item {
  margin-block: -2px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
}
.points {
  display: flex;
  align-items: center;
  gap: 10px;
}
.points input[type='range'] {
  flex: 1;
  min-width: 0;
}
.points-box {
  width: 4em;
  font: inherit;
}
</style>
