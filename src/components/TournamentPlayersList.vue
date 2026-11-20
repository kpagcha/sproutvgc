<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { EVENTS } from '@/data/tournaments'
import { loadPlayers, type PlayerRun, type TournamentPlayer } from '@/data/tournamentPlayers'
import { locale, t } from '@/i18n'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useSort } from '@/composables/useSort'
import { medalOf } from '@/lib/tournamentStats'
import AppLink from '@/components/AppLink'
import CountryFlag from '@/components/CountryFlag'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortHeader from '@/components/SortHeader.vue'

// The official tournaments' players, across every event generated (`tournamentPlayers.ts`): each a row with their name
// and country (the way to their page, `PlayerRecordView`), their events, top cuts, Day 2s, record over them and best
// placing, and the six they brought to their latest; sorted by any of those (by top cuts first, then Day 2s, then
// matches won over lost), searched by name (`?q=`) and narrowed to one regulation's events (`?reg=`), the numbers then
// that regulation's alone. The first `PAGE` rows, more on asking.
const PAGE = 50

const router = useRouter()
const query = useActiveQuery()

const all = shallowRef<Map<string, TournamentPlayer> | null>(null)
const failed = shallowRef(false)
loadPlayers().then(
  (p) => (all.value = p),
  () => (failed.value = true),
)

// The regulations with events, the latest first, and the one picked (all of them by default).
const REGULATIONS = [...new Set(EVENTS.map((e) => e.regulation))]
const regulation = computed({
  get: () => {
    const r = query.value.reg
    return typeof r === 'string' && REGULATIONS.includes(r) ? r : 'all'
  },
  set: (r) => void router.replace({ query: { ...query.value, reg: r === 'all' ? undefined : r } }),
})
const regulationOptions = computed(() => [
  { value: 'all', label: t('players.allRegulations') },
  ...REGULATIONS.map((r) => ({ value: r, label: r })),
])

// The search, the URL following it.
const text = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
watch(text, (q) => void router.replace({ query: { ...query.value, q: q || undefined } }))

interface Row {
  slug: string
  name: string
  country: string
  events: number
  topCuts: number
  day2s: number
  wins: number
  losses: number
  best: PlayerRun
  latest: PlayerRun
  /** Their name, folded for the search. */
  folded: string
}
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Each player's numbers over the regulation picked, those with no event in it left out; ordered by top cuts, Day 2s
// and matches won over lost, the order ties keep whatever the sort.
const rows = computed((): Row[] => {
  if (!all.value) return []
  const reg = regulation.value
  const out: Row[] = []
  for (const p of all.value.values()) {
    const runs = reg === 'all' ? p.runs : p.runs.filter((r) => r.event.regulation === reg)
    if (!runs.length) continue
    let wins = 0
    let losses = 0
    let topCuts = 0
    let day2s = 0
    let best = runs[0]!
    for (const r of runs) {
      wins += r.wins
      losses += r.losses
      if (r.stage === 'topCut') topCuts++
      if (r.stage !== 'day1') day2s++
      if (r.placing < best.placing) best = r
    }
    out.push({
      slug: p.slug,
      name: p.name,
      country: p.country,
      events: runs.length,
      topCuts,
      day2s,
      wins,
      losses,
      best,
      latest: runs[0]!,
      folded: fold(p.name),
    })
  }
  return out.sort(
    (a, b) =>
      b.topCuts - a.topCuts ||
      b.day2s - a.day2s ||
      b.wins - b.losses - (a.wins - a.losses) ||
      a.best.placing - b.best.placing ||
      a.name.localeCompare(b.name),
  )
})

const found = computed(() => {
  const q = fold(text.value.trim())
  return q ? rows.value.filter((r) => r.folded.includes(q)) : rows.value
})

type Key = 'name' | 'events' | 'topCuts' | 'day2s' | 'record' | 'best'
const rate = (r: Row) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0)
const { sorted, key, desc, toggle } = useSort<Row, Key>({
  rows: found,
  value: (r, k) =>
    k === 'name' ? r.name : k === 'record' ? rate(r) * 1e4 + r.wins / 1e3 : k === 'best' ? r.best.placing : r[k],
  initial: 'topCuts',
  startsDesc: (k) => k !== 'name' && k !== 'best',
  locale,
  remember: 'tournamentPlayers',
})

// The rows shown: the first `PAGE`, more on asking; back to the first as the list changes.
const shown = shallowRef(PAGE)
watch([text, regulation, key, desc], () => (shown.value = PAGE))
const visible = computed(() => sorted.value.slice(0, shown.value))
const more = computed(() => Math.min(PAGE * 2, sorted.value.length - shown.value))

const num = (n: number) => n.toLocaleString(locale.value)
const pct = (r: Row) =>
  (r.wins + r.losses ? rate(r) : 0).toLocaleString(locale.value, { style: 'percent', maximumFractionDigits: 0 })
const header = (k: Key, label: string, tip?: string, right = true) => ({
  label,
  tip,
  right,
  active: key.value === k,
  desc: desc.value,
  k,
})
const headers = computed(() => [
  header('name', t('players.col.player'), undefined, false),
  header('events', t('players.col.events'), t('players.col.eventsTip')),
  header('topCuts', t('players.col.topCuts'), t('players.col.topCutsTip')),
  header('day2s', t('players.col.day2s'), t('players.col.day2sTip')),
  header('record', t('players.col.record'), t('players.col.recordTip')),
  header('best', t('players.col.best'), t('players.col.bestTip')),
])
</script>

<template>
  <div class="players">
    <div class="controls">
      <SearchBox v-model="text" icon :placeholder="t('players.search')" :aria-label="t('players.search')" />
      <SegmentedControl
        v-if="REGULATIONS.length > 1"
        v-model="regulation"
        :label="t('players.regulation')"
        :options="regulationOptions"
      />
    </div>
    <p v-if="failed" class="muted">{{ t('players.none') }}</p>
    <p v-else-if="!all" class="muted">{{ t('players.loading') }}</p>
    <template v-else>
      <p class="muted small count">{{ t('players.count', { n: num(found.length) }) }}</p>
      <p v-if="!found.length" class="muted">{{ t('players.none') }}</p>
      <div v-else role="table" class="dex-table" :aria-label="t('title.tournamentPlayers')">
        <div role="row" class="row head">
          <SortHeader
            v-for="h in headers"
            :key="h.k"
            :class="[`col-${h.k}`, { r: h.right, 'wide-only': h.k === 'day2s' || h.k === 'events' }]"
            :label="h.label"
            :tip="h.tip"
            :right="h.right"
            :active="h.active"
            :desc="h.desc"
            @sort="toggle(h.k)"
          />
          <div role="columnheader" class="col-team wide-only">{{ t('players.col.team') }}</div>
        </div>
        <AppLink
          v-for="r in visible"
          :key="r.slug"
          v-memo="[r, locale]"
          role="row"
          class="row"
          :to="{ name: 'playerRecord', params: { player: r.slug } }"
        >
          <span role="cell" class="col-name"
            ><span class="name">{{ r.name }}</span> <CountryFlag :code="r.country"
          /></span>
          <span role="cell" class="col-events num wide-only">{{ r.events }}</span>
          <span role="cell" class="col-topCuts num" :class="{ zero: !r.topCuts }">{{ r.topCuts }}</span>
          <span role="cell" class="col-day2s num wide-only" :class="{ zero: !r.day2s }">{{ r.day2s }}</span>
          <span role="cell" class="col-record num"
            >{{ r.wins }}–{{ r.losses }} <span class="muted small pct">{{ pct(r) }}</span></span
          >
          <span v-tip="r.best.event.name" role="cell" class="col-best num"
            ><span class="placing" :class="medalOf(r.best.placing)">#{{ r.best.placing }}</span></span
          >
          <span role="cell" class="col-team team wide-only" :aria-label="t('players.col.team')">
            <PokemonIcon v-for="(p, i) in r.latest.team" :id="p" :key="i" />
          </span>
        </AppLink>
      </div>
      <button v-if="more > 0" type="button" class="more" @click="shown += PAGE * 2">
        {{ t('players.more', { n: num(more) }) }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.875em;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 8px;
}
.controls :deep(.search-box) {
  flex: 1 1 220px;
  margin: 0;
}
.count {
  margin: 0 0 6px;
}
/* The table: the player and their numbers, their latest six at the end. */
.dex-table {
  --cols: minmax(0, 1fr) 5em 5.5em 5em 7em 4em 248px;
}
a.row {
  color: inherit;
  text-decoration: none;
}
a.row:hover {
  background: var(--hover);
}
.col-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  overflow: hidden;
  font-weight: bold;
  color: var(--link);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.num {
  text-align: right;
}
.zero {
  color: var(--muted);
}
.col-record {
  white-space: nowrap;
}
.placing {
  display: inline-block;
  min-width: 2.5em;
  padding: 0 4px;
  text-align: center;
}
.team {
  display: flex;
  justify-content: flex-end;
}
.more {
  display: block;
  margin: 12px auto 0;
}
/* Narrower: no Day 2s nor team, the rest closer. */
@media (max-width: 720px) {
  .dex-table {
    --cols: minmax(0, 1fr) 4.75em 4.25em 3.75em;
  }
  .col-team,
  .pct {
    display: none;
  }
  .dex-table .row > * {
    padding-inline: 3px;
  }
}
</style>
