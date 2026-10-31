<script setup lang="ts">
import { computed, useId } from 'vue'
import { X } from '@lucide/vue'
import {
  atCutoff,
  datasetKey,
  metaDatasets,
  periodLabel,
  selectSnapshot,
  selectedSnapshot,
  snapshots,
  type MetaDataset,
} from '@/data/meta'
import { t } from '@/i18n'
import { metaLoading } from '@/composables/useMeta'

// The meta's data, to pick (`MetaDialog`'s card): the regulation (the current one first), then its months, the latest
// first, each shown when there's a choice. Another regulation shows its latest month. Whose teams count most is the
// settings' (`metaCutoff`), and what the data is said there too, not here. Tournaments aren't part of it (their own
// pages lead to them): while one is shown, its regulation's months are listed, none picked, and picking one leaves it.
const emit = defineEmits<{ close: [] }>()
const id = useId()

const datasets = computed(() => metaDatasets(snapshots.value.filter((s) => s.kind !== 'tournament')))
/** The dataset shown, none while it's a tournament's. */
const current = computed<MetaDataset | undefined>(() => {
  const s = selectedSnapshot.value
  if (s?.kind === 'tournament') return undefined
  return datasets.value.find((d) => s && d.key === datasetKey(s)) ?? datasets.value[0]
})
const regulations = computed(() => [...new Set(datasets.value.map((d) => d.regulation))])
/** The regulation shown: its dataset's, or the tournament's shown. */
const regulation = computed(() => current.value?.regulation ?? selectedSnapshot.value?.regulation)
/** The regulation's datasets, the latest first. */
const inRegulation = computed(() => datasets.value.filter((d) => d.regulation === regulation.value))

/** Another regulation, at its latest month. */
function pickRegulation(r: string) {
  const d = datasets.value.find((x) => x.regulation === r)
  if (d) show(d)
}
/** Shows a dataset, at the players the settings pick. */
function show(d: MetaDataset) {
  const s = atCutoff(d.snapshots)
  if (s) selectSnapshot(s.id)
}
</script>

<template>
  <div class="panel banded meta-card" :class="{ loading: metaLoading }" :aria-busy="metaLoading">
    <div class="band">
      <span>{{ t('meta.data') }}</span>
      <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <div class="body">
      <section v-if="regulations.length > 1" class="section">
        <h3 :id="`${id}-regulations`" class="heading">{{ t('meta.regulations') }}</h3>
        <div class="options" role="radiogroup" :aria-labelledby="`${id}-regulations`">
          <label v-for="r in regulations" :key="r" class="option" :class="{ on: r === regulation }">
            <input type="radio" :name="`${id}-regulation`" :checked="r === regulation" @change="pickRegulation(r)" />
            <span class="name">{{ r }}</span>
          </label>
        </div>
      </section>
      <section v-if="inRegulation.length > 1" class="section">
        <h3 :id="`${id}-months`" class="heading">{{ t('meta.month') }}</h3>
        <div class="options" role="radiogroup" :aria-labelledby="`${id}-months`">
          <label v-for="d in inRegulation" :key="d.key" class="option" :class="{ on: d === current }">
            <input type="radio" :name="`${id}-month`" :checked="d === current" @change="show(d)" />
            <span class="name">{{ periodLabel(d.snapshots[0]!) }}</span>
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.meta-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0;
}
/* Its band: what it is, its close at the end. */
:root:root .meta-card.banded > .band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-weight: bold;
}
/* Under the band, what scrolls when the card's too tall for the screen (its dialog fits it to the screen), the band
   staying put; it reaches the card's right edge, so its scrollbar runs along it. */
.body {
  min-height: 0;
  margin: 0 calc(-1 * var(--panel-pad)) 0 0;
  padding: 0 var(--panel-pad) 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.close {
  min-height: 0;
  padding: 2px 4px;
}
.section {
  padding: 10px 0;
}
.section + .section {
  border-top: 1px solid var(--border);
}
.section:last-child {
  padding-bottom: 0;
}
.heading {
  margin: 0 0 6px;
  font-size: 0.85em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
/* Side by side, wrapping. */
.options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
/* Each a choice: its radio and its name, the one shown marked. */
.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  cursor: pointer;
}
.option input {
  margin: 0;
}
.option:hover {
  background: var(--hover);
}
.option.on {
  background: var(--sel);
  border-color: var(--border-strong);
}
.option .name {
  font-weight: bold;
}
/* The one picked, while its data loads (it stays open on another regulation or dataset, over the page). */
.loading .option.on .name {
  animation: meta-pulse 0.7s ease-in-out infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  .loading .option.on .name {
    animation: none;
  }
}
</style>
