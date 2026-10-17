<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { ability, pokemon, type AbilityId, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { datasetDates, GENERATED_SNAPSHOTS, has, loadMeta, percent, type MetaData } from '@/data/meta'
import { locale, t } from '@/i18n'
import { description, shortText } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { fold, split } from '@/lib/search'
import { formatTerms, parseTerms, type Term } from '@/lib/searchTerms'
import { POKEMON } from '@/data/pokemon'
import { useRouter } from 'vue-router'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useSlashFocus } from '@/composables/useSlashFocus'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import { useRowColumns } from '@/composables/useRowColumns'
import { useSort } from '@/composables/useSort'
import AppLink from '@/components/AppLink'
import DexText from '@/components/DexText'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import RankingsTabs from '@/components/RankingsTabs.vue'
import TermSearch from '@/components/TermSearch.vue'
import SkeletonRows from '@/components/SkeletonRows.vue'
import SortHeader from '@/components/SortHeader.vue'

// The abilities players run, by usage, from the meta snapshot shown (`useMeta`), as the Pokémon rankings: each with
// its short description, the Pokémon that run it most, and its usage, the teams running it: the usage of each Pokémon
// with it by the share of its sets that run it, summed.
const query = useActiveQuery()
const { snapshot, data, loading } = useMeta()
const hasAbilities = computed(() => !!snapshot.value && has(snapshot.value, 'abilities'))

/** The Pokémon shown with each ability: those whose teams run it most. */
const TOP = 5

type User = { id: PokemonId; share: number; usage: number }
/** Each ability's Pokémon in a snapshot's data: the share of their sets running it, and the usage that brings it. */
function usersOf(d: MetaData) {
  const by = new Map<AbilityId, User[]>()
  for (const [key, m] of Object.entries(d)) {
    for (const a of m!.abilities ?? []) {
      if (!a.share) continue
      const list = by.get(a.id) ?? []
      list.push({ id: key as PokemonId, share: a.share, usage: (m!.usage ?? 0) * a.share })
      by.set(a.id, list)
    }
  }
  return by
}
const usageOf = (list: User[]) => list.reduce((sum, u) => sum + u.usage, 0)
/** Each ability's rank in a snapshot's data, by usage. */
const ranksOf = (by: Map<AbilityId, User[]>) =>
  new Map([...by].sort((a, b) => usageOf(b[1]) - usageOf(a[1])).map(([id], i) => [id, i + 1]))

// Trends, as the Pokémon rankings': against the dataset before the one shown in its series (`previous`, the month
// before), each ability's rank then (a mark by its rank: up or down so many places, or new to it) and the usage it
// gained or lost since, in points. Changes under `STEADY` read as noise: shown, but not colored. That dataset's data
// loads on its own, the trends filling in once it's in.
const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
const prevData = shallowRef<MetaData | null>(null)
watch(
  previous,
  async (s) => {
    prevData.value = null
    if (!s) return
    const d = await loadMeta(s)
    if (previous.value === s) prevData.value = d
  },
  { immediate: true },
)
const before = computed(() => {
  if (!prevData.value) return null
  const by = usersOf(prevData.value)
  return { ranks: ranksOf(by), usage: new Map([...by].map(([id, list]) => [id, usageOf(list)])) }
})
const STEADY = 0.005
/** A change in usage, in percentage points: "+3.2", "−1.8". */
const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

const rows = computed(() => {
  const by = usersOf(data.value ?? {})
  const ranks = ranksOf(by)
  const then = before.value
  return [...by].map(([id, users]) => {
    const usage = usageOf(users)
    const rank = ranks.get(id)!
    const prevRank = then?.ranks.get(id)
    return {
      id,
      name: refName(ability(id)),
      rank,
      usage,
      users: users.sort((a, b) => b.usage - a.usage).slice(0, TOP),
      count: users.length,
      // Places gained (up) or lost since the previous dataset, or whether it's new to it.
      climb: prevRank === undefined ? undefined : prevRank - rank,
      fresh: !!then && prevRank === undefined,
      change: then ? usage - (then.usage.get(id) ?? 0) : undefined,
    }
  })
})
type Row = (typeof rows.value)[number]
type Key = 'rank' | 'name' | 'usage' | 'change'

const { key, desc, toggle, sorted } = useSort<Row, Key>({
  rows,
  value: (r, k) => (k === 'change' ? (r.change ?? -Infinity) : r[k]),
  initial: 'rank',
  startsDesc: (k) => k === 'usage' || k === 'change',
  locale,
  remember: 'abilityUsage',
})

// The search, as the Pokémon rankings': its text finds the list's abilities by name or by what their short description
// says ("terrain", "Speed"), and its terms (`?f=`, picked from what the text finds, `TermSearch`) narrow it to those a
// Pokémon can have, each such Pokémon's share of its sets running each ability a column of its own. While a term is
// highlighted in the search's options (`preview`), the list shows it added, faded a little: what picking it would do.
const router = useRouter()
const TERM_KINDS = ['pokemon'] as const
const terms = computed({
  get: () => parseTerms(query.value.f, TERM_KINDS),
  set: (list: Term[]) => void router.replace({ query: { ...query.value, f: formatTerms(list) } }),
})
const preview = shallowRef<Term | null>(null)
const shownTerms = computed(() => (preview.value ? [...terms.value, preview.value] : terms.value))
type MonTerm = Extract<Term, { kind: 'pokemon' }>
const monTerms = computed(() => shownTerms.value.filter((x): x is MonTerm => x.kind === 'pokemon'))
const matches = (id: AbilityId, term: Term) => term.kind === 'pokemon' && POKEMON[term.id].abilities.includes(id)
const passes = (id: AbilityId, list: readonly Term[] = terms.value) => list.every((x) => matches(id, x))
/** How many of the list a term would leave, added to the others: offered with it. */
const termCount = (term: Term) => rows.value.filter((r) => passes(r.id, [...terms.value, term])).length
/** The share of a Pokémon's sets running an ability, when the snapshot has it. */
const shareOf = (mon: PokemonId, id: AbilityId) => data.value?.[mon]?.abilities?.find((x) => x.id === id)?.share

const termSearch = useTemplateRef('termSearch')
useSlashFocus(() => {
  if (!termSearch.value) return false
  termSearch.value.focus({ preventScroll: true })
})
// The home page's search links here with its query (`?q=`).
const search = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
/** What the text finds: an ability by name, or by its short description, where it's whole words ("rain" finds
 * "rain", not "terrain"). Null with no text. */
const finder = computed(() => {
  const q = fold(search.value.trim())
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const words = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u')
  return (r: Row) => !!split(r.name, q) || words.test(fold(shortText(ability(r.id)) ?? ''))
})
/** How many the text finds, with the terms. */
const named = computed(() => {
  const found = finder.value
  return found ? sorted.value.filter((r) => found(r) && passes(r.id)).length : 0
})
const shown = computed(() => {
  if (preview.value) return sorted.value.filter((r) => passes(r.id, shownTerms.value))
  const found = finder.value
  return sorted.value.filter((r) => (!found || found(r)) && passes(r.id))
})
/** The most used, the full length of the usage bars. */
const top = computed(() => Math.max(0, ...rows.value.map((r) => r.usage)))

const { entered, restoring } = usePageEntered()
useRowColumns(useTemplateRef('head'))
// The columns: rank, the ability, its Pokémon (not on phones, where they go under the row), usage, each Pokémon term's
// share, and the change.
const columns = computed(() => {
  const list: { cell: string; wide: string; sm: string | null }[] = [
    { cell: 'r', wide: 'minmax(3em, auto)', sm: 'minmax(1.8em, auto)' },
    { cell: 'grow', wide: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr)' },
    { cell: 'wide-only', wide: 'var(--users)', sm: null },
    { cell: 'r', wide: '5em', sm: '4em' },
    ...monTerms.value.map(() => ({ cell: 'r', wide: '4.5em', sm: '4em' })),
  ]
  if (previous.value) list.push({ cell: 'r', wide: 'minmax(3.5em, auto)', sm: 'minmax(3em, auto)' })
  return list
})
const colVars = computed(() => ({
  '--cols-wide': columns.value.map((c) => c.wide).join(' '),
  '--cols-sm': columns.value.flatMap((c) => c.sm ?? []).join(' '),
}))
</script>

<template>
  <div>
    <div class="panel banded">
      <RankingsTabs current="abilities" />
      <!-- The dex's list of them, as it links here. -->
      <div class="title-row">
        <h1>{{ t('title.abilityRankings') }}</h1>
        <AppLink :to="{ name: 'abilities' }" class="other-page">{{ t('lists.toDex') }} ›</AppLink>
      </div>
      <p class="muted intro">{{ t('abilityUsage.intro', { reg: snapshot?.regulation ?? REGULATION }) }}</p>
      <template v-if="hasAbilities && snapshot">
        <div class="source">
          <MetaDialog />
          <span v-if="snapshot.battles" class="muted">
            {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
          </span>
        </div>
        <div class="find">
          <TermSearch
            ref="termSearch"
            v-model:text="search"
            hotkey="/"
            v-model:terms="terms"
            v-model:preview="preview"
            :name-count="named"
            :placeholder="t('abilityUsage.search')"
            :kinds="TERM_KINDS"
            :count="termCount"
          />
        </div>
      </template>
      <p v-else class="muted">{{ t('usage.none', { reg: REGULATION }) }}</p>
    </div>
    <div
      v-if="hasAbilities && snapshot"
      class="panel"
      :class="{ 'meta-stale': loading, previewing: preview }"
      :aria-busy="loading"
    >
      <div v-if="!data || shown.length" class="dex-table" :class="{ restoring }" :style="colVars" role="table">
        <div ref="head" class="row head" role="row">
          <SortHeader
            :label="t('usage.rank')"
            :tip="t('usage.rankFull')"
            :class="{ 'with-climb': previous }"
            right
            :active="key === 'rank'"
            :desc="desc"
            @sort="toggle('rank')"
          />
          <SortHeader :label="t('usage.ability')" :active="key === 'name'" :desc="desc" @sort="toggle('name')" />
          <div role="columnheader" class="wide-only">
            <span v-tip="t('abilityUsage.usersTip')" class="tipped">{{ t('abilityUsage.users') }}</span>
          </div>
          <SortHeader
            :label="t('usage.usage')"
            :tip="t('abilityUsage.usageTip')"
            right
            :active="key === 'usage'"
            :desc="desc"
            @sort="toggle('usage')"
          />
          <div
            v-for="x in monTerms"
            :key="x.id"
            v-tip="t('abilityUsage.monShareTip', { name: refName(x) })"
            role="columnheader"
            class="r"
          >
            <PokemonIcon :id="x.id" :scale="0.75" />
          </div>
          <SortHeader
            v-if="previous"
            :label="t('usage.change')"
            :tip="t('usage.changeTip', { dates: datasetDates(previous) })"
            right
            :active="key === 'change'"
            :desc="desc"
            @sort="toggle('change')"
          />
        </div>
        <SkeletonRows v-if="!entered || !data" :cells="columns.map((c) => c.cell)" height="3.4em" />
        <template v-else>
          <div v-for="r in shown" :key="r.id" class="row" role="row">
            <div role="cell" class="r num muted rank">
              {{ r.rank
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
              <AppLink :to="{ name: 'ability', params: { id: r.id } }" class="name">{{ r.name }}</AppLink>
              <p class="muted text"><DexText :text="description('ability', r.id)?.short ?? ''" /></p>
            </div>
            <!-- Its Pokémon: a column of their own on wider screens, a line under the row on phones. -->
            <div role="cell" class="users">
              <AppLink
                v-for="u in r.users"
                :key="u.id"
                v-tip:group="t('abilityUsage.userTip', { name: refName(pokemon(u.id)), share: percent(u.share) })"
                :to="{ name: 'metaPokemon', params: { id: u.id } }"
                :aria-label="refName(pokemon(u.id))"
                class="user"
              >
                <PokemonIcon :id="u.id" />
              </AppLink>
              <span v-if="r.count > r.users.length" class="muted more">+{{ r.count - r.users.length }}</span>
            </div>
            <div role="cell" class="r num meter usage" :style="{ '--share': r.usage / (top || 1) }">
              {{ percent(r.usage) }}
            </div>
            <div
              v-for="x in monTerms"
              :key="x.id"
              role="cell"
              class="r num meter term-share"
              :style="{ '--share': shareOf(x.id, r.id) ?? 0 }"
            >
              {{ shareOf(x.id, r.id) === undefined ? '—' : percent(shareOf(x.id, r.id)!) }}
            </div>
            <div
              v-if="previous"
              role="cell"
              class="r num change"
              :class="r.change !== undefined && Math.abs(r.change) >= STEADY && (r.change > 0 ? 'up' : 'down')"
            >
              {{ r.change === undefined ? '' : points(r.change) }}
            </div>
          </div>
        </template>
      </div>
      <p v-else class="muted">{{ t('abilityUsage.noMatch') }}</p>
      <p class="muted note">{{ t('abilityUsage.usageNote') }}</p>
      <p v-if="previous" class="muted note phone-only-block">
        {{ t('usage.change') }}: {{ t('usage.changeTip', { dates: datasetDates(previous) }) }}.
      </p>
      <p class="muted note">
        {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Rank, the ability (its name over its short description), its Pokémon (room for all five icons and the count after
   them: the rows take the header's widths), its usage, each Pokémon term's share and its change (`columns`). On phones
   its Pokémon go on a line under the row. */
.dex-table {
  --users: calc(5 * 40px + 4 * 2px + 2.5em);
  --cols: var(--cols-wide);
  --row-height: 3.4em;
}
/* The list with a term highlighted in the search's options: a preview, faded a little. */
.previewing .dex-table {
  opacity: 0.75;
}
/* A Pokémon term's share: its bar thinner and muted, as the Pokémon rankings' terms', so it doesn't vie with usage. */
.meter.term-share::after {
  bottom: 4px;
  height: 2px;
  background: var(--muted);
}
.dex-table .row > .grow {
  padding-block: 6px;
}
.text {
  margin: 2px 0 0;
  font-size: 0.85em;
}
.users {
  display: flex;
  align-items: center;
  gap: 2px;
}
.user {
  display: inline-flex;
}
.more {
  margin-left: 4px;
  font-size: 0.85em;
}
@media (max-width: 720px) {
  .dex-table {
    --cols: var(--cols-sm);
  }
  .phone-only-block {
    display: block;
  }
  .dex-table .row > :first-child {
    padding-inline: 6px 4px;
    text-align: left;
  }
  .dex-table .row:not(.head) > .users {
    grid-column: 2 / -1;
    grid-row: 2;
    padding-top: 0;
    padding-bottom: 6px;
  }
  .intro {
    display: none;
  }
}
.usage {
  font-weight: bold;
}
.phone-only-block {
  display: none;
}
/* As the Pokémon rankings': the rank's mark, places gained or lost since the previous dataset or new to it, small after
   the rank in a slot as wide for every rank; and the change in usage, muted while it's steady. */
.rank {
  white-space: nowrap;
}
.climb {
  display: inline-block;
  width: 2.4em;
  margin-left: 3px;
  font-size: 0.75em;
  text-align: left;
  white-space: nowrap;
}
.with-climb :deep(.sort) {
  margin-right: calc(3px + 1.8em);
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
  color: var(--muted);
}
.change.up {
  color: var(--good);
}
.change.down {
  color: var(--bad);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 12px;
}
.find {
  max-width: 480px;
}
/* As the Pokémon rankings' usage: a bar along the bottom of the cell, against the most used one's. */
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
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
