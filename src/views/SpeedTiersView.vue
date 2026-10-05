<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useRouter } from 'vue-router'
import { ability, availableIds, condition, item, pokemon, type PokemonId, type Ref } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { has, percent } from '@/data/meta'
import { locale, t } from '@/i18n'
import { refName } from '@/i18n/refName'
import { fold } from '@/lib/search'
import { center } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'
import { natureEffects, natureName } from '@/data/natures'
import {
  BENCHMARKS,
  SPEED_ABILITIES,
  SPEED_ITEMS,
  benchmark,
  inBattle,
  natureEffect,
  speedStat,
  type Benchmark,
  type SpeedEffect,
  type SpeedMods,
  withEffect,
} from '@/lib/speed'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { usePageEntered } from '@/composables/usePageEntered'
import AppLink from '@/components/AppLink'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SearchBox from '@/components/SearchBox.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

// The regulation's Pokémon ordered by Speed, as a ladder of Speed values with the Pokémon at each. By default the
// meta: the most used Pokémon at the Speeds their sets actually run (from the meta snapshot shown, when it has them);
// with the items and abilities they run that change Speed as chips of their own (boosts); or every Pokémon at
// the Speeds that mark its range (`BENCHMARKS`). Trick Room turns the ladder over; the modifiers, when the reader
// opens them, apply to every Pokémon shown, to read Speeds as they'd be under Tailwind, at +1... Every choice is kept
// in the URL, so a view can be shared.
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
const trickRoom = computed(() => flag('trickroom'))

// The benchmark every Pokémon is at, showing them all: as picked (`?bench=`), else the fastest build, or the slowest
// under Trick Room, which is what matters then.
const isBench = (b: unknown): b is Benchmark => (BENCHMARKS as readonly unknown[]).includes(b)
const defaultBench = computed<Benchmark>(() => (trickRoom.value ? 'min' : 'max'))
const bench = computed<Benchmark>({
  get: () => (isBench(query.value.bench) ? query.value.bench : defaultBench.value),
  set: (b) => set('bench', b === defaultBench.value ? undefined : b),
})

// The modifiers, applied to everyone: shown when the reader opens them, or when the URL sets one; closing them clears
// them, so the ladder is never modified out of sight.
const STAGES = ['-1', '0', '1', '2'] as const
const stage = computed({
  get: () => ((STAGES as readonly string[]).includes(String(query.value.stage)) ? String(query.value.stage) : '0'),
  set: (v: string) => set('stage', v === '0' ? undefined : v),
})
const TOGGLES = ['tailwind', 'scarf', 'doubled', 'paralysis'] as const
type Toggle = (typeof TOGGLES)[number]
const toggleMod = (k: Toggle) => set(k, flag(k) ? undefined : '1')
const mods = computed<SpeedMods>(() => ({
  tailwind: flag('tailwind'),
  scarf: flag('scarf'),
  doubled: flag('doubled'),
  paralysis: flag('paralysis'),
  stage: Number(stage.value),
}))
const modded = computed(() => TOGGLES.some(flag) || stage.value !== '0')
const modsOpen = shallowRef(modded.value)
function onModsToggle(e: Event) {
  const open = (e.target as HTMLDetailsElement).open
  if (!open && modded.value) {
    const q = { ...query.value }
    for (const k of [...TOGGLES, 'stage']) delete q[k]
    void router.replace({ query: q })
  }
  modsOpen.value = open
}
/**
 * Whether boosts show, when the snapshot has the items and abilities they come from: as the URL says (`?boosts=0` or
 * `1`, a shared link), else as the reader last left them, remembered in this browser; on at first.
 */
const boostsAvailable = computed(
  () => !!snapshot.value && has(snapshot.value, 'items') && has(snapshot.value, 'abilities'),
)
const BOOSTS_KEY = 'sproutvgc.speedTiers.boosts'
function savedBoosts(): boolean {
  try {
    return localStorage.getItem(BOOSTS_KEY) !== '0'
  } catch {
    return true
  }
}
const boostsPref = shallowRef(savedBoosts())
const boostsOn = computed(() =>
  query.value.boosts === '0' ? false : query.value.boosts === '1' ? true : boostsPref.value,
)
const showBoosts = computed(() => !showAll.value && boostsAvailable.value && boostsOn.value)
function toggleBoosts() {
  const on = !boostsOn.value
  boostsPref.value = on
  try {
    localStorage.setItem(BOOSTS_KEY, on ? '1' : '0')
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
  // The URL says so only when it differs from the default, so links stay short.
  set('boosts', on ? undefined : '0')
}
const toggleTrickRoom = () => set('trickroom', trickRoom.value ? undefined : '1')

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
  /** An item or ability its sets run that changes Speed (`SPEED_ITEMS`, `SPEED_ABILITIES`), at its most common
   * Speed build. */
  boost?: { ref: Ref<'item' | 'ability'> } & SpeedEffect
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
        const base = POKEMON[id].stats[5]
        // A chip per investment: stat points and nature.
        const list: Entry[] = (m!.speeds ?? [])
          .filter((s) => s.share >= MIN_SHARE)
          .map((s) => ({
            id,
            ...named(id),
            speed: speedStat(base, s.points, natureEffect(s.nature)),
            points: s.points,
            nature: s.nature,
            share: s.share,
            rank: m!.rank,
          }))
        // Its boosts, at its most common build: the data counts items, abilities and spreads apart, so it doesn't say
        // which build goes with them.
        const build = m!.speeds?.[0]
        if (showBoosts.value && build) {
          const speed = speedStat(base, build.points, natureEffect(build.nature))
          const at = { id, ...named(id), points: build.points, nature: build.nature, rank: m!.rank }
          const effects = [
            ...(m!.items ?? []).map((i) => ({ ref: item(i.id), share: i.share, effect: SPEED_ITEMS[i.id] })),
            ...(m!.abilities ?? []).map((a) => ({ ref: ability(a.id), share: a.share, effect: SPEED_ABILITIES[a.id] })),
          ]
          for (const { ref, share, effect } of effects) {
            if (effect && (share ?? 0) >= MIN_SHARE)
              list.push({ ...at, speed: withEffect(speed, effect), share, boost: { ref, ...effect } })
          }
        }
        return list
      })
  }
  // Every Pokémon once, at the benchmark picked.
  const ranks = data.value
  return availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic)
    .map((id) => ({
      id,
      ...named(id),
      speed: benchmark(POKEMON[id].stats[5], bench.value),
      bench: bench.value,
      rank: ranks?.[id]?.rank ?? Infinity,
    }))
})

const find = shallowRef(typeof query.value.q === 'string' ? query.value.q : '')
watch(find, (q) => set('q', q.trim() || undefined))
const isHit = (e: Entry) => {
  const q = fold(find.value.trim())
  return !!q && fold(`${e.species} ${e.forme ?? ''}`).includes(q)
}

/** The ladder: each Speed (with the modifiers) with the Pokémon at it, fastest first (slowest under Trick Room). */
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
type Boost = NonNullable<Entry['boost']>
const factor = (b: Boost) => b.factor.toLocaleString(locale.value)
const boostLabel = (b: Boost) => t('speed.boostLabel', { effect: refName(b.ref), factor: factor(b) })
/** The weather or terrain a boost needs, by name. */
const field = (b: Boost) =>
  b.when === 'always' || b.when === 'itemLost' || b.when === 'status' ? undefined : refName(condition(b.when))
function boostTip(e: Entry) {
  const b = e.boost!
  const f = field(b)
  const when =
    b.when === 'always'
      ? ''
      : ` ${f ? t('speed.when.field', { field: f }) : t(`speed.when.${b.when as 'itemLost' | 'status'}`)}`
  return t('speed.boostTip', {
    effect: refName(b.ref),
    pct: percent(e.share!),
    factor: factor(b),
    when,
    build: t('speed.build', { nature: natureName(e.nature!), points: e.points! }),
  })
}
const tip = (e: Entry) => (e.bench ? undefined : e.boost ? boostTip(e) : investTip(e))
const chipKey = (e: Entry) =>
  `${e.id}:${e.bench ?? (e.boost ? `${e.boost.ref.kind}:${e.boost.ref.id}` : `${e.points}:${e.nature}`)}`

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
// A shared link brings what it points at into view once the ladder is in: its picked row, or else the first Speed its
// search finds.
let scrolled = false
watch(
  () => [ladder.value, tiers.value.length] as const,
  async ([el, n]) => {
    if (scrolled || !el || !n || (at.value === null && !finding.value)) return
    scrolled = true
    await nextTick()
    const target = at.value !== null ? el.querySelector(`[data-speed="${at.value}"]`) : el.querySelector('.tier.hit')
    target?.scrollIntoView({ block: 'center' })
  },
)

// Finding a Pokémon, a floating button goes to the Speed it's at nearest the screen while none of them is on it, an
// arrow saying which way.
const match = shallowRef<{ el: Element; up: boolean; name: string } | null>(null)
function checkMatch() {
  const el = ladder.value
  const hits = finding.value && el ? [...el.querySelectorAll('.tier.hit')] : []
  const vh = window.innerHeight
  let nearest: { el: Element; up: boolean; d: number } | null = null
  for (const hit of hits) {
    const r = hit.getBoundingClientRect()
    if (r.bottom > 0 && r.top < vh) return void (match.value = null)
    const up = r.bottom <= 0
    const d = up ? -r.bottom : r.top - vh
    if (!nearest || d < nearest.d) nearest = { el: hit, up, d }
  }
  // Named after the Pokémon found there.
  const tier = nearest && tiers.value.find((t) => t.speed === Number((nearest.el as HTMLElement).dataset.speed))
  const e = tier?.list.find(isHit)
  match.value = nearest && {
    el: nearest.el,
    up: nearest.up,
    name: e ? [e.species, e.forme].filter(Boolean).join(' ') : '',
  }
}
watch([tiers, find, ladder], () => void nextTick(checkMatch), { flush: 'post' })
window.addEventListener('scroll', checkMatch, { passive: true })
window.addEventListener('resize', checkMatch)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', checkMatch)
  window.removeEventListener('resize', checkMatch)
})
const toMatch = () => center(match.value?.el)

// Once the controls scroll away, a slim bar pinned over the ladder keeps the search and the switches in reach (not on
// phones, where it would take too much of the screen).
const controls = useTemplateRef<HTMLElement>('controls')
const controlsGone = shallowRef(false)
let observer: IntersectionObserver | undefined
watch(
  controls,
  (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new IntersectionObserver(([e]) => {
      controlsGone.value = !e!.isIntersecting && e!.boundingClientRect.top < 0
    })
    observer.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())

const { entered } = usePageEntered()
</script>

<template>
  <div class="panel">
    <h1>{{ t('title.speedTiers') }}</h1>
    <p class="muted">{{ t('speed.intro', { reg: REGULATION }) }}</p>
    <div ref="controls" class="controls">
      <!-- What's shown: the data, which Pokémon, and finding one. -->
      <div class="view-row">
        <MetaPicker v-if="snapshot" />
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
        <SegmentedControl
          v-if="showAll"
          v-model="bench"
          :label="t('speed.at')"
          :options="BENCHMARKS.map((b) => ({ value: b, label: benchLabel(b) }))"
        />
        <div class="find">
          <SearchBox v-model="find" :placeholder="t('speed.find')" :aria-label="t('speed.find')" />
        </div>
      </div>

      <!-- How it's shown: each option with what it does beside it, as tooltips get missed. -->
      <div class="options">
        <div v-if="!showAll && boostsAvailable" class="option">
          <label class="btn switch" :class="{ on: showBoosts }">
            <input type="checkbox" :checked="showBoosts" @change="toggleBoosts" />
            {{ t('speed.boosts') }}
          </label>
          <span class="muted">{{ t('speed.boostsDesc') }}</span>
        </div>
        <div class="option">
          <label class="btn switch" :class="{ on: trickRoom }">
            <input type="checkbox" :checked="trickRoom" @change="toggleTrickRoom" />
            {{ t('speed.mod.trickroom') }}
          </label>
          <span class="muted">{{ t('speed.modTip.trickroom') }}</span>
        </div>
        <details class="modifiers" :open="modsOpen" @toggle="onModsToggle">
          <summary>
            <span class="option-name">{{ t('speed.modifiers') }}</span>
            <span class="muted">{{ t('speed.modifiersTip') }}</span>
          </summary>
          <div class="mods all-mods">
            <button
              v-for="k in TOGGLES"
              :key="k"
              v-tip="t(`speed.modTip.${k}`)"
              type="button"
              class="btn mod"
              :class="{ on: flag(k) }"
              :aria-pressed="flag(k)"
              @click="toggleMod(k)"
            >
              {{ t(`speed.mod.${k}`) }}
            </button>
            <SegmentedControl
              v-model="stage"
              :label="t('speed.stage')"
              :options="STAGES.map((s) => ({ value: s, label: Number(s) > 0 ? `+${s}` : s.replace('-', '−') }))"
            />
          </div>
        </details>
      </div>
    </div>

    <!-- How to read a chip: samples, each with what its parts mean. -->
    <dl v-if="!showAll && snapshot" class="legend small">
      <dt>
        <span class="chip sample"
          ><span class="tag">{{ natureName('timid') }}</span
          ><span class="tag">{{ t('speed.points', { n: 32 }) }}</span
          ><span class="tag">{{ percent(0.461) }}</span></span
        >
      </dt>
      <dd class="muted">{{ t('speed.legendChip', { pct: percent(MIN_SHARE) }) }}</dd>
      <template v-if="showBoosts">
        <dt>
          <span v-tip="t('speed.boostNote')" class="chip sample boost"
            ><span class="tag boost-label"
              ><ItemIcon id="choicescarf" :scale="0.67" />{{ t('speed.legendBoostLabel') }}</span
            ></span
          >
        </dt>
        <dd class="muted">{{ t('speed.legendBoost') }}</dd>
      </template>
    </dl>
    <p v-else class="muted small">{{ t('speed.allNote', { build: benchTip(bench) }) }}</p>

    <!-- Pinned over the ladder once the controls are scrolled away; takes no room of its own. -->
    <div class="pin">
      <div v-if="controlsGone" class="pinned">
        <div class="find">
          <SearchBox v-model="find" :placeholder="t('speed.find')" :aria-label="t('speed.find')" />
        </div>
        <label v-if="!showAll && boostsAvailable" class="btn switch" :class="{ on: showBoosts }">
          <input type="checkbox" :checked="showBoosts" @change="toggleBoosts" />
          {{ t('speed.boosts') }}
        </label>
        <label class="btn switch" :class="{ on: trickRoom }">
          <input type="checkbox" :checked="trickRoom" @change="toggleTrickRoom" />
          {{ t('speed.mod.trickroom') }}
        </label>
      </div>
    </div>

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
          <li v-for="e in tier.list" :key="chipKey(e)">
            <AppLink
              v-tip="tip(e)"
              :to="{ name: 'pokemon', params: { id: e.id } }"
              class="chip"
              :class="{ hit: isHit(e), boost: e.boost }"
            >
              <PokemonIcon :id="e.id" />
              <span>{{ e.species }}</span>
              <span v-if="e.forme" class="forme">{{ e.forme }}</span>
              <template v-if="e.boost">
                <span class="tag boost-label"
                  ><ItemIcon v-if="e.boost.ref.kind === 'item'" :id="e.boost.ref.id" :scale="0.67" />{{
                    boostLabel(e.boost)
                  }}</span
                >
                <span v-if="field(e.boost)" class="tag">{{ field(e.boost) }}</span>
                <span class="tag">{{ percent(e.share!) }}</span>
              </template>
              <template v-else-if="!e.bench">
                <span class="tag">{{ natureName(e.nature!) }}</span>
                <span class="tag">{{ t('speed.points', { n: e.points! }) }}</span>
                <span class="tag">{{ percent(e.share!) }}</span>
              </template>
            </AppLink>
          </li>
        </ul>
      </li>
    </ol>

    <!-- Outside the page so the page transition's transform can't move it. -->
    <Teleport to="body">
      <AnimatePresence>
        <motion.button
          v-if="match"
          type="button"
          class="btn primary to-match"
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: 8 }"
          :transition="FADE"
          :while-press="PRESS"
          @click="toMatch"
        >
          {{ match.name }} {{ match.up ? '↑' : '↓' }}
        </motion.button>
      </AnimatePresence>
    </Teleport>

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
.view-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.find {
  flex: 1 1 14em;
  max-width: 22em;
}
.find :deep(.search-box) {
  margin: 0;
}
/* The options: a name lined up in a column of its own, what it does beside it. */
.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* An option: a switch (a button holding its checkbox), as wide as the others, and what it does beside it. */
.option {
  display: flex;
  align-items: center;
  gap: 10px;
}
.switch {
  flex: none;
  justify-content: flex-start;
  gap: 6px;
  width: var(--switch-width);
  font-weight: bold;
}
.switch.on {
  background: var(--sel);
}
.switch input {
  margin: 0;
}
.options {
  --switch-width: 9.5em;
}
/* The name of the section that opens, lined up with the switches: as wide, less its marker. */
.option-name {
  display: inline-block;
  width: calc(var(--switch-width) - 1em);
  font-weight: bold;
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
/* The modifiers that apply to everyone: a section that opens, its marker in the checkboxes' column. */
.modifiers > summary {
  cursor: pointer;
}
.modifiers > summary .option-name {
  margin-right: 10px;
}
.modifiers[open] > summary {
  margin-bottom: 6px;
}
.all-mods {
  padding: 8px;
  background: var(--panel-alt);
  border: 1px dashed var(--border-strong);
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
/* The bar pinned over the ladder: sticks to the top with no height, the bar itself drawn over the rows. */
.pin {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 0;
}
.pinned {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  background: var(--panel);
  border-bottom: 1px solid var(--border-strong);
}
.pinned .switch {
  width: auto;
}
@media (max-width: 720px) {
  .pin {
    display: none;
  }
}
/* The button to the nearest match, floating at the bottom of the screen as the matchups page's to its results. */
.to-match {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 10;
  translate: -50% 0;
  min-height: 40px;
  padding: 6px 16px;
  font-weight: bold;
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
/* An item's icon before its name. */
.boost-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
/* An item or ability its sets run that changes Speed, told apart from its builds. */
.chip.boost {
  border-style: dashed;
  border-color: var(--border-strong);
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
/* The legend: sample chips, each with what its parts mean. */
.legend {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 4px 10px;
  margin: 12px 0 0;
}
.legend dt,
.legend dd {
  margin: 0;
}
.sample {
  padding: 1px 6px;
}
.sample .tag:first-child {
  padding-left: 0;
  border-left: none;
}
.note + .note {
  margin-top: 4px;
}
</style>
