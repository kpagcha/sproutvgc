<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { has, percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import { natureEffects, natureName } from '@/data/natures'
import { BENCHMARKS, benchmark, inBattle, natureEffect, speedStat, type Benchmark, type SpeedMods } from '@/lib/speed'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import AppLink from '@/components/AppLink'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The regulation's Pokémon ordered by Speed, as a ladder of Speed values with the Pokémon at each. By default the
// meta: the most used Pokémon at the Speeds their sets actually run (from the meta snapshot shown, when it has them);
// or every Pokémon at the Speeds that mark its range (`BENCHMARKS`). Battle modifiers apply to everyone shown. Every
// choice is kept in the URL, so a view can be shared.
const router = useRouter()
const query = useActiveQuery()
const flag = (k: string) => query.value[k] === '1'
function set(k: string, v: string | undefined) {
  void router.replace({ query: { ...query.value, [k]: v } })
}

/** How many of the most used Pokémon the meta view shows, and the least share of a Pokémon's sets a Speed needs. */
const TOP = 50
const MIN_SHARE = 0.03

// The snapshot shown is the one picked on any page (`useMeta`).
const { snapshot, data } = useMeta()
const metaAvailable = computed(() => !!snapshot.value && has(snapshot.value, 'speeds'))

const showAll = computed(() => !metaAvailable.value || flag('all'))
const STAGES = ['-1', '0', '1', '2'] as const
const stage = computed({
  get: () => ((STAGES as readonly string[]).includes(String(query.value.stage)) ? String(query.value.stage) : '0'),
  set: (v: string) => set('stage', v === '0' ? undefined : v),
})
const TOGGLES = ['tailwind', 'trickroom', 'scarf', 'doubled', 'paralysis'] as const
type Toggle = (typeof TOGGLES)[number]
const on = (k: Toggle) => flag(k)
const toggle = (k: Toggle) => set(k, on(k) ? undefined : '1')
const mods = computed<SpeedMods>(() => ({
  tailwind: on('tailwind'),
  scarf: on('scarf'),
  doubled: on('doubled'),
  paralysis: on('paralysis'),
  stage: Number(stage.value),
}))
const trickRoom = computed(() => on('trickroom'))

interface Entry {
  id: PokemonId
  species: string
  forme?: string
  speed: number
  /** How its sets get there, stat points and nature, and their share of its sets (the meta), or the benchmark it is
   * (every Pokémon). */
  points?: number
  nature?: string
  share?: number
  bench?: Benchmark
  /** Its usage rank, to order the Pokémon at the same Speed. */
  rank: number
}

const named = (id: PokemonId) => splitForme(id, refName(pokemon(id)))
const entries = computed<Entry[]>(() => {
  if (!showAll.value) {
    if (!data.value) return []
    return Object.entries(data.value)
      .filter(([, m]) => m!.rank <= TOP)
      .flatMap(([key, m]) => {
        const id = key as PokemonId
        // A chip per investment: stat points and nature.
        return (m!.speeds ?? [])
          .filter((s) => s.share >= MIN_SHARE)
          .map((s) => ({
            id,
            ...named(id),
            speed: speedStat(POKEMON[id].stats[5], s.points, natureEffect(s.nature)),
            points: s.points,
            nature: s.nature,
            share: s.share,
            rank: m!.rank,
          }))
      })
  }
  const ranks = data.value
  return availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic)
    .flatMap((id) =>
      BENCHMARKS.map((bench) => ({
        id,
        ...named(id),
        speed: benchmark(POKEMON[id].stats[5], bench),
        bench,
        rank: ranks?.[id]?.rank ?? Infinity,
      })),
    )
})

const find = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
watch(find, (q) => set('q', q.trim() || undefined))
const isHit = (e: Entry) => {
  const q = fold(find.value.trim())
  return !!q && fold(`${e.species} ${e.forme ?? ''}`).includes(q)
}

/** The ladder: each Speed in battle with the Pokémon at it, fastest first (slowest under Trick Room). */
const tiers = computed(() => {
  const bySpeed = new Map<number, Entry[]>()
  for (const e of entries.value) {
    const s = inBattle(e.speed, mods.value)
    bySpeed.set(s, [...(bySpeed.get(s) ?? []), e])
  }
  const dir = trickRoom.value ? 1 : -1
  return [...bySpeed]
    .sort((a, b) => (a[0] - b[0]) * dir)
    .map(([speed, list]) => {
      const sorted = list.sort(
        (a, b) =>
          a.rank - b.rank || (b.share ?? 0) - (a.share ?? 0) || a.species.localeCompare(b.species, locale.value),
      )
      return { speed, list: sorted, hit: sorted.some(isHit) }
    })
})
const finding = computed(() => !!find.value.trim())

const benchLabel = (b: Benchmark) => t(`speed.bench.${b}`)
const benchTip = (b: Benchmark) => t(`speed.benchTip.${b}`)
function investTip(e: Entry) {
  const effects = natureEffects(e.nature!)
  return t('speed.invest', {
    points: e.points!,
    nature: natureName(e.nature!),
    effect: effects ? ` (${effects.plus} ${effects.minus})` : '',
    pct: percent(e.share!),
  })
}

// A Speed's row links to the page as it is with that row picked (`?at=`): clicking its number picks it (or drops it,
// when picked already) and copies the link. A shared link brings the row into view once the ladder is in.
const at = computed(() => (typeof query.value.at === 'string' ? Number(query.value.at) : null))
const rowHref = (speed: number) => router.resolve({ query: { ...query.value, at: String(speed) } }).href
const copied = shallowRef<number | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function share(speed: number) {
  if (at.value === speed) return set('at', undefined)
  set('at', String(speed))
  try {
    await navigator.clipboard.writeText(new URL(rowHref(speed), location.href).href)
    copied.value = speed
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = null), 1500)
  } catch {
    // No clipboard (an insecure page, or permission denied): the address bar has the link.
  }
}
const ladder = useTemplateRef<HTMLElement>('ladder')
let scrolled = false
watch(
  () => [ladder.value, tiers.value.length] as const,
  async ([el, n]) => {
    if (scrolled || !el || !n || at.value === null) return
    scrolled = true
    await nextTick()
    el.querySelector(`[data-speed="${at.value}"]`)?.scrollIntoView({ block: 'center' })
  },
)

const { entered } = usePageEntered()
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.speedTiers') }}</h1>
    <p class="muted">{{ t('speed.intro', { reg: REGULATION }) }}</p>
    <div class="controls">
      <div v-if="snapshot" class="segment-row">
        <MetaPicker />
        <SegmentedControl
          v-if="metaAvailable"
          :model-value="showAll ? 'all' : 'meta'"
          :label="t('speed.show')"
          :options="[
            { value: 'meta', label: t('speed.meta', { n: TOP }) },
            { value: 'all', label: t('speed.all') },
          ]"
          @update:model-value="(v: string) => set('all', v === 'all' ? '1' : undefined)"
        />
      </div>
      <div class="mods">
        <button
          v-for="k in TOGGLES"
          :key="k"
          v-tip="t(`speed.modTip.${k}`)"
          type="button"
          class="btn mod"
          :class="{ on: on(k) }"
          :aria-pressed="on(k)"
          @click="toggle(k)"
        >
          {{ t(`speed.mod.${k}`) }}
        </button>
        <SegmentedControl
          v-model="stage"
          :label="t('speed.stage')"
          :options="STAGES.map((s) => ({ value: s, label: Number(s) > 0 ? `+${s}` : s.replace('-', '−') }))"
        />
      </div>
      <SearchBox v-model="find" :placeholder="t('speed.find')" :aria-label="t('speed.find')" />
    </div>
    <p v-if="!showAll && snapshot" class="muted small">
      {{ t('speed.metaNote', { pct: percent(MIN_SHARE) }) }}
    </p>
    <p v-else class="muted small">{{ t('speed.allNote') }}</p>

    <div v-if="!entered || (!showAll && !data)" class="ladder" aria-hidden="true">
      <div v-for="i in 12" :key="i" class="tier skeleton"><span class="bone"></span></div>
    </div>
    <ol v-else ref="ladder" class="ladder" :class="{ finding }">
      <li
        v-for="tier in tiers"
        :key="tier.speed"
        class="tier"
        :class="{ hit: tier.hit, at: tier.speed === at }"
        :data-speed="tier.speed"
      >
        <a
          v-tip="t('speed.rowLink')"
          :href="rowHref(tier.speed)"
          class="speed num"
          :aria-current="tier.speed === at ? 'true' : undefined"
          @click.prevent="share(tier.speed)"
          >{{ tier.speed
          }}<span v-if="copied === tier.speed" class="copied" role="status">{{ t('speed.copied') }}</span></a
        >
        <ul class="mons">
          <li v-for="e in tier.list" :key="`${e.id}:${e.bench ?? `${e.points}:${e.nature}`}`">
            <AppLink
              v-tip="e.bench ? benchTip(e.bench) : investTip(e)"
              :to="{ name: 'pokemon', params: { id: e.id } }"
              class="chip"
              :class="{ hit: isHit(e) }"
            >
              <PokemonIcon :id="e.id" />
              <span>{{ e.species }}</span>
              <span v-if="e.forme" class="forme">{{ e.forme }}</span>
              <span v-if="e.bench" class="tag">{{ benchLabel(e.bench) }}</span>
              <template v-else>
                <span class="tag">{{ natureName(e.nature!) }}</span>
                <span class="tag">{{ t('speed.points', { n: e.points! }) }}</span>
                <span class="tag">{{ percent(e.share!) }}</span>
              </template>
            </AppLink>
          </li>
        </ul>
      </li>
    </ol>

    <p class="muted small note">{{ t('speed.megaNote') }}</p>
    <p v-if="!showAll && snapshot" class="muted small note">
      {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
    </p>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.segment-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.mods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mod {
  min-height: 0;
  padding: 6px 10px;
  line-height: inherit;
}
.mod.on {
  background: var(--sel);
}
.small {
  font-size: calc(13px * var(--text-scale));
}
.ladder {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
/* A Speed, and the Pokémon at it: the number in a column of its own, the chips wrapping beside it. */
.tier {
  display: grid;
  grid-template-columns: 3.5em 1fr;
  align-items: start;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid var(--border);
}
.speed {
  position: relative;
  padding-top: 4px;
  font-weight: bold;
  text-align: right;
  color: inherit;
  text-decoration: none;
}
.speed:hover {
  text-decoration: underline;
}
/* The row a link picked. */
.tier.at {
  background: var(--sel);
  box-shadow: inset 3px 0 var(--accent);
}
.copied {
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 1;
  padding: 1px 6px;
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border-strong);
}
.mons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 2px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  white-space: nowrap;
}
.forme,
.tag {
  font-size: 0.85em;
  color: var(--muted);
}
.tag {
  padding-left: 4px;
  border-left: 1px solid var(--border);
}
/* Finding a Pokémon: its chips marked, the Speeds without it faded. */
.chip.hit {
  background: var(--sel);
  border-color: var(--border-strong);
}
.finding .tier:not(.hit) {
  opacity: 0.4;
}
.skeleton {
  height: 2.2em;
}
.bone {
  display: inline-block;
  width: 40%;
  height: 0.8em;
  margin-left: calc(3.5em + 8px);
  background: var(--border);
  border-radius: 2px;
  opacity: 0.6;
}
.note {
  margin: 12px 0 0;
}
.note + .note {
  margin-top: 4px;
}
</style>
