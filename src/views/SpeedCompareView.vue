<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRight, ChevronsDown, ChevronsUp, Trash2 } from '@lucide/vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { POKEMON } from '@/data/pokemon'
import { has, percent } from '@/data/meta'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { NATURE_EFFECTS, NATURES_BY_EFFECT, natureEffect, speedStat } from '@/lib/speed'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import {
  BUILD_TOGGLES,
  buildQuery,
  buildSpeed,
  pointsText,
  readBuild,
  toggled,
  toMoveFirst,
  type BuildToggle,
  type SpeedBuild,
} from '@/lib/speedBuild'
import { TIERS_PICKS, lastTiersQuery } from '@/lib/tiersState'
import { useMeta } from '@/composables/useMeta'
import AppLink from '@/components/AppLink'
import BuildSummary from '@/components/BuildSummary.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
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
      base: id ? POKEMON[id].stats[5] : null,
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
</script>

<template>
  <div class="compare-page">
    <header class="page-head">
      <h1>{{ t('title.speedCompare') }}</h1>
      <p class="muted">{{ t('compare.intro') }}</p>
    </header>

    <!-- What applies to both: the snapshot the common builds come from, Trick Room, and swapping the sides. -->
    <div class="panel controls">
      <MetaPicker v-if="metaSpeeds" />
      <label class="btn switch" :class="{ on: trickRoom }">
        <input type="checkbox" :checked="trickRoom" @change="replace({ trickroom: trickRoom ? undefined : '1' })" />
        {{ t('speed.mod.trickroom') }}
      </label>
      <span class="muted small">{{ t('compare.trickroomTip') }}</span>
      <button type="button" class="btn swap" :disabled="!sideOf('a').id && !sideOf('b').id" @click="swap">
        <ArrowLeftRight :size="16" aria-hidden="true" />{{ t('compare.swap') }}
      </button>
      <AppLink v-if="sideOf('a').id || sideOf('b').id" :to="ladderLink" class="btn">{{
        t('compare.toLadder')
      }}</AppLink>
    </div>

    <!-- Who moves first, between the two. -->
    <p class="verdict panel" :class="{ tie: verdict?.tie }" role="status">
      <template v-if="!verdict">{{ t('compare.empty') }}</template>
      <template v-else-if="verdict.tie">{{ t('compare.tie') }}</template>
      <template v-else
        ><PokemonIcon :id="sideOf(verdict.first).id!" />{{ t('compare.first', { name: verdict.name }) }}</template
      >
      <span v-if="verdict" class="verdict-speeds"
        >{{ sideOf('a').speed }} <span class="muted">vs</span> {{ sideOf('b').speed }}</span
      >
    </p>

    <div class="sides">
      <section
        v-for="side in sides"
        :key="side.s"
        class="panel banded side"
        :class="{ first: verdict && !verdict.tie && verdict.first === side.s, opponent: side.s === 'b' }"
      >
        <!-- Yours, and its opponent, red as on the speed tiers. On phones, where one is under the other, each stuck to
             the top while its panel is in view, with its Pokémon in short as on the speed tiers' bar. -->
        <div class="band">
          <span class="band-label" :class="{ picked: side.id }">{{
            side.s === 'a' ? t('speed.yours') : t('compare.opponent')
          }}</span>
          <BuildSummary v-if="side.id" :id="side.id" :speed="side.speed!" :build="side.build" class="band-summary" />
          <!-- On phones, its icon alone, leaving the band's room to the summary. -->
          <button
            v-if="side.id"
            type="button"
            class="btn on-band inverted band-clear"
            :aria-label="t('speed.clear')"
            @click="clear(side.s)"
          >
            <Trash2 :size="14" aria-hidden="true" /><span class="clear-text">{{ t('speed.clear') }}</span>
          </button>
        </div>
        <PokemonPicker
          :model-value="side.id"
          :placeholder="t('compare.pick')"
          icon
          class="picker"
          @update:model-value="(id: PokemonId | null) => pick(side.s, id)"
        />
        <template v-if="side.id">
          <!-- Its Speed, large, with what it comes from. -->
          <p class="speed">
            <span class="speed-number">{{ side.speed }}</span>
            <span class="muted small">{{ t('compare.baseStat', { base: side.base!, stat: side.stat! }) }}</span>
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

          <!-- What it takes to move before the other, at each nature effect. -->
          <section v-if="against(side.s)" class="part">
            <strong class="small">{{
              t('compare.against', { name: sideOf(other(side.s)).name!, speed: sideOf(other(side.s)).speed! })
            }}</strong>
            <dl class="versus small">
              <template v-for="v in against(side.s)!" :key="v.effect">
                <dt v-tip="canHover && !!EFFECT_ICONS[v.effect] && t(`speed.effect.${v.effect}`)" class="effect">
                  <template v-if="EFFECT_ICONS[v.effect]"
                    ><component :is="EFFECT_ICONS[v.effect]" :size="14" aria-hidden="true" /><span aria-hidden="true">{{
                      t('stat.spe')
                    }}</span
                    ><span class="visually-hidden">{{ t(`speed.effect.${v.effect}`) }}</span></template
                  >
                  <template v-else>{{ t(`speed.effect.${v.effect}`) }}</template>
                </dt>
                <dd>{{ pointsText(v.result) }}</dd>
              </template>
            </dl>
          </section>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page-head h1 {
  margin: 0;
}
.page-head p {
  margin: 4px 0 12px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.swap {
  gap: 6px;
  margin-left: auto;
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
.verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0 0 12px;
  font-weight: bold;
}
.verdict-speeds {
  margin-left: auto;
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
  .swap {
    margin-left: 0;
  }
}
:root:root .side.opponent > .band {
  color: var(--opponent-text);
  background: var(--opponent);
}
.band-label {
  flex: none;
}
.band-summary {
  display: none;
}
.band > .btn {
  flex: none;
  gap: 4px;
  margin-left: auto;
}
@media (max-width: 720px) {
  :root:root .side > .band {
    position: sticky;
    top: 0;
    z-index: 4;
  }
  .band-summary {
    display: flex;
    overflow: hidden;
  }
  .clear-text {
    display: none;
  }
  /* Once picked, the summary says whose it is, by the band's color: the label gives it the room. */
  .band-label.picked {
    display: none;
  }
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
/* The one that moves first, marked by its outline. */
.side.first {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.picker {
  width: 100%;
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
.versus {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 0;
}
.versus dd {
  margin: 0;
}
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
</style>
