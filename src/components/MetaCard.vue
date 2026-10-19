<script setup lang="ts">
import { computed, useId } from 'vue'
import { RotateCcw, X } from '@lucide/vue'
import {
  datasetDates,
  datasetKey,
  datasetParts,
  metaDatasets,
  offLatest,
  selectSnapshot,
  selectedSnapshot,
  showLatest,
  snapshots,
  sourceParts,
  subsetParts,
  type MetaDataset,
  type MetaSnapshot,
} from '@/data/meta'
import { locale, t } from '@/i18n'
import { metaLoading } from '@/composables/useMeta'
import { eventsOf, snapshotEvents, tournamentSnapshot } from '@/data/tournaments'

// The meta's data, to see and pick (`MetaDialog`'s card), in steps, each shown when there's a choice: the regulation
// (the current one first), then its datasets, a plain list of them, the latest first (what one source observed over
// one period, whatever the period: Smogon's are months), what the one shown is (its battles, regulation, days,
// source), and its subsets (whose teams count most), what they mean said once over them. Picking a subset shows it on every page and closes the card; another regulation
// or dataset shows its latest, keeping the subset when it has it, and leaves the card open for the next step. While
// it isn't the latest dataset, its band has the way back to it (Latest), at the same players, which closes it. Under
// the steps, Confirm closes it too, as the speed editor's does: what's picked is shown already. A regulation's
// tournaments are one dataset, every event of it by default; its events, folded under it until some are picked, pick
// which it adds up, the card staying open.
const emit = defineEmits<{ close: [] }>()
const id = useId()

const datasets = computed(() => metaDatasets(snapshots.value))
const current = computed<MetaDataset | undefined>(() => {
  const s = selectedSnapshot.value
  return datasets.value.find((d) => s && d.key === datasetKey(s)) ?? datasets.value[0]
})
const regulations = computed(() => [...new Set(datasets.value.map((d) => d.regulation))])
/** The current regulation's datasets. */
const inRegulation = computed(() => datasets.value.filter((d) => d.regulation === current.value?.regulation))
/** A dataset's name among its regulation's: its source and period ("Showdown ladder · Sep 2026"). */
const datasetName = (d: MetaDataset) => sourceParts(d.snapshots[0]!).join(' · ')

function pickRegulation(r: string) {
  const d = datasets.value.find((x) => x.regulation === r)
  if (d) show(d)
}

/** Shows a dataset, at the subset shown when it has it; the card stays open. */
function show(d: MetaDataset) {
  const now = selectedSnapshot.value
  const same = d.snapshots.find((s) => s.cutoff === now?.cutoff && s.bestOf === now?.bestOf) ?? d.snapshots[0]
  if (same) selectSnapshot(same.id)
}
/** Shows it on every page, and closes the card: the choice is made. */
function pick(snapshot: string) {
  selectSnapshot(snapshot)
  emit('close')
}
function latest() {
  showLatest()
  emit('close')
}
const subsetLabel = (s: MetaSnapshot) => subsetParts(s).join(' · ')

/** The tournaments shown: its regulation's events, and those it adds up. */
const tournaments = computed(() => {
  const s = selectedSnapshot.value
  if (!s?.events) return null
  const all = eventsOf(s.regulation)
  return { all, picked: new Set(snapshotEvents(s).map((e) => e.id)), regulation: s.regulation }
})
/** Adds an event to those added up, or takes it out, keeping one at least; the card stays open. */
function toggleEvent(id: string) {
  const tm = tournaments.value
  if (!tm) return
  const picked = new Set(tm.picked)
  if (picked.has(id)) picked.delete(id)
  else picked.add(id)
  const s = picked.size && tournamentSnapshot(tm.regulation, [...picked])
  if (s) selectSnapshot(s.id)
}
/** What the one shown is: its own label, for tournaments (the events it adds up), else its dataset's. */
const shownLabel = computed(() =>
  selectedSnapshot.value?.events ? datasetParts(selectedSnapshot.value).join(' · ') : current.value?.label,
)
/** What its subsets mean, said once over them: Smogon's cutoffs, when they're what tells them apart. */
const cutoffs = computed(() => !!current.value?.snapshots.some((s) => s.cutoff !== undefined))
const about = (d: MetaDataset) =>
  [
    d.battles !== undefined && t('meta.battles', { n: d.battles.toLocaleString(locale.value) }),
    selectedSnapshot.value?.events &&
      t('meta.teams', { n: (selectedSnapshot.value.teams ?? 0).toLocaleString(locale.value) }),
    t('meta.regulation', { reg: d.regulation }),
    datasetDates(selectedSnapshot.value?.events ? selectedSnapshot.value : d),
  ]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="panel banded meta-card" :class="{ loading: metaLoading }" :aria-busy="metaLoading">
    <div class="band">
      <span>{{ t('meta.data') }}</span>
      <div class="band-end">
        <button
          v-if="offLatest"
          v-tip="t('meta.toLatest')"
          type="button"
          class="btn on-band latest"
          :aria-label="t('meta.toLatest')"
          @click="latest"
        >
          <RotateCcw :size="14" aria-hidden="true" />{{ t('meta.latest') }}
        </button>
        <button type="button" class="btn on-band close" :aria-label="t('picker.close')" @click="emit('close')">
          <X :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="body">
      <!-- The regulations, when there's a choice of them. -->
      <section v-if="regulations.length > 1" class="section">
        <h3 :id="`${id}-regulations`" class="heading">{{ t('meta.regulations') }}</h3>
        <div class="options inline" role="radiogroup" :aria-labelledby="`${id}-regulations`">
          <label v-for="r in regulations" :key="r" class="option" :class="{ on: r === current?.regulation }">
            <input
              type="radio"
              :name="`${id}-regulation`"
              :checked="r === current?.regulation"
              @change="pickRegulation(r)"
            />
            <span class="name">{{ r }}</span>
          </label>
        </div>
      </section>
      <!-- Its datasets, when there's a choice of them. -->
      <section v-if="inRegulation.length > 1" class="section">
        <h3 :id="`${id}-datasets`" class="heading">{{ t('meta.dataset') }}</h3>
        <div class="options" role="radiogroup" :aria-labelledby="`${id}-datasets`">
          <label v-for="d in inRegulation" :key="d.key" class="option" :class="{ on: d === current }">
            <input type="radio" :name="`${id}-dataset`" :checked="d === current" @change="show(d)" />
            <span class="name">{{ datasetName(d) }}</span>
          </label>
        </div>
      </section>
      <!-- What the one shown is. -->
      <section v-if="current" class="section about">
        <p class="name">{{ shownLabel }}</p>
        <p class="muted small">
          {{ about(current) }} · {{ t('usage.from') }}
          <a :href="current.provider.url" target="_blank" rel="noopener">{{ current.provider.name }}</a>
        </p>
        <p v-if="tournaments" class="muted small note-after">{{ t('meta.topPlacings') }}</p>
      </section>
      <!-- A regulation's tournaments: which of its events are added up, folded until some are picked. -->
      <section v-if="tournaments && tournaments.all.length > 1" class="section">
        <details class="events" :open="tournaments.picked.size < tournaments.all.length">
          <summary class="heading">
            {{ t('meta.pickEvents') }}
            <span class="count">{{
              t('meta.pickEventsCount', { n: tournaments.picked.size, total: tournaments.all.length })
            }}</span>
          </summary>
          <div class="options">
            <label
              v-for="e in tournaments.all"
              :key="e.id"
              class="option"
              :class="{ on: tournaments.picked.has(e.id) }"
            >
              <input
                type="checkbox"
                :checked="tournaments.picked.has(e.id)"
                :disabled="tournaments.picked.size === 1 && tournaments.picked.has(e.id)"
                @change="toggleEvent(e.id)"
              />
              <span>
                <span class="name">{{ e.name }}</span>
                <span class="muted small event-about"
                  >{{ datasetDates({ from: e.date, to: e.date }) }} ·
                  {{
                    t('meta.eventTeams', {
                      teams: e.teams.toLocaleString(locale),
                      players: e.players.toLocaleString(locale),
                    })
                  }}</span
                >
              </span>
            </label>
          </div>
        </details>
      </section>
      <!-- Its subsets, what they mean said once over them. -->
      <section v-if="current && current.snapshots.length > 1" class="section">
        <h3 :id="`${id}-subsets`" class="heading">{{ t('meta.subset') }}</h3>
        <p v-if="cutoffs" class="muted small note">{{ t('meta.cutoffsNote') }}</p>
        <div class="options" role="radiogroup" :aria-labelledby="`${id}-subsets`">
          <label
            v-for="s in current.snapshots"
            :key="s.id"
            class="option"
            :class="{ on: s.id === selectedSnapshot?.id }"
          >
            <input type="radio" :name="`${id}-subset`" :checked="s.id === selectedSnapshot?.id" @change="pick(s.id)" />
            <span class="name">{{ subsetLabel(s) }}</span>
          </label>
        </div>
      </section>
    </div>
    <div class="confirm-row">
      <button type="button" class="btn primary" @click="emit('close')">{{ t('meta.confirm') }}</button>
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
/* Its end: the way back to the latest, when it's not, then the close. */
.band-end {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* Under the band, what scrolls when the card's too tall for the screen (its dialog fits it to the screen), the band
   and Confirm staying put; it reaches the card's right edge, so its scrollbar runs along it. */
.body {
  min-height: 0;
  margin: 0 calc(-1 * var(--panel-pad)) 0 0;
  padding: 0 var(--panel-pad) 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.confirm-row {
  display: flex;
  flex: none;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
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
/* The regulations, short: side by side, wrapping. */
.options.inline {
  flex-direction: row;
  flex-wrap: wrap;
}
.options.inline .option {
  align-items: center;
}
.options.inline .option input {
  margin: 0;
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
.note-after {
  margin-top: 4px;
}
/* The events, folded under their heading, which says how many are picked. */
.events summary {
  cursor: pointer;
}
.events[open] summary {
  margin-bottom: 6px;
}
.events .count {
  margin-left: 4px;
  font-weight: bold;
}
.event-about {
  display: block;
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
.small {
  font-size: 0.875em;
}
</style>
