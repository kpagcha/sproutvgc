<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { pokemon, type PokemonId } from '@/data/dex'
import { splitForme } from '@/data/pokemon'
import { GENERATED_SNAPSHOTS, has, metaLabel, percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { loadDexNames, refName } from '@/i18n/refName'
import { useMeta } from '@/composables/useMeta'
import AppLink from '@/components/AppLink'
import PokemonIcon from '@/components/PokemonIcon'

// The meta at a glance, on the home page under the areas, the page's width: the most used Pokémon as the rankings show
// them (a `.dex-table` of their rank, name and usage with its bar, with no header), and beside them (under them on
// narrower screens) those whose usage rose or fell the most since the dataset before (none for a series' first), each leading to its meta page, and the way to the whole
// rankings. The data shown is every page's (`useMeta`), named under the band. The home page doesn't wait for the dex's
// names, so the panel holds its place until they're in, with the data.
const { snapshot, data } = useMeta()
const named = shallowRef(false)
onMounted(() => void loadDexNames().then(() => (named.value = true)))

const TOP = 10
const MOVERS = 5
/** Changes in usage under this read as noise (as on the rankings), so they don't make a mover. */
const STEADY = 0.005

const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
const rows = computed(() =>
  Object.entries(data.value ?? {}).map(([key, m]) => {
    const id = key as PokemonId
    return {
      id,
      ...splitForme(id, refName(pokemon(id))),
      rank: m!.rank,
      usage: m!.usage,
      climb: m!.prev ? m!.prev.rank - m!.rank : undefined,
      fresh: !!previous.value && !m!.prev,
      change: m!.usage !== undefined && m!.prev?.usage !== undefined ? m!.usage - m!.prev.usage : undefined,
    }
  }),
)
type Row = (typeof rows.value)[number]
const top = computed(() => [...rows.value].sort((a, b) => a.rank - b.rank).slice(0, TOP))
/** The bars' full length: the most used's usage, as on the rankings. */
const most = computed(() => Math.max(0, ...top.value.map((r) => r.usage ?? 0)))
const withUsage = computed(() => !!snapshot.value && has(snapshot.value, 'usage'))
const changed = computed(() => rows.value.filter((r): r is Row & { change: number } => r.change !== undefined))
const rising = computed(() =>
  changed.value
    .filter((r) => r.change >= STEADY)
    .sort((a, b) => b.change - a.change)
    .slice(0, MOVERS),
)
const falling = computed(() =>
  changed.value
    .filter((r) => r.change <= -STEADY)
    .sort((a, b) => a.change - b.change)
    .slice(0, MOVERS),
)
const movers = computed(() => withUsage.value && (rising.value.length > 0 || falling.value.length > 0))

/** A change in usage, in percentage points: "+3.2", "−1.8". */
const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

const ready = computed(() => named.value && !!data.value)
</script>

<template>
  <section v-if="snapshot" class="panel banded highlights">
    <div class="band">
      <h2 class="title">{{ t('home.metaTitle') }}</h2>
      <AppLink :to="{ name: 'rankings' }" class="all">{{ t('home.metaAll') }} ›</AppLink>
    </div>
    <p class="muted label">{{ metaLabel(snapshot) }}</p>
    <!-- The most used, and beside them on wide screens (under them on narrower ones) the movers. -->
    <div v-if="ready" class="body">
      <!-- Each column under a heading, so their tops line up. -->
      <div>
        <h3 v-if="movers">{{ t('home.metaTop') }}</h3>
        <div class="dex-table" role="table" :aria-label="t('home.metaTop')">
          <div v-for="r in top" :key="r.id" class="row" role="row">
            <div role="cell" class="r num muted rank">
              #{{ r.rank
              }}<span
                v-if="previous"
                class="climb"
                :class="r.climb ? (r.climb > 0 ? 'up' : 'down') : r.fresh && 'fresh'"
                ><template v-if="r.climb"
                  ><span aria-hidden="true">{{ r.climb > 0 ? '▲' : '▼' }}</span
                  ><span class="visually-hidden">{{ t(r.climb > 0 ? 'usage.up' : 'usage.down') }}</span
                  >{{ Math.abs(r.climb) }}</template
                ><template v-else-if="r.fresh">{{ t('usage.new') }}</template></span
              >
            </div>
            <div role="cell" class="grow">
              <AppLink :to="{ name: 'metaPokemon', params: { id: r.id } }" class="mon">
                <PokemonIcon :id="r.id" />
                <span class="mon-label">
                  <span class="name">{{ r.species }}</span>
                  <span v-if="r.forme" class="forme">{{ r.forme }}</span>
                </span>
              </AppLink>
            </div>
            <div
              v-if="withUsage"
              role="cell"
              class="r num meter usage"
              :style="{ '--share': (r.usage ?? 0) / (most || 1) }"
            >
              {{ r.usage === undefined ? '—' : percent(r.usage) }}
            </div>
          </div>
        </div>
      </div>
      <!-- Those whose usage changed the most since the dataset before, in points: a table each, side by side. -->
      <div v-if="movers" class="movers">
        <div
          v-for="group in [
            { key: 'rising', list: rising, title: t('home.metaRising') },
            { key: 'falling', list: falling, title: t('home.metaFalling') },
          ]"
          :key="group.key"
        >
          <h3 v-tip="t('home.metaMoversTip')" class="tipped">{{ group.title }}</h3>
          <div class="dex-table moved" role="table" :aria-label="group.title">
            <div v-for="r in group.list" :key="r.id" class="row" role="row">
              <div role="cell" class="grow">
                <AppLink :to="{ name: 'metaPokemon', params: { id: r.id } }" class="mon">
                  <PokemonIcon :id="r.id" />
                  <span class="mon-label">
                    <span class="name">{{ r.species }}</span>
                    <span v-if="r.forme" class="forme">{{ r.forme }}</span>
                  </span>
                </AppLink>
              </div>
              <div role="cell" class="r num change" :class="r.change > 0 ? 'up' : 'down'">
                {{ points(r.change) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="waiting" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
.band {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.title {
  margin: 0;
}
.all {
  color: inherit;
  font-weight: bold;
  white-space: nowrap;
}
.label {
  margin: 0 0 8px;
  font-size: 0.9em;
}
/* As the rankings' table: rank, Pokémon, usage (its number, with its bar under it). A handful of rows, so laid out at
   once rather than skipped until seen, and no header, so the first row has no line over it. */
.dex-table {
  --cols: minmax(3em, auto) minmax(0, 1fr) 4.5em;
}
.dex-table.moved {
  --cols: minmax(0, 1fr) minmax(3.5em, auto);
}
.dex-table .row {
  content-visibility: visible;
}
.dex-table .row:first-child {
  border-top: none;
}
.mon {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  /* The icon is taller than the row: let it into the cell's padding, but no further. */
  margin: -3px 0;
}
.mon-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
}
.forme {
  padding: 0 5px;
  font-size: 0.85em;
  color: var(--muted);
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.usage {
  font-weight: bold;
}
/* Usage's bar, as the rankings': a faint track along the cell's foot, filled to its share of the most used's. */
.meter {
  --inset: 6px;
  position: relative;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: var(--inset);
}
.meter::before {
  right: var(--inset);
  bottom: 4px;
  height: 1px;
  background: var(--border);
}
.meter::after {
  bottom: 3px;
  width: calc((100% - 2 * var(--inset)) * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
/* The rank's mark: places gained or lost since the previous dataset, or new to it, small after the rank. */
.climb {
  display: inline-block;
  width: 2.4em;
  margin-left: 3px;
  font-size: 0.75em;
  text-align: left;
  white-space: nowrap;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
.fresh {
  color: var(--accent);
  font-weight: bold;
}
.change {
  font-size: 0.9em;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* The movers under the most used, rising and falling side by side (one under the other on phones); on wide screens,
   beside the most used, rising over falling, about as tall as their ten. */
.movers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin-top: 16px;
}
@media (min-width: 861px) {
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    align-items: start;
    gap: 32px;
  }
  .movers {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 0;
  }
}
h3 {
  width: fit-content;
  margin: 0 0 4px;
  font-size: 1em;
}
/* Its place held while the data and names come in: about the height of the list. */
.waiting {
  height: 320px;
}
@media (max-width: 560px) {
  .movers {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
