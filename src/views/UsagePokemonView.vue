<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronsDown, ChevronsUp } from '@lucide/vue'
import { ability, available, move, pokemon, type PokemonId } from '@/data/dex'
import { MOVES } from '@/data/moves'
import { POKEMON, STATS, barAt, gameStats, gameTotal, spriteUrl, statColor } from '@/data/pokemon'
import { datasetDates, GENERATED_SNAPSHOTS, loadHistory, percent, type MetaHistory } from '@/data/meta'
import { natureEffectOn, natureEffects, natureName } from '@/data/natures'
import { locale, t } from '@/i18n'
import { description } from '@/i18n/descriptions'
import { refName } from '@/i18n/refName'
import { speedBuilds } from '@/lib/speed'
import { FASTEST, type SpeedBuild } from '@/lib/speedBuild'
import { odds, reachOf, setSpread, type SpreadPoint } from '@/lib/speedLineup'
import { MAX_POINTS, statValue } from '@/lib/stats'
import { percentiles } from '@/lib/statPercentiles'
import { useMeta } from '@/composables/useMeta'
import AppLink from '@/components/AppLink'
import ItemList from '@/components/ItemList.vue'
import MoveTable from '@/components/MoveTable.vue'
import DexRef from '@/components/DexRef'
import DexText from '@/components/DexText'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import ShareSplit from '@/components/ShareSplit.vue'
import SpeedShare from '@/components/SpeedShare.vue'
import SpeedSpread from '@/components/SpeedSpread.vue'
import TypeIcon from '@/components/TypeIcon'

// One Pokémon in the meta shown (`useMeta`, picked on the back row). Its heading has what matters most to a player: its
// stats as the game shows them, set against the Pokémon it'll face, each marked when its most common nature raises or
// lowers it, and its natures; then, smaller, its rank, usage and how often it's brought. Then what its sets run (moves,
// items, abilities, each with its share of them), its most common exact spreads (each a row of bars: the points in each
// stat, and the stat they give), its Speeds as the speed tiers draw them, its usage over the months of the dataset's
// series, and last its teammates. The dex has the rest of it, a link away.
const route = useRoute()
const id = computed(() => String(route.params.id) as PokemonId)
const ref_ = computed(() => pokemon(id.value))
const exists = computed(() => available(ref_.value))
const mon = computed(() => POKEMON[id.value])
const { snapshot, data, loading } = useMeta()
const m = computed(() => data.value?.[id.value])

// Its rank's change since the dataset before (as the list marks it), and its usage's.
const previous = computed(() => GENERATED_SNAPSHOTS.find((s) => s.id === snapshot.value?.previous))
const climb = computed(() => (m.value?.prev ? m.value.prev.rank - m.value.rank : undefined))
const change = computed(() =>
  m.value?.usage !== undefined && m.value.prev?.usage !== undefined ? m.value.usage - m.value.prev.usage : undefined,
)
const points = (x: number) =>
  (x * 100).toLocaleString(locale.value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

// Its stats as the game shows them (`gameStats`), each a bar colored by its base stat (`statColor`), marked when its
// sets' most common nature raises or lowers it, and set against the Pokémon it'll face: every Pokémon in the snapshot,
// each counting as much as it's used (its usage, the share of teams with it), so the long tail barely counts. Their
// middle half is a band behind the bar, their median a tick through it, and the share of them it's above is said on
// the bar's hover (its base stat on its number's). Base stats go in (Megas as their own, as the meta has them): a stat's place among theirs is the same as the
// game's stat's, which only adds 20 (HP 75) to every one.
const natures = computed(() =>
  (m.value?.natures ?? [])
    .filter((n) => (n.share ?? 0) >= 0.03)
    .slice(0, 3)
    .map((n) => ({ key: n.id, share: n.share })),
)
const topNature = computed(() => natures.value[0]?.key)
// Where there's hover, a nature says what it does, as an item's, ability's or move's name gives its short description.
const canHover = window.matchMedia('(hover: hover)').matches
function natureTip(id: string) {
  const e = natureEffects(id)
  return e ? `${e.plus} ${e.minus}` : t('usageMon.natureNeutral')
}
const field = computed(() =>
  data.value
    ? percentiles(
        Object.entries(data.value).flatMap(([pid, x]) => {
          const p = POKEMON[pid as PokemonId]
          return p && x?.usage ? [{ stats: p.stats, weight: x.usage }] : []
        }),
      )
    : null,
)
/** A base stat as the game shows it, where it falls along the bar. */
const at = (base: number, i: number) => barAt(statValue(base, 0, 'neutral', i === 0))
const stats = computed(() => {
  const values = gameStats(mon.value)
  const f = field.value
  return STATS.map((s, i) => {
    const base = mon.value.stats[i]!
    const rank = f?.rank(i, base) ?? null
    const median = f?.quantile(i, 0.5) ?? null
    const low = f?.quantile(i, 0.25) ?? null
    const high = f?.quantile(i, 0.75) ?? null
    return {
      s,
      v: values[i]!,
      width: `${barAt(values[i]!)}%`,
      base,
      color: statColor(base),
      effect: topNature.value ? natureEffectOn(topNature.value, s) : 'neutral',
      tip: rank === null ? undefined : t('usageMon.statRank', { pct: Math.round(rank * 100) }),
      median: median === null ? null : `${at(median, i)}%`,
      band: low === null || high === null ? null : { left: `${at(low, i)}%`, width: `${at(high, i) - at(low, i)}%` },
    }
  })
})

// What its sets run: its moves, a table as the dex's (type, category, power, accuracy) with the share of its sets
// running each; its items and abilities, a list each, the share as a bar (out of all of them) and a number.
const moves = computed(() =>
  (m.value?.moves ?? []).flatMap((x) => (MOVES[x.id] ? [{ ref: move(x.id), share: x.share }] : [])),
)
const moveShares = computed(() => Object.fromEntries(moves.value.map((x) => [x.ref.id, x.share])))
// Its abilities, in its heading: every one it can have, with the share of its sets running it, the most run first. The
// data keeps those on at least `LIST_MIN` of its sets: one it doesn't have is under that.
const LIST_MIN = 0.01
const abilities = computed(() =>
  mon.value.abilities
    .map((a) => ({ key: a, ref: ability(a), share: m.value?.abilities?.find((x) => x.id === a)?.share }))
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0)),
)
const items = computed(() => (m.value?.items ?? []).map((x) => ({ id: x.id })))
const itemShares = computed(() => Object.fromEntries((m.value?.items ?? []).map((x) => [x.id, x.share])))

// Its most common exact spreads, a row each: its share, its nature, and a bar per stat of the points put there (out of
// `MAX_POINTS`), the one its nature raises in the good color, the one it lowers outlined in the bad; on hover, the stat
// it gives.
const spreads = computed(() =>
  (m.value?.spreads ?? []).map((s) => ({
    ...s,
    stats: STATS.map((stat, i) => {
      const effect = natureEffectOn(s.nature, stat)
      const value = statValue(mon.value.stats[i]!, s.points[i]!, effect, stat === 'hp')
      return { stat, points: s.points[i]!, effect, value }
    }),
  })),
)

// Its Speeds at its sets, as the speed tiers draw a row, with nothing on: the Speeds its builds reach.
const BARE: SpeedBuild = { ...FASTEST, effect: 'neutral', points: 0 }
const spread = computed(() => (m.value?.speeds ? setSpread(id.value, speedBuilds(m.value.speeds), BARE) : []))
// Against the Pokémon it'll face, as the comparison sets one against another at its sets: every Pokémon of the dataset
// at its sets, as one spread, each counting as much as it's used. Its marks take the color of who moves first against
// most of them, and a bar says how often it moves first, ties or moves after (`odds`, `SpeedShare`); the speed pages
// have the rest.
const metaSpeeds = computed((): SpreadPoint[] => {
  const d = data.value
  if (!d) return []
  const bySpeed = new Map<number, number>()
  let total = 0
  for (const [pid, x] of Object.entries(d)) {
    if (!x?.usage || !x.speeds || !POKEMON[pid as PokemonId]) continue
    for (const p of setSpread(pid as PokemonId, speedBuilds(x.speeds), BARE)) {
      bySpeed.set(p.speed, (bySpeed.get(p.speed) ?? 0) + p.share * x.usage)
    }
    total += x.usage
  }
  return [...bySpeed].map(([speed, w]) => ({ speed, share: w / total, builds: [] })).sort((a, b) => b.speed - a.speed)
})
const fieldOdds = computed(() =>
  spread.value.length && metaSpeeds.value.length ? odds(spread.value, metaSpeeds.value, false) : null,
)

// Its usage over the dataset's series, a month each, when the series has more than one.
const history = shallowRef<MetaHistory | null>(null)
watch(
  snapshot,
  async (s) => {
    history.value = null
    const h = s ? await loadHistory(s) : null
    if (snapshot.value === s) history.value = h
  },
  { immediate: true },
)
const months = computed(() => {
  const h = history.value
  const row = h?.pokemon[id.value]
  if (!h || !row) return []
  return h.snapshots.map((s, i) => ({
    id: s.id,
    label: new Date(`${s.from}T00:00:00Z`).toLocaleDateString(locale.value, { month: 'short', timeZone: 'UTC' }),
    dates: datasetDates(s),
    rank: row[i]?.[0],
    usage: row[i]?.[1],
    current: s.id === snapshot.value?.id,
  }))
})
const topMonth = computed(() => Math.max(...months.value.map((x) => x.usage ?? 0), 0.0001))

// Its teammates, the least of it, last: the data keeps the ten most common, those on at least this share of its teams.
const TEAMMATE_MIN = LIST_MIN
const teammates = computed(() => (m.value?.teammates ?? []).filter((x) => available(pokemon(x.id))))
</script>

<template>
  <template v-if="exists">
    <!-- The data shown, on the row of the way back: what the whole page is of. -->
    <Teleport to="#back-actions-usagePokemon" defer>
      <span v-if="snapshot?.battles" class="muted battles">
        {{ t('usage.battles', { n: snapshot.battles.toLocaleString(locale) }) }}
      </span>
      <MetaDialog />
    </Teleport>

    <!-- The heading: who, its stats and what its sets do to them, and how much it's used. -->
    <div class="panel head" :class="{ 'meta-stale': loading }">
      <img
        v-if="!mon.noSprite"
        class="pixel sprite"
        :src="spriteUrl(id)"
        :alt="refName(ref_)"
        width="96"
        height="96"
        draggable="false"
      />
      <span v-else class="sprite icon-sprite"><PokemonIcon :id="id" :scale="2" /></span>
      <div class="facts">
        <h1>{{ refName(ref_) }}</h1>
        <div class="types">
          <AppLink v-for="ty in mon.types" :key="ty" :to="{ name: 'types', params: { type: ty } }">
            <TypeIcon :type="ty" />
          </AppLink>
          <AppLink :to="{ name: 'pokemon', params: { id } }" class="dex-link">{{ t('usageMon.dex') }} ›</AppLink>
        </div>
        <!-- How much it's used, smaller: its rank, usage and how often it's brought, with their changes. -->
        <p v-if="m" class="used">
          <span class="used-part"
            ><strong>#{{ m.rank }}</strong>
            <span v-if="climb" class="climb" :class="climb > 0 ? 'up' : 'down'"
              >{{ climb > 0 ? '▲' : '▼' }}{{ Math.abs(climb) }}</span
            ><span v-else-if="previous && !m.prev" class="climb fresh">{{ t('usage.new') }}</span></span
          >
          <span v-if="m.usage !== undefined" class="used-part"
            ><strong>{{ percent(m.usage) }}</strong>
            <span v-tip="t('usage.usageTip')" class="muted tipped">{{ t('usageMon.usage') }}</span>
            <span v-if="change !== undefined" class="climb" :class="change > 0 ? 'up' : change < 0 && 'down'">{{
              points(change)
            }}</span></span
          >
          <span v-if="m.brought !== undefined" class="used-part"
            ><strong>{{ percent(m.brought) }}</strong>
            <span v-tip="t('usage.broughtTip')" class="muted tipped">{{ t('usageMon.brought') }}</span></span
          >
        </p>
      </div>
      <!-- Its stats as the dex has them, each with its sets' most common nature's mark. -->
      <div class="stats-col">
        <p class="stats-head">
          <span v-tip="t('stats.gameTip')" class="tipped muted">{{ t('stats.game') }}</span>
          <span v-if="field" v-tip="t('usageMon.vsTip')" class="tipped muted">{{ t('usageMon.vs') }}</span>
        </p>
        <table class="stats">
          <tbody>
            <tr v-for="st in stats" :key="st.s">
              <th class="muted" :class="st.effect">
                {{ t(`stat.${st.s}`)
                }}<component
                  :is="st.effect === 'up' ? ChevronsUp : ChevronsDown"
                  v-if="st.effect !== 'neutral'"
                  class="nature-mark"
                  :size="14"
                  :stroke-width="3"
                  aria-hidden="true"
                />
              </th>
              <td v-tip="t('stats.base', { base: st.base })" class="r num">{{ st.v }}</td>
              <td v-tip="st.tip" class="bar-cell">
                <span class="track" :class="{ compared: st.band }">
                  <span v-if="st.band" class="band" :style="st.band"></span>
                  <span class="stat-bar" :style="{ width: st.width, background: st.color }"></span>
                  <span v-if="st.median" class="median" :style="{ left: st.median }"></span>
                </span>
              </td>
            </tr>
            <tr class="total">
              <th v-tip="t('stat.bstFull')" class="muted">{{ t('stat.bst') }}</th>
              <td class="r num">{{ gameTotal(mon) }}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <!-- Its natures, each with what it does and the share of its sets running it. -->
        <!-- Its natures, each with the share of its sets running it, what it does on hover. -->
        <ShareSplit
          v-if="natures.length"
          class="natures"
          :label="t('usageMon.natures')"
          :parts="natures"
          :min="LIST_MIN"
          :tip="(n) => canHover && natureTip(n.key)"
        >
          <template #part="{ part }">{{ natureName(part.key) }}</template>
        </ShareSplit>
      </div>
    </div>

    <div v-if="!m && data" class="panel">
      <p class="muted">{{ t('usageMon.none', { name: refName(ref_) }) }}</p>
    </div>

    <template v-else-if="m">
      <!-- Its abilities, a panel of their own: each with the share of its sets running it and what it does. -->
      <section class="panel abilities-panel" :class="{ 'meta-stale': loading }">
        <h2>{{ t('usageMon.abilities') }}</h2>
        <ul class="abilities">
          <li v-for="(a, i) in abilities" :key="a.key" :class="{ main: i === 0 && a.share }">
            <span class="ability-head">
              <DexRef :to="a.ref" class="ability-name" />
              <span class="num">{{ a.share === undefined ? `<${percent(LIST_MIN)}` : percent(a.share) }}</span>
            </span>
            <span class="bar" :style="{ '--share': a.share ?? 0 }"></span>
            <p class="muted small ability-desc"><DexText :text="description('ability', a.key)?.short ?? ''" /></p>
          </li>
        </ul>
      </section>
      <!-- What its sets run: moves, items, abilities. -->
      <div class="cards" :class="{ 'meta-stale': loading }">
        <section v-if="moves.length" class="panel card moves-card">
          <h2>{{ t('usageMon.moves') }}</h2>
          <MoveTable :ids="moves.map((x) => x.ref.id)" :shares="moveShares" descriptions no-pp no-filters stacked />
        </section>
        <section v-if="items.length" class="panel card items-card">
          <h2>{{ t('usageMon.items') }}</h2>
          <ItemList :items="items" :shares="itemShares" />
        </section>
      </div>

      <!-- Its most common exact spreads: its share, its nature, a bar per stat of the points put there. -->
      <section v-if="spreads.length" class="panel" :class="{ 'meta-stale': loading }">
        <h2>{{ t('usageMon.spreads') }}</h2>
        <div class="spreads" role="table">
          <div class="spread head-row" role="row">
            <span role="columnheader">{{ t('usageMon.share') }}</span>
            <span role="columnheader">{{ t('usageMon.nature') }}</span>
            <span v-for="s in STATS" :key="s" role="columnheader" class="stat-head">{{ t(`stat.${s}`) }}</span>
          </div>
          <div v-for="(s, i) in spreads" :key="i" class="spread" role="row">
            <span role="cell" class="spread-share num meter" :style="{ '--share': s.share ?? 0 }">{{
              percent(s.share ?? 0)
            }}</span>
            <span v-tip:group="canHover && natureTip(s.nature)" role="cell" class="spread-nature">{{
              natureName(s.nature)
            }}</span>
            <span
              v-for="x in s.stats"
              :key="x.stat"
              role="cell"
              class="invest"
              :class="x.effect"
              :aria-label="t('usageMon.spreadStat', { stat: t(`stat.${x.stat}`), points: x.points, value: x.value })"
            >
              <span class="invest-bar" :style="{ '--share': x.points / MAX_POINTS }"></span>
              <span class="invest-text" aria-hidden="true"
                ><span class="invest-pts">{{ x.points }}</span
                ><span class="invest-val"
                  >{{ x.value
                  }}<component
                    :is="x.effect === 'up' ? ChevronsUp : ChevronsDown"
                    v-if="x.effect !== 'neutral'"
                    :size="12"
                    :stroke-width="3" /></span
              ></span>
            </span>
          </div>
        </div>
        <p class="muted small note">{{ t('usageMon.spreadsNote') }}</p>
      </section>

      <!-- Its Speeds, as the speed tiers draw a row, and the ways to them. -->
      <section v-if="spread.length" class="panel" :class="{ 'meta-stale': loading }">
        <h2>{{ t('usageMon.speed') }}</h2>
        <SpeedSpread
          :title="t('usageMon.speedChart', { name: refName(ref_) })"
          :spread="spread"
          tone="yours"
          :other="metaSpeeds.length ? { name: t('usageMon.field'), spread: metaSpeeds, sets: true } : null"
          :reach="reachOf(id, BARE)"
          :trick-room="false"
        />
        <template v-if="fieldOdds">
          <p class="muted small field-note">
            <span v-tip="t('usageMon.fieldTip')" class="tipped">{{ t('usageMon.fieldVs') }}</span>
          </p>
          <SpeedShare :odds="fieldOdds" :name="refName(ref_)" :other="t('usageMon.field')" tone="yours" />
        </template>
        <p class="links">
          <AppLink :to="{ name: 'speedTiers', query: { find: id } }">{{ t('usageMon.toTiers') }} ›</AppLink>
          <AppLink :to="{ name: 'speedCompare', query: { a: id } }">{{ t('usageMon.toCompare') }} ›</AppLink>
        </p>
      </section>

      <!-- Its usage over the months of the dataset's series. -->
      <section v-if="months.length > 1" class="panel">
        <h2>{{ t('usageMon.history') }}</h2>
        <ol class="months" :aria-label="t('usageMon.history')">
          <li
            v-for="x in months"
            :key="x.id"
            v-tip="
              x.usage === undefined
                ? t('usageMon.monthNone', { dates: x.dates })
                : t('usageMon.month', { dates: x.dates, usage: percent(x.usage), rank: x.rank ?? '' })
            "
            :class="{ current: x.current }"
          >
            <span class="month-value">{{ x.usage === undefined ? '—' : percent(x.usage) }}</span>
            <span class="month-bar" :style="{ '--share': (x.usage ?? 0) / topMonth }"></span>
            <span class="month-label">{{ x.label }}</span>
            <span class="month-rank muted">{{ x.rank ? `#${x.rank}` : '' }}</span>
          </li>
        </ol>
      </section>

      <!-- Its teammates, each a link to its own page here: the least of it, last. -->
      <section v-if="teammates.length" class="panel" :class="{ 'meta-stale': loading }">
        <h2 v-tip="t('usageMon.teammatesTip', { share: percent(TEAMMATE_MIN) })" class="tipped-head">
          {{ t('usageMon.teammates') }}
        </h2>
        <ul class="shares mates">
          <li v-for="x in teammates" :key="x.id">
            <AppLink :to="{ name: 'usagePokemon', params: { id: x.id } }" class="what">
              <PokemonIcon :id="x.id" />{{ refName(pokemon(x.id)) }}
            </AppLink>
            <span class="bar" :style="{ '--share': x.share ?? 0 }"></span>
            <span class="num">{{ x.share === undefined ? '—' : percent(x.share) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </template>
  <div v-else class="panel">
    <p>{{ t('usageMon.notFound', { id }) }}</p>
  </div>
</template>

<style scoped>
.battles {
  align-self: center;
  font-size: 0.9em;
}
/* The heading, as the dex's: the sprite, the facts, the stats at the right. */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.sprite {
  flex: none;
  width: 144px;
  height: 144px;
}
.icon-sprite {
  display: flex;
  align-items: center;
  justify-content: center;
}
.facts {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.facts h1 {
  margin: 0;
}
.types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.dex-link {
  margin-left: 8px;
  font-weight: bold;
}
/* How much it's used: a line of its own, smaller than the stats. */
.used {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin: 0;
}
.used-part {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.used strong {
  font-variant-numeric: tabular-nums;
}
.tipped,
.tipped-head {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.tipped-head {
  width: fit-content;
}
.climb {
  margin-left: 4px;
  font-size: 0.85em;
  font-weight: bold;
}
.up {
  color: var(--good);
}
.down {
  color: var(--bad);
}
.fresh {
  color: var(--accent);
}
/* The stats, as the dex's: label, base, bar; then the points its sets put there. */
.stats-col {
  flex: 1 1 360px;
  min-width: 0;
  max-width: 520px;
  margin-left: auto;
}
/* Its natures after their label, those that don't fit on its line going on under the first. */
/* Its abilities: a card each, side by side as there's room, its name and share over a bar, what it does under them;
   the one its sets run most outlined. */
.abilities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.abilities li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.abilities li.main {
  border-color: var(--accent);
}
.ability-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ability-name {
  font-weight: bold;
}
.ability-desc {
  margin: 0;
}
/* Its natures, under its stats. */
.natures {
  margin-top: 10px;
}
.stats {
  width: 100%;
  border-collapse: collapse;
}
.stats th {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}
/* The stat its most common nature raises or lowers: its label in that color, marked. */
.stats th.up,
.stats th.down {
  font-weight: bold;
}
.nature-mark {
  margin-left: 1px;
  vertical-align: -2px;
}
.stats td.r {
  width: 1%;
  padding: 2px 8px 2px 0;
  text-align: right;
}
.bar-cell {
  width: 100%;
  min-width: 60px;
}
.track {
  position: relative;
  display: block;
  height: 10px;
  background: color-mix(in srgb, var(--border) 35%, transparent);
  border-radius: 2px;
}
.stat-bar {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 2px;
}
/* Set against the Pokémon it'll face, a bullet chart: their middle half a band, the bar thinner over it, their median a
   tick through both. */
.track.compared {
  height: 12px;
  border-radius: 0;
}
.band,
.median {
  position: absolute;
}
.band {
  top: 0;
  bottom: 0;
  background: var(--border);
}
.compared .stat-bar {
  inset: 3px auto 3px 0;
  border-radius: 0;
}
.median {
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background: var(--text);
}
/* What the stats are, and what they're set against, each explained on hover. */
.stats-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 14px;
  margin: 0 0 6px;
  font-size: 0.85em;
}
.stats .total td,
.stats .total th {
  padding-top: 6px;
  font-weight: bold;
}
/* The moves at the left, the items at the right (their descriptions under them), each as tall as it is; one under the
   other where they don't fit side by side. */
.cards {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  grid-template-areas: 'moves items';
  gap: 0 16px;
  align-items: start;
}
.moves-card {
  grid-area: moves;
}
.items-card {
  grid-area: items;
}
@media (max-width: 900px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'moves' 'items';
  }
}
/* The share, as the usage list's: its number, its bar under it, out of all of its sets. */
.meter {
  position: relative;
  padding-bottom: 5px;
}
.meter::before,
.meter::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
}
.meter::before {
  right: 0;
  height: 1px;
  background: var(--border);
}
.meter::after {
  width: calc(100% * var(--share, 0));
  height: 3px;
  background: var(--accent);
}
h2 {
  margin-top: 0;
}
/* A list of shares: what, its bar (out of all of its sets), its number. */
.shares {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(40px, 1fr) auto;
  gap: 4px 10px;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shares li {
  display: contents;
}
.mates {
  max-width: 640px;
}
.what {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}
.bar {
  position: relative;
  height: 6px;
  background: color-mix(in srgb, var(--border) 50%, transparent);
}
.bar::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--share, 0));
  background: var(--accent);
}
.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.small {
  font-size: 0.85em;
}
/* The spreads, a row each: share, nature, and a bar per stat of the points in it (out of the most there can be), the
   stat its nature raises in the good color, the one it lowers in the bad. */
.spreads {
  display: grid;
  grid-template-columns: 4.5em minmax(5em, 8em) repeat(6, minmax(0, 1fr));
  gap: 10px 8px;
  align-items: center;
}
.spread {
  display: contents;
}
.head-row > * {
  font-size: 0.85em;
  color: var(--muted);
}
.stat-head {
  text-align: center;
}
/* Its share, as the moves': its number, its bar under it. */
.spread-share {
  justify-self: start;
  min-width: 3.6em;
  text-align: left;
}
.spread-nature {
  font-weight: bold;
  white-space: nowrap;
}
/* A stat of a spread: a bar of its points, on a faint track, with over it the points (muted) at its start and the stat
   they give at its end, the nature's mark after it: the bar the good color under the stat the nature raises, the cell
   outlined in the bad around the one it lowers. */
.invest {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 22px;
  background: color-mix(in srgb, var(--border) 40%, transparent);
}
.invest-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% * var(--share, 0));
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.invest.up .invest-bar {
  background: color-mix(in srgb, var(--good) 55%, transparent);
}
.invest.down {
  box-shadow: inset 0 0 0 1px var(--bad);
}
.invest-text {
  position: relative;
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0 5px;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.invest-pts {
  color: var(--muted);
}
.invest-val {
  display: inline-flex;
  align-items: center;
  font-weight: bold;
}
.invest.down .invest-val {
  color: var(--bad);
}
.note {
  margin: 10px 0 0;
}
.field-note {
  margin: 12px 0 6px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 12px 0 0;
  font-weight: bold;
}
/* Its usage by month: a bar each, from a common floor, as tall as its usage against its best month's; the month shown
   marked. */
.months {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin: 0;
  padding: 0;
  list-style: none;
}
.months li {
  display: flex;
  flex: 0 1 72px;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.month-value {
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.month-bar {
  width: 60%;
  height: calc(4px + 96px * var(--share, 0));
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.current .month-bar {
  background: var(--accent);
}
.current .month-label {
  font-weight: bold;
}
.month-rank {
  font-size: 0.8em;
}
/* Phones: the sprite smaller, beside the name, types and use; the stats under them, the whole width. */
@media (max-width: 560px) {
  .head {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
  }
  .sprite {
    width: 96px;
    height: 96px;
  }
  .icon-sprite :deep(.sheet-icon) {
    zoom: 0.5;
  }
  .stats-col {
    grid-column: 1 / -1;
    margin: 0;
  }
  /* The spreads: share and nature on a line, the stats' bars under them. */
  .spreads {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px 6px;
  }
  .head-row > :nth-child(-n + 2) {
    display: none;
  }
  .spread-share {
    grid-column: 1 / 4;
    margin-top: 6px;
  }
  .spread-nature {
    grid-column: 4 / -1;
    margin-top: 6px;
  }
}
</style>
