<script setup lang="ts" generic="R extends TrendRow">
import { computed, ref } from 'vue'
import { percent } from '@/data/meta'
import { t } from '@/i18n'
import { points, STEADY } from '@/lib/entryUsage'
import type { NamedLocation } from '@/lib/links'
import AppLink from '@/components/AppLink'
import MoreToggle from '@/components/MoreToggle.vue'

// The rankings' trends, a panel of their own after the list (the list's rank keeps only a mark of them: up, down or
// new): of the entries the list shows (its search and filters), those whose usage rose and fell the most since the
// dataset before (`since`), in percentage points, and those new to it, by usage, a column each, every entry leading
// where its row does. A snapshot with no usage measures the change in places (`climb`). Other trends take its shape
// with a title of their own (`title`), what they're against in place of the dates (`about`), and the columns' tooltips
// saying so (`tips`): the tournaments'.
export interface TrendRow {
  id: string
  to: NamedLocation
  usage?: number
  /** Places gained (up) or lost since the dataset before. */
  climb?: number
  /** Usage gained or lost since the dataset before. */
  change?: number
  fresh: boolean
}
const props = defineProps<{
  rows: readonly R[]
  since?: string
  title?: string
  about?: string
  tips?: { points: string; new: string; none: string }
}>()
defineSlots<{ entry(p: { row: R }): unknown }>()

/** How many each column shows, and unfolded (`MoreToggle`, one for them all). */
const MOVERS = 5
const MOVERS_ALL = 20
const all = ref(false)

/** Usage's change where the snapshot has it, else the places'. */
const byUsage = computed(() => props.rows.some((r) => r.change !== undefined))
const delta = (r: R) => (byUsage.value ? r.change : r.climb)
const moved = computed(() =>
  props.rows.flatMap((r) => {
    const d = delta(r)
    return d === undefined ? [] : [{ row: r, d }]
  }),
)
const floor = computed(() => (byUsage.value ? STEADY : 1))
const rising = computed(() =>
  moved.value
    .filter((x) => x.d >= floor.value)
    .sort((a, b) => b.d - a.d)
    .slice(0, MOVERS_ALL),
)
const falling = computed(() =>
  moved.value
    .filter((x) => x.d <= -floor.value)
    .sort((a, b) => a.d - b.d)
    .slice(0, MOVERS_ALL),
)
const fresh = computed(() =>
  props.rows
    .filter((r) => r.fresh)
    .sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
    .slice(0, MOVERS_ALL),
)
const label = (d: number) => (byUsage.value ? points(d) : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`)
// New left out when there are none (rising and falling say so), the columns keeping their width.
const groups = computed(() =>
  [
    { key: 'rising', title: t('trends.rising'), list: rising.value.map((x) => ({ row: x.row, value: label(x.d) })) },
    { key: 'falling', title: t('trends.falling'), list: falling.value.map((x) => ({ row: x.row, value: label(x.d) })) },
    {
      key: 'fresh',
      title: t('trends.new'),
      list: fresh.value.map((row) => ({ row, value: row.usage === undefined ? '' : percent(row.usage) })),
    },
  ].filter((g) => g.key !== 'fresh' || g.list.length),
)
const any = computed(() => groups.value.some((g) => g.list.length))
/** The longest column, for the toggle to unfold to. */
const longest = computed(() => Math.max(0, ...groups.value.map((g) => g.list.length)))
</script>

<template>
  <section class="panel banded trends">
    <h2 class="band">
      {{ title ?? t('trends.title')
      }}<span class="since">{{ about ?? t('trends.since', { dates: since ?? '' }) }}</span>
    </h2>
    <div v-if="any" class="groups">
      <section v-for="g in groups" :key="g.key" :class="g.key">
        <h3
          v-tip="
            tips
              ? g.key === 'fresh'
                ? tips.new
                : tips.points
              : t(g.key === 'fresh' ? 'trends.newTip' : byUsage ? 'trends.pointsTip' : 'trends.placesTip')
          "
          class="tipped"
        >
          {{ g.title }}
        </h3>
        <ol v-if="g.list.length" class="list">
          <li v-for="x in all ? g.list : g.list.slice(0, MOVERS)" :key="x.row.id">
            <AppLink :to="x.row.to" class="entry"><slot name="entry" :row="x.row" /></AppLink>
            <span class="num value">{{ x.value }}</span>
          </li>
        </ol>
        <p v-else class="muted none">{{ t('trends.none') }}</p>
      </section>
    </div>
    <MoreToggle v-if="any" v-model:all="all" :n="longest" :top="MOVERS" />
    <p v-else class="muted none">{{ tips?.none ?? t('trends.steady') }}</p>
  </section>
</template>

<style scoped>
/* The dates after the heading, smaller and lighter. */
.band {
  font-size: 1rem;
}
.since {
  margin-left: 8px;
  font-size: 0.8em;
  font-weight: normal;
  opacity: 0.85;
}
/* Rising, falling and new side by side, one under the other on phones. */
.groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 24px;
}
@media (max-width: 720px) {
  .groups {
    grid-template-columns: minmax(0, 1fr);
  }
}
h3 {
  width: fit-content;
  margin: 0 0 4px;
  font-size: 1em;
}
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 2em;
  border-top: 1px solid var(--border);
}
.list li:first-child {
  border-top: none;
}
.entry {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  /* An icon taller than the line reaches into its room, but no further. */
  margin: -3px 0;
}
.value {
  flex: none;
  font-size: 0.9em;
}
.rising .value {
  color: var(--good);
}
.falling .value {
  color: var(--bad);
}
.fresh .value {
  color: var(--muted);
}
.none {
  margin: 0;
  font-size: 0.9em;
}
</style>
