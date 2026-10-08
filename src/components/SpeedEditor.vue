<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { ChevronsDown, ChevronsUp, Trash2 } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent } from '@/data/meta'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import { NATURE_EFFECTS, NATURES_BY_EFFECT } from '@/lib/speed'
import { MAX_POINTS, type NatureEffect } from '@/lib/stats'
import { BUILD_TOGGLES, toggled, type BuildToggle, type SpeedBuild } from '@/lib/speedBuild'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonPicker from '@/components/PokemonPicker.vue'
import ScrollRow from '@/components/ScrollRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// One of the comparison's Pokémon and its Speed build, to change: the Pokémon (and, when `clearable`, Clear beside it),
// its Speed, the meta's common builds of it, its nature's effect, its points, its modifiers and its stage. In a side's
// panel, and under its band in the comparison's list.
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
  clearable?: boolean
}>()
const emit = defineEmits<{ pick: [id: PokemonId]; build: [b: Partial<SpeedBuild>]; clear: [] }>()

const picker = useTemplateRef<InstanceType<typeof PokemonPicker>>('picker')
// A page can open the picking straight away (a slot just added, or tapped with none picked).
defineExpose({ openPicker: () => picker.value?.open() })

function setPoints(v: string) {
  const n = Math.round(Number(v))
  if (Number.isFinite(n)) emit('build', { points: Math.min(MAX_POINTS, Math.max(0, n)) })
}
const toggle = (k: BuildToggle) => emit('build', { toggles: toggled(props.build.toggles, k) })

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
  <div class="speed-editor">
    <div class="pick-row">
      <PokemonPicker
        ref="picker"
        :model-value="props.id"
        :placeholder="t('compare.pick')"
        :title="props.title"
        :tone="props.tone"
        icon
        speed
        class="picker"
        @update:model-value="(id: PokemonId | null) => id && emit('pick', id)"
      />
      <button v-if="props.clearable && props.id" type="button" class="btn pick-clear" @click="emit('clear')">
        <Trash2 :size="14" aria-hidden="true" />{{ t('speed.clear') }}
      </button>
    </div>
    <template v-if="props.id">
      <!-- Its Speed, large, with its stat as built when modifiers change it (its base is the dex's). -->
      <p class="speed">
        <span class="speed-number">{{ props.speed }}</span>
        <span v-if="props.stat !== props.speed" class="muted small">{{
          t('compare.stat', { stat: props.stat! })
        }}</span>
      </p>

      <!-- The meta's builds of it, to pick one in a tap. -->
      <section v-if="props.common.length" class="part">
        <span class="muted small">{{ t('compare.common') }}</span>
        <!-- On one line, scrolling sideways when they don't fit; on phones, wrapping. -->
        <ScrollRow wrap-on-phones class="builds">
          <button
            v-for="b in props.common"
            :key="`${b.effect}:${b.points}`"
            type="button"
            class="btn mod"
            :class="{ on: props.build.effect === b.effect && props.build.points === b.points }"
            @click="emit('build', { effect: b.effect, points: b.points })"
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

      <section class="part">
        <label class="field">
          <span class="muted small">{{ t('speed.pointsLabel') }}</span>
          <span class="points">
            <input
              type="range"
              min="0"
              :max="MAX_POINTS"
              :value="props.build.points"
              @input="setPoints(($event.target as HTMLInputElement).value)"
            />
            <input
              type="number"
              class="points-box"
              min="0"
              :max="MAX_POINTS"
              :value="props.build.points"
              @change="setPoints(($event.target as HTMLInputElement).value)"
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
            :class="{ on: props.build.toggles.includes(k) }"
            :aria-pressed="props.build.toggles.includes(k)"
            @click="toggle(k)"
          >
            <ItemIcon v-if="MOD_ITEMS[k]" :id="MOD_ITEMS[k]!" :scale="0.75" class="mod-item" />{{ t(`speed.mod.${k}`) }}
          </button>
        </div>
        <SegmentedControl
          class="stacked"
          :model-value="String(props.build.stage)"
          :label="t('speed.stage')"
          :options="STAGES.map((s) => ({ value: s, label: stageLabel(s) }))"
          @update:model-value="(v: string) => emit('build', { stage: Number(v) })"
        />
      </section>
      <slot />
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
.pick-row > .picker {
  flex: 1;
  min-width: 0;
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
