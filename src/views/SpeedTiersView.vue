<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useRouter } from 'vue-router'
import { ChevronsDown, ChevronsUp, CircleHelp } from '@lucide/vue'
import { ability, availableIds, condition, item, pokemon, type PokemonId, type Ref } from '@/data/dex'
import { REGULATION } from '@/data/format'
import { POKEMON, splitForme } from '@/data/pokemon'
import { currentSnapshots, distinctLabel, has, percent } from '@/data/meta'
import { locale, t, tSlots, tSplit } from '@/i18n'
import { refName } from '@/i18n/refName'
import { center, reveal } from '@/lib/scroll'
import { FADE, PRESS } from '@/lib/motion'
import { natureEffects, natureName } from '@/data/natures'
import {
  NATURE_EFFECTS,
  NATURES_BY_EFFECT,
  pointsToMoveFirst,
  SPEED_ABILITIES,
  SPEED_ITEMS,
  inBattle,
  natureEffect,
  speedStat,
  type SpeedEffect,
  type SpeedMods,
  withEffect,
} from '@/lib/speed'
import { BENCHMARKS, MAX_POINTS, benchmark, type Benchmark, type NatureEffect } from '@/lib/stats'
import { useActiveQuery } from '@/composables/useActiveQuery'
import { useMeta } from '@/composables/useMeta'
import { useOpenState } from '@/composables/useOpenState'
import { usePageEntered } from '@/composables/usePageEntered'
import AppLink from '@/components/AppLink'
import ItemIcon from '@/components/ItemIcon.vue'
import MetaPicker from '@/components/MetaPicker.vue'
import PokemonIcon from '@/components/PokemonIcon'
import PokemonPicker from '@/components/PokemonPicker.vue'
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
function toggleMods() {
  const open = !modsOpen.value
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
// Megas show unless the URL turns them off (`?megas=0`).
const showMegas = computed(() => query.value.megas !== '0')
const toggleMegas = () => set('megas', showMegas.value ? '0' : undefined)

// Your Pokémon: one, at the Speed its nature's effect and stat points give it, with modifiers of its own (the others'
// apply to everyone else), placed on the ladder among them. All in the URL: `mine`, `mynat`, `mypts`, `mymods` and
// `mystage`; and `vs`, the chip it's measured against.
const mine = computed(() => {
  const id = query.value.mine
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
const isEffect = (e: unknown): e is NatureEffect => (NATURE_EFFECTS as readonly unknown[]).includes(e)
const myNature = computed<NatureEffect>(() => (isEffect(query.value.mynat) ? query.value.mynat : 'up'))
const myPoints = computed(() => {
  const n = Number(query.value.mypts)
  return Number.isInteger(n) && n >= 0 && n <= MAX_POINTS ? n : MAX_POINTS
})
const MY_TOGGLES = ['tailwind', 'scarf', 'ironball', 'doubled', 'paralysis'] as const
type MyToggle = (typeof MY_TOGGLES)[number]
const myToggles = computed(
  () =>
    new Set(
      String(query.value.mymods ?? '')
        .split(',')
        .filter((m): m is MyToggle => (MY_TOGGLES as readonly string[]).includes(m)),
    ),
)
const myStage = computed(() =>
  (STAGES as readonly string[]).includes(String(query.value.mystage)) ? String(query.value.mystage) : '0',
)
const myMods = computed<SpeedMods>(() => ({
  tailwind: myToggles.value.has('tailwind'),
  scarf: myToggles.value.has('scarf'),
  ironBall: myToggles.value.has('ironball'),
  doubled: myToggles.value.has('doubled'),
  paralysis: myToggles.value.has('paralysis'),
  stage: Number(myStage.value),
}))
// Its modifiers fold away as the others' do: shown when the page comes with some on, folding them turns them off.
const myModded = computed(() => myToggles.value.size > 0 || myStage.value !== '0')
const myModsOpen = shallowRef(myModded.value)
function toggleMyMods() {
  const open = !myModsOpen.value
  if (!open && myModded.value) {
    const q = { ...query.value }
    delete q.mymods
    delete q.mystage
    void router.replace({ query: q })
  }
  myModsOpen.value = open
}
const mySpeed = computed(() =>
  mine.value === null
    ? null
    : inBattle(speedStat(POKEMON[mine.value].stats[5], myPoints.value, myNature.value), myMods.value),
)

/**
 * Picks your Pokémon, at the meta's most common build of it when there is one, else the fastest. The page stays where
 * it is, so the ladder's opponents band is the first of it you see; the Speed's button shows where it landed.
 */
function pickMine(id: PokemonId | null) {
  if (!id) return
  const build = data.value?.[id]?.speeds?.[0]
  void router.replace({
    query: {
      ...query.value,
      mine: id,
      mynat: build ? natureEffect(build.nature) : 'up',
      mypts: String(build ? build.points : MAX_POINTS),
      vs: undefined,
    },
  })
}
function clearMine() {
  const q = { ...query.value }
  for (const k of ['mine', 'mynat', 'mypts', 'mymods', 'mystage', 'vs']) delete q[k]
  void router.replace({ query: q })
}
const setMyNature = (e: NatureEffect) => set('mynat', e)
const setMyPoints = (v: string) => {
  const n = Math.round(Number(v))
  if (Number.isFinite(n)) set('mypts', String(Math.min(MAX_POINTS, Math.max(0, n))))
}
/** Turns one of your modifiers on or off: a Choice Scarf and an Iron Ball can't be held together. */
function toggleMine(k: MyToggle) {
  const on = new Set(myToggles.value)
  if (on.has(k)) on.delete(k)
  else {
    on.add(k)
    if (k === 'scarf') on.delete('ironball')
    if (k === 'ironball') on.delete('scarf')
  }
  set('mymods', on.size ? [...on].join(',') : undefined)
}
const setMyStage = (v: string) => set('mystage', v === '0' ? undefined : v)
/** The nature effects' choice shows them as arrows beside "Spe", up and down, neutral as a word. */
const EFFECT_ICONS = { up: ChevronsUp, neutral: undefined, down: ChevronsDown }
/** The natures of an effect, by name: listed, as the effect is all Speed cares about. */
const naturesOf = (e: NatureEffect) =>
  e === 'neutral' ? t('speed.naturesNeutral') : NATURES_BY_EFFECT[e].map(natureName).join(', ')

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
  /** Your Pokémon, with its own modifiers rather than the others'. */
  mine?: true
  /** Its usage rank, to order the Pokémon at the same Speed: the same for all of them when every one shows, which
   * shows no usage, so they go by name. */
  rank: number
}

const named = (id: PokemonId) => splitForme(id, refName(pokemon(id)))
const entries = computed<Entry[]>(() => {
  if (!showAll.value) {
    if (!data.value) return []
    return Object.entries(data.value)
      .filter(([key, m]) => m!.rank <= TOP && (showMegas.value || !POKEMON[key as PokemonId].mega))
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
  return availableIds('pokemon')
    .filter((id) => !POKEMON[id].cosmetic && (showMegas.value || !POKEMON[id].mega))
    .map((id) => ({
      id,
      ...named(id),
      speed: benchmark(POKEMON[id].stats[5], bench.value),
      bench: bench.value,
      rank: 0,
    }))
})

// Finding a Pokémon: one picked from those on the ladder (`?find=`), its chips marked and the rest dimmed.
const found = computed(() => {
  const id = query.value.find
  return typeof id === 'string' && id in POKEMON ? (id as PokemonId) : null
})
const setFound = (id: PokemonId | null) => set('find', id ?? undefined)
const onLadder = computed(() => [...new Set(entries.value.map((e) => e.id))])
const isHit = (e: Entry) => !e.mine && e.id === found.value
// What finding does: mark its chips among the rest, or show only them (and yours, to compare): only them by default;
// the URL says so (`?findmode=`) only when it differs.
const FIND_MODES = ['mark', 'only'] as const
type FindMode = (typeof FIND_MODES)[number]
const defaultFindMode: FindMode = 'only'
const findMode = computed<FindMode>({
  get: () =>
    (FIND_MODES as readonly unknown[]).includes(query.value.findmode)
      ? (query.value.findmode as FindMode)
      : defaultFindMode,
  set: (m) => set('findmode', m === defaultFindMode ? undefined : m),
})
const onlyFound = computed(() => found.value !== null && findMode.value === 'only')
// The toggle's label around the found Pokémon's icon, the same width whatever its name (which the search shows).
const onlyLabel = computed(() => tSplit('speed.findOnly', 'name'))

/** The ladder: each Speed (with the modifiers) with the Pokémon at it, fastest first (slowest under Trick Room). */
const tiers = computed(() => {
  const bySpeed = new Map<number, Entry[]>()
  for (const e of entries.value) {
    if (onlyFound.value && e.id !== found.value) continue
    const s = inBattle(e.speed, mods.value)
    bySpeed.set(s, [...(bySpeed.get(s) ?? []), e])
  }
  // Yours, first at its Speed.
  if (mine.value !== null && mySpeed.value !== null) {
    const yours: Entry = { id: mine.value, ...named(mine.value), speed: mySpeed.value, mine: true, rank: -1 }
    bySpeed.set(mySpeed.value, [...(bySpeed.get(mySpeed.value) ?? []), yours])
  }
  const dir = trickRoom.value ? 1 : -1
  return [...bySpeed]
    .sort((a, b) => (a[0] - b[0]) * dir)
    .map(([speed, list]) => {
      // Yours first, then by usage and by how many of its sets are at that Speed, then by name: species, then forme,
      // the species' own first.
      const sorted = list.sort(
        (a, b) =>
          a.rank - b.rank ||
          (b.share ?? 0) - (a.share ?? 0) ||
          a.species.localeCompare(b.species, locale.value) ||
          (a.forme ?? '').localeCompare(b.forme ?? '', locale.value),
      )
      return { speed, list: sorted, hit: sorted.some(isHit) }
    })
})
const finding = computed(() => found.value !== null)
/** How many Pokémon the ladder holds, each once however many Speeds it's at. */
const monCount = computed(
  () => new Set(tiers.value.flatMap((t) => t.list.filter((e) => !e.mine).map((e) => e.id))).size,
)
const ladder = useTemplateRef<HTMLElement>('ladder')

// How yours does against the others shown: the share of them it moves before, ties and moves after, weighted by usage
// in the meta (each build by its Pokémon's usage and its share of its sets; boosts left out, as they're those same
// sets boosted), or each Pokémon alike when showing them all.
const summary = computed(() => {
  if (mySpeed.value === null) return null
  const tally = { first: 0, ties: 0, after: 0 }
  let total = 0
  for (const e of entries.value) {
    if (e.boost) continue
    const w = showAll.value ? 1 : (data.value?.[e.id]?.usage ?? 0) * (e.share ?? 0)
    const theirs = inBattle(e.speed, mods.value)
    const k = theirs === mySpeed.value ? 'ties' : mySpeed.value > theirs !== trickRoom.value ? 'first' : 'after'
    tally[k] += w
    total += w
  }
  if (!total) return null
  return { first: tally.first / total, ties: tally.ties / total, after: tally.after / total }
})

// The chip yours is measured against (`?vs=`, picked by tapping it while yours is set), and what it takes to move
// before it, for each nature effect.
const versus = computed(() => {
  if (mine.value === null || typeof query.value.vs !== 'string') return null
  const e = entries.value.find((x) => chipKey(x) === query.value.vs)
  if (!e) return null
  const target = inBattle(e.speed, mods.value)
  const base = POKEMON[mine.value].stats[5]
  return {
    e,
    target,
    byEffect: NATURE_EFFECTS.map((effect) => ({
      effect,
      result: pointsToMoveFirst(base, effect, myMods.value, target, trickRoom.value),
    })),
  }
})
// Its title, the Pokémon's name (with its icon) a link to its page.
const vsTitle = computed(() => tSlots('speed.vs'))
// Picking one finds it too, the find showing as its "Only" switch says.
function pickVersus(e: Entry) {
  const vs = query.value.vs === chipKey(e) ? undefined : chipKey(e)
  void router.replace({ query: { ...query.value, vs, ...(vs && { find: e.id }) } })
}
function onChip(ev: MouseEvent, e: Entry) {
  if (mine.value === null || ev.ctrlKey || ev.metaKey || ev.shiftKey) return
  ev.preventDefault()
  ev.stopPropagation()
  if (!e.mine) pickVersus(e)
}
function versusText(r: ReturnType<typeof pointsToMoveFirst>) {
  if (!r) return t('speed.vsNever')
  if ('from' in r) return r.from === 0 ? t('speed.vsAny') : t('speed.vsFrom', { points: r.from })
  if ('upTo' in r) return r.upTo === MAX_POINTS ? t('speed.vsAny') : t('speed.vsUpTo', { points: r.upTo })
  return t('speed.vsTies', { points: r.ties })
}
const toMine = () => center(ladder.value?.querySelector('.tier.has-mine'))
// To the ladder from yours' card, when it isn't beside it: the ladder's top brought up, its find flashing once (not
// focused, so no keyboard comes up) to say it's where to look for an opponent.
const listPanel = useTemplateRef<HTMLElement>('listPanel')
const flashFind = shallowRef(false)
async function toOpponents() {
  reveal(listPanel.value, listPanel.value)
  flashFind.value = false
  await nextTick()
  flashFind.value = true
}

const benchLabel = (b: Benchmark) => t(`stat.bench.${b}`)
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
/** When a boost applies, in short, for its chip: the weather or terrain, or what has to happen first. */
const whenTag = (b: Boost) => (b.when === 'itemLost' || b.when === 'status' ? t(`speed.whenShort.${b.when}`) : field(b))
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
  e.mine
    ? 'mine'
    : `${e.id}:${e.bench ?? (e.boost ? `${e.boost.ref.kind}:${e.boost.ref.id}` : `${e.points}:${e.nature}`)}`

// A Speed's row links to the page as it is with that row picked (`?at=`): clicking its number picks it (or drops it,
// when picked already) and copies the link. A shared link brings the row into view once the ladder is in.
const at = computed(() => (typeof query.value.at === 'string' ? Number(query.value.at) : null))
const rowHref = (speed: number) => router.resolve({ query: { ...query.value, at: String(speed) } }).href
const copied = shallowRef<number | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function share(speed: number) {
  if (at.value === speed) return set('at', undefined)
  set('at', String(speed))
  if (!(await copy(new URL(rowHref(speed), location.href).href))) return
  copied.value = speed
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = null), 1500)
}

/**
 * Copies `text`, saying whether it could. The clipboard API only exists on secure pages (not the dev server opened
 * over the LAN, as on a phone), so elsewhere it goes through a hidden field and the older copy command. When neither
 * works, the address bar still has the link.
 */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position: fixed; opacity: 0; pointer-events: none'
    document.body.append(field)
    field.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      field.remove()
    }
  }
}
// A shared link brings what it points at into view once the ladder is in: its picked row, or else the first Speed its
// search finds. Only the link it came with: a row or a Pokémon picked later doesn't move the page (the floating
// button, below, goes to the Pokémon found).
let scrolled = false
watch(
  () => [ladder.value, tiers.value.length] as const,
  async ([el, n]) => {
    if (scrolled || !el || !n) return
    scrolled = true
    if (at.value === null && !finding.value) return
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
watch([tiers, found, ladder], () => void nextTick(checkMatch), { flush: 'post' })
window.addEventListener('scroll', checkMatch, { passive: true })
window.addEventListener('resize', checkMatch)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', checkMatch)
  window.removeEventListener('resize', checkMatch)
})
const toMatch = () => center(match.value?.el)

// Once the ladder's top scrolls past the screen's (the controls and the legend gone), a slim bar pinned over it keeps
// the search and the switches in reach. A marker where the ladder starts says when.
const pinMark = useTemplateRef<HTMLElement>('pinMark')
const pinned = shallowRef(false)
let observer: IntersectionObserver | undefined
watch(
  pinMark,
  (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new IntersectionObserver(([e]) => {
      pinned.value = !e!.isIntersecting && e!.boundingClientRect.top < 0
    })
    observer.observe(el)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())

// How to read the page, in a section closed unless the reader opens it (remembered), so the ladder starts close to the
// top: the chips' legend, and on phones the intro and what each option does too (wide screens show them beside what
// they explain). Opened from the intro's line, apart from the controls, as it changes nothing shown.
const { open: helpOpen, toggle: toggleHelp } = useOpenState('sproutvgc.speedTiers.helpOpen', false)

// The controls fold away (open at first, then as the reader last left them) once the reader has the view they want,
// what's active then said in short beside the heading: what's shown, and every switch and modifier away from its default.
const isOpen = (e: Event) => (e.target as HTMLDetailsElement).open
const { open: controlsOpen, toggle: toggleControls } = useOpenState('sproutvgc.speedTiers.controlsOpen', true)
const stageLabel = (s: string) => (Number(s) > 0 ? `+${s}` : s.replace('-', '−'))
const active = computed(() => {
  const list: string[] = []
  if (snapshot.value && !showAll.value && currentSnapshots().length > 1) list.push(distinctLabel(snapshot.value))
  list.push(showAll.value ? `${t('speed.all')} · ${benchLabel(bench.value)}` : t('speed.meta', { n: TOP }))
  if (showBoosts.value) list.push(t('speed.boosts'))
  if (!showMegas.value) list.push(t('speed.noMegas'))
  if (trickRoom.value) list.push(t('speed.mod.trickroom'))
  for (const k of TOGGLES) if (flag(k)) list.push(t(`speed.mod.${k}`))
  if (stage.value !== '0') list.push(t('speed.stageShort', { stage: stageLabel(stage.value) }))
  return list
})

/** Whether the screen has hover, for tooltips: touch screens show what matters inline instead. */
const canHover = window.matchMedia('(hover: hover)').matches

// Yours' card: always open beside the ladder; narrower, it opens and closes, closed at first (remembered), but open
// when the page comes with yours set (a shared link).
const { open: yoursOpen, toggle: toggleYours } = useOpenState('sproutvgc.speedTiers.yoursOpen', false)
if (query.value.mine) yoursOpen.value = true

/** Whether the sidebar (yours) shows beside the ladder: from 1100px. Narrower, a comparison shows in a card. */
const sideQuery = window.matchMedia('(min-width: 1100px)')
const side = shallowRef(sideQuery.matches)
const onSide = (e: MediaQueryListEvent) => (side.value = e.matches)
sideQuery.addEventListener('change', onSide)
onBeforeUnmount(() => sideQuery.removeEventListener('change', onSide))

const { entered } = usePageEntered()
</script>

<template>
  <!-- The controls and the ladder in panels of their own. -->
  <div>
    <!-- A section that folds, as yours does: its heading, with what's active in short beside it while folded (under it
         on phones), and what folds it. -->
    <!-- Their headings open and close them themselves, rather than leaving it to the browser, so the section and what
         changes with it (what's active, the arrow) change at once, however fast the taps come; the browser opening one
         itself (finding text in it) is followed. -->
    <details class="panel instant" :open="controlsOpen" @toggle="controlsOpen = isOpen($event)">
      <summary class="head" @click.prevent="toggleControls">
        <!-- With yours picked, everything the controls set is for the others: its opponents. -->
        <h1>
          {{ t('title.speedTiers') }}<span v-if="mine" class="opponents"> ({{ t('speed.opponents') }})</span>
        </h1>
        <ul v-if="!controlsOpen" class="active" :aria-label="t('speed.active')">
          <li v-for="a in active" :key="a">{{ a }}</li>
        </ul>
        <span class="fold">
          <span class="marker" aria-hidden="true">{{ controlsOpen ? '▾' : '▸' }}</span
          >{{ t(controlsOpen ? 'speed.hideControls' : 'speed.showControls') }}
        </span>
      </summary>
      <div class="fold-body">
        <!-- The intro, and how to read the page: a link-like toggle beside it, apart from the controls. -->
        <p class="lede">
          <span class="muted wide-only">{{ t('speed.intro', { reg: REGULATION }) }}</span>
          <button
            type="button"
            class="help-toggle"
            :aria-expanded="helpOpen"
            aria-controls="speed-help"
            @click="toggleHelp"
          >
            <CircleHelp :size="16" aria-hidden="true" /><span>{{ t('speed.help') }}</span>
          </button>
        </p>
        <!-- How to read a chip: samples, each with what its parts mean; on phones, the intro and the options too. -->
        <div v-if="helpOpen" id="speed-help" class="help-body panel sunken">
          <div class="phone-only-block small">
            <p class="muted">{{ t('speed.intro', { reg: REGULATION }) }}</p>
            <dl class="help-options">
              <template v-if="!showAll && boostsAvailable">
                <dt>{{ t('speed.boosts') }}</dt>
                <dd class="muted">{{ t('speed.boostsDesc') }}</dd>
              </template>
              <dt>{{ t('speed.megas') }}</dt>
              <dd class="muted">{{ t('speed.megasDesc') }}</dd>
              <dt>{{ t('speed.mod.trickroom') }}</dt>
              <dd class="muted">{{ t('speed.modTip.trickroom') }}</dd>
              <dt>{{ t('speed.modifiers') }}</dt>
              <dd class="muted">{{ t('speed.modifiersTip') }}</dd>
            </dl>
          </div>
          <p class="formula muted small">{{ t('speed.formula') }}</p>
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
                <span class="chip sample boost"
                  ><span class="tag boost-label"
                    ><ItemIcon id="choicescarf" :scale="0.67" />{{ t('speed.legendBoostLabel') }}</span
                  ></span
                >
              </dt>
              <dd class="muted">
                {{ t('speed.legendBoost') }}
              </dd>
            </template>
          </dl>
          <p v-else class="muted small">{{ t('speed.allNote', { build: benchTip(bench) }) }}</p>
        </div>
        <div class="controls">
          <!-- What's shown: the data, and which Pokémon. -->
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
          </div>

          <!-- How it's shown: each option with what it does beside it, as tooltips get missed. -->
          <div class="options">
            <template v-if="!showAll && boostsAvailable">
              <label class="btn switch" :class="{ on: showBoosts }">
                <input type="checkbox" :checked="showBoosts" @change="toggleBoosts" />
                {{ t('speed.boosts') }}
              </label>
              <span class="muted">{{ t('speed.boostsDesc') }}</span>
            </template>
            <label class="btn switch" :class="{ on: showMegas }">
              <input type="checkbox" :checked="showMegas" @change="toggleMegas" />
              {{ t('speed.megas') }}
            </label>
            <span class="muted">{{ t('speed.megasDesc') }}</span>
            <label class="btn switch" :class="{ on: trickRoom }">
              <input type="checkbox" :checked="trickRoom" @change="toggleTrickRoom" />
              {{ t('speed.mod.trickroom') }}
            </label>
            <span class="muted">{{ t('speed.modTip.trickroom') }}</span>
            <button type="button" class="disclosure" :aria-expanded="modsOpen" @click="toggleMods">
              <span class="marker" aria-hidden="true">{{ modsOpen ? '▾' : '▸' }}</span
              >{{ t('speed.modifiers') }}
            </button>
            <span class="muted">{{ t('speed.modifiersTip') }}</span>
            <div v-if="modsOpen" class="mods all-mods">
              <button
                v-for="k in TOGGLES"
                :key="k"
                v-tip="canHover && t(`speed.modTip.${k}`)"
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
                :options="STAGES.map((s) => ({ value: s, label: stageLabel(s) }))"
              />
            </div>
          </div>
        </div>
      </div>
    </details>

    <div class="speed-layout">
      <div ref="listPanel" class="panel banded soft list">
        <!-- With yours picked, the ladder is its opponents: said over it, with what tapping one does. -->
        <div v-if="mine" class="band opponents-head">
          <strong>{{ t('speed.opponentsHead') }}</strong>
          <span>{{ t('speed.opponentsHint') }}</span>
        </div>
        <!-- Finding a Pokémon on the ladder: a band on top, over its header, which sits on the rows as a table's does. -->
        <div class="band find find-row" :class="{ flash: flashFind }" @animationend="flashFind = false">
          <PokemonPicker
            :model-value="found"
            :ids="onLadder"
            :placeholder="t('speed.find')"
            list-width-of=".find-row"
            @update:model-value="setFound"
          />
          <label v-if="found" class="btn switch find-mode" :class="{ on: onlyFound }">
            <input
              type="checkbox"
              :checked="onlyFound"
              :aria-label="t('speed.findOnly', { name: refName(pokemon(found)) })"
              @change="findMode = onlyFound ? 'mark' : 'only'"
            />
            {{ onlyLabel[0] }}<PokemonIcon :id="found" />{{ onlyLabel[1] }}
          </label>
          <button v-if="found" type="button" class="btn" @click="setFound(null)">{{ t('speed.clear') }}</button>
        </div>
        <!-- What the ladder is: its numbers, which way it runs, and how many Pokémon it holds. -->
        <div class="band ladder-head">
          <!-- The stat's shorthand, as narrow as the column of Speeds it heads. -->
          <span v-tip="canHover && t('speed.column')" :aria-label="t('speed.column')">{{ t('stat.spe') }}</span>
          <span>{{ t(trickRoom ? 'speed.slowestFirst' : 'speed.fastestFirst') }}</span>
          <span v-if="entered && (showAll || data)" class="muted">{{ t('speed.count', { n: monCount }) }}</span>
        </div>
        <!-- Pinned over the ladder once the controls are scrolled away; takes no room of its own. -->
        <div ref="pinMark" aria-hidden="true"></div>
        <div class="pin">
          <div v-if="pinned" class="pinned">
            <div class="find">
              <PokemonPicker
                :model-value="found"
                :ids="onLadder"
                :placeholder="t('speed.findShort')"
                list-width-of=".pinned"
                @update:model-value="setFound"
              />
              <label v-if="found" class="btn switch find-mode" :class="{ on: onlyFound }">
                <input
                  type="checkbox"
                  :checked="onlyFound"
                  :aria-label="t('speed.findOnly', { name: refName(pokemon(found)) })"
                  @change="findMode = onlyFound ? 'mark' : 'only'"
                />
                {{ onlyLabel[0] }}<PokemonIcon :id="found" />{{ onlyLabel[1] }}
              </label>
            </div>
            <label v-if="!showAll && boostsAvailable" class="btn switch" :class="{ on: showBoosts }">
              <input type="checkbox" :checked="showBoosts" @change="toggleBoosts" />
              {{ t('speed.boosts') }}
            </label>
            <label class="btn switch" :class="{ on: trickRoom }">
              <input
                type="checkbox"
                :checked="trickRoom"
                :aria-label="t('speed.mod.trickroom')"
                @change="toggleTrickRoom"
              />
              <!-- "TR" on phones, the usual shorthand, so the bar fits on one line. -->
              <span class="long" aria-hidden="true">{{ t('speed.mod.trickroom') }}</span>
              <span class="short" aria-hidden="true">{{ t('speed.trShort') }}</span>
            </label>
          </div>
        </div>

        <div v-if="!entered || (!showAll && !data)" class="ladder" aria-hidden="true">
          <div v-for="i in 12" :key="i" class="tier skeleton"><span class="bone"></span></div>
        </div>
        <ol v-else ref="ladder" class="ladder" :class="{ finding: finding && !onlyFound }">
          <li
            v-for="tier in tiers"
            :key="tier.speed"
            class="tier"
            :class="{ hit: tier.hit, at: tier.speed === at, 'has-mine': tier.list.some((e) => e.mine) }"
            :data-speed="tier.speed"
          >
            <a
              v-tip="canHover && t('speed.rowLink')"
              :href="rowHref(tier.speed)"
              class="speed num"
              :aria-current="tier.speed === at ? 'true' : undefined"
              @click.prevent="share(tier.speed)"
              >{{ tier.speed
              }}<span v-if="copied === tier.speed" class="copied" role="status">{{ t('speed.copied') }}</span></a
            >
            <ul class="mons">
              <!-- With yours set, a tap on a chip measures yours against it (caught before the link follows); the link
                 still opens in a new tab. -->
              <li v-for="e in tier.list" :key="chipKey(e)" @click.capture="onChip($event, e)">
                <AppLink
                  v-tip="canHover && !e.mine && tip(e)"
                  :to="{ name: 'pokemon', params: { id: e.id } }"
                  class="chip"
                  :class="{
                    hit: isHit(e) && !onlyFound,
                    boost: e.boost,
                    yours: e.mine,
                    versus: query.vs === chipKey(e),
                  }"
                >
                  <span class="who">
                    <PokemonIcon :id="e.id" />
                    <span>{{ e.species }}</span>
                    <span v-if="e.forme" class="forme">{{ e.forme }}</span>
                  </span>
                  <span v-if="e.mine" class="tags">
                    <span class="tag">{{ t('speed.yoursTag') }}</span>
                    <span class="tag">{{ t(`speed.effect.${myNature}`) }}</span>
                    <span class="tag">{{ t('speed.points', { n: myPoints }) }}</span>
                  </span>
                  <span v-else-if="e.boost" class="tags">
                    <span class="tag boost-label"
                      ><ItemIcon v-if="e.boost.ref.kind === 'item'" :id="e.boost.ref.id" :scale="0.67" />{{
                        boostLabel(e.boost)
                      }}</span
                    >
                    <span v-if="whenTag(e.boost)" class="tag">{{ whenTag(e.boost) }}</span>
                    <span class="tag">{{ percent(e.share!) }}</span>
                  </span>
                  <span v-else-if="!e.bench" class="tags">
                    <span class="tag">{{ natureName(e.nature!) }}</span>
                    <span class="tag">{{ t('speed.points', { n: e.points! }) }}</span>
                    <span class="tag">{{ percent(e.share!) }}</span>
                  </span>
                </AppLink>
              </li>
            </ul>
          </li>
        </ol>

        <!-- Outside the page so the page transition's transform can't move it. -->
        <Teleport to="body">
          <AnimatePresence>
            <motion.div
              v-if="versus && !side"
              key="versus"
              class="versus-card small"
              role="status"
              :initial="{ opacity: 0, y: 8 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: 8 }"
              :transition="FADE"
            >
              <p>
                <strong
                  ><template v-for="(part, i) in vsTitle" :key="i"
                    ><template v-if="typeof part === 'string'">{{ part }}</template
                    ><AppLink
                      v-else-if="part.slot === 'name'"
                      :to="{ name: 'pokemon', params: { id: versus.e.id } }"
                      class="vs-mon"
                      ><PokemonIcon :id="versus.e.id" />{{
                        [versus.e.species, versus.e.forme].filter(Boolean).join(' ')
                      }}</AppLink
                    ><template v-else>{{ versus.target }}</template></template
                  ></strong
                >
                <button type="button" class="link-button" @click="set('vs', undefined)">
                  {{ t('speed.vsClose') }}
                </button>
              </p>
              <dl>
                <template v-for="v in versus.byEffect" :key="v.effect">
                  <dt>{{ t(`speed.effect.${v.effect}`) }}</dt>
                  <dd>{{ versusText(v.result) }}</dd>
                </template>
              </dl>
            </motion.div>
            <motion.button
              v-else-if="match"
              key="match"
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

        <p v-if="showMegas" class="muted small note">{{ t('speed.megaNote') }}</p>
        <p v-if="!showAll && snapshot" class="muted small note">
          {{ t('usage.from') }} <a :href="snapshot.provider.url" rel="noopener">{{ snapshot.provider.name }}</a>
        </p>
      </div>
      <!-- Your Pokémon: where it lands among the others, and what it takes to move before one of them. A sidebar that
           stays in view beside the ladder on wide screens, so tapping a chip anywhere shows the answer; above it, narrower. -->
      <details
        class="panel banded yours instant"
        :open="side || yoursOpen"
        @toggle="!side && (yoursOpen = isOpen($event))"
      >
        <!-- A heading that opens and closes the card on phones; beside the ladder it's always open. -->
        <summary class="yours-title" @click.prevent="!side && toggleYours()">
          <span class="marker yours-marker" aria-hidden="true">{{ yoursOpen ? '▾' : '▸' }}</span>
          {{ t('speed.yours') }}
          <PokemonIcon v-if="mine" :id="mine" :scale="0.75" class="yours-icon" />
        </summary>
        <div class="yours-pick">
          <PokemonPicker
            :model-value="mine"
            :placeholder="t('speed.yoursPick')"
            list-width-of=".yours-pick"
            @update:model-value="pickMine"
          />
          <button v-if="mine" type="button" class="btn" @click="clearMine">{{ t('speed.clear') }}</button>
        </div>
        <p v-if="!mine" class="muted small wide-only yours-intro">{{ t('speed.yoursIntro') }}</p>
        <template v-else>
          <!-- Its Speed, right under the pick, following the build below as it changes; a tap shows where it landed on
               the ladder. -->
          <button type="button" class="btn primary big-go" @click="toMine">
            <span class="big-go-speed">{{ mySpeed }}</span>
            <span>{{ t('speed.showYours') }}</span>
          </button>
          <!-- Narrower, the ladder is under this card, its opponents band out of view: a way to it, said as it's
               picked. -->
          <button v-if="!side" type="button" class="btn opponents-go" @click="toOpponents">
            <span class="opponents-tag">{{ t('speed.opponentsHead') }}</span>
            <span>{{ t('speed.opponentsGo') }}</span>
          </button>
          <!-- Its build and modifiers, then what they come to: each a section of its own, labeled above. -->
          <section class="yours-section">
            <SegmentedControl
              class="stacked"
              :model-value="myNature"
              :label="t('speed.natureLabel')"
              :options="
                NATURE_EFFECTS.map((e) => ({
                  value: e,
                  label: t(`speed.effect.${e}`),
                  icon: EFFECT_ICONS[e],
                  short: t('stat.spe'),
                }))
              "
              @update:model-value="(v: string) => setMyNature(v as NatureEffect)"
            />
            <p class="muted small">{{ naturesOf(myNature) }}</p>
          </section>
          <section class="yours-section">
            <label class="yours-field">
              <span class="muted small">{{ t('speed.pointsLabel') }}</span>
              <span class="yours-points">
                <input
                  type="range"
                  min="0"
                  :max="MAX_POINTS"
                  :value="myPoints"
                  @input="setMyPoints(($event.target as HTMLInputElement).value)"
                />
                <input
                  type="number"
                  class="points-box"
                  min="0"
                  :max="MAX_POINTS"
                  :value="myPoints"
                  @change="setMyPoints(($event.target as HTMLInputElement).value)"
                />
              </span>
            </label>
          </section>
          <section class="yours-section">
            <button type="button" class="disclosure" :aria-expanded="myModsOpen" @click="toggleMyMods">
              <span class="marker" aria-hidden="true">{{ myModsOpen ? '▾' : '▸' }}</span
              >{{ t('speed.modifiers') }}
            </button>
            <div v-if="myModsOpen" class="mods">
              <button
                v-for="k in MY_TOGGLES"
                :key="k"
                v-tip="canHover && t(`speed.modTip.${k}`)"
                type="button"
                class="btn mod"
                :class="{ on: myToggles.has(k) }"
                :aria-pressed="myToggles.has(k)"
                @click="toggleMine(k)"
              >
                {{ t(`speed.mod.${k}`) }}
              </button>
            </div>
            <SegmentedControl
              v-if="myModsOpen"
              :model-value="myStage"
              :label="t('speed.stage')"
              :options="STAGES.map((s) => ({ value: s, label: stageLabel(s) }))"
              @update:model-value="(v: string) => setMyStage(v)"
            />
          </section>
          <section v-if="summary || (versus && side)" class="yours-section">
            <p v-if="summary" class="small">
              {{
                t('speed.summary', {
                  first: percent(summary.first),
                  ties: percent(summary.ties),
                  after: percent(summary.after),
                })
              }}
              <span class="muted">{{
                showAll ? t('speed.summaryAll', { bench: benchLabel(bench) }) : t('speed.summaryMeta', { n: TOP })
              }}</span>
            </p>
            <!-- Narrower, the comparison shows in its card over the ladder instead. -->
            <div v-if="versus && side" class="versus small">
              <p>
                <strong
                  ><template v-for="(part, i) in vsTitle" :key="i"
                    ><template v-if="typeof part === 'string'">{{ part }}</template
                    ><AppLink
                      v-else-if="part.slot === 'name'"
                      :to="{ name: 'pokemon', params: { id: versus.e.id } }"
                      class="vs-mon"
                      ><PokemonIcon :id="versus.e.id" />{{
                        [versus.e.species, versus.e.forme].filter(Boolean).join(' ')
                      }}</AppLink
                    ><template v-else>{{ versus.target }}</template></template
                  ></strong
                >
              </p>
              <dl>
                <template v-for="v in versus.byEffect" :key="v.effect">
                  <dt>{{ t(`speed.effect.${v.effect}`) }}</dt>
                  <dd>{{ versusText(v.result) }}</dd>
                </template>
              </dl>
            </div>
          </section>
        </template>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* The heading's row: the heading, what's active (taking what room is left, on one line, scrolling sideways when it
   doesn't fit), and the toggle at the end. On phones, what's active goes to a line of its own. */
.head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'title active fold';
  align-items: center;
  gap: 4px 12px;
  list-style: none;
  cursor: pointer;
}
.head::-webkit-details-marker {
  display: none;
}
.opponents {
  font-weight: normal;
  color: var(--muted);
}
.head h1 {
  grid-area: title;
  margin: 0;
}
.active {
  grid-area: active;
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: none;
  list-style: none;
}
.active::-webkit-scrollbar {
  display: none;
}
.active li {
  flex: none;
  padding: 1px 6px;
  font-size: 0.85em;
  white-space: nowrap;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
}
.fold {
  grid-area: fold;
  font-weight: bold;
  white-space: nowrap;
}
/* These sections open and close at once, without the slide and fade collapsible sections have (main.css). Their
   headings take taps as taps: quick ones neither select the text nor zoom. */
.instant::details-content,
.instant > summary {
  transition: none;
}
.instant > summary {
  touch-action: manipulation;
  user-select: none;
}
.fold-body {
  padding-top: 8px;
}
@media (max-width: 720px) {
  .head {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'title fold' 'active active';
  }
}
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
  max-width: 30em;
}
.find :deep(.search-box) {
  max-width: none;
}
/* The options: a grid of switches (buttons holding their checkbox) and the modifiers' disclosure, as wide as the
   widest of them, each with what it does beside it; on phones, under it. */
.options {
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: 4px 10px;
}
.switch {
  justify-content: flex-start;
  gap: 6px;
  font-weight: bold;
}
.switch.on {
  background: var(--sel);
}
.switch input {
  margin: 0;
}
.disclosure {
  margin-top: 6px;
  padding: 0;
  font: inherit;
  font-weight: bold;
  text-align: left;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
.disclosure + .muted {
  margin-top: 6px;
}
/* The disclosures' arrows: as large as the text, close to it, in a column as wide as either so the text doesn't shift
   when one turns. */
.marker {
  display: inline-block;
  width: 0.85em;
  font-size: 1.15em;
  line-height: 1;
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
/* The modifiers that apply to everyone, under the options, across both columns. */
.all-mods {
  grid-column: 1 / -1;
  padding: 8px;
  background: var(--panel-alt);
  border: 1px dashed var(--border-strong);
}
.small {
  font-size: calc(13px * var(--text-scale));
}
/* On phones, runs to the panel's edges (`--panel-bleed`), so the row lines and a picked row's highlight meet its
   border. */
.ladder {
  margin: 0 calc(-1 * var(--panel-bleed));
  padding: 0;
  list-style: none;
}
/* A Speed, and the Pokémon at it: the number in a column of its own, the chips wrapping beside it. The band over the
   ladder's header heads that column too. */
.list {
  --speed-col: 2.2em;
}
/* The opponents band: red, on top of the panel. Beats retro.css's bands. */
:root:root .list.banded > .band.opponents-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin-bottom: 0;
  color: var(--opponent-text);
  background: var(--opponent);
}
/* The panel's bands, stacked: the opponents' (with yours picked), the find's, the ladder's header on the rows. */
:root:root .list.banded > .band.find-row {
  margin-bottom: 0;
  padding-block: 8px;
}
:root:root .list.banded > .opponents-head + .band.find-row,
:root:root .list.banded > .band.ladder-head {
  margin-top: 0;
}
:root:root .list.banded > .band.ladder-head {
  margin-bottom: 0;
}
/* The find's band and the header: the panel's own color, darker, rather than the accent's tint. */
:root:root .list.banded > .band:is(.find-row, .ladder-head) {
  background: color-mix(in srgb, var(--ink) 25%, var(--panel));
}
/* The ladder's header: its columns' labels, its first, the stat's shorthand, bold, over the Speeds. */
.ladder-head {
  display: grid;
  grid-template-columns: var(--speed-col) 1fr auto;
  align-items: baseline;
  gap: 8px;
}
.ladder-head > :first-child {
  font-weight: bold;
  text-align: right;
}
/* The find's band. */
.find-row {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: none;
}
/* The toggle as tall as the search beside it. */
.find-row > .find-mode {
  align-self: stretch;
}
/* The found Pokémon's icon over the toggle's padding, so the toggle takes the height around it: the search's in its
   row, the switches' pinned. */
.find-mode :deep(.sheet-icon) {
  margin-block: -6px;
}
/* The search takes what the toggle leaves. */
.find.find-row > .picker {
  flex: 1 1 0;
  min-width: 0;
}
/* The band's line stands in for the first Speed's. */
.tier:first-child {
  border-top: none;
}
.tier {
  display: grid;
  grid-template-columns: var(--speed-col) 1fr;
  align-items: start;
  gap: 8px;
  padding: 4px var(--panel-bleed);
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
  /* As wide as the ladder. */
  margin-inline: calc(-1 * var(--panel-bleed));
}
.pinned {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px var(--panel-bleed);
  background: var(--panel);
  border-bottom: 1px solid var(--border-strong);
}
.pinned .short {
  display: none;
}
/* The find, how it shows beside it, the search taking what the switches leave, as in its row. */
.pinned .find {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: none;
}
.pinned .find > .picker {
  flex: 1 1 0;
  min-width: 0;
}
/* On phones, one line: the search takes what the compact switches leave. */
@media (max-width: 720px) {
  .pinned {
    gap: 6px;
  }
  .pinned .find {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
  }
  /* No room for how a find shows beside it, the switches too: the find's row has it. */
  .pinned .find-mode {
    display: none;
  }
  .pinned .switch {
    flex: none;
    padding-inline: 6px;
  }
  .pinned .long {
    display: none;
  }
  .pinned .short {
    display: inline;
  }
}
/* Your Pokémon's Speed: one big primary button, its number large. */
.big-go {
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  padding: 4px 12px;
  font-weight: bold;
}
/* The opponents band, in short, on the button to them. */
.opponents-tag {
  flex: none;
  padding: 1px 6px;
  font-size: 0.8125em;
  font-weight: bold;
  color: var(--opponent-text);
  background: var(--opponent);
  border: 1px solid var(--ink);
}
/* The way to the opponents: a plain button beside yours' primary one, in red. */
.opponents-go {
  justify-content: space-between;
  width: 100%;
  margin-top: 8px;
  padding: 4px 6px 4px 4px;
  font-weight: bold;
  color: var(--bad);
}
/* The find, flashed once in the opponents' red after the page scrolls to it. */
.find-row.flash :deep(.search) {
  animation: find-flash 1.2s ease-out 0.35s;
}
@keyframes find-flash {
  30% {
    box-shadow: 0 0 0 3px var(--opponent);
  }
}
.big-go-speed {
  font-size: 1.75em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
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
/* The ladder and yours: side by side from 1100px, yours sticking in view; narrower, yours above the ladder. */
.speed-layout {
  display: flex;
  flex-direction: column;
}
.yours {
  order: -1;
}
@media (min-width: 1100px) {
  .speed-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 21em;
    align-items: start;
    gap: 0 12px;
  }
  .yours {
    order: 0;
    position: sticky;
    top: 12px;
  }
}
/* The comparison's card, at the bottom of the screen where yours isn't beside the ladder. */
.versus-card {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 10;
  max-width: 32em;
  margin: 0 auto;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
}
.versus-card p {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
  margin: 0;
}
.versus-card dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 6px 0 0;
}
.versus-card dd {
  margin: 0;
}
.yours-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.yours-pick .picker {
  flex: 1 1 12em;
  max-width: 20em;
}
/* Its heading, with an arrow drawn as the modifiers' is, rather than the browser's marker. */
.yours-title {
  display: flex;
  align-items: center;
  gap: 4px;
  list-style: none;
  font-weight: bold;
  cursor: pointer;
}
/* Yours' icon in the band, right after the heading (its cell has room of its own around the sprite), at three quarters
   of its size to fit the band, and taking no height of its own, so the band is as tall with it as without. */
.yours-icon {
  margin-block: -6px;
}
.yours-title::-webkit-details-marker {
  display: none;
}
@media (min-width: 1100px) {
  .yours-title {
    cursor: default;
  }
  .yours-marker {
    display: none;
  }
}
/* Its sections, each under a line, its parts spaced evenly, a label above what it labels. */
.yours-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.yours-section > .disclosure {
  margin-top: 0;
}
.yours-section > p,
.yours p.small {
  margin: 0;
}
.yours p.yours-intro {
  margin-top: 10px;
}
.yours-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
}
.yours-points {
  display: flex;
  align-items: center;
  gap: 10px;
}
.yours-points input[type='range'] {
  flex: 1;
  min-width: 0;
}
/* The nature's choice under its label, its options each on one line. */
.yours .stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.stacked :deep(.segments label) {
  white-space: nowrap;
}
/* Its modifiers smaller than the ones for everyone, as the panel is narrow. */
.yours .mod {
  padding: 3px 8px;
  font-size: 0.875em;
}
.points-box {
  width: 4em;
  font: inherit;
}
.versus {
  margin: 0;
}
.versus p {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0;
}
/* The Pokémon it's against, in its title: its name on the text's line, its icon centered on it. */
.vs-mon {
  white-space: nowrap;
}
.vs-mon :deep(.sheet-icon) {
  margin-block: -6px;
}
.versus dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 4px 0 0;
}
.versus dd {
  margin: 0;
}
.link-button {
  padding: 0;
  font: inherit;
  color: var(--link);
  background: none;
  border: none;
  cursor: pointer;
}
/* Yours on the ladder: solid and strong; the one it's measured against, picked. */
.chip.yours {
  border: 2px solid var(--text);
  font-weight: bold;
}
.chip.versus {
  background: var(--sel);
  border-color: var(--text);
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
/* A chip: who (icon, name, forme), then its tags, which go under it when the two don't fit on a line. */
.chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  max-width: 100%;
  padding: 0 6px 0 2px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.who,
.tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.who {
  white-space: nowrap;
}
.tags {
  flex-wrap: wrap;
}
.tag {
  white-space: nowrap;
}
/* On phones only: what wider screens show in a tooltip, or beside what it explains. */
.phone-only,
.phone-only-block {
  display: none;
}
/* The intro's line: the intro, then the toggle for how to read the page, a link rather than a control. */
.lede {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}
.help-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
  align-self: center;
}
/* Ink rather than a link's blue, which nothing else on the page has: dotted, as what explains, solid on hover. */
.help-toggle > span {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.help-toggle:hover > span {
  text-decoration-style: solid;
}
.help-toggle > .lucide {
  color: var(--muted);
}
/* How to read the page, in a well between the intro and the controls. */
.help-body {
  margin: 0 0 12px;
  padding: 8px 10px;
}
.help-body > :is(.legend, p) {
  margin-top: 0;
}
.help-body > .formula {
  margin-bottom: 8px;
}
.help-body .legend dd:last-child {
  margin-bottom: 0;
}
.help-options {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 8px 0 0;
}
.help-options dt {
  font-weight: bold;
}
.help-options dd {
  margin: 0;
}
@media (max-width: 720px) {
  .phone-only {
    display: inline;
  }
  .phone-only-block {
    display: block;
  }
  .wide-only {
    display: none;
  }
  .help-body .phone-only-block > :first-child {
    margin-top: 0;
  }
  /* Under the intro and the options. */
  .help-body > .legend {
    margin-top: 12px;
  }
  .help-body > p {
    margin-top: 1em;
  }
  .help-options {
    grid-template-columns: 1fr;
  }
  .help-options dd {
    margin-bottom: 4px;
  }
  /* The switches and the modifiers' disclosure in a row, their descriptions in the section above. */
  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .options > .muted {
    display: none;
  }
  .disclosure {
    margin-top: 6px;
  }
  .all-mods {
    flex-basis: 100%;
  }
  /* Each legend sample's description under it rather than squeezed beside it. */
  .help-body .legend {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .help-body .legend dd {
    margin-bottom: 8px;
  }
  /* The tags under the name, with room beside the icon. */
  .chip {
    padding-bottom: 2px;
  }
  .tags {
    padding-left: 4px;
  }
}
.forme,
.tag {
  font-size: 0.85em;
  color: var(--muted);
}
.tag + .tag::before {
  content: '·';
  margin-right: 4px;
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
  border-color: var(--muted);
}
/* Finding a Pokémon: its chips marked, the Speeds without it faded. */
.chip.hit {
  background: var(--sel);
  border-color: var(--border-strong);
}
.chip.boost.hit {
  border-color: var(--muted);
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
  margin-left: calc(var(--speed-col) + 8px);
  background: var(--border);
  border-radius: 2px;
  opacity: 0.6;
}
.note {
  margin: 12px 0 0;
}
/* Nothing below the top panel's last line but its padding. */
.help-body > :last-child {
  margin-bottom: 0;
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
.note + .note {
  margin-top: 4px;
}
</style>
