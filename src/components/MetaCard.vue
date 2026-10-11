<script setup lang="ts">
import { computed, useId } from 'vue'
import { X } from '@lucide/vue'
import {
  currentSnapshots,
  datasetDates,
  metaDatasets,
  selectSnapshot,
  selectedSnapshot,
  subsetParts,
  type MetaDataset,
  type MetaSnapshot,
} from '@/data/meta'
import { locale, t } from '@/i18n'

// The meta's data, to see and pick (`MetaDialog`'s card): the datasets (what one source observed over one period,
// for one regulation), when there are several, by regulation when there are several of those, the latest first; what
// the one shown is (its battles, regulation, days, source); and its subsets (whose teams count most), what they mean
// said once over them. Picking one shows it on every page and closes the card; another dataset keeps the subset when
// it has it.
const emit = defineEmits<{ close: [] }>()
const id = useId()

const datasets = computed(() => metaDatasets(currentSnapshots()))
const current = computed<MetaDataset | undefined>(
  () => datasets.value.find((d) => d.snapshots.some((s) => s.id === selectedSnapshot.value?.id)) ?? datasets.value[0],
)
const byRegulation = computed(() => new Set(datasets.value.map((d) => d.regulation)).size > 1)

function pickDataset(d: MetaDataset) {
  const now = selectedSnapshot.value
  const same = d.snapshots.find((s) => s.cutoff === now?.cutoff && s.bestOf === now?.bestOf) ?? d.snapshots[0]
  if (same) pick(same.id)
}
/** Shows it on every page, and closes the card: the choice is made. */
function pick(snapshot: string) {
  selectSnapshot(snapshot)
  emit('close')
}
const subsetLabel = (s: MetaSnapshot) => subsetParts(s).join(' · ')
/** What its subsets mean, said once over them: Smogon's cutoffs, when they're what tells them apart. */
const cutoffs = computed(() => !!current.value?.snapshots.some((s) => s.cutoff !== undefined))
const about = (d: MetaDataset) =>
  [
    d.battles !== undefined && t('meta.battles', { n: d.battles.toLocaleString(locale.value) }),
    t('meta.regulation', { reg: d.regulation }),
    datasetDates(d),
  ]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="panel banded meta-card">
    <div class="band">
      <span>{{ t('meta.data') }}</span>
      <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <!-- The datasets, when there's a choice of them: under their regulation's name when there's one of those too. -->
    <section v-if="datasets.length > 1" class="section">
      <h3 :id="`${id}-datasets`" class="heading">{{ t('meta.dataset') }}</h3>
      <div class="options" role="radiogroup" :aria-labelledby="`${id}-datasets`">
        <template v-for="(d, i) in datasets" :key="d.key">
          <p v-if="byRegulation && d.regulation !== datasets[i - 1]?.regulation" class="group">
            {{ t('meta.regulation', { reg: d.regulation }) }}
          </p>
          <label class="option" :class="{ on: d === current }">
            <input type="radio" :name="`${id}-dataset`" :checked="d === current" @change="pickDataset(d)" />
            <span class="name">{{ d.label }}</span>
          </label>
        </template>
      </div>
    </section>
    <!-- What the one shown is. -->
    <section v-if="current" class="section about">
      <p class="name">{{ current.label }}</p>
      <p class="muted small">
        {{ about(current) }} · {{ t('usage.from') }}
        <a :href="current.provider.url" target="_blank" rel="noopener">{{ current.provider.name }}</a>
      </p>
    </section>
    <!-- Its subsets, what they mean said once over them. -->
    <section v-if="current && current.snapshots.length > 1" class="section">
      <h3 :id="`${id}-subsets`" class="heading">{{ t('meta.subset') }}</h3>
      <p v-if="cutoffs" class="muted small note">{{ t('meta.cutoffsNote') }}</p>
      <div class="options" role="radiogroup" :aria-labelledby="`${id}-subsets`">
        <label v-for="s in current.snapshots" :key="s.id" class="option" :class="{ on: s.id === selectedSnapshot?.id }">
          <input type="radio" :name="`${id}-subset`" :checked="s.id === selectedSnapshot?.id" @change="pick(s.id)" />
          <span class="name">{{ subsetLabel(s) }}</span>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.meta-card {
  display: flex;
  flex-direction: column;
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
.group {
  margin: 6px 0 2px;
  font-size: 0.85em;
  font-weight: bold;
}
.about p {
  margin: 0;
}
.about .name {
  font-weight: bold;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* Each a row to pick: its radio, its name, and what it means under it; the one shown marked. */
.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  cursor: pointer;
}
.option:hover {
  background: var(--hover);
}
.option.on {
  background: var(--sel);
  border-color: var(--border-strong);
}
.option input {
  margin: 3px 0 0;
}
.note {
  margin: 0 0 8px;
}
.option .name {
  font-weight: bold;
}
.small {
  font-size: 0.875em;
}
</style>
