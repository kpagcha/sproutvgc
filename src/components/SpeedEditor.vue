<script setup lang="ts">
import { computed, useTemplateRef, type Component } from 'vue'
import { ChevronsDown, ChevronsUp, Trash2, Wind, Zap } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { POKEMON } from '@/data/pokemon'
import type { Ranks } from '@/composables/usePokemonSearch'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { NATURE_EFFECTS, NATURES_BY_EFFECT } from '@/lib/speed'
import { benchmark, MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { modButtons, toggled, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import ItemIcon from '@/components/ItemIcon.vue'
import PointsBar from '@/components/PointsBar.vue'
import PokemonPicker from '@/components/PokemonPicker.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import StageStepper from '@/components/StageStepper.vue'

// One of the comparison's Pokémon and its Speed build, to change (its buttons as the speed tiers' yours has them):
// the Pokémon, with Clear beside it, its Speed, the
// meta's common builds of it, its nature's effect, its points, its modifiers and its stage; where it folds away
// (`confirmable`), Confirm at its end, folding it as it is. In a side's panel, and under its band in the comparison's
// list. Where it can be at its sets (`atSets` given), the first of the common builds is "Every set": on, its Speed is
// its sets' range, and its nature and points are theirs, their controls giving way to a note.
const props = defineProps<{
  id: PokemonId | null
  build: SpeedBuild
  speed: number | null
  /** Its stat as built, before modifiers. */
  stat: number | null
  /** The meta's most common builds of it. */
  common: readonly { effect: NatureEffect; points: number; share: number }[]
  /** What it's picked for, on the picking dialog's band on phones, and its color there. */
  title: string
  tone?: 'yours' | 'opponent'
  /** The picker's text while none is picked: who it's picking. */
  placeholder?: string
  confirmable?: boolean
  /** Pokémon already on its team, which it can't be (nor one of their species). */
  taken?: readonly PokemonId[]
  /** The meta's usage ranks, for its picker to list by. */
  ranks?: Ranks
  /** Whether it's at its sets, where it can be; and then, its Speeds from the slowest to the fastest. */
  atSets?: boolean
  range?: readonly [number, number] | null
}>()
const emit = defineEmits<{
  pick: [id: PokemonId]
  build: [b: Partial<SpeedBuild>]
  sets: [on: boolean]
  clear: []
  confirm: []
}>()
const sets = computed(() => !!props.atSets && !!props.range)
/** Its Speed with no stat points and a neutral nature: a stat, as the game has it, rather than its base. */
const uninvested = computed(() => (props.id ? benchmark(POKEMON[props.id].stats[5], 'none') : 0))

const picker = useTemplateRef<InstanceType<typeof PokemonPicker>>('picker')
// A page can open the picking straight away (a slot just added, or tapped with none picked).
defineExpose({ openPicker: () => picker.value?.open() })

const toggle = (k: BuildToggle) => emit('build', { toggles: toggled(props.build.toggles, k) })

/** The Speed stages its stepper goes through. */
const STAGE_MIN = -6
const STAGE_MAX = 6
/** Its modifiers' buttons: its doubling abilities' by name, only those it can have. */
const mods = computed(() => modButtons(props.id))
/** The nature effects' choice shows them as arrows beside "Spe", up and down, neutral as a word. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
/** The modifiers with no item to show, by an icon: Tailwind's wind, paralysis' bolt. */
const MOD_ICONS: Partial<Record<string, Component>> = { tailwind: Wind, paralysis: Zap }
const naturesOf = (e: NatureEffect) =>
  e === 'neutral' ? t('speed.naturesNeutral') : NATURES_BY_EFFECT[e].map(natureName).join(', ')
const canHover = window.matchMedia('(hover: hover)').matches
</script>

<template>
  <div class="speed-editor">
    <div class="pick-row">
      <PokemonPicker
        ref="picker"
        recent
        :model-value="props.id"
        :placeholder="props.placeholder ?? t('compare.pick')"
        :title="props.title"
        :tone="props.tone"
        :taken="props.taken"
        :ranks="props.ranks"
        icon
        speed
        class="picker"
        @update:model-value="(id: PokemonId | null) => id && emit('pick', id)"
      />
      <button v-if="props.id" type="button" class="btn inverted pick-clear" @click="emit('clear')">
        <Trash2 :size="14" aria-hidden="true" />{{ t('speed.clear') }}
      </button>
    </div>
    <template v-if="props.id">
      <!-- Its Speed, large, with its stat as built when modifiers change it, and its Speed uninvested (no points, a
           neutral nature: a stat, rather than its base). -->
      <p v-if="sets" class="speed">
        <span class="speed-number">{{
          props.range![0] === props.range![1] ? props.range![0] : `${props.range![0]}–${props.range![1]}`
        }}</span>
        <span class="muted small">{{ t('compare.setsRange', { speed: props.speed! }) }}</span>
        <span v-tip="t('speed.benchTip.none')" class="muted small">{{ t('compare.base', { n: uninvested }) }}</span>
      </p>
      <p v-else class="speed">
        <span class="speed-number">{{ props.speed }}</span>
        <span v-if="props.stat !== props.speed" class="muted small">{{
          t('compare.stat', { stat: props.stat! })
        }}</span>
        <span v-tip="t('speed.benchTip.none')" class="muted small">{{ t('compare.base', { n: uninvested }) }}</span>
      </p>

      <!-- The meta's builds of it, to pick one in a tap. -->
      <section v-if="props.common.length" class="part">
        <span class="muted small">{{ t('compare.common') }}</span>
        <!-- On one line, scrolling sideways when they don't fit; on phones, wrapping. Each Pokémon's from its start,
             not where the last one's was left. -->
        <ScrollRow :key="props.id" wrap-on-phones class="builds">
          <button
            v-if="props.atSets !== undefined"
            v-tip="canHover && t('compare.atSetsTip')"
            type="button"
            class="btn mod"
            :class="{ on: sets }"
            :aria-pressed="sets"
            @click="emit('sets', !sets)"
          >
            {{ t('compare.atSets') }}
          </button>
          <button
            v-for="b in props.common"
            :key="`${b.effect}:${b.points}`"
            type="button"
            class="btn mod"
            :class="{ on: !sets && props.build.effect === b.effect && props.build.points === b.points }"
            @click="emit('build', { effect: b.effect, points: b.points })"
          >
            <component :is="EFFECT_ICONS[b.effect]" v-if="EFFECT_ICONS[b.effect]" :size="14" aria-hidden="true" />{{
              t('speed.points', { n: b.points })
            }}
            <span class="muted">{{ percent(b.share) }}</span>
          </button>
        </ScrollRow>
      </section>

      <section v-if="sets" class="part">
        <p class="muted small">{{ t('compare.atSetsNote') }}</p>
      </section>
      <section v-if="!sets" class="part">
        <SegmentedControl
          class="stacked"
          :model-value="props.build.effect"
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
          @update:model-value="(v: string) => emit('build', { effect: v as NatureEffect })"
        />
        <p class="muted small">{{ naturesOf(props.build.effect) }}</p>
      </section>

      <section v-if="!sets" class="part">
        <!-- The team builder's bar: the Speed its points give, and where its nature's rounding makes a point add 2 or
             nothing. -->
        <div class="field">
          <span class="muted small">{{ t('speed.pointsLabel') }}</span>
          <PointsBar
            :model-value="props.build.points"
            :base="POKEMON[props.id].stats[5]"
            :effect="props.build.effect"
            :limit="MAX_POINTS"
            :label="t('speed.pointsLabel')"
            raised
            @update:model-value="(p: number) => emit('build', { points: p })"
          />
        </div>
      </section>

      <section class="part">
        <span class="muted small">{{ t('speed.modifiers') }}</span>
        <div class="mods">
          <button
            v-for="m in mods"
            :key="m.key"
            v-tip="canHover && m.tip"
            type="button"
            class="btn mod"
            :class="{ on: props.build.toggles.includes(m.key) }"
            :aria-pressed="props.build.toggles.includes(m.key)"
            @click="toggle(m.key)"
          >
            <ItemIcon v-if="m.item" :id="m.item" :scale="0.75" class="mod-item" /><component
              :is="MOD_ICONS[m.key]"
              v-else-if="MOD_ICONS[m.key]"
              :size="16"
              aria-hidden="true"
            />{{ m.label }}
          </button>
          <StageStepper
            :model-value="props.build.stage"
            :min="STAGE_MIN"
            :max="STAGE_MAX"
            @update:model-value="(n: number) => emit('build', { stage: n })"
          />
        </div>
      </section>
      <slot />
      <div v-if="props.confirmable" class="confirm-row">
        <!-- As the speed tiers' Confirm, putting yours away. -->
        <button type="button" class="btn primary" @click="emit('confirm')">{{ t('compare.confirm') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.pick-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
/* The field at its usual width (a search box's, 320px) or less where the row is narrower, Clear right after it: the
   two one control, whatever the panel's width. */
.pick-row > .picker {
  flex: 0 1 320px;
  min-width: 0;
}
/* At the end, on its right, under a line. */
.confirm-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.pick-clear {
  flex: none;
  gap: 4px;
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
/* Each part under a line, a label above what it labels; a part slotted in after them too. */
.part,
.speed-editor :slotted(.part) {
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
.part > .builds {
  align-self: stretch;
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
</style>
