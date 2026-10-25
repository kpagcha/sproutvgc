<script setup lang="ts">
// The speed quiz: who moves first, or a tie, between two Pokémon (`lib/speedQuiz.ts`). Questions come from the
// reader's level and build stage, saved pairs that are due coming first (`srs.ts`, a deck of its own).
import { computed, reactive, ref, shallowRef, triggerRef, watch } from 'vue'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { availableIds, pokemon, type PokemonId } from '@/data/dex'
import { has, pastRoster, snapshots } from '@/data/meta'
import { locale, t, type MessageKey } from '@/i18n'
import { refName } from '@/i18n/refName'
import { LEARN_STEPS, deckStats, emptyDeck, grade, loadDeck, pickNext, saveDeck } from '@/lib/srs'
import {
  DECK_KEY,
  DOWN_MISSES,
  EARLIER_EVERY,
  EASIER_EVERY,
  LEVELS,
  LEVEL_GAPS,
  MISS_MAX,
  POOLS,
  QUICK_MS,
  QUICK_RUN,
  STAGES,
  STREAK_UP,
  TIE_EVERY,
  TOP_SHARES,
  UNLOCK_LEVEL,
  UNLOCK_RIGHT,
  WINDOW,
  activeStages,
  defaultSettings,
  emptyProgress,
  fromCard,
  generate,
  ladderAround,
  levelOf,
  gap,
  loadProgress,
  loadSettings,
  normalize,
  poolIds,
  record,
  saveProgress,
  saveSettings,
  sidesAt,
  levelAt,
  lately,
  standingOf,
  type Question,
  type QuizEvent,
  type Stage,
  type SpeedQuizSettings,
  type Weighted,
} from '@/lib/speedQuiz'
import ChoiceDialog from '@/components/ChoiceDialog.vue'
import MetaDialog from '@/components/MetaDialog.vue'
import PokemonIcon from '@/components/PokemonIcon'
import SpeedQuizCard from '@/components/SpeedQuizCard.vue'
import { useMeta } from '@/composables/useMeta'
import { confirmDialog } from '@/composables/useConfirm'
import { useOpenState } from '@/composables/useOpenState'

const { snapshot, data } = useMeta()

const settings = ref(loadSettings())
// Closed until the reader opens them, then as they left them.
const { open: settingsOpen, onToggle: onSettingsToggle } = useOpenState('sproutvgc.speedQuiz.settingsOpen', false)
const progress = reactive(loadProgress())
const deck = shallowRef(loadDeck(DECK_KEY))

/** Whether the data shown has its Pokémon's sets: without, uninvested alone. */
const hasSets = computed(() => !!snapshot.value && has(snapshot.value, 'speeds') && !!data.value)
/** Waiting for the data shown, which says who the most used are. */
const waiting = computed(() => !!snapshot.value && !data.value)
const regulationIds = computed<readonly PokemonId[]>(
  () => (snapshot.value && pastRoster(snapshot.value.regulation)) ?? availableIds('pokemon'),
)
const ids = computed(() => (waiting.value ? [] : poolIds(settings.value, data.value, regulationIds.value)))
const idSet = computed(() => new Set(ids.value))
const stages = computed(() => activeStages(settings.value, progress.unlocked, hasSets.value))
/** The stage the reader is at: the last asked. */
const stage = computed(() => stages.value[stages.value.length - 1]!)
const closeOnly = computed(() => settings.value.pairs === 'close')
const level = computed(() => (closeOnly.value ? LEVELS : levelAt(progress, stage.value)))

/** Every side at each stage asked, and how often each comes up. */
const sides = computed(() => {
  const out: Partial<Record<Stage, Weighted[]>> = {}
  for (const s of stages.value) out[s] = sidesAt(ids.value, s, data.value, settings.value.topShare, progress.misses)
  return out
})

const percentOf = (share: number) => Math.round(share * 100)
function stageName(s: Stage): string {
  if (s === 'top') return t('speedQuiz.stage.topFrom', { n: percentOf(settings.value.topShare) })
  return t(`speedQuiz.stage.${s}`)
}

// ---- The question shown ----
const current = ref<Question | null>(null)
const round = ref(0)
const answered = ref(false)
const event = ref<QuizEvent | null>(null)
let recent: string[] = []

const chance = (every: number) => Math.random() < 1 / every

/** A saved pair due now, if any the settings still ask about: one being learned whose turn has come, or one due for
 * review. */
function dueReview(): Question | null {
  const d = deck.value
  const skip = (id: string) => !fromCard(id, stages.value, idSet.value, data.value, settings.value.topShare)
  const id = pickNext(d, { newIds: [], avoid: current.value?.id, skip })
  const c = id ? d.cards[id] : undefined
  if (!id || !c || !(c.step >= 0 ? c.learnAt <= d.tick : c.due <= Date.now())) return null
  return fromCard(id, stages.value, idSet.value, data.value, settings.value.topShare)
}

/** A new pair: at an earlier stage one time in `EARLIER_EVERY`, at an easier level one in `EASIER_EVERY` (neither
 * counting), else at the stage's level; at the nearest level with any when that one has none. */
function newQuestion(): Question | null {
  const list = stages.value
  const at =
    list.length > 1 && chance(EARLIER_EVERY) ? list[Math.floor(Math.random() * (list.length - 1))]! : stage.value
  const own = closeOnly.value ? LEVELS : levelAt(progress, at)
  const easier = !closeOnly.value && own > 1 && chance(EASIER_EVERY)
  const want = easier ? 1 + Math.floor(Math.random() * (own - 1)) : own
  const pool = sides.value[at] ?? []
  const avoid = new Set(recent)
  for (let d = 0; d < LEVELS; d++) {
    for (const l of d ? [want - d, want + d] : [want]) {
      if (l < 1 || l > LEVELS) continue
      const q = generate(pool, at, l, avoid)
      if (q) return { ...q, counts: !easier && l === own }
    }
  }
  return null
}

function next() {
  current.value = waiting.value ? null : (dueReview() ?? newQuestion())
  if (current.value) recent = [...recent.slice(-19), current.value.id]
  answered.value = false
  event.value = null
  round.value++
}

const session = reactive({ seen: 0, right: 0, streak: 0 })

function onAnswered(right: boolean, quick: boolean) {
  const q = current.value!
  answered.value = true
  event.value = record(progress, q, right, quick, settings.value, hasSets.value)
  saveProgress(progress)
  // Saved: a miss, a close pair, or one saved already; the rest only move the learning steps' clock.
  const d = deck.value
  const close = levelOf(gap(q.a.speed, q.b.speed)) === LEVELS
  if (d.cards[q.id] || !right || close) grade(d, q.id, right ? (quick ? 5 : 3) : 1)
  else d.tick++
  saveDeck(d, DECK_KEY)
  triggerRef(deck)
  session.seen++
  if (right) session.right++
  session.streak = right ? session.streak + 1 : 0
}

/** The pair on the ladder of its stage's Pokémon. */
const ladder = computed(() => {
  const q = current.value
  if (!q || !answered.value) return []
  const all =
    sides.value[q.stage]?.map((w) => w.side) ??
    sidesAt(ids.value, q.stage, data.value, settings.value.topShare, {}).map((w) => w.side)
  return ladderAround(q, all)
})

// A question the settings no longer ask about is replaced, unless answered; none yet, one comes once there's data.
watch(
  settings,
  (s) => {
    const clean = normalize(s)
    if (JSON.stringify(clean) !== JSON.stringify(s)) {
      settings.value = clean
      return
    }
    saveSettings(s)
    if (!answered.value) next()
  },
  { deep: true },
)
watch(ids, () => {
  if (!current.value || (!answered.value && ![current.value.a, current.value.b].every((x) => idSet.value.has(x.id))))
    next()
})
next()

// ---- Progress ----
const stats = computed(() => {
  void deck.value.tick
  return deckStats(deck.value)
})
const percent = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0)
/** The Pokémon asked about with enough answers to tell, the least known first, each as its standing colors it. */
const mons = computed(() =>
  ids.value
    .flatMap((id) => {
      const r = progress.mons[id]
      const standing = standingOf(r)
      if (!r || standing === 'new') return []
      const share = lately(r)
      const name = refName(pokemon(id))
      const right = Math.round(share * r.last.length)
      const tip = t('speedQuiz.monTip', { name, r: right, n: r.last.length, all: r.right, seen: r.seen })
      return [{ id, share, standing, seen: r.seen, tip }]
    })
    .sort((a, b) => a.share - b.share || b.seen - a.seen),
)
/** The rest of them, too few answers yet to tell, in the order asked about (by usage): shown when asked for. */
const unrated = computed(() =>
  ids.value
    .filter((id) => standingOf(progress.mons[id]) === 'new')
    .map((id) => ({
      id,
      tip: t('speedQuiz.monTipNew', { name: refName(pokemon(id)), seen: progress.mons[id]?.seen ?? 0 }),
    })),
)
const showAll = ref(false)
// Open until the reader closes it, then as they left it.
const { open: monsOpen, onToggle: onMonsToggle } = useOpenState('sproutvgc.speedQuiz.monsOpen', true)

async function reset() {
  if (!(await confirmDialog({ message: t('speedQuiz.resetConfirm'), confirm: t('quiz.reset'), danger: true }))) return
  Object.assign(progress, emptyProgress())
  saveProgress(progress)
  deck.value = emptyDeck(deck.value.newLimit)
  saveDeck(deck.value, DECK_KEY)
  next()
}
// ---- Settings: each a choice, with what each option means ----
const num = (n: number) => n.toLocaleString(locale.value)
interface Choice {
  key: string
  label: string
  value: string
  options: { value: string; label: string; desc: string }[]
  disabled?: boolean
  set: (v: string) => void
}
const choices = computed<Choice[]>(() => {
  const s = settings.value
  const list: Choice[] = [
    {
      key: 'builds',
      label: t('speedQuiz.builds'),
      value: s.builds,
      disabled: !hasSets.value,
      options: [
        { value: 'progressive', label: t('speedQuiz.progressive'), desc: t('speedQuiz.buildsDesc.progressive') },
        ...STAGES.map((st) => ({
          value: st,
          label: t(`speedQuiz.stage.${st}`),
          desc: t(`speedQuiz.buildsDesc.${st}`),
        })),
      ],
      set: (v) => (s.builds = v as SpeedQuizSettings['builds']),
    },
  ]
  if (s.builds === 'progressive')
    list.push({
      key: 'upTo',
      label: t('speedQuiz.upTo'),
      value: s.upTo,
      disabled: !hasSets.value,
      options: (['common', 'top'] as const).map((st) => ({
        value: st,
        label: t(`speedQuiz.stage.${st}`),
        desc: t(`speedQuiz.upToDesc.${st}`),
      })),
      set: (v) => (s.upTo = v as SpeedQuizSettings['upTo']),
    })
  if (s.builds === 'top' || (s.builds === 'progressive' && s.upTo === 'top'))
    list.push({
      key: 'topShare',
      label: t('speedQuiz.topShare'),
      value: String(s.topShare),
      disabled: !hasSets.value,
      options: TOP_SHARES.map((x) => ({
        value: String(x),
        label: t('speedQuiz.share', { n: percentOf(x) }),
        desc: t(`speedQuiz.shareDesc.${percentOf(x)}` as MessageKey),
      })),
      set: (v) => (s.topShare = Number(v)),
    })
  list.push(
    {
      key: 'pairs',
      label: t('speedQuiz.pairs'),
      value: s.pairs,
      options: [
        { value: 'progressive', label: t('speedQuiz.progressive'), desc: t('speedQuiz.pairsDesc.progressive') },
        {
          value: 'close',
          label: t('speedQuiz.closeOnly'),
          desc: t('speedQuiz.pairsDesc.close', { n: num(LEVEL_GAPS[LEVEL_GAPS.length - 1]!) }),
        },
      ],
      set: (v) => (s.pairs = v as SpeedQuizSettings['pairs']),
    },
    {
      key: 'pool',
      label: t('speedQuiz.pool'),
      value: String(s.pool),
      disabled: !snapshot.value,
      options: POOLS.map((p) =>
        p === 'all'
          ? { value: p, label: t('speedQuiz.pool.all'), desc: t('speedQuiz.poolDesc.all') }
          : { value: String(p), label: t('speedQuiz.pool.top', { n: p }), desc: t('speedQuiz.poolDesc.top', { n: p }) },
      ),
      set: (v) => (s.pool = v === 'all' ? 'all' : (Number(v) as SpeedQuizSettings['pool'])),
    },
  )
  return list
})

function restoreDefaults() {
  settings.value = defaultSettings()
}

// ---- How it works: the numbers ----
const levelRows = computed(() =>
  Array.from({ length: LEVELS }, (_, i) => {
    const from = LEVEL_GAPS[i]
    const to = LEVEL_GAPS[i - 1]
    const text =
      from === undefined
        ? t('speedQuiz.about.closest', { n: num(LEVEL_GAPS[i - 1]!), t: TIE_EVERY })
        : to === undefined
          ? t('speedQuiz.about.widest', { n: num(from) })
          : t('speedQuiz.about.range', { from: num(from), to: num(to) })
    return { level: i + 1, text }
  }),
)
</script>

<template>
  <div class="layout">
    <section class="panel card">
      <SpeedQuizCard
        v-if="current"
        :question="current"
        :round="round"
        :event="event"
        :ladder="ladder"
        :stage-name="stageName"
        @answered="onAnswered"
        @next="next"
      />
      <p v-else class="muted done">{{ t(waiting ? 'speedQuiz.loading' : 'speedQuiz.empty') }}</p>
    </section>

    <aside>
      <div class="panel">
        <h2>{{ t('quiz.progress') }}</h2>
        <div class="level">
          <span class="big">{{ closeOnly ? t('speedQuiz.closeOnly') : t('speedQuiz.level', { n: level }) }}</span>
          <span class="muted">{{ stageName(stage) }}</span>
        </div>
        <div v-if="!closeOnly" class="pips" :aria-label="t('speedQuiz.levelOf', { n: level, of: LEVELS })" role="img">
          <span v-for="l in LEVELS" :key="l" :class="{ on: l <= level }" />
        </div>
        <dl class="stats">
          <dt>{{ t('quiz.session') }}</dt>
          <dd class="num">
            {{ session.right }}/{{ session.seen }}
            <span class="muted">({{ percent(session.right, session.seen) }}%)</span>
          </dd>
          <dt>{{ t('practice.streak') }}</dt>
          <dd class="num">{{ session.streak }}</dd>
          <dt>{{ t('speedQuiz.saved') }}</dt>
          <dd class="num">{{ stats.seen }}</dd>
          <dt>{{ t('quiz.learning') }}</dt>
          <dd class="num">{{ stats.learning }}</dd>
          <dt>{{ t('quiz.due') }}</dt>
          <dd class="num">{{ stats.due }}</dd>
        </dl>
        <button type="button" class="btn" @click="reset">{{ t('quiz.reset') }}</button>
      </div>

      <details class="panel settings" :open="settingsOpen" @toggle="onSettingsToggle">
        <summary>{{ t('settings.title') }}</summary>
        <div v-if="snapshots.length" class="setting">
          <span class="muted">{{ t('speedQuiz.data') }}</span>
          <MetaDialog />
        </div>
        <p v-if="!waiting && !hasSets" class="muted">{{ t('speedQuiz.noSets') }}</p>
        <!-- Each a choice of a few, what each means in a line under it. -->
        <div v-for="c in choices" :key="c.key" class="setting">
          <span class="muted" aria-hidden="true">{{ c.label }}</span>
          <ChoiceDialog
            :model-value="c.value"
            :label="c.label"
            :options="c.options"
            :disabled="c.disabled"
            @update:model-value="c.set"
          />
        </div>
        <label class="check">
          <input v-model="settings.megas" type="checkbox" />
          {{ t('speedQuiz.megas') }}
        </label>
        <button type="button" class="btn" @click="restoreDefaults">{{ t('settings.restore') }}</button>
      </details>

      <details class="panel mons" :open="monsOpen" @toggle="onMonsToggle">
        <summary>{{ t('speedQuiz.mons') }}</summary>
        <!-- How well each Pokémon is known: its share right of the latest answers about it. -->
        <ul v-if="mons.length || showAll" class="icons">
          <li v-for="m in mons" :key="m.id" v-tip:group="m.tip" :aria-label="m.tip" :class="m.standing">
            <PokemonIcon :id="m.id" />
            <span class="bar"><span :style="{ width: `${Math.round(m.share * 100)}%` }" /></span>
          </li>
          <template v-if="showAll">
            <li v-for="m in unrated" :key="m.id" v-tip:group="m.tip" :aria-label="m.tip" class="new">
              <PokemonIcon :id="m.id" />
              <span class="bar" />
            </li>
          </template>
        </ul>
        <button
          v-if="unrated.length"
          type="button"
          class="show-all"
          :aria-pressed="showAll"
          @click="showAll = !showAll"
        >
          <component :is="showAll ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />{{
            showAll ? t('speedQuiz.showFewer') : t('speedQuiz.showAll', { n: unrated.length })
          }}
        </button>
      </details>

      <details class="panel about">
        <summary>{{ t('quiz.howItWorks') }}</summary>
        <h3>{{ t('speedQuiz.about.levelsTitle') }}</h3>
        <p class="muted">{{ t('speedQuiz.about.levels') }}</p>
        <dl class="levels">
          <template v-for="r in levelRows" :key="r.level">
            <dt>{{ r.level }}</dt>
            <dd class="muted">{{ r.text }}</dd>
          </template>
        </dl>
        <h3>{{ t('speedQuiz.about.moveTitle') }}</h3>
        <ul class="muted">
          <li>{{ t('speedQuiz.about.up', { n: STREAK_UP, s: num(QUICK_MS / 1000), q: QUICK_RUN }) }}</li>
          <li>{{ t('speedQuiz.about.down', { n: DOWN_MISSES, w: WINDOW }) }}</li>
          <li>{{ t('speedQuiz.about.easier', { n: EASIER_EVERY }) }}</li>
        </ul>
        <h3>{{ t('speedQuiz.about.buildsTitle') }}</h3>
        <p class="muted">
          {{
            t('speedQuiz.about.builds', {
              r: UNLOCK_RIGHT,
              w: WINDOW,
              l: LEVELS,
              start: UNLOCK_LEVEL,
              e: EARLIER_EVERY,
            })
          }}
        </p>
        <p class="muted">{{ t('speedQuiz.about.weights', { n: MISS_MAX }) }}</p>
        <h3>{{ t('speedQuiz.about.reviewTitle') }}</h3>
        <p class="muted">{{ t('speedQuiz.about.review', { a: LEARN_STEPS[0]!, b: LEARN_STEPS[1]! }) }}</p>
        <p class="muted">{{ t('speedQuiz.about.reset') }}</p>
      </details>
    </aside>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}
@media (max-width: 760px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

.card {
  min-height: 260px;
}
@media (max-width: 760px) {
  .card {
    min-height: 0;
  }
}
.done {
  text-align: center;
  padding: 40px 0;
}

.level {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 6px;
}
.level .big {
  font-family: var(--font-display, inherit);
  font-size: calc(16px * var(--text-scale));
  font-weight: bold;
}
.pips {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 3px;
  margin-bottom: 10px;
}
.pips span {
  height: 6px;
  border: 1px solid var(--border-strong);
  background: var(--panel-alt);
}
.pips span.on {
  background: var(--accent);
  border-color: var(--accent);
}

.stats {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  margin: 0 0 10px;
}
.stats dt {
  color: var(--muted);
}
.stats dd {
  margin: 0;
  text-align: right;
  font-weight: bold;
}

.settings .setting {
  display: grid;
  gap: 2px;
  margin-bottom: 8px;
}
/* The choices as wide as the panel, what's picked at the left and the arrow at the right. */
.settings .setting :deep(.choice-dialog),
.settings .setting :deep(.toggle) {
  width: 100%;
}
.settings .setting :deep(.toggle) {
  justify-content: space-between;
}
.settings .check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.settings p {
  margin: 0 0 8px;
}

.icons {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}
.icons li {
  display: grid;
  justify-items: center;
  gap: 1px;
}
.icons .weak {
  --tone: var(--bad);
}
.icons .fair {
  --tone: var(--gold);
}
.icons .solid {
  --tone: var(--good);
}
.icons .new {
  opacity: 0.5;
}
.show-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 2px;
  font: inherit;
  font-size: 0.9em;
  font-weight: bold;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}
.show-all:hover {
  color: var(--text);
  background: var(--hover);
}
/* The share right lately, under its icon. */
.bar {
  width: 32px;
  height: 4px;
  border: 1px solid var(--border-strong);
  background: var(--panel-alt);
}
.bar span {
  display: block;
  height: 100%;
  background: var(--tone);
}

.settings summary,
.mons summary,
.about summary {
  cursor: pointer;
  font-family: var(--font-display, inherit);
  font-weight: bold;
}
.settings[open] summary,
.mons[open] summary,
.about[open] summary {
  margin-bottom: 10px;
}
.about h3 {
  margin: 12px 0 4px;
  font-size: inherit;
}
.about h3:first-of-type {
  margin-top: 0;
}
.about p,
.about ul {
  margin: 0 0 6px;
}
.about ul {
  padding-left: 16px;
}
.levels {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 10px;
  margin: 0 0 6px;
}
.levels dt {
  font-weight: bold;
}
.levels dd {
  margin: 0;
}
</style>
