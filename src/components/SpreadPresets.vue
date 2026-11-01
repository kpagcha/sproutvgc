<script lang="ts">
/** How many of its common spreads it offers. */
export const PRESETS = 4
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { percent, type Spread } from '@/data/meta'
import { natureName } from '@/data/natures'
import { t } from '@/i18n'
import type { Points } from '@/lib/team'
import { natureTip } from '@/components/natureTip'
import ModalDialog from '@/components/ModalDialog.vue'

// A Pokémon's most common spreads (the meta's), in a dialog over the page (`ModalDialog`), each setting its points and
// nature and closing it: those of the nature it has already tinted, the one it's at outlined. Opened from the stat
// points editor's foot (`PointsEditor`), or the damage calculator's row of what a side's stats are (`TeamSlot`).
const props = defineProps<{ spreads: readonly Spread[]; nature: string | null; points: Points }>()
const emit = defineEmits<{ pick: [spread: Spread] }>()
const open = defineModel<boolean>('open', { default: false })
const presets = computed(() => props.spreads.slice(0, PRESETS))
function choose(s: Spread) {
  emit('pick', s)
  open.value = false
}
const isPreset = (s: Spread) => s.nature === props.nature && s.points.every((p, i) => p === props.points[i])
</script>

<template>
  <ModalDialog v-if="presets.length" v-model:open="open" :label="t('builder.presets')">
    <div class="panel banded presets-card">
      <div class="band">
        <span>{{ t('builder.presets') }}</span>
        <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="open = false">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
      <div class="presets">
        <button
          v-for="(sp, i) in presets"
          :key="i"
          type="button"
          class="preset"
          :class="{ on: isPreset(sp), same: sp.nature === nature }"
          @click="choose(sp)"
        >
          <span v-tip="natureTip(sp.nature)" class="preset-nature">{{ natureName(sp.nature) }}</span>
          <span class="preset-points">{{ sp.points.join('/') }}</span>
          <span class="preset-share muted">{{ sp.share ? percent(sp.share) : '' }}</span>
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
/* Its card no wider than its spreads read; its band what it is, its close at the end. */
:global(.modal-dialog) > .presets-card {
  max-width: 360px;
}
:root:root .presets-card.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
.close {
  min-height: 0;
  padding: 2px 4px;
}
/* The spreads one grid, so their nature, points and share line up in columns from one to the next. */
.presets {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px;
  padding-top: 10px;
}
.preset {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  text-align: left;
  column-gap: 10px;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  cursor: pointer;
}
.preset:hover {
  background: var(--hover);
}
/* Of the nature it has already: the faintest tint of the accent, an edge of it down its left; the one it's at
   outlined too. */
.preset.same {
  background: color-mix(in srgb, var(--accent) 8%, var(--panel-alt));
  box-shadow: inset 3px 0 0 var(--accent);
}
.preset.same:hover {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel-alt));
}
.preset.on {
  border-color: var(--accent);
}
.preset-nature {
  font-weight: bold;
}
.preset-points,
.preset-share {
  font-variant-numeric: tabular-nums;
}
.preset-share {
  text-align: right;
}
</style>
