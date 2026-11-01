<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChevronsDown, ChevronsUp, CircleAlert, Trash2 } from '@lucide/vue'
import type { PokemonId } from '@/data/dex'
import { percent, type Spread } from '@/data/meta'
import { natureEffects, natureName } from '@/data/natures'
import { t } from '@/i18n'
import { pointsLeft, type Member, type Points } from '@/lib/team'
import MoreToggle from '@/components/MoreToggle.vue'
import PointsEditor from '@/components/PointsEditor.vue'
import { PRESETS } from '@/components/SpreadPresets.vue'
import { natureTip } from '@/components/natureTip'

// A slot's stat points in the picker's drawer, its set's last step (`TeamPicker`, `points`): its common spreads listed
// (the meta's, the first `PRESETS` until unfolded), each setting its points and nature; then, after a rule, its own, cleared
// from a bin by its heading, its nature named
// (tapped, the natures' picker, coming back here: `nature`) over its sliders (`PointsEditor`), what's left to spend
// across from its heading; and, after a rule, where it can be (the damage calculator's, `canPool`), at every set, its sets pooled by
// usage, said under it, its sliders then showing the pooled points and stats, dimmed and locked (`pooled`), its own
// kept for when it's off again, and its nature crossed out. At its foot, closing it (`done`), its points as they are.
const props = defineProps<{
  member: Member
  /** The Pokémon its stats are of: its Mega while it Mega Evolves. */
  pokemon: PokemonId
  spreads: readonly Spread[]
  canPool?: boolean
  atSets?: boolean
  pooled?: { points: readonly number[]; stats: readonly number[] }
}>()
const emit = defineEmits<{ change: [patch: Partial<Member>]; sets: [on: boolean]; nature: []; done: [] }>()

const all = shallowRef(false)
const spreads = computed(() => (all.value ? props.spreads : props.spreads.slice(0, PRESETS)))
const isAt = (s: Spread) =>
  !props.atSets && s.nature === props.member.nature && s.points.every((p, i) => p === props.member.points[i])
const effects = computed(() => (props.member.nature ? natureEffects(props.member.nature) : null))
const left = computed(() => pointsLeft(props.member))
const locked = computed(() => (props.atSets ? props.pooled : undefined))
const points = computed({
  get: () => props.member.points,
  set: (p: Points) => emit('change', { points: p }),
})
</script>

<template>
  <div class="points-picker">
    <section v-if="spreads.length" class="part">
      <h3 class="part-head">{{ t('builder.spreads') }}</h3>
      <div class="spreads">
        <button
          v-for="(sp, i) in spreads"
          :key="i"
          type="button"
          class="spread"
          :class="{ on: isAt(sp), same: sp.nature === member.nature }"
          @click="emit('change', { points: [...sp.points], nature: sp.nature })"
        >
          <span v-tip="natureTip(sp.nature)" class="spread-nature">{{ natureName(sp.nature) }}</span>
          <span class="spread-points">{{ sp.points.join('/') }}</span>
          <span class="spread-share muted">{{ sp.share ? percent(sp.share) : '' }}</span>
        </button>
      </div>
      <MoreToggle v-model:all="all" :n="props.spreads.length" :top="PRESETS" />
    </section>
    <p v-if="spreads.length" class="or muted">{{ t('builder.orOwn') }}</p>

    <section class="part">
      <h3 class="part-head">
        <span class="own-head"
          >{{ t('builder.ownSpread')
          }}<button
            v-tip="t('builder.clearPoints')"
            type="button"
            class="trash"
            :disabled="atSets || member.points.every((p) => !p)"
            :aria-label="t('builder.clearPoints')"
            @click="emit('change', { points: [0, 0, 0, 0, 0, 0] })"
          >
            <Trash2 :size="14" aria-hidden="true" /></button
        ></span>
        <span v-if="!atSets && left !== 0" class="left" :class="{ over: left < 0 }" aria-live="polite"
          ><CircleAlert :size="14" aria-hidden="true" />{{
            left > 0
              ? left === 1
                ? t('builder.pointToSpend')
                : t('builder.pointsToSpend', { n: left })
              : left === -1
                ? t('builder.pointOver')
                : t('builder.pointsOver', { n: -left })
          }}</span
        >
      </h3>
      <p class="nature-line">
        <span class="muted">{{ t('builder.pick.nature') }}</span>
        <button
          type="button"
          class="btn quiet small nature"
          :class="{ placeholder: !member.nature, struck: atSets }"
          @click="emit('nature')"
        >
          <span class="nature-name">{{ member.nature ? natureName(member.nature) : t('builder.nature') }}</span>
          <span v-if="effects" class="effects"
            ><span class="up"><ChevronsUp :size="12" :stroke-width="3" />{{ t(`stat.${effects.plus}`) }}</span
            ><span class="down"
              ><ChevronsDown :size="12" :stroke-width="3" />{{ t(`stat.${effects.minus}`) }}</span
            ></span
          >
        </button>
      </p>
      <PointsEditor v-model:points="points" :pokemon :nature="member.nature" :spreads no-actions :locked />
    </section>

    <p v-if="canPool" class="or muted">{{ t('builder.orSets') }}</p>
    <section v-if="canPool" class="part">
      <button
        type="button"
        class="btn quiet small sets"
        :class="{ on: atSets }"
        :aria-pressed="!!atSets"
        @click="emit('sets', !atSets)"
      >
        <span class="box" aria-hidden="true"></span>{{ t('calc.sets.toggle') }}
      </button>
      <p class="sets-note muted">{{ t('calc.sets.tip') }}</p>
    </section>

    <button type="button" class="btn done" @click="emit('done')">{{ t('picker.close') }}</button>
  </div>
</template>

<style scoped>
.points-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* Between the three ways to set them, a rule each side of "or", as the Pokémon's step offers its common set. */
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
.own-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* Clearing its points: an icon alone, no outline nor fill, by its heading. */
.trash {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.trash:hover:not(:disabled) {
  color: var(--bad);
}
.trash:disabled {
  opacity: 0.4;
  cursor: default;
}
/* Closing the drawer, its points kept as they are: at its foot's end, as wide as its label. */
.done {
  align-self: flex-end;
  margin-top: 4px;
}
.part {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.part-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
  margin: 0;
  font-size: 0.8em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
/* Points left to spend, or over: in the warm warning (red, over), as the slot's line has them. */
.left {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
  letter-spacing: 0;
  text-transform: none;
  color: var(--warn);
}
.left.over {
  color: var(--bad);
}
/* The spreads one grid, so their nature, points and share line up from one to the next; of the nature it has the
   faintest tint of the accent with an edge of it, the one it's at outlined (as the dialog had them). */
.spreads {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px;
}
.spread {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  column-gap: 10px;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.spread:hover {
  background: var(--hover);
}
.spread.same {
  background: color-mix(in srgb, var(--accent) 8%, var(--panel-alt));
}
.spread.same:hover {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel-alt));
}
.spread.on {
  border-color: var(--accent);
}
.spread-nature {
  font-weight: bold;
}
.spread-points,
.spread-share {
  font-variant-numeric: tabular-nums;
}
.spread-share {
  text-align: right;
}
.nature-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.9em;
}
.nature {
  gap: 10px;
}
.nature-name {
  font-weight: bold;
}
.nature.placeholder .nature-name {
  font-weight: normal;
  color: var(--muted);
}
/* At every set, its nature isn't what it battles with. */
.nature.struck .nature-name {
  text-decoration: line-through;
}
.effects {
  display: inline-flex;
  gap: 8px;
  font-size: 0.9em;
}
.up,
.down {
  display: inline-flex;
  align-items: center;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
/* Every set: a checkbox's square, filled while on. */
.sets {
  align-self: flex-start;
  gap: 6px;
}
.box {
  width: 11px;
  height: 11px;
  border: 1px solid currentColor;
}
.sets.on .box {
  background: var(--accent);
  border-color: var(--accent);
}
.sets-note {
  margin: 0;
  font-size: 0.85em;
}
</style>
