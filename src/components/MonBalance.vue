<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { ability as abilityRef, item as itemRef, move, pokemon, type PokemonId } from '@/data/dex'
import type { MetaData, MetaSnapshot } from '@/data/meta'
import { natureName } from '@/data/natures'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { useMetaBalance } from '@/composables/useMetaBalance'
import {
  LANE_KEYS,
  metaLadder,
  offenseModeOf,
  type OffenseMode,
  type Placed,
  type Plotted,
  type Side,
} from '@/lib/teamBalance'
import AppLink from '@/components/AppLink'
import BalanceLanes, { type LaneView } from '@/components/BalanceLanes.vue'
import CategoryIcon from '@/components/CategoryIcon'
import DexRef from '@/components/DexRef'
import ItemIcon from '@/components/ItemIcon.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SegmentedControl from '@/components/SegmentedControl.vue'

// A Pokémon's bulk and power against the meta, on its meta page: the rankings' overview (`MetaOverview`) turned on one
// Pokémon. Two cards, its bulk and its power (by stats alone or with moves, as the overview, sharing its choice), each
// either the team builder's chart (`BalanceLanes`: the meta's spread on each side, this one on it) or a list: the
// meta's Pokémon as a ladder on each side, strongest first, each at its most common set (`metaLadder`), this one among
// them, with how much stronger or weaker each is than it; around it until the whole ladder's asked for. Which of the
// two, remembered (`sproutvgc.monBalance.view`). This one is placed as every other is, at its most common spread,
// ability and item, which each row of the list says.
const props = defineProps<{
  mon: PokemonId
  snapshot: MetaSnapshot | undefined
  data: MetaData | null | undefined
}>()
const balance = useMetaBalance(
  computed(() => props.snapshot),
  computed(() => props.data),
)
const state = computed(() => (balance.value === undefined ? 'pending' : balance.value === null ? 'none' : undefined))

/** A choice kept in the browser, its value checked by `read`. */
function stored<T extends string>(key: string, read: (saved: string | null) => T | null, fallback: T) {
  const r = shallowRef<T>(fallback)
  try {
    r.value = read(localStorage.getItem(key)) ?? fallback
  } catch {
    // Storage unavailable: the default.
  }
  watch(r, (v) => {
    try {
      localStorage.setItem(key, v)
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  })
  return r
}
// Measured as the rankings' overview is, the same choice.
const mode = stored<OffenseMode>('sproutvgc.metaOverview.mode', offenseModeOf, 'stats')
type View = 'chart' | 'list'
const view = stored<View>('sproutvgc.monBalance.view', (s) => (s === 'chart' || s === 'list' ? s : null), 'chart')
const modes = computed(() => [
  { value: 'stats' as const, label: t('builder.balance.modeStats') },
  { value: 'moves' as const, label: t('builder.balance.modeMoves') },
])
const views = computed(() => [
  { value: 'chart' as const, label: t('monBalance.chart') },
  { value: 'list' as const, label: t('monBalance.list') },
])

const SIDES = ['physical', 'special'] as const
type Kind = 'defense' | 'offense'
const KINDS = ['defense', 'offense'] as const

const ladders = computed(() => {
  const b = balance.value
  const d = props.data
  if (!b || !d) return null
  return { defense: metaLadder(d, b, 'defense', props.mon), offense: metaLadder(d, b, mode.value, props.mon) }
})
const own = (kind: Kind, side: Side) => ladders.value?.[kind][side].find((p) => p.pokemon === props.mon) ?? null

const pct = (x: number) => `${Math.round(x * 100)}%`
const sideName = (s: Side) => t(s === 'physical' ? 'builder.balance.physical' : 'builder.balance.special')

// The chart: the meta's shape on each side, this one on it.
function lanesOf(kind: Kind): LaneView[] {
  const b = balance.value
  const split = b?.physicalShare ?? null
  return SIDES.map((side) => {
    const p = own(kind, side)
    return {
      side,
      label: sideName(side),
      sub: kind === 'offense' && b && !p ? t('monBalance.noSide') : undefined,
      tip:
        kind === 'defense' && split !== null
          ? t(`builder.balance.share.${side}`, { pct: pct(side === 'physical' ? split : 1 - split) })
          : undefined,
      shape: b?.[LANE_KEYS[kind === 'defense' ? 'defense' : mode.value][side]].shape ?? null,
      peakShape: kind === 'offense' && mode.value === 'moves' ? (b?.[LANE_KEYS.peak[side]].shape ?? null) : null,
      points: p ? [p] : [],
      mean: null,
    }
  })
}
const lanes = computed(() => ({ defense: lanesOf('defense'), offense: lanesOf('offense') }))

/** Where a Pokémon stands, in words: how much of the meta it's bulkier than, or hits harder than. */
const standing = (kind: Kind, side: Side, rank: number) =>
  kind === 'defense'
    ? t('builder.balance.bulkierThan', { pct: pct(rank) })
    : t(side === 'physical' ? 'builder.balance.physHarder' : 'builder.balance.specHarder', { pct: pct(rank) })
function tipOf(kind: Kind) {
  return (p: Plotted, side: Side) => {
    const how = p.move
      ? refName(move(p.move))
      : kind === 'defense'
        ? ''
        : `${t(side === 'physical' ? 'stat.atk' : 'stat.spa')} ${Math.round(p.value)}`
    const where = p.rank === null ? '' : standing(kind, side, p.rank)
    return [refName(pokemon(p.pokemon)), how, where, p.mixed ? t('builder.balance.mixedTip') : '']
      .filter(Boolean)
      .join(' · ')
  }
}
const tips = { defense: tipOf('defense'), offense: tipOf('offense') }
const noMean = () => ''
const ends = computed(() => ({
  defense: [t('builder.balance.frailer'), t('builder.balance.bulkier')] as [string, string],
  offense: [t('builder.balance.softer'), t('builder.balance.harder')] as [string, string],
}))

// The list: each side's ladder, around this one (`AROUND` each way, or the top ones where it isn't on it) until the
// whole of it is asked for.
const AROUND = 5
const unfolded = shallowRef(new Set<string>())
function toggle(key: string) {
  const s = new Set(unfolded.value)
  if (!s.delete(key)) s.add(key)
  unfolded.value = s
}
interface Rung {
  p: Placed
  pos: number
  self: boolean
  /** How much stronger (or weaker) than this one, as a ratio less one; null for this one, or where it's not on it. */
  vs: number | null
}
interface Ladder {
  side: Side
  key: string
  total: number
  self: Placed | null
  pos: number
  rows: Rung[]
  folded: boolean
}
function ladderOf(kind: Kind, side: Side): Ladder {
  const all = ladders.value?.[kind][side] ?? []
  const pos = all.findIndex((p) => p.pokemon === props.mon)
  const self = pos >= 0 ? all[pos]! : null
  const key = `${kind}:${side}`
  const whole = unfolded.value.has(key)
  const [from, to] = whole
    ? [0, all.length]
    : pos >= 0
      ? [Math.max(0, pos - AROUND), Math.min(all.length, pos + AROUND + 1)]
      : [0, Math.min(all.length, AROUND * 2 + 1)]
  const rows = all.slice(from, to).map((p, i) => ({
    p,
    pos: from + i + 1,
    self: p.pokemon === props.mon,
    vs: self && p.pokemon !== props.mon ? p.value / self.value - 1 : null,
  }))
  return { side, key, total: all.length, self, pos: pos + 1, rows, folded: to - from < all.length }
}
const lists = computed(() => ({
  defense: SIDES.map((side) => ladderOf('defense', side)),
  offense: SIDES.map((side) => ladderOf('offense', side)),
}))

const signed = (x: number) =>
  (x * 100).toLocaleString(locale.value, { signDisplay: 'exceptZero', maximumFractionDigits: 0 }) + '%'
/** The stats a rung's value is made of, as the game shows them: HP and its defending stat, or its attacking stat. */
function statsOf(kind: Kind, side: Side, p: Placed): string {
  const names =
    kind === 'defense'
      ? ['stat.hp', side === 'physical' ? 'stat.def' : 'stat.spd']
      : [side === 'physical' ? 'stat.atk' : 'stat.spa']
  return p.stats.map((v, i) => `${t(names[i] as 'stat.hp')} ${Math.round(v)}`).join(' / ')
}

// Each card's heading explains, on hover, how the meta is pooled.
const defenseHow = useTemplateRef<HTMLElement>('defenseHow')
const offenseHow = useTemplateRef<HTMLElement>('offenseHow')
const how = computed(() => ({ defense: defenseHow.value, offense: offenseHow.value }))
const titles = computed(() => ({ defense: t('overview.bulk'), offense: t('overview.attack') }))
</script>

<template>
  <section class="panel mon-balance">
    <div class="head">
      <h2>{{ t('overview.title') }}</h2>
      <SegmentedControl v-model="view" class="soft" :label="t('monBalance.view')" :options="views" />
    </div>
    <p class="muted small about">{{ t('monBalance.about') }}</p>
    <div hidden>
      <div ref="defenseHow" class="how">
        <p>{{ t('builder.balance.howDef') }}</p>
        <p>{{ t('builder.balance.howMeta') }}</p>
      </div>
      <div ref="offenseHow" class="how">
        <p>{{ t('builder.balance.howAtk') }}</p>
        <p v-if="mode === 'moves'">{{ t('builder.balance.howMoves') }}</p>
        <p>{{ t('builder.balance.howMeta') }} {{ t('builder.balance.howMetaAtk') }}</p>
      </div>
    </div>
    <div class="cards">
      <section v-for="kind in KINDS" :key="kind" class="card">
        <header class="card-head">
          <h3 v-tip="how[kind]" class="tipped" tabindex="0" :aria-label="how[kind]?.textContent ?? undefined">
            {{ titles[kind] }}
          </h3>
          <SegmentedControl
            v-if="kind === 'offense'"
            v-model="mode"
            class="mode soft"
            :label="t('builder.balance.modeLabel')"
            :tip="t('builder.balance.modeTip')"
            :options="modes"
          />
        </header>
        <BalanceLanes
          v-if="view === 'chart'"
          :lanes="lanes[kind]"
          :ends="ends[kind]"
          :tip="tips[kind]"
          :mean-tip="noMean"
          :state
          :rows="2"
        />
        <p v-else-if="state === 'pending'" class="muted small">…</p>
        <p v-else-if="state === 'none'" class="muted small">{{ t('builder.balance.noMeta') }}</p>
        <div v-else class="ladders">
          <section v-for="l in lists[kind]" :key="l.side" class="ladder" :class="l.side">
            <h4>
              <CategoryIcon :category="l.side" />{{ sideName(l.side) }}
              <span v-if="l.self" class="muted small standing"
                >#{{ l.pos }} · {{ standing(kind, l.side, l.self.rank ?? 0) }}</span
              >
            </h4>
            <p v-if="!l.self" class="muted small">{{ t('monBalance.notOn') }}</p>
            <ol class="rungs">
              <li v-for="r in l.rows" :key="r.p.pokemon" :class="{ self: r.self }">
                <span class="pos">{{ r.pos }}</span>
                <PokemonIcon :id="r.p.pokemon" />
                <span class="who">
                  <AppLink v-if="!r.self" :to="{ name: 'metaPokemon', params: { id: r.p.pokemon } }" class="name">{{
                    refName(pokemon(r.p.pokemon))
                  }}</AppLink>
                  <strong v-else class="name">{{ refName(pokemon(r.p.pokemon)) }}</strong>
                  <span class="set muted small">
                    <span v-tip="t('monBalance.statsTip')">{{ statsOf(kind, l.side, r.p) }}</span>
                    <span v-if="r.p.nature">{{ natureName(r.p.nature) }}</span>
                    <DexRef v-if="r.p.ability" :to="abilityRef(r.p.ability)" meta />
                    <span v-if="r.p.item" class="item"
                      ><ItemIcon :id="r.p.item" /><DexRef :to="itemRef(r.p.item)" meta
                    /></span>
                    <DexRef v-if="r.p.move" :to="move(r.p.move)" meta class="move" />
                  </span>
                </span>
                <span v-if="r.vs !== null" v-tip="t('monBalance.vsTip', { pct: signed(r.vs) })" class="vs">{{
                  signed(r.vs)
                }}</span>
                <span v-else-if="r.self" class="vs muted small">{{ t('monBalance.self') }}</span>
              </li>
            </ol>
            <button
              v-if="l.total > l.rows.length || !l.folded"
              type="button"
              class="more"
              :aria-pressed="!l.folded"
              @click="toggle(l.key)"
            >
              {{
                l.folded
                  ? t('monBalance.all', { n: l.total })
                  : l.self
                    ? t('monBalance.around')
                    : t('monBalance.top', { n: AROUND * 2 + 1 })
              }}
            </button>
          </section>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.head h2 {
  margin: 0;
}
.about {
  margin: 4px 0 12px;
}
.cards {
  display: grid;
  gap: 12px;
}
.card {
  min-width: 0;
  padding: 12px 14px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}
.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 12px;
}
.card-head h3 {
  margin: 0;
  font-size: 0.78em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.card-head h3.tipped {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}
.how {
  max-width: 22rem;
}
.how p {
  margin: 0;
}
.how p + p {
  margin-top: 6px;
}
.mode {
  margin-left: auto;
  font-size: 0.9em;
  flex-wrap: wrap;
  row-gap: 4px;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .mode {
    margin-left: 0;
  }
}

/* The list: the two sides' ladders side by side, one under the other on phones. */
.ladders {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 16px;
}
.ladder {
  min-width: 0;
}
.ladder h4 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
}
.standing {
  font-weight: normal;
}
.rungs {
  margin: 0;
  padding: 0;
  list-style: none;
}
.rungs li {
  display: grid;
  grid-template-columns: 2.2em auto 1fr auto;
  align-items: center;
  gap: 2px 6px;
  padding: 3px 6px;
  border-bottom: 1px solid var(--border);
}
.rungs li.self {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  box-shadow: inset 3px 0 0 var(--accent);
}
.pos {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  text-align: right;
}
.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.set {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
}
.item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.vs {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.more {
  margin-top: 8px;
}
</style>
